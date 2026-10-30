// Cloudflare Worker: serves the static site and handles lead form submissions.
//
// Lead delivery is configured with Worker variables/secrets (Cloudflare dashboard
// → Workers & Pages → this worker → Settings → Variables and Secrets):
//   LEAD_WEBHOOK_URL  (optional) POSTs each lead as JSON — Zapier, Make, a CRM, Google Sheets, etc.
//   RESEND_API_KEY    (optional, secret) send each lead by email through resend.com
//   LEAD_TO_EMAIL     where lead emails go, e.g. "leads@yourdomain.com" (comma-separate several)
//   LEAD_FROM_EMAIL   verified sender, e.g. "Leads <leads@liftedtrucksneworleans.com>"
// With none set, leads are only written to the Worker logs.

const CANONICAL_HOST = "www.liftedtrucksneworleans.com";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Send the bare domain to www so search engines see one version of every page.
    if (url.hostname === CANONICAL_HOST.replace(/^www\./, "")) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/lead") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      return handleLead(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  }
};

const FIELDS = ["name", "phone", "email", "model", "budget", "notes", "area", "source_page"];

async function handleLead(request, env, ctx) {
  const wantsJson = (request.headers.get("Accept") || "").includes("application/json");
  let form;
  try { form = await request.formData(); } catch { return reply(false, "Bad request", 400, wantsJson); }

  // Honeypot: bots fill the hidden "company" field. Pretend success.
  if ((form.get("company") || "").toString().trim()) return reply(true, "ok", 200, wantsJson);

  const lead = {};
  for (const f of FIELDS) lead[f] = (form.get(f) || "").toString().trim().slice(0, 2000);
  const digits = lead.phone.replace(/\D/g, "");
  if (!lead.name || digits.length < 10) return reply(false, "Name and a valid phone number are required", 422, wantsJson);

  lead.submitted_at = new Date().toISOString();
  lead.site = CANONICAL_HOST;
  lead.ip_country = request.cf?.country || "";

  console.log("LEAD", JSON.stringify(lead));

  const tasks = [];
  if (env.LEAD_WEBHOOK_URL) {
    tasks.push(fetch(env.LEAD_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) }));
  }
  if (env.RESEND_API_KEY && env.LEAD_TO_EMAIL && env.LEAD_FROM_EMAIL) {
    const rows = Object.entries(lead).map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0"><b>${k}</b></td><td>${escapeHtml(v)}</td></tr>`).join("");
    tasks.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.LEAD_FROM_EMAIL,
        to: env.LEAD_TO_EMAIL.split(",").map((s) => s.trim()),
        reply_to: lead.email || undefined,
        subject: `New truck lead: ${lead.name} — ${lead.model || "Any lifted truck"} (${lead.budget || "budget n/a"})`,
        html: `<table>${rows}</table>`
      })
    }));
  }
  // Deliver in the background so the visitor isn't kept waiting.
  ctx.waitUntil(Promise.allSettled(tasks).then((r) => r.forEach((x) => x.status === "rejected" && console.error("Lead delivery failed", x.reason))));

  return reply(true, "ok", 200, wantsJson);
}

function reply(ok, message, status, wantsJson) {
  if (wantsJson) return Response.json({ ok, message }, { status });
  if (ok) return new Response(null, { status: 303, headers: { Location: "/thank-you/" } });
  return new Response(message, { status });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
