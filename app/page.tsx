"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Draft, DraftFromServer, Person } from "@/lib/types";
import {
  loadDrafts,
  loadPasscode,
  loadPeople,
  newId,
  saveDrafts,
  savePasscode,
  savePeople,
} from "@/lib/storage";
import { findPerson, normalize, smsHref } from "@/lib/people";
import { speechSupported, startListening, type Listener } from "@/lib/speech";

type View = "home" | "listening" | "compose" | "drafting";

const PENDING_KEY = "talksoon.pending.v1";

function loadPending(): string {
  try {
    return localStorage.getItem(PENDING_KEY) ?? "";
  } catch {
    return "";
  }
}
function savePending(text: string) {
  try {
    if (text) localStorage.setItem(PENDING_KEY, text);
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("home");
  const [people, setPeople] = useState<Person[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [liveText, setLiveText] = useState("");
  const [composeText, setComposeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [whoIsDraftId, setWhoIsDraftId] = useState<string | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [askPasscode, setAskPasscode] = useState(false);
  const listener = useRef<Listener | null>(null);

  // Load saved state once, on the phone.
  useEffect(() => {
    setPeople(loadPeople());
    setDrafts(loadDrafts());
    const pending = loadPending();
    if (pending) {
      setComposeText(pending);
      setError("You have a memo that didn't get drafted yet. Tap Make my texts to try again.");
      setView("compose");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) savePeople(people);
  }, [people, ready]);
  useEffect(() => {
    if (ready) saveDrafts(drafts);
  }, [drafts, ready]);

  // ---------- Drafting ----------

  const makeTexts = useCallback(
    async (transcript: string) => {
      const text = transcript.trim();
      if (!text) {
        setError("I didn't catch anything. Try again, or type it.");
        setView("compose");
        return;
      }
      savePending(text); // Never lose a memo, even if there's no signal.
      setComposeText(text);
      setError(null);
      setView("drafting");

      try {
        const res = await fetch("/api/draft", {
          method: "POST",
          headers: { "content-type": "application/json", "x-passcode": loadPasscode() },
          body: JSON.stringify({
            transcript: text,
            // Names and nicknames only. Phone numbers stay on your phone.
            people: people.map(({ id, name, aliases }) => ({ id, name, aliases })),
          }),
        });

        if (res.status === 401) {
          setAskPasscode(true);
          setView("compose");
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          messages?: DraftFromServer[];
          error?: string;
        };
        if (!res.ok || !data.messages) {
          throw new Error(data.error || "Couldn't draft that. Try again.");
        }
        if (data.messages.length === 0) {
          setError("I didn't hear anyone to text. Try saying who it's for, like “tell Hannah…”.");
          setView("compose");
          return;
        }

        const now = Date.now();
        const fresh: Draft[] = data.messages.map((m) => ({
          id: newId(),
          spokenAs: m.spoken_as,
          personId: m.person_id ?? findPerson(people, m.spoken_as)?.id ?? null,
          message: m.message,
          createdAt: now,
          sentAt: null,
        }));
        setDrafts((d) => [...fresh, ...d]);
        savePending("");
        setComposeText("");
        setView("home");
      } catch (e) {
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        setError(
          offline
            ? "No signal right now. Your memo is saved — tap Make my texts when you're back online."
            : e instanceof Error
              ? e.message
              : "Couldn't draft that. Try again.",
        );
        setView("compose");
      }
    },
    [people],
  );

  // ---------- Listening ----------

  const startTalking = () => {
    setError(null);
    setLiveText("");
    if (!speechSupported()) {
      setView("compose");
      return;
    }
    const l = startListening({
      onText: setLiveText,
      onFatalError: (msg) => {
        listener.current = null;
        setError(msg);
        setView("compose");
      },
    });
    if (!l) {
      setView("compose");
      return;
    }
    listener.current = l;
    setView("listening");
  };

  const doneTalking = async () => {
    const l = listener.current;
    listener.current = null;
    setView("drafting"); // Show progress right away while the last words land.
    const text = l ? await l.stop() : "";
    void makeTexts(text || liveText);
  };

  const cancelTalking = () => {
    listener.current?.cancel();
    listener.current = null;
    setView("home");
  };

  // ---------- Drafts & people ----------

  const updateDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const removeDraft = (id: string) => setDrafts((ds) => ds.filter((d) => d.id !== id));

  /** Link a spoken name ("mother-in-law") to a person, for this draft and all others like it. */
  const assignPerson = (draftId: string, spokenAs: string, person: Person) => {
    const key = normalize(spokenAs);
    const isAlias = key && key !== normalize(person.name) && !person.aliases.some((a) => normalize(a) === key);
    const updated: Person = isAlias ? { ...person, aliases: [...person.aliases, key] } : person;

    setPeople((ps) => (ps.some((p) => p.id === updated.id) ? ps.map((p) => (p.id === updated.id ? updated : p)) : [...ps, updated]));
    setDrafts((ds) =>
      ds.map((d) =>
        d.id === draftId || (d.personId === null && d.sentAt === null && normalize(d.spokenAs) === key)
          ? { ...d, personId: updated.id }
          : d,
      ),
    );
    setWhoIsDraftId(null);
  };

  const unsent = drafts.filter((d) => d.sentAt === null);
  const sent = drafts.filter((d) => d.sentAt !== null);
  const whoIsDraft = drafts.find((d) => d.id === whoIsDraftId) ?? null;
  const personFor = (d: Draft) => people.find((p) => p.id === d.personId) ?? null;

  if (!ready) return <main className="app" />;

  return (
    <main className="app">
      {view === "listening" && (
        <div className="listening" role="dialog" aria-label="Listening">
          <div className={`live-text ${liveText ? "" : "placeholder"}`} aria-live="polite">
            {liveText || "Listening… say who and what. “Tell Hannah I’ve been thinking about her…”"}
          </div>
          <button className="done-btn" onClick={doneTalking}>
            Done
          </button>
          <button className="link-btn muted" onClick={cancelTalking}>
            Cancel
          </button>
        </div>
      )}

      <header className="topbar">
        <span className="brand">Talk Soon</span>
        <button className="link-btn" onClick={() => setShowPeople(true)}>
          People{people.length ? ` (${people.length})` : ""}
        </button>
      </header>

      {view === "drafting" && (
        <section className="hero" aria-live="polite">
          <div className="spinner" />
          <p className="hint">Writing your texts…</p>
        </section>
      )}

      {view === "compose" && (
        <section className="compose">
          <h2>What do you want to say?</h2>
          {error && <div className="banner error">{error}</div>}
          {!error && !speechSupported() && (
            <div className="banner">Tap the text box, then the 🎤 on your keyboard to talk.</div>
          )}
          <textarea
            className="big"
            value={composeText}
            onChange={(e) => {
              setComposeText(e.target.value);
              savePending(e.target.value);
            }}
            placeholder="Tell Hannah I've been thinking about her and sending so much love…"
            autoFocus={!composeText}
          />
          <button className="primary" disabled={!composeText.trim()} onClick={() => makeTexts(composeText)}>
            Make my texts
          </button>
          <button
            className="link-btn muted"
            onClick={() => {
              setError(null);
              setView("home");
            }}
          >
            Back
          </button>
        </section>
      )}

      {view === "home" && (
        <>
          <section className="hero">
            <button className="talk-btn" onClick={startTalking} aria-label="Tap to talk">
              <MicIcon />
              Tap to talk
            </button>
            <p className="hint">Say who and what. I’ll draft the texts — you send them when you’re parked.</p>
            <button
              className="link-btn muted"
              onClick={() => {
                setError(null);
                setView("compose");
              }}
            >
              or type it
            </button>
          </section>

          {error && <div className="banner error">{error}</div>}

          <section>
            <h2 className="section-title">Ready to send{unsent.length ? ` · ${unsent.length}` : ""}</h2>
            {unsent.length === 0 ? (
              <p className="empty">Nothing waiting. Who’s on your mind?</p>
            ) : (
              <div className="cards">
                {unsent.map((d) => {
                  const person = personFor(d);
                  return (
                    <article className="card" key={d.id}>
                      <div className="card-head">
                        <div className="to">
                          {person ? person.name : d.spokenAs}
                          {person && normalize(person.name) !== normalize(d.spokenAs) && <small>{d.spokenAs}</small>}
                          {!person && <small>who’s this?</small>}
                        </div>
                        <button className="icon-btn" aria-label="Delete draft" onClick={() => removeDraft(d.id)}>
                          ×
                        </button>
                      </div>
                      <textarea
                        value={d.message}
                        aria-label={`Message to ${person?.name ?? d.spokenAs}`}
                        rows={Math.min(8, Math.max(2, Math.ceil(d.message.length / 34)))}
                        onChange={(e) => updateDraft(d.id, { message: e.target.value })}
                      />
                      <div className="card-actions">
                        {person ? (
                          <a
                            className="primary"
                            href={smsHref(person.phone, d.message)}
                            onClick={() => updateDraft(d.id, { sentAt: Date.now() })}
                          >
                            Send to {person.name.split(" ")[0]}
                          </a>
                        ) : (
                          <>
                            <button className="primary" onClick={() => setWhoIsDraftId(d.id)}>
                              Who’s this?
                            </button>
                            <a
                              className="secondary"
                              href={smsHref("", d.message)}
                              onClick={() => updateDraft(d.id, { sentAt: Date.now() })}
                            >
                              Just send
                            </a>
                          </>
                        )}
                      </div>
                      {person && (
                        <button className="link-btn muted" style={{ alignSelf: "flex-start", padding: 0, minHeight: 0 }} onClick={() => setWhoIsDraftId(d.id)}>
                          Not {person.name.split(" ")[0]}?
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {sent.length > 0 && (
            <section style={{ marginTop: 20 }}>
              <h2 className="section-title">Sent today</h2>
              {sent.map((d) => (
                <div className="sent-row" key={d.id}>
                  <span>
                    <span className="check">✓</span>
                    {personFor(d)?.name ?? d.spokenAs}
                  </span>
                  <button className="link-btn muted" onClick={() => updateDraft(d.id, { sentAt: null })}>
                    Undo
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {whoIsDraft && (
        <WhoIsSheet
          draft={whoIsDraft}
          people={people}
          onPick={(p) => assignPerson(whoIsDraft.id, whoIsDraft.spokenAs, p)}
          onClose={() => setWhoIsDraftId(null)}
          onUnlink={() => {
            updateDraft(whoIsDraft.id, { personId: null });
          }}
        />
      )}

      {showPeople && <PeopleSheet people={people} setPeople={setPeople} onClose={() => setShowPeople(false)} />}

      {askPasscode && (
        <PasscodeSheet
          onSave={(code) => {
            savePasscode(code);
            setAskPasscode(false);
            void makeTexts(composeText);
          }}
          onClose={() => setAskPasscode(false)}
        />
      )}
    </main>
  );
}

// ---------- Sheets ----------

function Sheet({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function WhoIsSheet({
  draft,
  people,
  onPick,
  onClose,
  onUnlink,
}: {
  draft: Draft;
  people: Person[];
  onPick: (p: Person) => void;
  onClose: () => void;
  onUnlink: () => void;
}) {
  const spoken = draft.spokenAs.replace(/^(my|our)\s+/i, "");
  const looksLikeName = /^[A-Z]/.test(spoken) && !spoken.includes(" ");
  const [name, setName] = useState(looksLikeName ? spoken : "");
  const [phone, setPhone] = useState("");

  return (
    <Sheet onClose={onClose} label="Who is this?">
      <h2>Who’s “{draft.spokenAs}”?</h2>
      <p>I’ll remember next time.</p>

      {people.length > 0 && (
        <>
          <div className="chips">
            {people.map((p) => (
              <button key={p.id} className="chip" onClick={() => onPick(p)}>
                {p.name}
              </button>
            ))}
          </div>
          <div className="divider">or someone new</div>
        </>
      )}

      <div className="field">
        <label htmlFor="who-name">Name</label>
        <input id="who-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Linda" />
      </div>
      <div className="field">
        <label htmlFor="who-phone">Phone (optional)</label>
        <input
          id="who-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
        />
      </div>
      <button
        className="primary"
        disabled={!name.trim()}
        onClick={() => onPick({ id: newId(), name: name.trim(), phone: phone.trim(), aliases: [] })}
      >
        Save
      </button>
      {draft.personId && (
        <button
          className="link-btn muted"
          onClick={() => {
            onUnlink();
          }}
        >
          Unlink from this text
        </button>
      )}
    </Sheet>
  );
}

function PeopleSheet({
  people,
  setPeople,
  onClose,
}: {
  people: Person[];
  setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
  onClose: () => void;
}) {
  const update = (id: string, patch: Partial<Person>) =>
    setPeople((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <Sheet onClose={onClose} label="People">
      <div className="topbar">
        <h2>People</h2>
        <button className="link-btn" onClick={onClose}>
          Done
        </button>
      </div>
      {people.length === 0 ? (
        <p>No one yet. When you mention someone new, I’ll ask who they are and remember.</p>
      ) : (
        people.map((p) => (
          <div className="person-row" key={p.id}>
            <div className="row">
              <div className="field">
                <label htmlFor={`n-${p.id}`}>Name</label>
                <input id={`n-${p.id}`} value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`p-${p.id}`}>Phone</label>
                <input
                  id={`p-${p.id}`}
                  type="tel"
                  inputMode="tel"
                  value={p.phone}
                  placeholder="optional"
                  onChange={(e) => update(p.id, { phone: e.target.value })}
                />
              </div>
            </div>
            {p.aliases.length > 0 && <span className="aka">Also: {p.aliases.join(", ")}</span>}
            <button
              className="link-btn muted"
              style={{ alignSelf: "flex-start", padding: 0, minHeight: 0 }}
              onClick={() => {
                if (confirm(`Forget ${p.name}?`)) setPeople((ps) => ps.filter((x) => x.id !== p.id));
              }}
            >
              Forget
            </button>
          </div>
        ))
      )}
    </Sheet>
  );
}

function PasscodeSheet({ onSave, onClose }: { onSave: (code: string) => void; onClose: () => void }) {
  const [code, setCode] = useState("");
  return (
    <Sheet onClose={onClose} label="Passcode">
      <h2>Enter your passcode</h2>
      <p>Just once on this phone. It keeps your app private.</p>
      <div className="field">
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          aria-label="Passcode"
          onKeyDown={(e) => e.key === "Enter" && code && onSave(code)}
        />
      </div>
      <button className="primary" disabled={!code} onClick={() => onSave(code)}>
        Unlock
      </button>
    </Sheet>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
