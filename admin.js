// Maison Élan — Admin bookings dashboard

const API = "/api/admin/bookings";
const STORAGE_KEY = "saloon_admin_pw";
const STATUSES = ["pending", "confirmed", "completed", "cancelled"];

const $ = (id) => document.getElementById(id);
let bookings = [];
let password = "";

// ---------- Storage (session only; cleared when the tab closes) ----------
const store = {
  get: () => { try { return sessionStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; } },
  set: (v) => { try { sessionStorage.setItem(STORAGE_KEY, v); } catch {} },
  clear: () => { try { sessionStorage.removeItem(STORAGE_KEY); } catch {} },
};

// ---------- API ----------
async function api(method = "GET", body) {
  const res = await fetch(API, {
    method,
    headers: { "Content-Type": "application/json", "x-admin-password": password },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let message = data.error || `Request failed (${res.status})`;
    if (data.detail) message += `\n\n${data.detail}`;
    if (data.config) {
      message += "\n\nConfiguration:\n" +
        Object.entries(data.config).map(([k, v]) => `• ${k}: ${v}`).join("\n");
    }
    if (res.status === 404 && !data.error) message = "The /api/admin/bookings function isn't deployed on this site.";
    throw Object.assign(new Error(message), { status: res.status });
  }
  return data;
}

// ---------- Helpers ----------
const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const fmtDateTime = (ts) =>
  new Date(ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function toast(message, isError = false) {
  const el = $("toast");
  el.textContent = message;
  el.classList.toggle("is-error", isError);
  el.classList.add("is-visible");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("is-visible"), 2600);
}

// ---------- Auth ----------
function showApp(show) {
  $("loginView").hidden = show;
  $("appView").hidden = !show;
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button");
  password = $("password").value;
  btn.disabled = true;
  $("loginError").textContent = "";
  try {
    await load();
    store.set(password);
    showApp(true);
  } catch (err) {
    $("loginError").textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

$("logoutBtn").addEventListener("click", () => {
  store.clear();
  password = "";
  bookings = [];
  $("password").value = "";
  showApp(false);
});

// ---------- Data ----------
async function load() {
  $("loading").hidden = false;
  const data = await api("GET");
  bookings = data.bookings || [];
  $("lastUpdated").textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  render();
}

$("refreshBtn").addEventListener("click", async () => {
  try {
    await load();
    toast("Bookings refreshed");
  } catch (err) {
    handleError(err);
  }
});

function handleError(err) {
  if (err.status === 401) {
    store.clear();
    showApp(false);
    $("loginError").textContent = "Session expired. Please sign in again.";
  } else {
    toast(err.message, true);
  }
}

// ---------- Filtering ----------
function filtered() {
  const q = $("search").value.trim().toLowerCase();
  const status = $("filterStatus").value;
  const service = $("filterService").value;
  const when = $("filterWhen").value;
  const sort = $("sortBy").value;
  const today = todayISO();

  const list = bookings.filter((b) => {
    if (status && b.status !== status) return false;
    if (service && b.service !== service) return false;
    if (when === "today" && b.preferred_date !== today) return false;
    if (when === "upcoming" && b.preferred_date < today) return false;
    if (when === "past" && b.preferred_date >= today) return false;
    if (q) {
      const hay = [b.full_name, b.email, b.phone, b.notes].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (sort === "date-asc") list.sort((a, b) => a.preferred_date.localeCompare(b.preferred_date));
  else if (sort === "date-desc") list.sort((a, b) => b.preferred_date.localeCompare(a.preferred_date));
  else list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return list;
}

["search", "filterStatus", "filterService", "filterWhen", "sortBy"].forEach((id) =>
  $(id).addEventListener("input", render)
);

// Stat cards act as quick filters
document.querySelectorAll(".stat").forEach((card) =>
  card.addEventListener("click", () => {
    $("filterStatus").value = card.dataset.filterStatus ?? "";
    $("filterWhen").value = card.dataset.filterWhen ?? "";
    if (card.dataset.filterWhen === "upcoming") $("filterStatus").value = "";
    render();
  })
);

// ---------- Rendering ----------
function renderStats() {
  const today = todayISO();
  const active = bookings.filter((b) => b.status !== "cancelled");
  $("statTotal").textContent = bookings.length;
  $("statPending").textContent = bookings.filter((b) => b.status === "pending").length;
  $("statUpcoming").textContent = active.filter((b) => b.preferred_date >= today).length;
  $("statToday").textContent = active.filter((b) => b.preferred_date === today).length;
}

function render() {
  renderStats();
  const list = filtered();
  const today = todayISO();

  $("rows").innerHTML = list
    .map((b) => {
      const options = STATUSES.map(
        (s) => `<option value="${s}" ${s === b.status ? "selected" : ""}>${s}</option>`
      ).join("");
      return `
      <tr>
        <td class="guest" data-label="Guest">
          <strong>${escapeHtml(b.full_name)}</strong>
          <a href="mailto:${escapeHtml(b.email)}">${escapeHtml(b.email)}</a>
          ${b.phone ? `<a href="tel:${escapeHtml(b.phone)}">${escapeHtml(b.phone)}</a>` : ""}
        </td>
        <td data-label="Service">${escapeHtml(b.service)}</td>
        <td class="date" data-label="Appointment">
          <strong>${fmtDate(b.preferred_date)}${b.preferred_date === today ? '<span class="tag-today">Today</span>' : ""}</strong>
        </td>
        <td data-label="Notes"><div class="notes">${b.notes ? escapeHtml(b.notes) : '<span class="muted">—</span>'}</div></td>
        <td data-label="Requested"><span class="muted">${fmtDateTime(b.created_at)}</span></td>
        <td data-label="Status">
          <select class="status-select" data-id="${escapeHtml(b.id)}" data-status="${escapeHtml(b.status)}" aria-label="Status">${options}</select>
        </td>
      </tr>`;
    })
    .join("");

  $("loading").hidden = true;
  $("empty").hidden = list.length > 0;
  $("resultCount").textContent = `Showing ${list.length} of ${bookings.length} booking${bookings.length === 1 ? "" : "s"}`;
}

// ---------- Status updates ----------
$("rows").addEventListener("change", async (e) => {
  const select = e.target.closest(".status-select");
  if (!select) return;
  const booking = bookings.find((b) => b.id === select.dataset.id);
  const previous = booking.status;
  select.disabled = true;
  try {
    const { booking: updated } = await api("PATCH", { id: booking.id, status: select.value });
    Object.assign(booking, updated);
    select.dataset.status = booking.status;
    renderStats();
    toast(`${booking.full_name} marked ${booking.status}`);
  } catch (err) {
    select.value = previous;
    handleError(err);
  } finally {
    select.disabled = false;
  }
});

// ---------- CSV export ----------
$("exportBtn").addEventListener("click", () => {
  const list = filtered();
  const cols = ["full_name", "email", "phone", "service", "preferred_date", "status", "notes", "created_at"];
  const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...list.map((b) => cols.map((c) => csvCell(b[c])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `saloon-bookings-${todayISO()}.csv` });
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- Boot ----------
(async () => {
  password = store.get();
  if (!password) return;
  try {
    await load();
    showApp(true);
  } catch (err) {
    store.clear();
    password = "";
  }
})();
