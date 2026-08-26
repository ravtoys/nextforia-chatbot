"use strict";

const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();
const ARRAY_FIELDS = new Set(["tools", "zeroResultQueries", "aiUsage"]);
const FIELDS = new Set([
  "tools",
  "zeroResultQueries",
  "handoff",
  "rating",
  "zeroSearchActive",
  "aiUsage"
]);

function copyArray(value) {
  return Array.isArray(value) ? value.slice() : [];
}

function createState(initial) {
  initial = initial || {};
  return {
    tools: copyArray(initial.tools),
    zeroResultQueries: copyArray(initial.zeroResultQueries),
    handoff: initial.handoff === true,
    rating: Object.prototype.hasOwnProperty.call(initial, "rating") ? initial.rating : null,
    zeroSearchActive: initial.zeroSearchActive === true,
    aiUsage: copyArray(initial.aiUsage)
  };
}

function assertField(field) {
  if (!FIELDS.has(field)) throw new TypeError("Unknown conversation turn field: " + field);
}

function currentState() {
  const state = storage.getStore();
  if (!state) throw new Error("Conversation turn context is not active");
  return state;
}

function isActive() {
  return !!storage.getStore();
}

function run(initial, callback) {
  if (typeof initial === "function") {
    callback = initial;
    initial = null;
  }
  if (typeof callback !== "function") throw new TypeError("Conversation turn callback is required");
  return storage.run(createState(initial), callback);
}

function get(field) {
  assertField(field);
  const state = currentState();
  return ARRAY_FIELDS.has(field) ? state[field].slice() : state[field];
}

function set(field, value) {
  assertField(field);
  const state = currentState();
  if (ARRAY_FIELDS.has(field)) state[field] = copyArray(value);
  else if (field === "handoff" || field === "zeroSearchActive") state[field] = value === true;
  else state[field] = value;
  return get(field);
}

function push(field, value) {
  assertField(field);
  if (!ARRAY_FIELDS.has(field)) throw new TypeError("Conversation turn field is not appendable: " + field);
  const state = currentState();
  state[field].push(value);
  return state[field].length;
}

function snapshot() {
  const state = currentState();
  return {
    tools: state.tools.slice(),
    zeroResultQueries: state.zeroResultQueries.slice(),
    handoff: state.handoff,
    rating: state.rating,
    zeroSearchActive: state.zeroSearchActive,
    aiUsage: state.aiUsage.slice()
  };
}

module.exports = { run, get, set, push, snapshot, isActive };
