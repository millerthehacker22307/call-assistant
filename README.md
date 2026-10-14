# Charco Call Assistant

An AI voice assistant that **answers Miller's phone calls** (greets the caller in polished English, understands English/Hinglish speech, answers FAQs, takes a message, and saves a summary) and can also **place an outbound enquiry call** that speaks a given script and records the reply.

## Architecture (5 lines)

1. `server.js` — one Express app: static pages, Twilio voice webhooks (`/voice/*`), JSON API (`/api/*`).
2. Telephony = **Twilio**: it bridges the phone call and POSTs each step to our webhooks; we reply with TwiML (Polly voices `hi-IN`/`en-IN`).
3. `lib/dialogue.js` — plain-JS dialogue manager: FAQ intent matching + name capture. **No external AI/LLM key needed.**
4. `lib/store.js` — call summaries (caller, time, purpose, message, transcript) in `data/calls.json`, viewable at `/api/calls`.
5. `public/test-call.html` — the same conversation flow running 100% in the browser (Web Speech API), so it can be tested **today, with zero accounts**.

## What works right now (no keys)

- Landing page: `GET /`
- **Browser Test Call**: `GET /test-call.html` — talk to Charco with your mic (Chrome/Edge), or type replies. Summary is shown on screen and kept in the browser.
- Call log API: `GET /api/calls` · Health: `GET /api/health`
- All `/voice/*` webhooks return valid TwiML even without keys (TwiML needs no credentials).
- `POST /api/outbound-call` returns a clear `503 telephony_not_configured` JSON until keys are added — it never crashes.

## Run locally

```bash
cd call-assistant
npm install
cp .env.example .env      # keys can stay empty for demo mode
npm start                 # http://localhost:3000
```

Then open `http://localhost:3000/test-call.html` and tap **Start Call**.
To let Twilio reach your local server during testing, expose it with a tunnel, e.g. `ngrok http 3000`, and use that HTTPS URL as the webhook base.

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
server.js            Express app + all webhook/API endpoints
config.js            Assistant name, greetings, voices, FAQ answers (edit freely)
lib/dialogue.js      Intent matching, name extraction, summary records
lib/store.js         JSON-file storage for call summaries
public/index.html    Landing page
public/test-call.html  Browser voice demo (Web Speech API)
public/dialogue.js   Browser copy of the dialogue logic for the demo
data/calls.json      Saved call summaries (starts empty)
.env.example         The only secrets/config you need to fill
```
