// Minimal server-side Supabase REST helper (no dependencies).
// Files under api/_lib are not exposed as routes by Vercel.

const crypto = require("crypto");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Non-secret description of the configuration, for troubleshooting from /admin
function describeConfig() {
  const key = SUPABASE_SERVICE_ROLE_KEY;
  let keyType = "missing";
  if (key.startsWith("sb_secret_")) keyType = "secret key (sb_secret_) — correct";
  else if (key.startsWith("sb_publishable_")) keyType = "PUBLISHABLE key — wrong, use the secret / service_role key";
  else if (key.startsWith("eyJ")) {
    try {
      const role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
      keyType = role === "service_role"
        ? "legacy service_role JWT — correct"
        : `legacy JWT with role "${role}" — wrong, use the service_role key`;
    } catch {
      keyType = "unreadable JWT — re-copy the key";
    }
  } else if (key) keyType = "unrecognised format — re-copy the key";

  let url = "missing";
  if (SUPABASE_URL) {
    try {
      const u = new URL(SUPABASE_URL);
      url = /\.supabase\.co$/.test(u.hostname) && (u.pathname === "/" || u.pathname === "")
        ? `${u.origin} — looks correct`
        : `${SUPABASE_URL} — expected https://<project-ref>.supabase.co with no path`;
    } catch {
      url = "invalid URL";
    }
  }
  return { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: keyType };
}

async function request(table, { method = "GET", params = {}, body, prefer = [] } = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables are not configured");
  }

  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
  };
  // Legacy service_role keys are JWTs and go in Authorization too.
  // New secret keys (sb_secret_...) are not JWTs and must only be sent as apikey.
  if (SUPABASE_SERVICE_ROLE_KEY.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  }
  if (prefer.length) headers.Prefer = prefer.join(",");

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase ${method} ${table} failed (${res.status}): ${detail}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function insertRow(table, row, { onConflict } = {}) {
  const params = {};
  const prefer = ["return=minimal"];
  if (onConflict) {
    params.on_conflict = onConflict;
    prefer.push("resolution=ignore-duplicates");
  }
  await request(table, { method: "POST", params, body: row, prefer });
}

function selectRows(table, params) {
  return request(table, { params });
}

function updateRows(table, params, changes) {
  return request(table, { method: "PATCH", params, body: changes, prefer: ["return=representation"] });
}

function safeEqual(given, expected) {
  if (!expected || typeof given !== "string") return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Checks x-admin-user / x-admin-password headers against ADMIN_USERNAME / ADMIN_PASSWORD
function isAdmin(req) {
  const userOk = safeEqual(req.headers["x-admin-user"], (process.env.ADMIN_USERNAME || "").trim());
  const passOk = safeEqual(req.headers["x-admin-password"], process.env.ADMIN_PASSWORD);
  return userOk && passOk;
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

module.exports = { insertRow, selectRows, updateRows, isAdmin, describeConfig, readBody, clean, EMAIL_RE };
