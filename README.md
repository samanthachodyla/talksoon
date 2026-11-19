# Talk Soon

Say it out loud. Send it later.

Tap the big button and ramble: *"Tell Hannah I've been thinking about her and
sending so much love, ask my mother-in-law what time we should be there for
Christmas Eve, and ask Katelyn if Alyx and Jenna broke up."* Talk Soon writes one
text per person, in your own words. When you're parked, tap **Send** on each one.
Messages opens with the text filled in, and you hit send yourself.

An iPhone home-screen web app. Just for you, no accounts.

## How it works

- **Talking:** uses the iPhone's built-in dictation (free, no extra service).
  If that's unavailable, you can type, or use the 🎤 on the keyboard.
- **Drafting:** your words go to Claude, which splits them by person and
  keeps your wording. See `app/api/draft/route.ts`.
- **People:** the first time you mention someone ("my mother-in-law"), tap
  **Who's this?** and give a name and, if you want, a number. It remembers
  them after that.
- **Sending:** opens iPhone Messages pre-filled. The app never sends anything
  on its own.
- **Privacy:** people, numbers and drafts are stored only on your phone.
  Only the memo text and names/nicknames are sent to Claude. Phone numbers
  never leave your phone.
- **No signal?** Your memo is saved. Tap *Make my texts* when you're back online.

## Put it on your phone

1. **Get a Claude API key** at console.anthropic.com → API Keys.
2. **Deploy** this repo to Vercel (vercel.com → Add New → Project → import
   `talksoon`). Under *Environment Variables* add:
   - `ANTHROPIC_API_KEY`: your key
   - `APP_PASSCODE`: any passcode, so only you can use your app
3. Open the Vercel URL in **Safari** on your iPhone → tap **Share** →
   **Add to Home Screen**.
4. Open Talk Soon from your home screen, tap the button, allow the microphone,
   and enter your passcode the first time.

## Run it locally

```bash
npm install
```

```bash
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
```

```bash
npm run dev
```

## Known limits (v1)

- iPhone dictation in home-screen apps has been unreliable on some iOS
  versions. If talking doesn't work, the app falls back to a text box, and
  the keyboard 🎤 still works.
- No contact import yet. You add a number once per person, or use
  **Just send** and pick the contact in Messages.
- Data lives in this phone's browser storage. Deleting the home-screen app
  clears it.
