"use strict";

const {
  normalizeScheduledEmail
} = require("./setup-email-journey");

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

class InMemorySetupEmailJourneyStore {
  constructor() {
    this.rows = [];
  }

  async schedule(input) {
    const existing = this.rows.find(function (row) { return row.dedupe_key === input.dedupe_key; });
    if (existing) return copy(existing);
    this.rows.push(copy(input));
    return copy(input);
  }

  async claimDue(limit, at) {
    const now = new Date(at || new Date()).getTime();
    const rows = this.rows.filter(function (row) {
      return ["scheduled", "failed"].includes(row.status) && Date.parse(row.send_after) <= now;
    }).sort(function (a, b) {
      return String(a.send_after).localeCompare(String(b.send_after));
    }).slice(0, limit || 20);
    rows.forEach(function (row) {
      row.status = "sending";
      row.attempts += 1;
      row.updated_at = new Date(now).toISOString();
    });
    return copy(rows);
  }

  async markSent(id, providerMessageId, at) {
    const row = this.rows.find(function (item) { return item.id === id; });
    if (!row) return null;
    row.status = "sent";
    row.provider_message_id = providerMessageId || null;
    row.sent_at = new Date(at || new Date()).toISOString();
    row.updated_at = row.sent_at;
    row.last_error = null;
    return copy(row);
  }

  async markFailed(id, error, retryAt) {
    const row = this.rows.find(function (item) { return item.id === id; });
    if (!row) return null;
    row.status = row.attempts >= 3 ? "failed_permanently" : "failed";
    row.last_error = String(error || "email_delivery_failed").slice(0, 240);
    row.send_after = new Date(retryAt || Date.now() + 15 * 60 * 1000).toISOString();
    row.updated_at = new Date().toISOString();
    return copy(row);
  }

  async markCancelled(id, reason) {
    const row = this.rows.find(function (item) { return item.id === id; });
    if (!row) return null;
    row.status = "cancelled";
    row.last_error = String(reason || "no_longer_applicable").slice(0, 240);
    row.updated_at = new Date().toISOString();
    return copy(row);
  }
}

class SupabaseSetupEmailJourneyStore {
  constructor(options) {
    options = options || {};
    this.url = String(options.url || "").replace(/\/$/, "");
    this.headers = options.headers || {};
    this.axios = options.axiosClient;
    this.table = options.table || "setup_email_deliveries";
  }

  async schedule(input) {
    const response = await this.axios.post(
      this.url + "/rest/v1/" + this.table + "?on_conflict=dedupe_key",
      input,
      {
        headers: Object.assign({}, this.headers, { Prefer: "resolution=ignore-duplicates,return=representation" }),
        timeout: 8000
      }
    );
    if (Array.isArray(response.data) && response.data[0]) return response.data[0];
    const existing = await this.axios.get(this.url + "/rest/v1/" + this.table, {
      params: { select: "*", dedupe_key: "eq." + input.dedupe_key, limit: 1 },
      headers: this.headers,
      timeout: 8000
    });
    return existing.data && existing.data[0] || input;
  }

  async claimDue(limit) {
    const response = await this.axios.post(this.url + "/rest/v1/rpc/claim_due_setup_emails", {
      p_limit: Math.max(1, Math.min(Number(limit) || 20, 100))
    }, { headers: this.headers, timeout: 8000 });
    return Array.isArray(response.data) ? response.data : [];
  }

  async patch(id, body) {
    const response = await this.axios.patch(this.url + "/rest/v1/" + this.table, body, {
      params: { id: "eq." + id },
      headers: Object.assign({}, this.headers, { Prefer: "return=representation" }),
      timeout: 8000
    });
    return response.data && response.data[0] || null;
  }

  async markSent(id, providerMessageId, at) {
    const now = new Date(at || new Date()).toISOString();
    return this.patch(id, {
      status: "sent",
      provider_message_id: providerMessageId || null,
      sent_at: now,
      last_error: null,
      updated_at: now
    });
  }

  async markFailed(id, error, retryAt, attempts) {
    const permanent = Number(attempts) >= 3;
    return this.patch(id, {
      status: permanent ? "failed_permanently" : "failed",
      last_error: String(error || "email_delivery_failed").slice(0, 240),
      send_after: new Date(retryAt || Date.now() + 15 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  async markCancelled(id, reason) {
    return this.patch(id, {
      status: "cancelled",
      last_error: String(reason || "no_longer_applicable").slice(0, 240),
      updated_at: new Date().toISOString()
    });
  }
}

function createSetupEmailJourneyService(options) {
  options = options || {};
  const store = options.store || new InMemorySetupEmailJourneyStore();
  const sender = options.sender;
  const now = typeof options.now === "function" ? options.now : function () { return new Date(); };
  const shouldSend = typeof options.shouldSend === "function" ? options.shouldSend : async function () { return true; };

  async function schedule(input) {
    return store.schedule(normalizeScheduledEmail(input));
  }

  async function processDue(limit) {
    const rows = await store.claimDue(limit || 20, now());
    const result = { claimed: rows.length, sent: 0, cancelled: 0, failed: 0 };
    for (const row of rows) {
      try {
        const applicable = await shouldSend(row);
        if (applicable !== true) {
          await store.markCancelled(row.id, "no_longer_applicable");
          result.cancelled += 1;
          continue;
        }
        const delivery = await sender.send(Object.assign({}, row.payload || {}, {
          template: row.template_key,
          to: row.recipient,
          tenant_id: row.tenant_id
        }));
        await store.markSent(row.id, delivery && delivery.id, now());
        result.sent += 1;
      } catch (error) {
        const retryAt = new Date(now().getTime() + Math.min(60, Math.pow(2, Number(row.attempts) || 1) * 5) * 60 * 1000);
        await store.markFailed(row.id, error && error.message, retryAt, row.attempts);
        result.failed += 1;
      }
    }
    return result;
  }

  return { processDue, schedule, store };
}

module.exports = {
  InMemorySetupEmailJourneyStore,
  SupabaseSetupEmailJourneyStore,
  createSetupEmailJourneyService
};
