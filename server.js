'use strict';
/**
 * Charco Call Assistant — server.
 *
 * One clean approach: a single Express app (this file) that serves the
 * landing page + browser Test Call demo from /public, exposes the Twilio
 * voice webhooks under /voice/*, and a small JSON API under /api/*.
 * Run it locally, or deploy this same app to any Node host and point
 * Twilio's webhooks at it. (On Vercel it can run as a single serverless
 * function exporting the app — see README.)
 *
 * Telephony is OPTIONAL at runtime: without Twilio keys in .env the server
 * still boots, the demo works, and /voice/* still returns valid TwiML
 * (TwiML generation needs no credentials). Only INITIATING an outbound
 * call via the REST API requires the keys, and that endpoint then returns
 * a clear 503 "telephony not configured" response instead of crashing.
 */
require('dotenv').config({ quiet: true }); // no-op if dotenv is not installed

const path = require('path');
const express = require('express');
const twilio = require('twilio');
const config = require('./config');
const dialogue = require('./lib/dialogue');
const store = require('./lib/store');

const VoiceResponse = twilio.twiml.VoiceResponse;

const TWILIO_CONFIGURED = Boolean(
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER
);
let twilioClient = null;
if (TWILIO_CONFIGURED) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio posts form data
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Say text with the right Polly voice: Devanagari text -> hi-IN voice,
 * everything else -> en-IN voice (the fallback handling). Both voices are
 * Indian and handle Hinglish reasonably.
 */
function say(twiml, text) {
  const isHindi = /[\u0900-\u097F]/.test(text);
  const v = isHindi ? config.voice.hindi : config.voice.english;
  twiml.say({ voice: v.voice, language: v.language }, text);
  return text;
}

function logSpeech(callSid, speaker, text) {
  if (!callSid || !text) return;
  const rec = store.getCall(callSid);
  if (!rec) return;
  const transcript = Array.isArray(rec.transcript) ? rec.transcript : [];
  transcript.push({ speaker, text });
  store.updateCall(callSid, { transcript });
}

function publicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function sendTwiml(res, twiml) {
  res.type('text/xml').send(twiml.toString());
}

/* ------------------------------------------------------------------ */
/* Incoming calls                                                      */
/* ------------------------------------------------------------------ */

/**
 * POST /voice/incoming — Twilio webhook for the Twilio number's
 * "A call comes in" setting. Greets the caller and gathers their name.
 */
app.post('/voice/incoming', (req, res) => {
  const callSid = req.body.CallSid;
  const rec = dialogue.newCallRecord({
    callSid,
    type: 'incoming',
    from: req.body.From,
    to: req.body.To,
  });
  store.saveCall(rec);

  const twiml = new VoiceResponse();
  logSpeech(callSid, 'assistant', say(twiml, config.greeting));
  const gather = twiml.gather({
    input: 'speech',
    language: config.gatherLanguage,
    speechTimeout: 'auto',
    action: '/voice/gather?stage=name',
    method: 'POST',
  });
  logSpeech(callSid, 'assistant', say(gather, config.askName));
  // If the caller says nothing, Gather falls through to these verbs:
  say(twiml, config.noInput);
  twiml.hangup();
  sendTwiml(res, twiml);
});

/**
 * POST /voice/gather?stage=name|purpose|more — the incoming-call dialogue.
 * State (stage, caller name) rides in the Gather action URL because
 * Twilio webhooks are stateless per request.
 */
