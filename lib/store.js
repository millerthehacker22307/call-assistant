'use strict';
/**
 * Tiny JSON-file store for call summaries: data/calls.json.
 * Good enough for personal use and demos; swap for a real DB later if needed.
 * All functions are defensive: a missing/corrupt file resets to an empty list
 * instead of crashing the server.
 *
 * SERVERLESS NOTE (Vercel): the function filesystem is read-only/ephemeral,
 * so writes to data/calls.json there may fail or be lost when the function
 * instance is recycled — and the dialogue keeps per-call state in this file
 * across webhook requests, which serverless does not guarantee. It still
 * works locally and on any normal Node host. For durable call logs on
 * Vercel, move this store to a real database (e.g. Vercel KV/Postgres) —
 * deliberately not done here to keep the project dependency-free.
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'calls.json');

function readAll() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeAll(calls) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(calls, null, 2) + '\n', 'utf8');
}

/** Insert a new call record (or replace an existing one with the same id). */
function saveCall(record) {
  const calls = readAll();
  const idx = calls.findIndex((c) => c.id === record.id);
  if (idx >= 0) calls[idx] = record; else calls.push(record);
  writeAll(calls);
  return record;
}

/** Merge fields into an existing record (creates it if missing). */
function updateCall(id, patch) {
  const calls = readAll();
  const idx = calls.findIndex((c) => c.id === id);
  if (idx === -1) {
    const created = Object.assign({ id }, patch);
    calls.push(created);
    writeAll(calls);
    return created;
  }
  calls[idx] = Object.assign({}, calls[idx], patch);
  writeAll(calls);
  return calls[idx];
}

function getCall(id) {
  return readAll().find((c) => c.id === id) || null;
}

/** Newest first. */
function listCalls() {
  return readAll().sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

module.exports = { saveCall, updateCall, getCall, listCalls, DATA_FILE };
