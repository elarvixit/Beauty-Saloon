// /api/admin/bookings — password-protected booking management
//   GET   → list all bookings (newest first)
//   PATCH → { id, status } update a booking's status
const { selectRows, updateRows, isAdmin, readBody, clean } = require("../_lib/supabase");

const STATUSES = ["pending", "confirmed", "completed", "cancelled"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: "ADMIN_PASSWORD is not configured on the server." });
  }
  if (!isAdmin(req)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down password guessing
    return res.status(401).json({ error: "Incorrect password." });
  }

  try {
    if (req.method === "GET") {
      const rows = await selectRows("saloon_bookings", {
        select: "*",
        order: "created_at.desc",
        limit: "2000",
      });
      return res.status(200).json({ bookings: rows });
    }

    if (req.method === "PATCH") {
      const body = readBody(req);
      const id = clean(body.id, 36);
      const status = clean(body.status, 20);
      if (!UUID_RE.test(id) || !STATUSES.includes(status)) {
        return res.status(400).json({ error: "Invalid booking or status." });
      }
      const rows = await updateRows("saloon_bookings", { id: `eq.${id}` }, { status });
      if (!rows || !rows.length) return res.status(404).json({ error: "Booking not found." });
      return res.status(200).json({ booking: rows[0] });
    }

    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not reach the database." });
  }
};
