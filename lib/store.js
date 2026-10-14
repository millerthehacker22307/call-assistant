'use strict';
/**
 * Tiny JSON-file store for call summaries (data/calls.json) and for the
 * voice commands Miller dictates in COMMAND MODE (data/commands.json).
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
const COMMANDS_FILE = path.join(__dirname, '..', 'data', 'commands.json');

function readJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeJson(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(rows, null, 2) + '\n', 'utf8');
}

function readAll() {
  return readJson(DATA_FILE);
}

function writeAll(calls) {
  writeJson(DATA_FILE, calls);
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

/* ------------------------------------------------------------------ */
/* Voice commands (COMMAND MODE) — data/commands.json                  */
/* Miller dictates a command on a call from his own number; Charco     */
/* picks it up via GET /api/commands and closes it when executed.      */
/* ------------------------------------------------------------------ */

/** Insert a new command record (or replace one with the same id). */
function saveCommand(record) {
  const commands = readJson(COMMANDS_FILE);
  const idx = commands.findIndex((c) => c.id === record.id);
  if (idx >= 0) commands[idx] = record; else commands.push(record);
  writeJson(COMMANDS_FILE, commands);
  return record;
}

/** Merge fields into an existing command (returns null when missing). */
function updateCommand(id, patch) {
  const commands = readJson(COMMANDS_FILE);
  const idx = commands.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  commands[idx] = Object.assign({}, commands[idx], patch);
  writeJson(COMMANDS_FILE, commands);
  return commands[idx];
}

function getCommand(id) {
  return readJson(COMMANDS_FILE).find((c) => c.id === id) || null;
}

/** Newest first. Optional filter: { status: 'new' | 'done' }. */
function listCommands(filter) {
  let commands = readJson(COMMANDS_FILE);
  if (filter && filter.status) {
    commands = commands.filter((c) => c.status === filter.status);
  }
  return commands.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** Total command count, or the count for one status when given. */
function countCommands(status) {
  const commands = readJson(COMMANDS_FILE);
  if (!status) return commands.length;
  return commands.filter((c) => c.status === status).length;
}

module.exports = {
  saveCall,
  updateCall,
  getCall,
  listCalls,
  DATA_FILE,
  saveCommand,
  updateCommand,
  getCommand,
  listCommands,
  countCommands,
  COMMANDS_FILE,
};
