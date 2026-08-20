"use strict";

const crypto = require("crypto");
const {
  NEXTFORIA_HOME_URL,
  NEXTFORIA_SETUP_EMAIL_FROM
} = require("./setup-email-journey");

const CUSTOMER_VISIBLE_PLAN_IDS = ["nextfor-uno", "nextfor-aura", "nextfor-tempo", "nextfor-atlas"];
const CUSTOMER_VISIBLE_BOT_IDS = ["atencion-cliente", "agendamiento"];
const PLAN_BOT_REQUIREMENTS = Object.freeze({
  "nextfor-uno": "atencion-cliente",
  "nextfor-aura": "atencion-cliente",
  "nextfor-tempo": "agendamiento"
});

class CustomerAccessError extends Error {
  constructor(code, status, details) {
    super(code);
    this.name = "CustomerAccessError";
    this.code = code;
    this.status = status || 400;
    this.details = details || null;
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function customerVisibleCatalogs(catalogs) {
  catalogs = catalogs || {};
  return {
    plans: (catalogs.plans || []).filter(function (row) {
      return CUSTOMER_VISIBLE_PLAN_IDS.indexOf(String(row && row.id || "").toLowerCase()) >= 0;
    }),
    bots: (catalogs.bots || []).filter(function (row) {
      return CUSTOMER_VISIBLE_BOT_IDS.indexOf(String(row && row.id || "").toLowerCase()) >= 0;
    })
  };
}

function validateCreateInput(input) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const allowed = ["company_name", "admin_email", "plan_id", "assigned_bot_id"];
  const keys = Object.keys(body);
  if (keys.some(function (key) { return !allowed.includes(key); }) || allowed.some(function (key) { return !keys.includes(key); })) {
    throw new CustomerAccessError("invalid_request", 400);
  }
  const companyName = String(body.company_name || "").trim().replace(/\s+/g, " ");
  const adminEmail = normalizeEmail(body.admin_email);
  const planId = cleanIdentifier(body.plan_id);
  const assignedBotId = cleanIdentifier(body.assigned_bot_id);
  if (companyName.length < 2 || companyName.length > 120) throw new CustomerAccessError("invalid_company_name", 400);
  if (!validEmail(adminEmail)) throw new CustomerAccessError("invalid_email", 400);
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(planId)) throw new CustomerAccessError("invalid_plan", 400);
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(assignedBotId)) throw new CustomerAccessError("invalid_assigned_bot", 400);
  if (CUSTOMER_VISIBLE_PLAN_IDS.indexOf(planId) < 0) throw new CustomerAccessError("invalid_plan", 400);
  if (CUSTOMER_VISIBLE_BOT_IDS.indexOf(assignedBotId) < 0) throw new CustomerAccessError("invalid_assigned_bot", 400);
  if (PLAN_BOT_REQUIREMENTS[planId] && PLAN_BOT_REQUIREMENTS[planId] !== assignedBotId) {
    throw new CustomerAccessError("invalid_assigned_bot", 400);
  }
  return { company_name: companyName, admin_email: adminEmail, plan_id: planId, assigned_bot_id: assignedBotId };
}

function validatePassword(password, confirmation) {
  const value = String(password || "");
  if (value.length < 12 || value.length > 128 || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(value) || !/\d/.test(value)) {
    throw new CustomerAccessError("weak_password", 400);
  }
  if (value !== String(confirmation || "")) throw new CustomerAccessError("password_mismatch", 400);
  return value;
}

function hashInvitationToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function normalizeHttpsOrigin(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return "";
    return url.origin;
  } catch (_) {
    return "";
  }
}

function uniqueInvitationOrigins(primary, fallbacks) {
  const seen = new Set();
  return [primary].concat(Array.isArray(fallbacks) ? fallbacks : []).map(normalizeHttpsOrigin).filter(function (origin) {
    if (!origin || seen.has(origin)) return false;
    seen.add(origin);
    return true;
  });
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password || ""), salt, 64).toString("base64url");
}

function invitationStatus(invitation, now) {
  if (invitation.revoked_at) return "revoked";
  if (invitation.used_at) return "used";
  if (new Date(invitation.expires_at).getTime() <= now.getTime()) return "expired";
  if (invitation.delivery_status === "failed") return "delivery_failed";
  if (invitation.delivery_status === "sent") return "sent";
  return "pending_delivery";
}

function publicInvitation(row, now) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    company_name: row.company_name,
    admin_email: row.email_normalized,
    plan_id: row.plan_id,
    assigned_bot_id: row.assigned_bot_id,
    role: row.role || "admin",
    status: invitationStatus(row, now),
    delivery_status: row.delivery_status || "pending",
    delivery_error: row.delivery_error || null,
    created_at: row.created_at,
    expires_at: row.expires_at,
    delivered_at: row.delivered_at || null,
    used_at: row.used_at || null,
    revoked_at: row.revoked_at || null
  };
}

function mapStoreError(error) {
  if (error instanceof CustomerAccessError) return error;
  const source = String(error && (error.code || error.message) || "");
  const known = {
    INVALID_PLAN: ["invalid_plan", 400],
    INVALID_ASSIGNED_BOT: ["invalid_assigned_bot", 400],
    CUSTOMER_ALREADY_EXISTS: ["customer_already_exists", 409],
    INVALID_INVITATION: ["invalid_invitation", 403],
    INVITATION_EXPIRED: ["invitation_expired", 410],
    INVITATION_REVOKED: ["invitation_revoked", 409],
    INVITATION_ALREADY_USED: ["invitation_already_used", 409]
  };
  const key = Object.keys(known).find(function (candidate) { return source.includes(candidate); });
  if (key) return new CustomerAccessError(known[key][0], known[key][1]);
  return new CustomerAccessError("customer_access_unavailable", 503, {
    store_error: source.slice(0, 160) || "unknown_store_error",
    store_details: String(error && error.details || "").slice(0, 240) || undefined,
    store_hint: String(error && error.hint || "").slice(0, 240) || undefined
  });
}

class SupabaseCustomerAccessStore {
  constructor(options) {
    this.url = String(options.url || "").replace(/\/$/, "");
    this.headers = Object.assign({}, options.headers || {});
    this.axios = options.axiosClient;
  }

  async rpc(name, payload) {
    try {
      const response = await this.axios.post(this.url + "/rest/v1/rpc/" + name, payload, {
        headers: Object.assign({ Prefer: "return=representation" }, this.headers),
        timeout: 8000
      });
      return Array.isArray(response.data) ? response.data : response.data == null ? [] : [response.data];
    } catch (error) {
      throw mapStoreError(error && error.response && error.response.data || error);
    }
  }

  async catalogs() {
    const rows = await this.rpc("platform_customer_access_catalogs_v2", {});
    const payload = rows[0] || {};
    return { plans: payload.plans || [], bots: payload.bots || [] };
  }

  async createInvitation(input) {
    const registeredTenantId = String(input.registered_tenant_id || "").trim().toLowerCase();
    const rpcName = registeredTenantId
      ? "platform_create_registered_customer_invitation_v1"
      : "platform_create_customer_invitation_v2";
    const payload = {
      p_company_name: input.company_name,
      p_admin_email: input.admin_email,
      p_plan_id: input.plan_id,
      p_assigned_bot_id: input.assigned_bot_id,
      p_token_hash: input.token_hash,
      p_expires_at: input.expires_at,
      p_created_by: input.created_by
    };
    if (registeredTenantId) payload.p_registered_tenant_id = registeredTenantId;
    const rows = await this.rpc(rpcName, payload);
    if (!rows[0]) throw new CustomerAccessError("customer_access_unavailable", 503);
    return rows[0];
  }