app.post('/voice/gather', (req, res) => {
  const callSid = req.body.CallSid;
  const stage = req.query.stage || 'purpose';
  const speech = (req.body.SpeechResult || '').trim();
  const name = req.query.name || (store.getCall(callSid) || {}).callerName || '';
  const twiml = new VoiceResponse();

  if (speech) logSpeech(callSid, 'caller', speech);

  /* ---- Stage 1: capture the caller's name ---- */
  if (stage === 'name') {
    const callerName = dialogue.extractName(speech) || name;
    if (callerName) store.updateCall(callSid, { callerName });
    const gather = twiml.gather({
      input: 'speech',
      language: config.gatherLanguage,
      speechTimeout: 'auto',
      action: '/voice/gather?stage=purpose&name=' + encodeURIComponent(callerName || ''),
      method: 'POST',
    });
    logSpeech(callSid, 'assistant', say(gather, config.askPurpose(callerName)));
    say(twiml, config.noInput);
    twiml.hangup();
    return sendTwiml(res, twiml);
  }

  /* ---- Stage 2/3: a question (FAQ) or a message ---- */
  // stage === 'purpose' (first request) or 'more' (follow-up turns)
  if (stage === 'more' && dialogue.isDone(speech)) {
    logSpeech(callSid, 'assistant', say(twiml, config.messageTaken(name)));
    logSpeech(callSid, 'assistant', say(twiml, config.goodbye));
    twiml.hangup();
    return sendTwiml(res, twiml);
  }

  const faq = dialogue.matchFaq(speech);
  if (faq) {
    const rec = store.getCall(callSid) || {};
    const matched = Array.isArray(rec.faqMatched) ? rec.faqMatched : [];
    matched.push(faq.id);
    store.updateCall(callSid, {
      faqMatched: matched,
      purpose: rec.purpose || 'FAQ: ' + faq.id,
    });
    logSpeech(callSid, 'assistant', say(twiml, faq.answer));
    const gather = twiml.gather({
      input: 'speech',
      language: config.gatherLanguage,
      speechTimeout: 'auto',
      action: '/voice/gather?stage=more&name=' + encodeURIComponent(name || ''),
      method: 'POST',
    });
    logSpeech(callSid, 'assistant', say(gather, config.askAnythingElse));
    logSpeech(callSid, 'assistant', say(twiml, config.messageTaken(name)));
    logSpeech(callSid, 'assistant', say(twiml, config.goodbye));
    twiml.hangup();
    return sendTwiml(res, twiml);
  }

  // Not an FAQ -> treat the speech as the caller's message for Miller.
  if (speech) {
    const rec = store.getCall(callSid) || {};
    const message = rec.message ? rec.message + ' | ' + speech : speech;
    store.updateCall(callSid, { message, purpose: rec.purpose || 'Left a message' });
  }
  logSpeech(callSid, 'assistant', say(twiml, config.messageTaken(name)));
  logSpeech(callSid, 'assistant', say(twiml, config.goodbye));
  twiml.hangup();
  return sendTwiml(res, twiml);
});

/* ------------------------------------------------------------------ */
/* Outbound calls                                                      */
/* ------------------------------------------------------------------ */

/**
 * POST /voice/outbound?script=...&forName=... — TwiML executed when the
 * other party answers an outbound call placed via /api/outbound-call.
 * Speaks the script/enquiry, then gathers the spoken reply.
 */
app.post('/voice/outbound', (req, res) => {
  const callSid = req.body.CallSid;
  const script = (req.query.script || req.body.script || '').toString();
  const forName = (req.query.forName || '').toString();

  const existing = store.getCall(callSid);
  if (!existing) {
    store.saveCall(
      Object.assign(
        dialogue.newCallRecord({ callSid, type: 'outbound', from: req.body.From, to: req.body.To }),
        { purpose: 'Outbound enquiry' + (forName ? ' to ' + forName : ''), message: script }
      )
    );
  }

  const twiml = new VoiceResponse();
  logSpeech(callSid, 'assistant', say(twiml, config.outboundIntro));
  if (script) logSpeech(callSid, 'assistant', say(twiml, script));
  const gather = twiml.gather({
    input: 'speech',
    language: config.gatherLanguage,
    speechTimeout: 'auto',
    action: '/voice/outbound-reply',
    method: 'POST',
  });
  say(gather, 'Please go ahead with your reply. I am listening.');
  say(twiml, config.outboundThanks);
  twiml.hangup();
  sendTwiml(res, twiml);
});

