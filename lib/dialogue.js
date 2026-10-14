'use strict';
/**
 * Dialogue manager — plain-JS intent matching and slot capture.
 * No external LLM / API key required.
 *
 * Used by server.js for live Twilio calls. The browser Test Call demo
 * (public/dialogue.js) mirrors the same logic so both flows behave alike.
 */
const config = require('../config');

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[?!.,;:"'()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Returns { id, answer } if the text matches a configured FAQ, else null. */
function matchFaq(text) {
  const t = ' ' + normalise(text) + ' ';
  for (const faq of config.faqs) {
    for (const kw of faq.keywords) {
      if (t.includes(' ' + normalise(kw)) || t.includes(normalise(kw) + ' ') || t.trim().includes(normalise(kw))) {
        return { id: faq.id, answer: faq.answer };
      }
    }
  }
  return null;
}

const DONE_PHRASES = [
  'no', 'no thanks', 'no thank you', 'nothing', 'nothing else', 'that is all',
  "that's all", 'no more', 'bas', 'nahi', 'nahin', 'bye', 'goodbye', 'thank you bye',
];
const YES_PHRASES = ['yes', 'yeah', 'yep', 'sure', 'ha', 'haan', 'han', 'ok', 'okay'];

/** True when the caller signals they are finished ("no", "that's all", "bye"...). */
function isDone(text) {
  const t = normalise(text);
  if (!t) return false;
  if (t.includes('goodbye') || t === 'bye' || t.endsWith(' bye')) return true;
  return DONE_PHRASES.some((p) => t === p || t.startsWith(p + ' '));
}

function isYes(text) {
  const t = normalise(text);
  return YES_PHRASES.some((p) => t === p || t.startsWith(p + ' '));
}

/**
 * Best-effort name extraction from a spoken introduction:
 * "My name is Ravi Kumar" / "I am Ravi" / "This is Ravi" / just "Ravi".
 */
function extractName(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const patterns = [
    /my name is\s+(.+)/i,
    /(?:i am|i'm|this is|it is|it's)\s+(.+)/i,
    /(?:myself|naam hai|mera naam)\s+(.+)/i,
    /(.+?)\s+(?:speaking|here|bol raha|bol rahi)/i,
  ];
  let candidate = raw;
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) { candidate = m[1]; break; }
  }
  candidate = candidate
    .replace(/[.!?,]+$/g, '')
    .replace(/\b(sir|madam|ji|please|from|calling)\b.*$/i, '')
    .replace(/\s+(speaking|here)$/i, '')
    .trim();
  // Keep at most 3 words — names are short; anything longer was probably a sentence.
  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length > 3) return '';
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Phone-number normalisation for owner matching: keep only digits, then
 * the last 10. '+919506605427', '919506605427', '09506605427' and
 * '9506605427' all normalise to the same value.
 */
function last10Digits(number) {
  return String(number || '').replace(/\D/g, '').slice(-10);
}

/**
 * True when `from` is Miller's own number (config.ownerPhone) — the
 * COMMAND MODE trigger. Comparison is by last 10 digits so any written
 * form of either number matches.
 */
function isOwnerNumber(from) {
  const a = last10Digits(from);
  const b = last10Digits(config.ownerPhone);
  return Boolean(a) && Boolean(b) && a === b;
}

/**
 * Builds one saved voice command (data/commands.json). Charco polls
 * GET /api/commands for status 'new', executes the command, then marks
 * it done via POST /api/commands/:id/done.
 */
function newCommandRecord({ from, commandText }) {
  return {
    id: 'cmd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    at: new Date().toISOString(),
    from: from || 'unknown',
    commandText: String(commandText || ''),
    status: 'new', // 'new' -> 'done'
  };
}

/** Builds the structured summary record saved for every call. */
function newCallRecord({ callSid, type, from, to }) {
  return {
    id: callSid || 'call-' + Date.now(),
    type: type || 'incoming',
    from: from || 'unknown',
    to: to || 'unknown',
    startedAt: new Date().toISOString(),
    // Epoch ms of the call start — server.js uses this to enforce Miller's
    // 1-minute call cap (see config.callTiming).
    createdAt: Date.now(),
    endedAt: null,
    durationSec: null,
    status: 'in-progress',
    callerName: '',
    purpose: '',
    message: '',
    reply: '',
    faqMatched: [],
    transcript: [], // [{ speaker: 'assistant'|'caller', text }]
  };
}

module.exports = {
  normalise,
  matchFaq,
  isDone,
  isYes,
  extractName,
  newCallRecord,
  last10Digits,
  isOwnerNumber,
  newCommandRecord,
};
