# Talk Soon — Project Notes

## What it is

A dead-simple voice memo app for the in-between moments: the drive to pick up
the kids, the morning routine, the times you're thinking about your friends,
wondering what they've been up to, or wanting to connect people.

You open it, ramble, and it drafts separate texts to each person you mentioned.

**Example input (spoken):**
> "Tell Hannah that I've been thinking about her and sending so much love, ask
> my mother-in-law what time we should be there for Christmas Eve, and text
> Katelyn and ask if Alyx and Jenna broke up — I saw their Instagram story and
> was like woah."

**Example output (draft cards):**
- **Hannah:** "Been thinking about you and sending so much love ❤️"
- **Mother-in-law:** "Hi! What time should we be there Christmas Eve?"
- **Katelyn:** "Ok random, but did Alyx and Jenna break up?? Saw their Instagram story and was like woah"

Goal: simple but effective, super user friendly.

## The core flow (v1)

1. **Tap.** One big button. Nothing else on the screen.
2. **Talk.** Ramble naturally.
3. **Review.** Transcribe → split by person → one draft card per person.
4. **Send.** Tap Send on a card → native Messages opens with the text pre-filled → you hit send.

If v1 does more than this, it's too much.

## Design principles / hard truths

1. **Capture now, send later.** Talking while driving is fine; reading and
   editing drafts while driving is not. Drafts wait in an outbox until you're
   parked (pickup line, home). Safer, and gives a second look before sending.
2. **The app never sends on its own.** Phones (especially iPhone) don't allow
   silent texting, and that's a feature. The app opens Messages pre-filled;
   you always press the final button.
3. **People resolution is the make-or-break UX.** "My mother-in-law" isn't a
   contact, and "Hannah" must mean *your* Hannah. The first time a
   name/nickname/relationship comes up, ask once, then remember forever.
4. **Your voice, not AI voice.** "Sending so much love" from you means
   something; a polished AI rewrite doesn't. Keep your exact words, only fix
   grammar enough to read like a text. If people can tell the app wrote it,
   it defeats the purpose.

## Question to keep asking ourselves

Is the real problem **forgetting** or **the effort of writing**?

- Forgetting → the capture is the product; speed-to-record matters most
  ("Hey Siri, start a memo" beats opening an app while driving).
- Effort → drafting is the product.

Current hunch: mostly forgetting.

## Decided

- **Platform: iPhone only.** No Android.

## Open decisions

| Question | Proposed default (if no answer) |
|---|---|
| Native iOS app or iPhone home-screen web app? | Open — native gets contacts, Siri, in-app Messages sheet, but needs a Mac + Xcode to build/run; web app is faster to try this week |
| Just me, or other people too? | Just me — no accounts/login in v1 |
| Exact words or lightly polished? | Exact words, light grammar cleanup only |
| How to build? | Next.js (same stack as other projects) |

## Proposed v1 scope

- Single record button (iPhone)
- Speech-to-text transcription
- Claude splits the transcript into per-person messages, preserving your wording
- Draft list grouped by person (the "outbox")
- "Who is this?" prompt for unknown names/relationships, remembered afterward
- Send button per card → opens Messages with the text pre-filled (`sms:` link on web, or the native Messages sheet in an iOS app)

Not in v1: auto-sending, contact import, Siri/CarPlay, accounts.