/** POST /voice/outbound-reply — saves the other party's spoken reply. */
app.post('/voice/outbound-reply', (req, res) => {
  const callSid = req.body.CallSid;
  const speech = (req.body.SpeechResult || '').trim();
  if (speech) {
    logSpeech(callSid, 'caller', speech);
    store.updateCall(callSid, { reply: speech });
  }
  const twiml = new VoiceResponse();
  logSpeech(callSid, 'assistant', say(twiml, config.outboundThanks));
  twiml.hangup();
  sendTwiml(res, twiml);
});

/**
 * POST /api/outbound-call { to, script, forName } — places an outbound
 * call using the Twilio REST API. Requires the Twilio keys; without them
 * returns 503 with a clear explanation instead of failing silently.
 */
app.post('/api/outbound-call', async (req, res) => {
  if (!TWILIO_CONFIGURED || !twilioClient) {
    return res.status(503).json({
      error: 'telephony_not_configured',
      message:
        'Twilio keys are missing. Copy .env.example to .env and fill in TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER, then restart the server.',
      missing: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'].filter((k) => !process.env[k]),
    });
  }
  const { to, script, forName } = req.body || {};
  if (!to || !script) {
    return res.status(400).json({ error: 'bad_request', message: 'Both "to" (phone number) and "script" (what the assistant should say/ask) are required.' });
  }
  try {
    const base = publicBaseUrl(req);
    const url =
      base + '/voice/outbound?script=' + encodeURIComponent(script) +
      (forName ? '&forName=' + encodeURIComponent(forName) : '');
    const call = await twilioClient.calls.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
      url,
      method: 'POST',
      statusCallback: base + '/voice/status',
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['completed'],
    });
    store.saveCall(
      Object.assign(
        dialogue.newCallRecord({ callSid: call.sid, type: 'outbound', from: process.env.TWILIO_PHONE_NUMBER, to }),
        { purpose: 'Outbound enquiry' + (forName ? ' to ' + forName : ''), message: script }
      )
    );
    return res.json({ ok: true, callSid: call.sid, status: call.status });
  } catch (err) {
    return res.status(502).json({ error: 'twilio_error', message: String(err && err.message ? err.message : err) });
  }
});

/* ------------------------------------------------------------------ */
/* Status callback + review API                                        */
/* ------------------------------------------------------------------ */

/**
 * POST /voice/status — Twilio status callback. On completion, finalises
 * the saved call summary (status, end time, duration).
 */
app.post('/voice/status', (req, res) => {
  const callSid = req.body.CallSid;
  const status = req.body.CallStatus;
  if (callSid && status) {
    const patch = { status };
    if (status === 'completed') {
      patch.endedAt = new Date().toISOString();
      const dur = parseInt(req.body.CallDuration, 10);
      if (!Number.isNaN(dur)) patch.durationSec = dur;
    }
    if (store.getCall(callSid)) store.updateCall(callSid, patch);
  }
  res.sendStatus(204);
});

/** GET /api/calls — all saved call summaries, newest first. */
app.get('/api/calls', (req, res) => {
  const calls = store.listCalls();
  res.json({ count: calls.length, calls });
});

/** GET /api/health — quick sanity/config check (never leaks secrets). */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    assistant: config.assistantName,
    owner: config.ownerName,
    telephonyConfigured: TWILIO_CONFIGURED,
  });
});

/* ------------------------------------------------------------------ */

const PORT = parseInt(process.env.PORT, 10) || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Charco Call Assistant listening on http://localhost:${PORT}`);
    console.log(`  Landing page : http://localhost:${PORT}/`);
    console.log(`  Test Call    : http://localhost:${PORT}/test-call.html`);
    console.log(`  Call log API : http://localhost:${PORT}/api/calls`);
    console.log(
      TWILIO_CONFIGURED
        ? '  Telephony    : Twilio keys found — live calls enabled.'
        : '  Telephony    : NOT configured (demo mode). Add Twilio keys to .env to enable live phone calls.'
    );
  });
}

module.exports = app;
