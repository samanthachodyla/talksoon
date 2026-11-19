// Everything lives on your phone (localStorage). Nothing about your people is
// stored on a server. Phone numbers never leave the device.

import type { Draft, Person } from "./types";

const PEOPLE_KEY = "talksoon.people.v1";
const DRAFTS_KEY = "talksoon.drafts.v1";
const PASSCODE_KEY = "talksoon.passcode.v1";

const DAY = 24 * 60 * 60 * 1000;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode). The app still works for this session.
  }
}

export const loadPeople = () => read<Person[]>(PEOPLE_KEY, []);
export const savePeople = (people: Person[]) => write(PEOPLE_KEY, people);

/** Sent drafts are kept for a day (so you can undo), then dropped. */
export const loadDrafts = () =>
  read<Draft[]>(DRAFTS_KEY, []).filter(
    (d) => d.sentAt === null || Date.now() - d.sentAt < DAY,
  );
export const saveDrafts = (drafts: Draft[]) => write(DRAFTS_KEY, drafts);

export const loadPasscode = () => read<string>(PASSCODE_KEY, "");
export const savePasscode = (code: string) => write(PASSCODE_KEY, code);

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
