// Minimal server-side Supabase REST helper (no dependencies).
// Files under api/_lib are not exposed as routes by Vercel.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function insertRow(table, row, { onConflict } = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables are not configured");
  }

  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
  const prefer = ["return=minimal"];
  if (onConflict) {
    url.searchParams.set("on_conflict", onConflict);
    prefer.push("resolution=ignore-duplicates");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: prefer.join(","),
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase insert into ${table} failed (${res.status}): ${detail}`);
  }
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

module.exports = { insertRow, readBody, clean, EMAIL_RE };