  async releaseSignupConflicts(input) {
    const email = normalizeEmail(input && input.admin_email);
    const companyName = String(input && input.company_name || "").trim().replace(/\s+/g, " ");
    const before = input && input.before ? String(input.before) : "";
    const beforeDate = Date.parse(before);
    if (!Number.isFinite(beforeDate)) return { users: 0, tenants: 0 };
    const marker = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14) + "-" + crypto.randomBytes(4).toString("hex");
    const patchHeaders = Object.assign({ Prefer: "return=representation" }, this.headers);
    let releasedUsers = 0;
    let releasedTenants = 0;
    if (email) {
      const users = await this.axios.get(this.url + "/rest/v1/tenant_users", {
        params: { select: "user_id,tenant_id,email_normalized,created_at", email_normalized: "eq." + email, created_at: "lt." + before },
        headers: this.headers,
        timeout: 8000
      }).then(function (response) { return Array.isArray(response.data) ? response.data : []; });
      for (const user of users) {
        const resetEmail = "reset+" + marker + "-" + String(user.user_id || "").slice(0, 8) + "@nextforia.local";
        await this.axios.patch(this.url + "/rest/v1/tenant_users", {
          email_normalized: resetEmail,
          active: false,
          status: "disabled",
          updated_at: new Date().toISOString()
        }, {
          params: { user_id: "eq." + user.user_id },
          headers: patchHeaders,
          timeout: 8000
        });
        releasedUsers += 1;
      }
      await this.axios.patch(this.url + "/rest/v1/tenant_invitations", {
        email_normalized: "reset+" + marker + "@nextforia.local",
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        params: { email_normalized: "eq." + email, revoked_at: "is.null", created_at: "lt." + before },
        headers: patchHeaders,
        timeout: 8000
      }).catch(function () {});
    }
    if (companyName) {
      const tenants = await this.axios.get(this.url + "/rest/v1/tenants", {
        params: { select: "id,company_name,status,created_at", company_name: "ilike." + companyName, created_at: "lt." + before },
        headers: this.headers,
        timeout: 8000
      }).then(function (response) { return Array.isArray(response.data) ? response.data : []; });
      for (const tenant of tenants) {
        await this.axios.patch(this.url + "/rest/v1/tenants", {
          company_name: String(tenant.company_name || tenant.id) + " · reset " + marker,
          status: "archivado",
          updated_at: new Date().toISOString()
        }, {
          params: { id: "eq." + tenant.id },
          headers: patchHeaders,
          timeout: 8000
        });
        releasedTenants += 1;
      }
    }
    return { users: releasedUsers, tenants: releasedTenants };
  }

  async updateDelivery(input) {
    const rows = await this.rpc("platform_update_invitation_delivery_v2", {
      p_invitation_id: input.invitation_id,
      p_delivery_status: input.delivery_status,
      p_provider_message_id: input.provider_message_id || null,
      p_delivery_error: input.delivery_error || null
    });
    return rows[0] || null;
  }

  async getInvitation(input) {
    const rows = await this.rpc("platform_get_customer_invitation_v2", {
      p_tenant_id: input.tenant_id,
      p_token_hash: input.token_hash
    });
    if (!rows[0]) throw new CustomerAccessError("invalid_invitation", 403);
    return rows[0];
  }

  async consumeInvitation(input) {
    const rows = await this.rpc("platform_consume_customer_invitation_v2", {
      p_tenant_id: input.tenant_id,
      p_token_hash: input.token_hash,
      p_password_hash: input.password_hash,
      p_password_salt: input.password_salt
    });
    if (!rows[0]) throw new CustomerAccessError("invalid_invitation", 403);
    return rows[0];
  }

  async activeUserByEmail(email) {
    const normalized = normalizeEmail(email);
    try {
      const membershipResponse = await this.axios.get(this.url + "/rest/v1/tenant_users", {
        params: {
          select: "user_id,auth_user_id,tenant_id,email_normalized,role,status,active,auth_provider,session_version,password_hash,password_salt,created_at,updated_at",
          email_normalized: "eq." + normalized,
          status: "eq.active",
          active: "eq.true",
          limit: 2
        },
        headers: this.headers,
        timeout: 8000
      });
      const memberships = Array.isArray(membershipResponse.data) ? membershipResponse.data : [];
      // Multiple active memberships for one email are ambiguous and must fail closed.
      if (memberships.length !== 1) return null;
      const user = memberships[0];
      const tenantResponse = await this.axios.get(this.url + "/rest/v1/tenants", {
          params: {
            select: "id,company_name,plan_id,assigned_bot_id,status",
            id: "eq." + cleanIdentifier(user.tenant_id),
            limit: 1
          },
          headers: this.headers,
          timeout: 8000
        });
      const tenant = Array.isArray(tenantResponse.data) ? tenantResponse.data[0] : null;
      if (!tenant || tenant.id !== user.tenant_id) throw new Error("tenant_context_unavailable");
      return Object.assign({}, user, {
        company_name: tenant.company_name,
        plan_id: tenant.plan_id,
        assigned_bot_id: tenant.assigned_bot_id,
        tenant_status: tenant.status,
        created_at: user.created_at || null,
        updated_at: user.updated_at || null
      });
    } catch (error) {
      throw mapStoreError(error && error.response && error.response.data || error);
    }
  }

  async authenticateSupabase(email, password, expectedUserId) {
    try {
      const response = await this.axios.post(this.url + "/auth/v1/token?grant_type=password", {
        email: normalizeEmail(email),
        password: String(password || "")
      }, {
        headers: { apikey: this.headers.apikey, "Content-Type": "application/json" },
        timeout: 8000
      });
      const identity = response.data && response.data.user;
      const accessToken = String(response.data && response.data.access_token || "");
      if (!identity || String(identity.id) !== String(expectedUserId || "")) return false;
      // The Customer Panel uses its own HttpOnly session. Revoke the temporary
      // Supabase session created only to verify the password.
      if (accessToken) {
        await this.axios.post(this.url + "/auth/v1/logout?scope=local", null, {
          headers: { apikey: this.headers.apikey, Authorization: "Bearer " + accessToken },
          timeout: 8000
        }).catch(function () {});
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  async requestProviderPasswordRecovery(email, redirectTo) {
    const normalized = normalizeEmail(email);
    try {
      let identity = null;
      for (let page = 1; page <= 20 && !identity; page += 1) {
        const response = await this.axios.get(this.url + "/auth/v1/admin/users", {
          params: { page: page, per_page: 1000 },
          headers: this.headers,
          timeout: 8000
        });
        const rows = Array.isArray(response.data) ? response.data : response.data && response.data.users || [];
        identity = rows.find(function (row) { return normalizeEmail(row.email) === normalized; }) || null;
        if (rows.length < 1000) break;
      }
      if (!identity) {
        const created = await this.axios.post(this.url + "/auth/v1/admin/users", {
          email: normalized,
          password: crypto.randomBytes(48).toString("base64url"),
          email_confirm: true
        }, { headers: this.headers, timeout: 8000 });
        identity = created.data && (created.data.user || created.data);
      }
      if (!identity || !identity.id) throw new Error("recovery_identity_unavailable");
      await this.axios.post(this.url + "/auth/v1/recover", {
        email: normalized
      }, {
        params: { redirect_to: redirectTo },
        headers: { apikey: this.headers.apikey, "Content-Type": "application/json" },
        timeout: 8000
      });
      return true;
    } catch (error) {
      throw mapStoreError(error && error.response && error.response.data || error);
    }
  }

  async completeProviderPasswordRecovery(accessToken, password) {
    try {
      const authHeaders = { apikey: this.headers.apikey, Authorization: "Bearer " + accessToken, "Content-Type": "application/json" };
      const identityResponse = await this.axios.get(this.url + "/auth/v1/user", { headers: authHeaders, timeout: 8000 });
      const identity = identityResponse.data;
      if (!identity || !identity.id || !validEmail(identity.email)) throw new CustomerAccessError("invalid_recovery", 403);
      const user = await this.activeUserByEmail(identity.email);
      if (!user || !user.active) throw new CustomerAccessError("invalid_recovery", 403);
      await this.axios.put(this.url + "/auth/v1/user", { password: password }, { headers: authHeaders, timeout: 8000 });
      const nextVersion = Number(user.session_version || 1) + 1;
      const membershipResponse = await this.axios.patch(this.url + "/rest/v1/tenant_users", {
        auth_provider: "supabase",
        auth_user_id: identity.id,
        password_hash: null,
        password_salt: null,
        session_version: nextVersion,
        updated_at: new Date().toISOString()
      }, {
        params: {
          user_id: "eq." + cleanIdentifier(user.user_id),
          tenant_id: "eq." + cleanIdentifier(user.tenant_id),
          session_version: "eq." + Number(user.session_version || 1),
          active: "eq.true"
        },
        headers: Object.assign({ Prefer: "return=representation" }, this.headers),
        timeout: 8000
      });
      if (!Array.isArray(membershipResponse.data) || membershipResponse.data.length !== 1) {
        throw new CustomerAccessError("recovery_conflict", 409);
      }
      await this.axios.post(this.url + "/auth/v1/logout?scope=global", null, { headers: authHeaders, timeout: 8000 }).catch(function () {});
      return { email: normalizeEmail(identity.email), tenant_id: user.tenant_id };
    } catch (error) {
      if (error instanceof CustomerAccessError) throw error;
      throw mapStoreError(error && error.response && error.response.data || error);
    }
  }

  async createPasswordRecovery(input) {
    try {
      const response = await this.axios.post(this.url + "/rest/v1/tenant_password_recovery_tokens", {
        token_hash: input.token_hash,
        user_id: input.user_id,
        tenant_id: input.tenant_id,
        email_normalized: normalizeEmail(input.email),
        expires_at: input.expires_at
      }, {
        headers: Object.assign({ Prefer: "return=representation" }, this.headers),
        timeout: 8000
      });
      return Array.isArray(response.data) ? response.data[0] : null;
    } catch (error) {
      throw mapStoreError(error && error.response && error.response.data || error);
    }
  }

  async consumePasswordRecovery(tokenHash) {
    const now = new Date().toISOString();
    try {
      const response = await this.axios.patch(this.url + "/rest/v1/tenant_password_recovery_tokens", {
        used_at: now
      }, {
        params: { token_hash: "eq." + tokenHash, used_at: "is.null", expires_at: "gt." + now },
        headers: Object.assign({ Prefer: "return=representation" }, this.headers),
        timeout: 8000
      });
      const rows = Array.isArray(response.data) ? response.data : [];
      return rows.length === 1 ? rows[0] : null;
    } catch (error) {
      throw mapStoreError(error && error.response && error.response.data || error);
    }
  }

  async invalidateMembershipSessions(user, nextVersion) {
    try {
      const response = await this.axios.patch(this.url + "/rest/v1/tenant_users", {
        session_version: nextVersion,
        updated_at: new Date().toISOString()
      }, {
        params: {
          user_id: "eq." + cleanIdentifier(user.user_id),
          tenant_id: "eq." + cleanIdentifier(user.tenant_id),
          session_version: "eq." + Number(user.session_version || 1),
          active: "eq.true"
        },
        headers: Object.assign({ Prefer: "return=representation" }, this.headers),
        timeout: 8000
      });
      const rows = Array.isArray(response.data) ? response.data : [];
      if (rows.length !== 1) throw new CustomerAccessError("recovery_conflict", 409);
      return rows[0];
    } catch (error) {
      if (error instanceof CustomerAccessError) throw error;
      throw mapStoreError(error && error.response && error.response.data || error);
    }
  }

  async resetPassword(user, password) {
    if (String(user.auth_provider || "local") === "supabase") {
      try {
        await this.axios.put(this.url + "/auth/v1/admin/users/" + encodeURIComponent(user.auth_user_id || user.user_id), {
          password: password
        }, { headers: this.headers, timeout: 8000 });
        return true;
      } catch (error) {
        throw mapStoreError(error && error.response && error.response.data || error);
      }
    }
    const salt = crypto.randomBytes(16);
    try {
      const response = await this.axios.patch(this.url + "/rest/v1/tenant_users", {
        password_hash: hashPassword(password, salt),
        password_salt: salt.toString("base64url"),
        updated_at: new Date().toISOString()
      }, {
        params: {
          user_id: "eq." + cleanIdentifier(user.user_id),
          tenant_id: "eq." + cleanIdentifier(user.tenant_id),
          active: "eq.true"
        },
        headers: Object.assign({ Prefer: "return=representation" }, this.headers),
        timeout: 8000
      });
      if (!Array.isArray(response.data) || response.data.length !== 1) throw new CustomerAccessError("invalid_recovery", 403);
      return true;
    } catch (error) {
      if (error instanceof CustomerAccessError) throw error;
      throw mapStoreError(error && error.response && error.response.data || error);
    }
  }

  async updatePassword(input) {
    try {
      const response = await this.axios.patch(this.url + "/rest/v1/tenant_users", {
        password_hash: input.password_hash,
        password_salt: input.password_salt,
        updated_at: new Date().toISOString()
      }, {
        params: {
          user_id: "eq." + cleanIdentifier(input.user_id),
          tenant_id: "eq." + cleanIdentifier(input.tenant_id),
          email_normalized: "eq." + normalizeEmail(input.email),
          active: "eq.true"
        },
        headers: Object.assign({ Prefer: "return=representation" }, this.headers),
        timeout: 8000
      });
      const rows = Array.isArray(response.data) ? response.data : [];
      if (!rows[0]) throw new CustomerAccessError("invalid_credentials", 401);
      return rows[0];
    } catch (error) {
      if (error instanceof CustomerAccessError) throw error;
      throw mapStoreError(error && error.response && error.response.data || error);
    }
  }

  async listInvitations() {
    return this.rpc("platform_list_customer_invitations_v2", {});
  }

  async revokeInvitation(invitationId, actor) {
    const rows = await this.rpc("platform_revoke_customer_invitation_v2", {
      p_invitation_id: invitationId,
      p_actor: actor
    });
    if (!rows[0]) throw new CustomerAccessError("invalid_invitation", 403);
    return rows[0];
  }

  async createPublicSignupDirect(input) {
    const now = new Date().toISOString();
    const slug = String(input.company_name || "cliente").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 45) || "cliente";
    const tenantId = slug + "-" + crypto.randomBytes(3).toString("hex");
    const headers = Object.assign({ Prefer: "return=representation" }, this.headers);
    const tenant = await this.axios.post(this.url + "/rest/v1/tenants", {
      id: tenantId,
      company_name: input.company_name,
      plan_id: input.plan_id,
      assigned_bot_id: input.assigned_bot_id,
      status: "setup"
    }, { headers: headers, timeout: 10000 }).then(function (response) {
      return Array.isArray(response.data) ? response.data[0] : response.data;
    });
    const user = await this.axios.post(this.url + "/rest/v1/tenant_users", {
      tenant_id: tenantId,
      email_normalized: input.admin_email,
      role: "admin",
      status: "active",
      active: true,
      password_hash: input.password_hash,
      password_salt: input.password_salt
    }, { headers: headers, timeout: 10000 }).then(function (response) {
      return Array.isArray(response.data) ? response.data[0] : response.data;
    });
    let invitation = null;
    try {
      invitation = await this.axios.post(this.url + "/rest/v1/tenant_invitations", {
        tenant_id: tenantId,
        tenant_user_id: user.user_id,
        email_normalized: input.admin_email,
        role: "admin",
        token_hash: input.token_hash,
        delivery_status: "pending",
        expires_at: input.expires_at,
        used_at: now,
        created_by: input.created_by || "public_signup"
      }, { headers: headers, timeout: 10000 }).then(function (response) {
        return Array.isArray(response.data) ? response.data[0] : response.data;
      });
    } catch (_) {
      invitation = null;
    }
    try {
      await this.axios.post(this.url + "/rest/v1/tenant_access_audit", {
        tenant_id: tenantId,
        invitation_id: invitation && invitation.id || null,
        actor: "public_signup",
        action: "tenant_invitation_created",
        metadata: { source: "public_signup_direct", plan_id: input.plan_id, assigned_bot_id: input.assigned_bot_id, admin_email: input.admin_email }
      }, { headers: Object.assign({ Prefer: "return=minimal" }, this.headers), timeout: 8000 });
    } catch (_) {}
    return {
      user_id: user.user_id,
      tenant_id: tenantId,
      email_normalized: input.admin_email,
      role: user.role || "admin",
      company_name: tenant && tenant.company_name || input.company_name,
      created_at: user.created_at || now,
      updated_at: user.updated_at || now
    };
  }
}

class InMemoryCustomerAccessStore {
  constructor(options) {
    options = options || {};
    this.plans = options.plans || [
      { id: "nextfor-uno", name: "Nextfor Uno", active: true },
      { id: "nextfor-aura", name: "Nextfor Aura", active: true },
      { id: "nextfor-tempo", name: "Nextfor Tempo", active: true },
      { id: "nextfor-atlas", name: "Nextfor Atlas", active: true },
      { id: "nextfor-signature", name: "Nextfor Signature", active: true },
      { id: "starter", name: "Starter", active: true },
      { id: "growth", name: "Growth", active: true },
      { id: "scale", name: "Scale", active: true }
    ];
    this.bots = options.bots || [
      { id: "atencion-cliente", name: "Atención al cliente", active: true },
      { id: "agendamiento", name: "Agendamiento", active: true },
      { id: "commerce", name: "Commerce", active: true }
    ];
    this.tenants = [];
    this.users = [];
    this.invitations = [];
    this.passwordRecoveries = [];
    this.audit = [];
    this.now = typeof options.now === "function" ? options.now : function () { return new Date(); };
  }

  setNow(now) {
    if (typeof now === "function") this.now = now;
  }

  seedActiveUser(input) {
    const email = normalizeEmail(input && input.email);
    const tenantId = cleanIdentifier(input && input.tenant_id);
    const companyName = String(input && input.company_name || tenantId).trim();
    const password = String(input && input.password || "");
    if (!validEmail(email) || !tenantId || !companyName || !password) throw new Error("invalid_test_fixture");
    const tenant = this.tenants.find(function (row) { return row.id === tenantId; }) || {
      id: tenantId,
      company_name: companyName,
      plan_id: cleanIdentifier(input.plan_id) || "nextfor-uno",
      assigned_bot_id: cleanIdentifier(input.assigned_bot_id) || "atencion-cliente",
      status: cleanIdentifier(input.tenant_status) || "setup",
      created_at: input.created_at || new Date().toISOString(),
      updated_at: input.updated_at || input.created_at || new Date().toISOString()
    };
    if (!this.tenants.some(function (row) { return row.id === tenantId; })) this.tenants.push(tenant);
    const suppliedSalt = String(input.password_salt || "");
    const suppliedHash = String(input.password_hash || "");
    const salt = suppliedSalt ? Buffer.from(suppliedSalt, "base64url") : crypto.randomBytes(16);
    const user = {
      user_id: String(input.user_id || crypto.randomUUID()),
      tenant_id: tenantId,
      email_normalized: email,
      role: input.role || "admin",
      status: "active",
      active: input.active !== false,
      auth_provider: input.auth_provider || "local",
      session_version: Number(input.session_version || 1),
      password_hash: suppliedHash || hashPassword(password, salt),
      password_salt: salt.toString("base64url"),
      created_at: input.created_at || new Date().toISOString(),
      updated_at: input.updated_at || input.created_at || new Date().toISOString()
    };
    this.users.push(user);
    return Object.assign({}, user, { company_name: companyName });
  }

  seedInvitation(input) {
    const email = normalizeEmail(input && input.email);
    const tenantId = cleanIdentifier(input && input.tenant_id);
    const companyName = String(input && input.company_name || tenantId).trim();
    const token = String(input && input.token || "");
    if (!validEmail(email) || !tenantId || !companyName || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("invalid_test_invitation_fixture");
    const now = new Date().toISOString();
    if (!this.tenants.some(function (row) { return row.id === tenantId; })) {
      this.tenants.push({ id: tenantId, company_name: companyName, plan_id: "nextfor-uno", assigned_bot_id: "atencion-cliente", status: "setup", created_at: now, updated_at: now });
    }
    const user = {
      user_id: String(input.user_id || crypto.randomUUID()),
      tenant_id: tenantId,
      email_normalized: email,
      role: "admin",
      status: "pending",
      active: false,
      password_hash: null,
      password_salt: null,
      created_at: now,
      updated_at: now
    };
    const invitation = {
      id: String(input.invitation_id || crypto.randomUUID()),
      tenant_id: tenantId,
      tenant_user_id: user.user_id,
      email_normalized: email,
      company_name: companyName,
      plan_id: "nextfor-uno",
      assigned_bot_id: "atencion-cliente",
      role: "admin",
      token_hash: hashInvitationToken(token),
      delivery_status: "sent",
      created_by: "test-fixture",
      created_at: now,
      expires_at: input.expires_at || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      delivered_at: now,
      used_at: input.used_at || null,
      revoked_at: input.revoked_at || null
    };
    this.users.push(user);
    this.invitations.push(invitation);
    return Object.assign({}, invitation, { token: undefined });
  }

  async catalogs() {
    return customerVisibleCatalogs({
      plans: this.plans.filter(function (row) { return row.active; }),
      bots: this.bots.filter(function (row) { return row.active; })
    });
  }

  async createInvitation(input) {
    if (!this.plans.some(function (row) { return row.id === input.plan_id && row.active; })) throw new CustomerAccessError("invalid_plan", 400);
    if (!this.bots.some(function (row) { return row.id === input.assigned_bot_id && row.active; })) throw new CustomerAccessError("invalid_assigned_bot", 400);
    if (this.users.some(function (row) { return row.email_normalized === input.admin_email; })) throw new CustomerAccessError("customer_already_exists", 409);
    const registeredTenantId = String(input.registered_tenant_id || "").trim().toLowerCase();
    if (registeredTenantId && !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(registeredTenantId)) throw new CustomerAccessError("invalid_request", 400);
    const slug = input.company_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45) || "cliente";
    if (this.tenants.some(function (row) { return row.company_name.toLowerCase() === input.company_name.toLowerCase(); })) throw new CustomerAccessError("customer_already_exists", 409);
    const now = new Date().toISOString();
    if (registeredTenantId && this.tenants.some(function (row) { return row.id === registeredTenantId; })) throw new CustomerAccessError("customer_already_exists", 409);
    const tenant = { id: registeredTenantId || slug + "-" + crypto.randomBytes(3).toString("hex"), company_name: input.company_name, plan_id: input.plan_id, assigned_bot_id: input.assigned_bot_id, status: "setup", created_at: now, updated_at: now };
    const user = { user_id: crypto.randomUUID(), tenant_id: tenant.id, email_normalized: input.admin_email, role: "admin", status: "pending", active: false, password_hash: null, password_salt: null, created_at: now, updated_at: now };
    const invitation = { id: crypto.randomUUID(), tenant_id: tenant.id, tenant_user_id: user.user_id, email_normalized: input.admin_email, company_name: tenant.company_name, plan_id: tenant.plan_id, assigned_bot_id: tenant.assigned_bot_id, role: "admin", token_hash: input.token_hash, delivery_status: "pending", delivery_error: null, provider_message_id: null, created_by: input.created_by, created_at: now, expires_at: input.expires_at, delivered_at: null, used_at: null, revoked_at: null };
    this.tenants.push(tenant);
    this.users.push(user);
    this.invitations.push(invitation);
    this.audit.push({ action: "tenant_invitation_created", tenant_id: tenant.id, invitation_id: invitation.id, actor: input.created_by, created_at: now });
    return Object.assign({}, invitation, { tenant_status: tenant.status, membership_status: user.status });
  }

  async releaseSignupConflicts(input) {
    const email = normalizeEmail(input && input.admin_email);
    const companyName = String(input && input.company_name || "").trim().replace(/\s+/g, " ");
    const before = input && input.before ? String(input.before) : "";
    const beforeDate = Date.parse(before);
    if (!Number.isFinite(beforeDate)) return { users: 0, tenants: 0 };
    const marker = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14) + "-" + crypto.randomBytes(4).toString("hex");
    let releasedUsers = 0;
    let releasedTenants = 0;
    if (email) {
      this.users.forEach(function (user) {
        const created = Date.parse(user.created_at || "");
        if (user.email_normalized === email && Number.isFinite(created) && created < beforeDate) {
          user.email_normalized = "reset+" + marker + "-" + String(user.user_id || "").slice(0, 8) + "@nextforia.local";
          user.active = false;
          user.status = "disabled";
          user.updated_at = new Date().toISOString();
          releasedUsers += 1;
        }
      });
      this.invitations.forEach(function (invitation) {
        const created = Date.parse(invitation.created_at || "");
        if (invitation.email_normalized === email && Number.isFinite(created) && created < beforeDate) {
          invitation.email_normalized = "reset+" + marker + "-" + String(invitation.id || "").slice(0, 8) + "@nextforia.local";
          invitation.revoked_at = invitation.revoked_at || new Date().toISOString();
        }
      });
    }
    if (companyName) {
      this.tenants.forEach(function (tenant) {
        const created = Date.parse(tenant.created_at || "");
        if (String(tenant.company_name || "").toLowerCase() === companyName.toLowerCase() && Number.isFinite(created) && created < beforeDate) {
          tenant.company_name = String(tenant.company_name || tenant.id) + " · reset " + marker;
          tenant.status = "archivado";
          tenant.updated_at = new Date().toISOString();
          releasedTenants += 1;
        }
      });
    }
    return { users: releasedUsers, tenants: releasedTenants };
  }

  async updateDelivery(input) {
    const row = this.invitations.find(function (item) { return item.id === input.invitation_id; });
    if (!row) throw new CustomerAccessError("invalid_invitation", 403);
    row.delivery_status = input.delivery_status;
    row.provider_message_id = input.provider_message_id || null;
    row.delivery_error = input.delivery_error ? String(input.delivery_error).slice(0, 160) : null;
    row.delivered_at = input.delivery_status === "sent" ? new Date().toISOString() : null;
    this.audit.push({ action: input.delivery_status === "sent" ? "invitation_delivered" : "invitation_delivery_failed", tenant_id: row.tenant_id, invitation_id: row.id, created_at: new Date().toISOString() });
    return row;
  }

  async getInvitation(input) {
    const row = this.invitations.find(function (item) { return item.tenant_id === input.tenant_id && item.token_hash === input.token_hash; });
    if (!row) throw new CustomerAccessError("invalid_invitation", 403);
    return Object.assign({}, row);
  }

  async consumeInvitation(input) {
    const row = this.invitations.find(function (item) { return item.tenant_id === input.tenant_id && item.token_hash === input.token_hash; });
    if (!row) throw new CustomerAccessError("invalid_invitation", 403);
    const status = invitationStatus(row, this.now());
    if (status === "used") throw new CustomerAccessError("invitation_already_used", 409);
    if (status === "revoked") throw new CustomerAccessError("invitation_revoked", 409);
    if (status === "expired") throw new CustomerAccessError("invitation_expired", 410);
    const user = this.users.find(function (item) { return item.user_id === row.tenant_user_id && item.tenant_id === row.tenant_id; });
    const now = new Date().toISOString();
    row.used_at = now;
    user.password_hash = input.password_hash;
    user.password_salt = input.password_salt;
    user.status = "active";
    user.active = true;
    user.updated_at = now;
    this.audit.push({ action: "invitation_consumed", tenant_id: row.tenant_id, invitation_id: row.id, actor: user.user_id, created_at: now });
    return { user_id: user.user_id, tenant_id: user.tenant_id, email_normalized: user.email_normalized, role: user.role, company_name: row.company_name };
  }

  async activeUserByEmail(email) {
    const normalized = normalizeEmail(email);
    const rows = this.users.filter(function (item) { return item.email_normalized === normalized && item.active && item.status === "active"; });
    if (rows.length !== 1) return null;
    const row = rows[0];
    const tenant = this.tenants.find(function (item) { return item.id === row.tenant_id; });
    return Object.assign({}, row, {
      company_name: tenant ? tenant.company_name : null,
      plan_id: tenant ? tenant.plan_id : null,
      assigned_bot_id: tenant ? tenant.assigned_bot_id : null,
      tenant_status: tenant ? tenant.status : null
    });
  }

  async authenticateSupabase(email, password, expectedUserId) {
    const row = this.users.find(function (item) {
      return item.email_normalized === normalizeEmail(email) && item.user_id === expectedUserId;
    });
    if (!row) return false;
    const salt = Buffer.from(String(row.password_salt || ""), "base64url");
    return !!row.password_hash && hashPassword(password, salt) === row.password_hash;
  }

  async createPasswordRecovery(input) {
    const row = {
      id: crypto.randomUUID(),
      token_hash: input.token_hash,
      user_id: input.user_id,
      tenant_id: input.tenant_id,
      email_normalized: normalizeEmail(input.email),
      expires_at: input.expires_at,
      used_at: null,
      created_at: this.now().toISOString()
    };
    this.passwordRecoveries.push(row);
    return Object.assign({}, row);
  }

  async consumePasswordRecovery(tokenHash) {
    const now = this.now();
    const row = this.passwordRecoveries.find(function (item) {
      return item.token_hash === tokenHash && !item.used_at && new Date(item.expires_at) > now;
    });
    if (!row) return null;
    row.used_at = now.toISOString();
    return Object.assign({}, row);
  }

  async invalidateMembershipSessions(user, nextVersion) {
    const row = this.users.find(function (item) {
      return item.user_id === user.user_id && item.tenant_id === user.tenant_id && item.active;
    });
    if (!row || Number(row.session_version || 1) !== Number(user.session_version || 1)) {
      throw new CustomerAccessError("recovery_conflict", 409);
    }
    row.session_version = Number(nextVersion);
    row.updated_at = this.now().toISOString();
    return Object.assign({}, row);
  }

  async resetPassword(user, password) {
    const row = this.users.find(function (item) {
      return item.user_id === user.user_id && item.tenant_id === user.tenant_id && item.active;
    });
    if (!row) throw new CustomerAccessError("invalid_recovery", 403);
    const salt = crypto.randomBytes(16);
    row.password_hash = hashPassword(password, salt);
    row.password_salt = salt.toString("base64url");
    row.updated_at = this.now().toISOString();
    return true;
  }

  async updatePassword(input) {
    const row = this.users.find(function (item) {
      return item.user_id === input.user_id &&
        item.tenant_id === input.tenant_id &&
        item.email_normalized === normalizeEmail(input.email) &&
        item.active;
    });
    if (!row) throw new CustomerAccessError("invalid_credentials", 401);
    row.password_hash = input.password_hash;
    row.password_salt = input.password_salt;
    row.updated_at = new Date().toISOString();
    this.audit.push({
      action: "customer_password_changed",
      tenant_id: row.tenant_id,
      actor: row.user_id,
      created_at: row.updated_at
    });
    return Object.assign({}, row);
  }

  async listInvitations() {
    return this.invitations.map(function (row) { return Object.assign({}, row, { token_hash: undefined }); });
  }

  async revokeInvitation(invitationId, actor) {
    const row = this.invitations.find(function (item) { return item.id === invitationId; });
    if (!row) throw new CustomerAccessError("invalid_invitation", 403);
    if (row.used_at) throw new CustomerAccessError("invitation_already_used", 409);
    if (!row.revoked_at) {
      row.revoked_at = new Date().toISOString();
      this.audit.push({ action: "invitation_revoked", tenant_id: row.tenant_id, invitation_id: row.id, actor: actor, created_at: row.revoked_at });
    }
    return Object.assign({}, row);
  }
}

