// Mobile menu
const t = document.querySelector(".nav-toggle");
const nav = document.getElementById("nav");
if (t && nav) {
  t.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    t.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) { nav.classList.remove("open"); t.setAttribute("aria-expanded", "false"); } });
}

// Lead forms: submit with fetch, fall back to normal POST if JS fails
document.querySelectorAll(".lead-form").forEach((form) => {
  const src = form.querySelector('[name="source_page"]');
  if (src) src.value = location.pathname;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = form.querySelector(".lf-status");
    const btn = form.querySelector('button[type="submit"]');
    let bad = null;
    form.querySelectorAll("[required]").forEach((el) => {
      const ok = el.value.trim() && (el.name !== "phone" || el.value.replace(/\D/g, "").length >= 10);
      el.setAttribute("aria-invalid", ok ? "false" : "true");
      if (!ok && !bad) bad = el;
    });
    if (bad) { status.className = "lf-status err"; status.textContent = "Please add your name and a 10-digit phone number."; bad.focus(); return; }
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      const res = await fetch("/api/lead", { method: "POST", headers: { Accept: "application/json" }, body: new FormData(form) });
      if (!res.ok) throw new Error();
      if (window.gtag) window.gtag("event", "generate_lead", { form_id: form.id });
      location.href = "/thank-you/";
    } catch {
      status.className = "lf-status err";
      status.textContent = "Something went wrong. Please call us instead.";
      btn.disabled = false; btn.textContent = "Check Available Trucks";
    }
  });
});
