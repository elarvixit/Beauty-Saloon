// POST /api/newsletter — add an email to saloon_newsletter_subscribers
const { insertRow, readBody, clean, EMAIL_RE } = require("./_lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = readBody(req);
  const email = clean(body.email, 254).toLowerCase();

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Please enter a valid email." });

  try {
    // Existing subscribers are silently ignored, so re-subscribing still succeeds
    await insertRow("saloon_newsletter_subscribers", { email }, { onConflict: "email" });
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