function createResendEmailSender(options) {
  const apiKey = String(options.apiKey || "");
  const replyTo = String(options.replyTo || "");
  const axiosClient = options.axiosClient;
  return {
    async sendInvitation(message) {
      const fallbackUrls = Array.isArray(message.fallback_setup_urls) ? message.fallback_setup_urls : [];
      const fallbackText = fallbackUrls.length
        ? "\n\nSi el enlace principal esta bloqueado por una red publica o corporativa, usa este enlace alterno:\n" + fallbackUrls.join("\n")
        : "";
      const fallbackHtml = fallbackUrls.length
        ? "<p>Si el enlace principal esta bloqueado por una red publica o corporativa, usa este enlace alterno:</p><ul>" + fallbackUrls.map(function (url) {
          return "<li><a href=\"" + escapeHtml(url) + "\">" + escapeHtml(url) + "</a></li>";
        }).join("") + "</ul>"
        : "";
      const response = await axiosClient.post("https://api.resend.com/emails", {
        from: NEXTFORIA_SETUP_EMAIL_FROM,
        to: [message.to],
        reply_to: replyTo || undefined,
        subject: "Crea tu acceso a Nextfor IA",
        text: "Hola. " + message.company_name + " fue creado en Nextfor IA. Define tu contraseña usando este enlace privado (vence el " + message.expires_at + "): " + message.setup_url + fallbackText + "\n\nEntrar a Nextfor: " + NEXTFORIA_HOME_URL,
        html: "<p>Hola.</p><p><strong>" + escapeHtml(message.company_name) + "</strong> fue creado en Nextfor IA.</p><p><a href=\"" + escapeHtml(message.setup_url) + "\">Crear mi contraseña</a></p>" + fallbackHtml + "<p>Este enlace es privado, de un solo uso y vence el " + escapeHtml(message.expires_at) + ".</p><p><a href=\"" + NEXTFORIA_HOME_URL + "\">Entrar a nextforia.com</a></p>"
      }, {
        headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
        timeout: 8000
      });
      return { id: response.data && response.data.id || null };
    },
    async sendPasswordRecovery(message) {
      const response = await axiosClient.post("https://api.resend.com/emails", {
        from: NEXTFORIA_SETUP_EMAIL_FROM,
        to: [message.to],
        reply_to: replyTo || undefined,
        subject: "Recupera tu acceso a Nextfor IA",
        text: "Recibimos una solicitud para cambiar tu contraseña. Usa este enlace privado: " + message.recovery_url + "\n\nEl enlace vence el " + message.expires_at + ". Si no solicitaste este cambio, ignora este mensaje.\n\nEntrar a Nextfor: " + NEXTFORIA_HOME_URL,
        html: "<p>Recibimos una solicitud para cambiar tu contraseña.</p><p><a href=\"" + escapeHtml(message.recovery_url) + "\">Crear una nueva contraseña</a></p><p>Este enlace es privado, de un solo uso y vence el " + escapeHtml(message.expires_at) + ".</p><p>Si no solicitaste este cambio, ignora este mensaje.</p><p><a href=\"" + NEXTFORIA_HOME_URL + "\">Entrar a nextforia.com</a></p>"
      }, {
        headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
        timeout: 8000
      });
      return { id: response.data && response.data.id || null };
    }
  };
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function createMemoryEmailSender() {
  const outbox = [];
  return {
    outbox: outbox,
    async sendInvitation(message) {
      outbox.push(Object.assign({}, message));
      return { id: "test-email-" + outbox.length };
    },
    async sendPasswordRecovery(message) {
      outbox.push(Object.assign({ type: "password_recovery" }, message));
      return { id: "test-email-" + outbox.length };
    }
  };
}

function createCustomerAccessService(options) {
  const store = options.store;
  const emailSender = options.emailSender;
  const invitationOrigins = uniqueInvitationOrigins(options.baseUrl, options.fallbackBaseUrls);
  const baseUrl = invitationOrigins[0] || "";
  const fallbackBaseUrls = invitationOrigins.slice(1);
  const ttlHours = Math.max(1, Math.min(168, Number(options.inviteTtlHours) || 24));
  const now = typeof options.now === "function" ? options.now : function () { return new Date(); };
  const resolveRegisteredTenantId = typeof options.resolveRegisteredTenantId === "function"
    ? options.resolveRegisteredTenantId
    : function () { return ""; };
  if (store && typeof store.setNow === "function") store.setNow(now);

  async function inspectInvitation(tenantId, token) {
    const cleanTenant = String(tenantId || "").trim().toLowerCase();
    const cleanToken = String(token || "");
    if (!/^[A-Za-z0-9_-]{43}$/.test(cleanToken)) throw new CustomerAccessError("invalid_invitation", 403);
    let row;
    try { row = await store.getInvitation({ tenant_id: cleanTenant, token_hash: hashInvitationToken(cleanToken) }); }
    catch (error) { throw mapStoreError(error); }
    const status = invitationStatus(row, now());
    if (status === "used") throw new CustomerAccessError("invitation_already_used", 409);
    if (status === "revoked") throw new CustomerAccessError("invitation_revoked", 409);
    if (status === "expired") throw new CustomerAccessError("invitation_expired", 410);
    return { id: row.id, tenant_id: row.tenant_id, company_name: row.company_name, email: row.email_normalized, role: row.role || "admin", expires_at: row.expires_at };
  }

  async function authenticateCustomer(email, password) {
    const normalized = normalizeEmail(email);
    if (!validEmail(normalized) || !password) return null;
    let user;
    try { user = await store.activeUserByEmail(normalized); }
    catch (error) { throw mapStoreError(error); }
    if (!user || !user.tenant_id || !user.active) return null;
    const provider = String(user.auth_provider || "local");
    if (provider === "supabase") {
      if (!store.authenticateSupabase || !await store.authenticateSupabase(normalized, password, user.auth_user_id || user.user_id)) return null;
    } else {
      if (!user.password_hash || !user.password_salt) return null;
      let candidate;
      try { candidate = hashPassword(password, Buffer.from(user.password_salt, "base64url")); }
      catch (_) { return null; }
      const stored = Buffer.from(String(user.password_hash));
      const supplied = Buffer.from(String(candidate));
      if (stored.length !== supplied.length || !crypto.timingSafeEqual(stored, supplied)) return null;
    }
    return {
      user_id: user.user_id,
      email: normalized,
      username: normalized,
      name: normalized,
      role: user.role || "admin",
      tenant_id: user.tenant_id,
      company_name: user.company_name || null,
      plan_id: user.plan_id || null,
      assigned_bot_id: user.assigned_bot_id || null,
      tenant_status: user.tenant_status || null,
      auth_provider: provider,
      membership_version: Number(user.session_version || 1),
      created_at: user.created_at || null,
      updated_at: user.updated_at || null
    };
  }

  async function requestPasswordRecovery(email) {
    const normalized = normalizeEmail(email);
    // Always return the same public response, whether the account exists or not.
    if (!validEmail(normalized)) return { accepted: true };
    let user = null;
    try { user = await store.activeUserByEmail(normalized); }
    catch (_) { return { accepted: true }; }
    if (!user || !user.active || !user.user_id || !user.tenant_id) return { accepted: true };
    if (store && typeof store.requestProviderPasswordRecovery === "function") {
      try {
        await store.requestProviderPasswordRecovery(normalized, baseUrl + "/admin/reset-password");
      } catch (_) {}
      return { accepted: true };
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(now().getTime() + 30 * 60 * 1000).toISOString();
    try {
      await store.createPasswordRecovery({
        token_hash: hashInvitationToken(token),
        user_id: user.user_id,
        tenant_id: user.tenant_id,
        email: normalized,
        expires_at: expiresAt
      });
      await emailSender.sendPasswordRecovery({
        to: normalized,
        recovery_url: baseUrl + "/admin/reset-password?token=" + encodeURIComponent(token),
        expires_at: expiresAt
      });
    } catch (_) {
      // Do not disclose delivery, schema or account state to the requester.
    }
    return { accepted: true };
  }

  async function completePasswordRecovery(input) {
    const password = validatePassword(input && input.password, input && input.password_confirmation);
    const accessToken = String(input && input.access_token || "");
    if (accessToken) {
      if (!store || typeof store.completeProviderPasswordRecovery !== "function") {
        throw new CustomerAccessError("invalid_recovery", 403);
      }
      const completed = await store.completeProviderPasswordRecovery(accessToken, password);
      return { ok: true, email: completed.email, tenant_id: completed.tenant_id };
    }
    const token = String(input && input.token || "");
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new CustomerAccessError("invalid_recovery", 403);
    let recovery;
    try { recovery = await store.consumePasswordRecovery(hashInvitationToken(token)); }
    catch (error) { throw mapStoreError(error); }
    if (!recovery) throw new CustomerAccessError("invalid_recovery", 403);
    let user;
    try { user = await store.activeUserByEmail(recovery.email_normalized); }
    catch (error) { throw mapStoreError(error); }
    if (!user || String(user.user_id) !== String(recovery.user_id) || String(user.tenant_id) !== String(recovery.tenant_id)) {
      throw new CustomerAccessError("invalid_recovery", 403);
    }
    // Invalidate every Customer Panel session before changing the credential.
    const nextVersion = Number(user.session_version || 1) + 1;
    await store.invalidateMembershipSessions(user, nextVersion);
    await store.resetPassword(user, password);
    return { ok: true, email: recovery.email_normalized, tenant_id: recovery.tenant_id };
  }

  async function changePassword(session, input) {
    const email = normalizeEmail(session && session.email);
    const userId = String(session && session.user_id || "");
    const tenantId = String(session && session.tenant_id || "").trim().toLowerCase();
    if (!validEmail(email) || !userId || !tenantId) throw new CustomerAccessError("invalid_credentials", 401);
    const authenticated = await authenticateCustomer(email, input && input.current_password);
    if (!authenticated ||
        String(authenticated.user_id) !== userId ||
        String(authenticated.tenant_id) !== tenantId) {
      throw new CustomerAccessError("invalid_current_password", 401);
    }
    const password = validatePassword(
      input && input.password,
      input && input.password_confirmation
    );
    if (password === String(input && input.current_password || "")) {
      throw new CustomerAccessError("password_reuse", 400);
    }
    if (!store || typeof store.resetPassword !== "function" || typeof store.invalidateMembershipSessions !== "function") {
      throw new CustomerAccessError("customer_access_unavailable", 503);
    }
    try {
      const user = await store.activeUserByEmail(email);
      await store.invalidateMembershipSessions(user, Number(user.session_version || 1) + 1);
      await store.resetPassword(user, password);
    } catch (error) {
      throw mapStoreError(error);
    }
    return { ok: true, user_id: userId, tenant_id: tenantId, email };
  }

  return {
    async catalogs() {
      try { return customerVisibleCatalogs(await store.catalogs()); }
      catch (error) { throw mapStoreError(error); }
    },

    async createInvitation(input, actor) {
      const clean = validateCreateInput(input);
      const registeredTenantId = String(resolveRegisteredTenantId(clean.company_name) || "").trim().toLowerCase();
      if (registeredTenantId && !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(registeredTenantId)) {
        throw new CustomerAccessError("invalid_request", 400);
      }
      const token = crypto.randomBytes(32).toString("base64url");
      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
      let created;
      try {
        created = await store.createInvitation(Object.assign({}, clean, {
          token_hash: hashInvitationToken(token),
          expires_at: expiresAt,
          registered_tenant_id: registeredTenantId || null,
          created_by: String(actor && (actor.user_id || actor.email || actor.username) || "super_admin").slice(0, 160)
        }));
      } catch (error) {
        throw mapStoreError(error);
      }
      const setupPath = "/admin/setup/" + encodeURIComponent(created.tenant_id) + "?invite=" + encodeURIComponent(token);
      const setupUrl = baseUrl + setupPath;
      const fallbackSetupUrls = fallbackBaseUrls.map(function (origin) { return origin + setupPath; });
      try {
        const delivery = await emailSender.sendInvitation({ to: clean.admin_email, company_name: clean.company_name, setup_url: setupUrl, fallback_setup_urls: fallbackSetupUrls, expires_at: expiresAt });
        const updated = await store.updateDelivery({ invitation_id: created.id, delivery_status: "sent", provider_message_id: delivery && delivery.id || null });
        return {
          tenant: { id: created.tenant_id, company_name: clean.company_name, plan_id: clean.plan_id, assigned_bot_id: clean.assigned_bot_id, status: created.tenant_status || "setup" },
          membership: { email: clean.admin_email, role: "admin", status: created.membership_status || "pending" },
          invitation: publicInvitation(Object.assign({}, created, updated || {}, { company_name: clean.company_name, email_normalized: clean.admin_email, plan_id: clean.plan_id, assigned_bot_id: clean.assigned_bot_id }), now())
        };
      } catch (error) {
        await store.updateDelivery({ invitation_id: created.id, delivery_status: "failed", delivery_error: "provider_rejected" }).catch(function () {});
        throw new CustomerAccessError("email_delivery_failed", 502, {
          tenant_id: created.tenant_id,
          invitation_id: created.id,
          delivery_status: "failed"
        });
      }
    },

    async createPublicSignup(input) {
      const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
      const publicPlanId = String(body.plan_id || "").trim().toLowerCase();
      const publicBotId = String(body.assigned_bot_id || "").trim().toLowerCase();
      if (!["nextfor-uno", "nextfor-aura"].includes(publicPlanId)) {
        throw new CustomerAccessError("invalid_plan", 400);
      }
      if (publicBotId !== "atencion-cliente") {
        throw new CustomerAccessError("invalid_assigned_bot", 400);
      }
      const clean = validateCreateInput({
        company_name: body.company_name,
        admin_email: body.admin_email,
        plan_id: body.plan_id,
        assigned_bot_id: body.assigned_bot_id
      });
      const password = validatePassword(body.password, body.password_confirmation);
      const token = crypto.randomBytes(32).toString("base64url");
      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
      const salt = crypto.randomBytes(16);
      const passwordHash = hashPassword(password, salt);
      const passwordSalt = salt.toString("base64url");
      if (store && typeof store.createPublicSignupDirect === "function" && body.use_direct_signup === true) {
        try {
          if (typeof store.releaseSignupConflicts === "function") {
            await store.releaseSignupConflicts(Object.assign({}, clean, { before: body.reset_conflicts_before }));
          }
          const directUser = await store.createPublicSignupDirect(Object.assign({}, clean, {
            token_hash: hashInvitationToken(token),
            expires_at: expiresAt,
            password_hash: passwordHash,
            password_salt: passwordSalt,
            created_by: "public_signup"
          }));
          return {
            user_id: directUser.user_id,
            email: directUser.email_normalized,
            username: directUser.email_normalized,
            name: directUser.email_normalized,
            role: directUser.role || "admin",
            tenant_id: directUser.tenant_id,
            company_name: directUser.company_name || clean.company_name,
            plan_id: clean.plan_id,
            assigned_bot_id: clean.assigned_bot_id,
            tenant_status: "setup",
            created_at: directUser.created_at || createdAt.toISOString(),
            updated_at: directUser.updated_at || createdAt.toISOString()
          };
        } catch (error) {
          const mapped = mapStoreError(error && error.response && error.response.data || error);
          mapped.details = Object.assign({ stage: "public_signup_direct" }, mapped.details || {});
          throw mapped;
        }
      }
      let created;
      try {
        if (store && typeof store.releaseSignupConflicts === "function") {
          try {
            await store.releaseSignupConflicts(Object.assign({}, clean, { before: body.reset_conflicts_before }));
          } catch (releaseError) {
            const releaseSource = String(releaseError && releaseError.details && releaseError.details.store_error || releaseError && (releaseError.code || releaseError.message) || "");
            if (releaseSource !== "PGRST205" && releaseSource !== "ERR_BAD_REQUEST") throw releaseError;
          }
        }
        created = await store.createInvitation(Object.assign({}, clean, {
          token_hash: hashInvitationToken(token),
          expires_at: expiresAt,
          created_by: "public_signup"
        }));
      } catch (error) {
        const mapped = mapStoreError(error);
        mapped.details = Object.assign({ stage: "public_signup_create_invitation" }, mapped.details || {});
        throw mapped;
      }
      let user;
      try {
        user = await store.consumeInvitation({
          tenant_id: created.tenant_id,
          token_hash: hashInvitationToken(token),
          password_hash: passwordHash,
          password_salt: passwordSalt
        });
      } catch (error) {
        const mapped = mapStoreError(error);
        mapped.details = Object.assign({ stage: "public_signup_consume_invitation" }, mapped.details || {});
        throw mapped;
      }
      return {
        user_id: user.user_id,
        email: user.email_normalized,
        username: user.email_normalized,
        name: user.email_normalized,
        role: user.role || "admin",
        tenant_id: user.tenant_id,
        company_name: user.company_name || clean.company_name,
        plan_id: clean.plan_id,
        assigned_bot_id: clean.assigned_bot_id,
        tenant_status: "setup"
      };
    },

    inspectInvitation: inspectInvitation,

    async consumeInvitation(input) {
      const inspected = await inspectInvitation(input.tenant_id, input.token);
      const password = validatePassword(input.password, input.password_confirmation);
      const salt = crypto.randomBytes(16);
      let user;
      try {
        user = await store.consumeInvitation({
          tenant_id: inspected.tenant_id,
          token_hash: hashInvitationToken(input.token),
          password_hash: hashPassword(password, salt),
          password_salt: salt.toString("base64url")
        });
      } catch (error) {
        throw mapStoreError(error);
      }
      return {
        user_id: user.user_id,
        email: user.email_normalized,
        username: user.email_normalized,
        name: user.email_normalized,
        role: user.role || "admin",
        tenant_id: user.tenant_id,
        company_name: user.company_name || inspected.company_name
      };
    },

    async confirmExistingAccess(input) {
      const cleanTenant = String(input && input.tenant_id || "").trim().toLowerCase();
      const cleanToken = String(input && input.token || "");
      if (!/^[A-Za-z0-9_-]{43}$/.test(cleanToken)) throw new CustomerAccessError("invalid_invitation", 403);
      let user;
      let row;
      try { row = await store.getInvitation({ tenant_id: cleanTenant, token_hash: hashInvitationToken(cleanToken) }); }
      catch (error) { throw mapStoreError(error); }
      const status = invitationStatus(row, now());
      if (status === "revoked") throw new CustomerAccessError("invitation_revoked", 409);
      if (status === "expired") throw new CustomerAccessError("invitation_expired", 410);
      if (status !== "used") throw new CustomerAccessError("invalid_invitation", 403);
      user = await authenticateCustomer(row.email_normalized, input && input.password);
      if (!user || String(user.tenant_id) !== cleanTenant) throw new CustomerAccessError("invalid_credentials", 401);
      return user;
    },

    authenticate: authenticateCustomer,
    changePassword,
    requestPasswordRecovery,
    completePasswordRecovery,

    async validateSession(session) {
      const email = normalizeEmail(session && session.email);
      const userId = String(session && session.user_id || "");
      const tenantId = String(session && session.tenant_id || "").trim().toLowerCase();
      if (!validEmail(email) || !userId || !tenantId) return null;
      let user;
      try { user = await store.activeUserByEmail(email); }
      catch (error) { throw mapStoreError(error); }
      if (!user || !user.active || String(user.user_id) !== userId || String(user.tenant_id) !== tenantId) return null;
      if ((user.role || "admin") !== (session.role || "admin")) return null;
      if (Number(user.session_version || 1) !== Number(session.membership_version || 0)) return null;
      return {
        user_id: String(user.user_id),
        email,
        username: email,
        name: email,
        role: user.role || "admin",
        tenant_id: tenantId,
        company_name: user.company_name || null,
        plan_id: user.plan_id || null,
        assigned_bot_id: user.assigned_bot_id || null,
        tenant_status: user.tenant_status || null,
        auth_provider: user.auth_provider || "local",
        membership_version: Number(user.session_version || 1),
        created_at: user.created_at || null,
        updated_at: user.updated_at || null
      };
    },

    async listInvitations() {
      let rows;
      try { rows = await store.listInvitations(); }
      catch (error) { throw mapStoreError(error); }
      return rows.map(function (row) { return publicInvitation(row, now()); });
    },

    async revokeInvitation(invitationId, actor) {
      if (!/^[0-9a-f-]{36}$/i.test(String(invitationId || ""))) throw new CustomerAccessError("invalid_invitation", 403);
      let row;
      try { row = await store.revokeInvitation(invitationId, String(actor && (actor.user_id || actor.email || actor.username) || "super_admin").slice(0, 160)); }
      catch (error) { throw mapStoreError(error); }
      return publicInvitation(row, now());
    }
  };
}

module.exports = {
  CustomerAccessError,
  InMemoryCustomerAccessStore,
  SupabaseCustomerAccessStore,
  createCustomerAccessService,
  createMemoryEmailSender,
  createResendEmailSender,
  CUSTOMER_VISIBLE_BOT_IDS,
  CUSTOMER_VISIBLE_PLAN_IDS,
  customerVisibleCatalogs,
  hashInvitationToken,
  invitationStatus,
  normalizeEmail,
  validateCreateInput,
  validatePassword
};
