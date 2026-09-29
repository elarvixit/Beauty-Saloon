// POST /api/booking — store an appointment request in saloon_bookings
const { insertRow, readBody, clean, EMAIL_RE } = require("./_lib/supabase");

const SERVICES = ["Hair", "Skin", "Makeup", "Nails", "Eyebrows", "Signature Ritual"];

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = readBody(req);

  // Honeypot: real visitors never fill this hidden field
  if (clean(body.company, 100)) return res.status(200).json({ ok: true });

  const booking = {
    full_name: clean(body.name, 120),
    email: clean(body.email, 254).toLowerCase(),
    phone: clean(body.phone, 30) || null,
    service: clean(body.service, 40),
    preferred_date: clean(body.date, 10),
    notes: clean(body.notes, 1000) || null,
  };

  const errors = {};
  if (booking.full_name.length < 2) errors.name = "Please enter your name.";
  if (!EMAIL_RE.test(booking.email)) errors.email = "Please enter a valid email.";
  if (!SERVICES.includes(booking.service)) errors.service = "Please choose a service.";

  const date = new Date(`${booking.preferred_date}T00:00:00Z`);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000); // allow for time zones
  yesterday.setUTCHours(0, 0, 0, 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.preferred_date) || isNaN(date) || date < yesterday) {
    errors.date = "Please choose a future date.";
  }

  if (Object.keys(errors).length) return res.status(400).json({ error: "Invalid request", fields: errors });

  try {
    await insertRow("saloon_bookings", booking);
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "We couldn't save your request. Please call us instead." });
  }
};
