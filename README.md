# Charco Call Assistant

An AI voice assistant that **answers Miller's phone calls** (greets the caller in polished English, understands English/Hinglish speech, answers FAQs, takes a message, and saves a summary), **takes spoken commands from Miller himself** when he calls the number (see Command mode below), and can also **place an outbound enquiry call** that speaks a given script and records the reply.

## Architecture (5 lines)

1. `server.js` — one Express app: static pages, Twilio voice webhooks (`/voice/*`), JSON API (`/api/*`).
2. Telephony = **Twilio**: it bridges the phone call and POSTs each step to our webhooks; we reply with TwiML (Polly voices `hi-IN`/`en-IN`).
3. `lib/dialogue.js` — plain-JS dialogue manager: FAQ intent matching + name capture. **No external AI/LLM key needed.**
4. `lib/store.js` — call summaries (caller, time, purpose, message, transcript) in `data/calls.json`, viewable at `/api/calls`; Miller's voice commands in `data/commands.json`, viewable at `/api/commands`.
5. `public/test-call.html` — the same conversation flow running 100% in the browser (Web Speech API), so it can be tested **today, with zero accounts**.

## What works right now (no keys)

- ⏱ **Under-a-minute calls (Miller's rule):** every call is capped at **60 seconds** and normally wraps up in **20–30 seconds** — the flow is lean (greeting → name → purpose → one answer/message → at most one "anything else?" → wrap-up), elapsed time is enforced server-side at the 45-second wrap-up point, and the browser demo shows a live timer with the same cap.
- Landing page: `GET /`
- **Browser Test Call**: `GET /test-call.html` — talk to Charco with your mic (Chrome/Edge), or type replies. Summary is shown on screen and kept in the browser. A mode toggle at the top switches between **Answering mode** (as a caller) and **Command mode** (as Miller — dictate a command and see it land in the on-page Command inbox).
- **Command mode** (phone + demo): when Miller himself calls, he dictates a command instead of getting the answering flow — details in the Command mode section below.
- Call log API: `GET /api/calls` · Commands API: `GET /api/commands` · Health: `GET /api/health` (includes command counts)
- All `/voice/*` webhooks return valid TwiML even without keys (TwiML needs no credentials).
- `POST /api/outbound-call` returns a clear `503 telephony_not_configured` JSON until keys are added — it never crashes.

## Command mode — Miller gives orders by phone

Decided by Miller on 2026-10-14: the same assistant number doubles as his personal command line.

**How it triggers.** `POST /voice/incoming` compares the incoming `From` with `config.ownerPhone` (`+919506605427`) by **last 10 digits** — so `+91…`, `0…` and bare forms of his number all match. A match runs the command flow; **every other caller gets the normal answering flow, completely unchanged.**

**The flow** (one gather + one confirmation, ~20–30 seconds — the 1-minute rule and the 45-second elapsed guard apply exactly as in the answering flow):

1. Greeting: *"Welcome back, Miller. Boliye, kya command hai?"* (Hinglish by design — it is spoken only to Miller.)
2. Miller dictates one command, e.g. *"Note kar lo kal subah saat baje uthana hai"* or *"Mera LeetCode status batao"*.
3. The command is saved to `data/commands.json` as `{ id, at, from, commandText, status: "new" }`.
4. Charco speaks the confirmation — *"Note kar liya: \<command\>. Main ispar kaam karke WhatsApp par report dunga."* — and hangs up.
5. If nothing is heard: one retry with a prompt line, then the call ends politely.

**How Charco consumes commands:**

- `GET /api/commands` — all commands, newest first. `GET /api/commands?status=new` — only unexecuted ones.
- `POST /api/commands/:id/done` — mark a command executed (sets `status: "done"` and `doneAt`).
- `GET /api/health` — includes `commands: { total, new }` counts.

**Demo:** `public/test-call.html` has an *Answering mode / Command mode* toggle. In Command mode the demo speaks the owner greeting, saves the dictated command to an on-page **Command inbox** (browser localStorage, with New/Done status and a "Mark done" button), and speaks the same confirmation.

## Run locally

```bash
cd call-assistant
npm install
cp .env.example .env      # keys can stay empty for demo mode
npm start                 # http://localhost:3000
```

Then open `http://localhost:3000/test-call.html` and tap **Start Call**.
To let Twilio reach your local server during testing, expose it with a tunnel, e.g. `ngrok http 3000`, and use that HTTPS URL as the webhook base.

## Deploy on Vercel

The project is already shaped for Vercel — no code changes needed:

1. **Import the repo** in Vercel (Add New → Project → pick this repository). The committed `vercel.json` takes care of routing: requests to `/voice/*` and `/api/*` are rewritten to the Express app running as a serverless function (`api/index.js` re-exports the app from `server.js`), and everything else is served as static files from `public/`. Framework preset can stay "Other".
2. **Set environment variables** in the Vercel project (Settings → Environment Variables), then redeploy:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER` (the Twilio number, in +1… / E.164 format)
   - `PUBLIC_BASE_URL` — your deployment URL, e.g. `https://call-assistant-xxxx.vercel.app` (no trailing slash)
3. **Point the Twilio number at it** (Twilio Console → Phone Numbers → your number → Voice configuration):
   - "A call comes in" webhook → `POST https://<your-domain>/voice/incoming`
   - Status callback → `POST https://<your-domain>/voice/status`

> **Storage caveat on Vercel:** call summaries are kept in `data/calls.json`, but a serverless function's filesystem is ephemeral — writes may be lost when the instance recycles, and multi-step call state kept in that file is not guaranteed to survive between webhook requests. Fine for testing the deployment; for durable logs, move `lib/store.js` to a real database (e.g. Vercel KV/Postgres). Locally and on a normal Node host the JSON store works as documented.

## Going live on real phone calls — exact remaining steps

1. **Create a Twilio account** at twilio.com (Miller's own account — the only missing piece).
2. **Buy a phone number** with Voice capability in the Twilio Console (or use the trial number). This number is the assistant's line.
3. **Put the keys in `.env`**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and `PUBLIC_BASE_URL` (the deployed server's HTTPS URL). Restart/redeploy.
4. **Deploy `server.js`** to any HTTPS Node host (Vercel/Render/Railway/a VPS) — Twilio webhooks must be publicly reachable over HTTPS.
5. **Point the number's webhooks at this server** (Twilio Console → Phone Numbers → your number → Voice):
   - "A call comes in" → `POST https://YOUR-DOMAIN/voice/incoming`
   - Status callback → `POST https://YOUR-DOMAIN/voice/status`
6. **Answering Miller's own calls:** in your phone's Phone app settings, enable **conditional call forwarding** (forward when busy / unanswered / unreachable) to the Twilio number, so calls Miller can't pick up land on Charco instead. Exact steps/codes vary by carrier (Jio/Airtel/Vi) — it is a phone-side setting, no code needed.
7. **Outbound enquiry calls:** `POST /api/outbound-call` with JSON `{ "to": "+91…", "script": "…what to ask…", "forName": "Shop name" }` — the reply is saved to `/api/calls`.

## Honest notes on limits

- **Twilio trial accounts** can only call **verified** numbers, start outbound calls with a spoken trial message, and have limited credit. Upgrading removes these.
- **India specifics:** buying an Indian (+91) local number on Twilio generally needs KYC/address proof, and Indian telecom rules (TRAI/DoT — e.g. 140-series for commercial calling) can apply to promotional use. Many people start with a US/international virtual number for personal testing; confirm current rules in the Twilio Console for your use case.
- Speech recognition quality depends on Twilio's transcription of Indian English/Hindi (`hi-IN` hint is configured); very noisy lines can mis-hear — every transcript is saved so Miller can verify.
- Summaries live in a local JSON file (`data/calls.json`) — perfect for personal scale; move to a database if call volume grows.

## Files

```
server.js            Express app + all webhook/API endpoints (exports the app; listens only when run directly)
api/index.js         Vercel serverless entry — re-exports the Express app from server.js
vercel.json          Vercel routing: /voice/* and /api/* → api/index.js, everything else static from public/
config.js            Assistant name, greetings, voices, FAQ answers, call timing (callTiming: target 30s / wrap up at 45s / hard cap 60s), ownerPhone + commandMode lines — edit freely
lib/dialogue.js      Intent matching, name extraction, summary records, owner-number matching, command records
lib/store.js         JSON-file storage for call summaries and voice commands
public/index.html    Landing page
public/test-call.html  Browser voice demo (Web Speech API) — Answering / Command mode toggle + Command inbox
public/dialogue.js   Browser copy of the dialogue logic for the demo
data/calls.json      Saved call summaries (starts empty)
data/commands.json   Saved voice commands from Miller (starts empty)
.env.example         The only secrets/config you need to fill
```
