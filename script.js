// Maison Élan — interactions

// Preloader
window.addEventListener("load", () => {
  setTimeout(() => document.getElementById("preloader").classList.add("is-done"), 600);
});
// Fallback in case some images are slow
setTimeout(() => document.getElementById("preloader").classList.add("is-done"), 3000);

// Sticky nav
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Mobile menu
const toggle = document.getElementById("navToggle");
const links = document.getElementById("navLinks");
toggle.addEventListener("click", () => {
  const open = links.classList.toggle("is-open");
  toggle.classList.toggle("is-open", open);
  document.body.style.overflow = open ? "hidden" : "";
});
links.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    links.classList.remove("is-open");
    toggle.classList.remove("is-open");
    document.body.style.overflow = "";
  })
);

// Reveal on scroll (staggered per parent)
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
      el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 5) * 110}ms`;
      el.classList.add("is-visible");
      io.unobserve(el);
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// Service tabs
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".menu__panel");
tabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.toggle("is-active", t === tab));
    panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === tab.dataset.tab));
  })
);

// Testimonial slider
const quotes = document.querySelectorAll(".quote");
const dots = document.querySelectorAll("#quoteDots button");
let current = 0;
let timer;
const showQuote = (i) => {
  current = i;
  quotes.forEach((q, idx) => q.classList.toggle("is-active", idx === i));
  dots.forEach((d, idx) => d.classList.toggle("is-active", idx === i));
};
const startTimer = () => {
  clearInterval(timer);
  timer = setInterval(() => showQuote((current + 1) % quotes.length), 6000);
};
dots.forEach((d, i) => d.addEventListener("click", () => { showQuote(i); startTimer(); }));
startTimer();

// Booking form
const dateInput = document.getElementById("date");
dateInput.min = new Date().toISOString().split("T")[0];

const postJSON = async (url, data) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || "Something went wrong. Please try again or call us."), { fields: body.fields });
  return body;
};

const form = document.getElementById("bookingForm");
const msg = document.getElementById("formMsg");
const setMsg = (text, isError = false) => {
  msg.textContent = text;
  msg.classList.toggle("is-error", isError);
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  let valid = true;
  form.querySelectorAll("[required]").forEach((field) => {
    const ok = field.checkValidity();
    field.closest(".field").classList.toggle("is-invalid", !ok);
    if (!ok) valid = false;
  });
  if (!valid) return setMsg("Please complete the highlighted fields.", true);

  const data = Object.fromEntries(new FormData(form));
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  setMsg("Sending your request…");

  try {
    await postJSON("/api/booking", data);
    const name = data.name.trim().split(" ")[0];
    setMsg(`Thank you, ${name}. Our concierge will be in touch within two hours.`);
    form.reset();
  } catch (err) {
    Object.keys(err.fields || {}).forEach((key) => {
      form.elements[key]?.closest(".field")?.classList.add("is-invalid");
    });
    setMsg(err.message, true);
  } finally {
    button.disabled = false;
  }
});

// Newsletter
document.getElementById("newsletter").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = e.target.querySelector("input");
  const button = e.target.querySelector("button");
  button.disabled = true;
  try {
    await postJSON("/api/newsletter", { email: input.value });
    input.value = "";
    input.placeholder = "Welcome to the Maison ✦";
  } catch (err) {
    input.value = "";
    input.placeholder = err.message;
  } finally {
    button.disabled = false;
  }
});

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();
