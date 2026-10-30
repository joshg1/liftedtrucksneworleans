// Static site generator: `npm run build` writes the finished site to ./dist
import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { site } from "./src/site.config.mjs";
import { trucks, areas, generalFaqs, steps, photos } from "./src/content.mjs";

const OUT = "dist";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync("public", OUT, { recursive: true });
const fontDir = "node_modules/@fontsource/oswald/files";
mkdirSync(join(OUT, "fonts"), { recursive: true });
for (const w of ["600", "700"]) {
  const f = `oswald-latin-${w}-normal.woff2`;
  if (existsSync(join(fontDir, f))) cpSync(join(fontDir, f), join(OUT, "fonts", f));
}

// Version stamps so browsers always fetch the latest CSS/JS after a deploy.
const ver = (f) => createHash("md5").update(readFileSync(join("public", f))).digest("hex").slice(0, 8);
const CSS_V = ver("styles.css"), JS_V = ver("app.js");

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const abs = (p) => site.url + p;
const tel = `tel:${site.phoneE164}`;
const pages = []; // for sitemap + llms.txt

const ORG_ID = abs("/#organization");
const WEBSITE_ID = abs("/#website");

const orgSchema = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: site.name,
  alternateName: site.shortName,
  url: abs("/"),
  logo: abs("/img/logo.png"),
  image: abs("/img/og-image.png"),
  description: site.description,
  slogan: site.tagline,
  foundingDate: site.founded,
  telephone: site.phoneE164,
  ...(site.email ? { email: site.email } : {}),
  areaServed: [
    { "@type": "City", name: "New Orleans", containedInPlace: { "@type": "State", name: "Louisiana" } },
    ...areas.filter((a) => a.slug !== "new-orleans").map((a) => ({ "@type": "Place", name: `${a.displayName || a.name}, Louisiana` }))
  ],
  knowsAbout: ["Lifted trucks", "Black Widow trucks", "SCA Performance trucks", "Ford Super Duty", "Truck financing"],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: site.phoneE164,
    contactType: "sales",
    areaServed: "US-LA",
    availableLanguage: ["English"],
    hoursAvailable: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "08:00", closes: "19:00" }
  },
  sameAs: site.sameAs
};

const websiteSchema = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: abs("/"),
  name: site.name,
  description: site.description,
  publisher: { "@id": ORG_ID },
  inLanguage: "en-US"
};

const faqSchema = (faqs) => ({
  "@type": "FAQPage",
  mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } }))
});

const crumbSchema = (crumbs) => ({
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) }))
});

// ── Building blocks ─────────────────────────────────────────
const truckArt = (label = "") => `
<svg class="truck-art" viewBox="0 0 400 200" role="img" aria-label="${esc(label || "Lifted truck illustration")}">
  <path class="ta-body" d="M28 66 L166 66 L166 34 Q166 26 174 26 L258 26 Q268 26 274 34 L298 66 L360 72 Q374 74 374 88 L374 106 Q374 114 366 114 L34 114 Q28 114 28 108 Z"/>
  <path class="ta-glass" d="M178 36 L226 36 L226 64 L178 64 Z M234 36 L257 36 Q263 36 266 40 L284 64 L234 64 Z"/>
  <rect class="ta-lift" x="84" y="114" width="14" height="24" rx="3"/><rect class="ta-lift" x="300" y="114" width="14" height="24" rx="3"/>
  <circle class="ta-tire" cx="91" cy="150" r="38"/><circle class="ta-rim" cx="91" cy="150" r="17"/>
  <circle class="ta-tire" cx="307" cy="150" r="38"/><circle class="ta-rim" cx="307" cy="150" r="17"/>
  <rect class="ta-light" x="362" y="80" width="10" height="9" rx="2"/><rect class="ta-seam" x="164" y="66" width="4" height="48"/>
</svg>`;

// Responsive photo. `eager` for above-the-fold images.
function pic(key, { sizes = "(max-width: 620px) 100vw, 400px", eager = false, cls = "", note = true } = {}) {
  const p = photos[key];
  if (!p) return "";
  const base = `/img/trucks/${p.file}`;
  const h = Math.round(800 / p.ratio);
  return `<figure class="photo ${cls}"><img src="${base}-800.webp" srcset="${base}-800.webp 800w, ${base}-1600.webp ${p.big}w" sizes="${sizes}" width="800" height="${h}" alt="${esc(p.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">${note ? '<figcaption>Example photo</figcaption>' : ""}</figure>`;
}

const crumbsHtml = (crumbs) =>
  crumbs.length < 2 ? "" :
  `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs
    .map(([n, p], i) => (i === crumbs.length - 1 ? `<li aria-current="page">${esc(n)}</li>` : `<li><a href="${p}">${esc(n)}</a></li>`))
    .join("")}</ol></nav>`;

const modelOptions = () =>
  ['<option value="">Any lifted truck</option>', ...trucks.map((t) => `<option>${esc(t.name)}</option>`), "<option>Custom build / not sure</option>"].join("");
const budgetOptions = () =>
  '<option value="">Choose a budget</option>' + ["Under $50k", "$50k–$65k", "$65k–$80k", "$80k–$95k", "$95k+", "Not sure / monthly payment"].map((b) => `<option>${b}</option>`).join("");

function leadForm({ id = "lead", heading = "Get Current Inventory & Pricing", full = false, preset = "", area = "" } = {}) {
  return `
<form class="lead-form" id="${id}" action="/api/lead" method="post" novalidate>
  <h2 class="lf-title">${esc(heading)}</h2>
  <p class="lf-sub">Free. No obligation. Usually answered the same day.</p>
  <input type="hidden" name="source_page" value="">
  <input type="hidden" name="area" value="${esc(area)}">
  <div class="hp" aria-hidden="true"><label>Leave blank<input name="company" tabindex="-1" autocomplete="off"></label></div>
  <div class="lf-grid">
    <label>Name<input name="name" autocomplete="name" required></label>
    <label>Phone<input name="phone" type="tel" autocomplete="tel" inputmode="tel" required></label>
    ${full ? `<label class="span2">Email <span class="opt">(optional)</span><input name="email" type="email" autocomplete="email"></label>` : ""}
    <label>Truck<select name="model">${modelOptions().replace(`<option>${esc(preset)}</option>`, `<option selected>${esc(preset)}</option>`)}</select></label>
    <label>Budget<select name="budget">${budgetOptions()}</select></label>
    ${full ? `<label class="span2">Anything specific? <span class="opt">(trim, color, trade-in, credit situation)</span><textarea name="notes" rows="3"></textarea></label>` : ""}
  </div>
  <button class="btn btn-red btn-block" type="submit">Check Available Trucks</button>
  <p class="lf-consent">By submitting, you agree that we may share your request with partner dealers in the New Orleans area so they can contact you by phone, text or email about vehicles. Your information is never sold outside our dealer network. Message and data rates may apply. See our <a href="/privacy/">privacy policy</a>.</p>
  <div class="lf-status" role="status" aria-live="polite"></div>
</form>`;
}

const ctaBand = (preset = "", area = "") => `
<section class="band band-dark" id="lead-form">
  <div class="wrap band-grid">
    <div>
      <p class="eyebrow">Inventory changes daily</p>
      <h2 class="h-xl">See what's on the lot right now</h2>
      <p class="lead">Lifted trucks sell fast in New Orleans. Tell us what you want and we'll send available trucks with real pricing before they're gone.</p>
      <ul class="checks"><li>Black Widow, SCA &amp; custom builds</li><li>Financing for all credit situations</li><li>$0 down on qualifying trucks</li><li>Trade-ins welcome</li></ul>
      <p class="callout">Prefer to talk? <a href="${tel}">${site.phone}</a> · ${site.hours}</p>
    </div>
    ${leadForm({ id: "lead-bottom", heading: "Tell us what you're looking for", full: true, preset, area })}
  </div>
</section>`;

const faqHtml = (faqs, heading = "Frequently asked questions") => `
<section class="section" id="faq">
  <div class="wrap narrow">
    <h2 class="h-lg">${esc(heading)}</h2>
    <div class="faq">${faqs.map(([q, a]) => `<details><summary><h3>${esc(q)}</h3></summary><p>${esc(a)}</p></details>`).join("")}</div>
  </div>
</section>`;

const answerBox = (text) => `<div class="answer"><p class="answer-label">Quick answer</p><p>${esc(text)}</p></div>`;

const truckCard = (t) => `
<a class="card truck-card" href="/trucks/${t.slug}/">
  <div class="tc-art${t.photo ? " has-photo" : ""}">${t.photo ? pic(t.photo, { note: false }) : truckArt(t.name)}<span class="tag">${esc(t.tag)}</span></div>
  <div class="tc-body">
    <h3>${esc(t.name)}</h3>
    <p class="tc-price">From the ${esc(t.priceFrom)}<span>*</span></p>
    <p class="tc-best">${esc(t.bestFor)}</p>
    <span class="tc-link">See availability →</span>
  </div>
</a>`;

const customCard = () => `
<a class="card truck-card custom-card" href="#lead-form">
  <div class="tc-body">
    <p class="eyebrow">Don't see it?</p>
    <h3>Custom build or specific spec</h3>
    <p class="tc-best">GMC, Toyota, a certain color, trim or lift height? Tell us the exact truck and we'll search dealer inventory for it.</p>
    <span class="tc-link">Request a custom search →</span>
  </div>
</a>`;

const header = () => `
<a class="skip" href="#main">Skip to content</a>
<div class="topbar"><div class="wrap tb-row">
  <span class="tb-areas">Serving New Orleans · Metairie · Kenner · Westbank · Northshore</span>
  <span><a href="${tel}">${site.phone}</a> · ${site.hours}</span>
</div></div>
<header class="site-header"><div class="wrap hdr-row">
  <a class="logo" href="/" aria-label="${esc(site.name)} home"><img src="/img/logo-header.webp" srcset="/img/logo-header.webp 1x, /img/logo-header@2x.webp 2x" width="169" height="80" alt="${esc(site.name)}" fetchpriority="high"></a>
  <button class="nav-toggle" aria-expanded="false" aria-controls="nav">Menu</button>
  <nav id="nav" class="nav" aria-label="Main">
    <a href="/trucks/">Trucks</a>
    <a href="/trucks/ford-f-150-black-widow/">Black Widow</a>
    <a href="/financing/">Financing</a>
    <a href="/areas/">Areas</a>
    <a href="/faq/">FAQ</a>
    <a class="btn btn-red btn-sm" href="#lead-form">Check Availability</a>
  </nav>
</div></header>`;

const footer = () => `
<footer class="site-footer">
  <div class="wrap ft-grid">
    <div>
      <a class="logo" href="/" aria-label="${esc(site.name)} home"><img src="/img/logo-header@2x.webp" width="169" height="80" alt="${esc(site.name)}" loading="lazy" decoding="async"></a>
      <p>${esc(site.description)}</p>
      <p><a href="${tel}">${site.phone}</a><br>${site.hours}</p>
    </div>
    <div><h2>Trucks</h2><ul>${trucks.map((t) => `<li><a href="/trucks/${t.slug}/">${esc(t.short)}</a></li>`).join("")}</ul></div>
    <div><h2>Areas served</h2><ul>${areas.map((a) => `<li><a href="/areas/${a.slug}/">${esc(a.displayName || a.name)}</a></li>`).join("")}</ul></div>
    <div><h2>Quick links</h2><ul>
      <li><a href="/#lead-form">Check inventory</a></li><li><a href="/financing/">Get pre-approved</a></li>
      <li><a href="/faq/">FAQ</a></li><li><a href="/about/">About us</a></li><li><a href="/privacy/">Privacy</a></li>
      <li><a href="https://www.liftedtrucksbatonrouge.com">Lifted Trucks Baton Rouge</a></li></ul></div>
  </div>
  <div class="wrap ft-legal">
    <p>${esc(site.name)} is an independent truck-finding service, not a dealership. Vehicles are sold, financed and serviced by licensed partner dealers. Black Widow and SCA Performance are trademarks of their respective owners; we are not affiliated with or endorsed by SCA Performance or any vehicle manufacturer. *Prices are typical ranges for the New Orleans area, are not offers, and change with inventory. Financing subject to lender approval.</p>
    <p>© ${new Date().getFullYear()} ${esc(site.name)} · Last updated <time datetime="${site.lastUpdated}">${site.lastUpdated}</time></p>
  </div>
</footer>
<a class="mobile-call" href="${tel}">Call ${site.phone}</a>`;

function layout({ path, title, desc, body, schema = [], crumbs = [], noindex = false, ogType = "website", preload = "" }) {
  const withBrand = `${title} | ${site.name}`;
  const fullTitle = title.includes(site.name) || withBrand.length > 65 ? title : withBrand;
  const graph = { "@context": "https://schema.org", "@graph": [orgSchema, websiteSchema,
    { "@type": "WebPage", "@id": abs(path) + "#webpage", url: abs(path), name: fullTitle, description: desc, isPartOf: { "@id": WEBSITE_ID }, about: { "@id": ORG_ID }, inLanguage: "en-US", dateModified: site.lastUpdated },
    ...(crumbs.length > 1 ? [crumbSchema(crumbs)] : []), ...schema] };
  if (!noindex) pages.push({ path, title: fullTitle, desc });
  const html = `<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${abs(path)}">
<meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1"}">
<meta name="geo.region" content="US-LA"><meta name="geo.placename" content="New Orleans">
<meta property="og:type" content="${ogType}"><meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(fullTitle)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(path)}"><meta property="og:image" content="${abs("/img/og-image.png")}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(site.name)}: lifted Black Widow and custom trucks near New Orleans">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0d0d0f">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/img/logo.png">
<link rel="preload" href="/fonts/oswald-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
${preload}<link rel="stylesheet" href="/styles.css?v=${CSS_V}">
<link rel="alternate" type="text/plain" href="/llms.txt" title="LLM summary">
<script type="application/ld+json">${JSON.stringify(graph)}</script>
</head>
<body>
${header()}
<main id="main">
${crumbs.length > 1 ? `<div class="wrap">${crumbsHtml(crumbs)}</div>` : ""}
${body}
</main>
${footer()}
<script src="/app.js?v=${JS_V}" defer></script>
</body>
</html>`;
  const file = path.endsWith("/") ? join(OUT, path, "index.html") : join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// ── Pages ───────────────────────────────────────────────────
// Home
layout({
  path: "/",
  preload: `<link rel="preload" as="image" href="/img/hero-poster.webp" fetchpriority="high">\n`,
  title: "Lifted Trucks for Sale in New Orleans | Black Widow & Custom Builds",
  desc: "Lifted trucks for sale in New Orleans: Black Widow F-150, F-250, F-350, Raptor SCA, Ram and Silverado from local dealers. Free search, financing for all credit.",
  schema: [
    faqSchema(generalFaqs.slice(0, 6)),
    { "@type": "ItemList", name: "Lifted trucks available near New Orleans", itemListElement: trucks.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, url: abs(`/trucks/${t.slug}/`) })) },
    { "@type": "Service", "@id": abs("/#service"), name: "Lifted truck sourcing", serviceType: "Vehicle sourcing and dealer matching", provider: { "@id": ORG_ID }, areaServed: { "@type": "City", name: "New Orleans" }, offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free for buyers" } }
  ],
  body: `
<section class="hero">
  <div class="hero-bg" aria-hidden="true">
    <video class="hero-video" muted loop playsinline preload="none" poster="/img/hero-poster.webp"
      data-src-lg="/video/hero-720.mp4" data-src-sm="/video/hero-480.mp4"></video>
  </div>
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">${esc(site.tagline)}</p>
      <h1 class="h-hero">Lifted Trucks for Sale in New Orleans</h1>
      <p class="lead">Black Widow, SCA Performance and custom-lifted Ford, Ram and Chevy trucks from local dealers. Tell us what you want and we'll find it, free.</p>
      <ul class="badges"><li>New &amp; pre-owned</li><li>All credit situations</li><li>$0 down on qualifying trucks</li><li>Same-day answers</li></ul>
      <div class="hero-ctas"><a class="btn btn-red" href="#lead">Check Available Trucks</a><a class="btn btn-ghost" href="${tel}">Call ${site.phone}</a></div>
    </div>
    ${leadForm({ id: "lead" })}
  </div>
</section>

<section class="section">
  <div class="wrap narrow">
    ${answerBox("Lifted Trucks New Orleans is a free service that finds lifted trucks for buyers in the New Orleans area. We search partner dealer inventory for Black Widow, SCA Performance and custom-lifted Ford, Ram and Chevy trucks, then send you matching trucks with real pricing and financing options, usually the same day. You buy from a licensed local dealer with a full warranty.")}
  </div>
</section>

<section class="section" id="inventory">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow">What we carry</p><h2 class="h-lg">Lifted trucks we find for New Orleans buyers</h2>
    <p>New and pre-owned builds from partner dealers across the metro and Northshore. Prices are typical starting ranges; request current inventory for exact numbers.</p></div>
    <div class="grid-4">${trucks.map(truckCard).join("")}${customCard()}</div>
  </div>
</section>

<section class="section section-alt" id="black-widow">
  <div class="wrap two-col">
    <div>
      <p class="eyebrow">Black Widow by SCA Performance</p>
      <h2 class="h-lg">What is a Black Widow truck?</h2>
      <p>A Black Widow is a <strong>new</strong> Ford, Ram, Chevy or GMC truck that SCA Performance upgrades with a suspension lift, larger wheels and off-road tires, and exclusive styling before it is sold. Because Black Widows are sold through franchised new-car dealers, they keep a new-vehicle factory warranty, and SCA adds its own coverage for the package.</p>
      <p>That is the main difference from a truck lifted at an aftermarket shop: you get a professionally engineered build that's ready to drive off the lot, with warranty paperwork you can read before you buy.</p>
      <a class="btn btn-red" href="/trucks/ford-f-150-black-widow/">Explore the F-150 Black Widow</a>
    </div>
    <table class="spec">
      <caption>Black Widow vs. aftermarket lift</caption>
      <thead><tr><th></th><th>Black Widow / SCA</th><th>Aftermarket lift</th></tr></thead>
      <tbody>
        <tr><th>Sold as</th><td>New truck at a dealer</td><td>Added after purchase</td></tr>
        <tr><th>Factory warranty</th><td>Kept, plus package coverage</td><td>Related parts may lose coverage</td></tr>
        <tr><th>Financing</th><td>Included in the truck loan</td><td>Often paid separately</td></tr>
        <tr><th>Calibration</th><td>Done before sale</td><td>Depends on the shop</td></tr>
      </tbody>
    </table>
  </div>
</section>

<section class="section" id="why">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow">How it works</p><h2 class="h-lg">Why buyers use us instead of driving lot to lot</h2></div>
    <ol class="steps">${steps.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join("")}</ol>
  </div>
</section>

<section class="section section-alt">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow">Coverage area</p><h2 class="h-lg">Serving the whole New Orleans area</h2></div>
    <ul class="area-list">${areas.map((a) => `<li><a href="/areas/${a.slug}/"><strong>${esc(a.displayName || a.name)}</strong><span>${esc(a.parish)}</span></a></li>`).join("")}</ul>
  </div>
</section>

${faqHtml(generalFaqs.slice(0, 6), "Lifted truck questions, answered")}
<div class="wrap narrow more-link"><a href="/faq/">See all questions →</a></div>
${ctaBand()}`
});

// Trucks index
layout({
  path: "/trucks/",
  title: "Lifted Trucks for Sale Near New Orleans: All Models",
  desc: "Compare lifted trucks near New Orleans: F-150, F-250 and F-350 Black Widow, Raptor SCA, lifted Ram, lifted Silverado and used lifted trucks, with typical prices.",
  crumbs: [["Home", "/"], ["Trucks", "/trucks/"]],
  schema: [{ "@type": "ItemList", itemListElement: trucks.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, url: abs(`/trucks/${t.slug}/`) })) }],
  body: `
<section class="page-hero"><div class="wrap narrow">
  <h1 class="h-xl">Lifted trucks for sale near New Orleans</h1>
  ${answerBox("New lifted trucks near New Orleans typically cost $60,000 to $110,000. Half-ton builds like the F-150 Black Widow, lifted Ram 1500 and lifted Silverado start around the $60,000s; Super Duty and Raptor builds start in the $80,000s to $90,000s. Used lifted trucks start in the $30,000s.")}
</div></section>
<section class="section"><div class="wrap">
  <table class="spec spec-wide">
    <caption>Lifted truck comparison: New Orleans area</caption>
    <thead><tr><th>Model</th><th>Typical starting price*</th><th>Best for</th></tr></thead>
    <tbody>${trucks.map((t) => `<tr><th><a href="/trucks/${t.slug}/">${esc(t.name)}</a></th><td>${esc(t.priceFrom)}</td><td>${esc(t.bestFor)}</td></tr>`).join("")}</tbody>
  </table>
  <div class="grid-4 mt">${trucks.map(truckCard).join("")}${customCard()}</div>
</div></section>
${ctaBand()}`
});

// Truck detail pages
for (const t of trucks) {
  const others = trucks.filter((x) => x.slug !== t.slug).slice(0, 3);
  layout({
    path: `/trucks/${t.slug}/`,
    title: t.title,
    desc: t.metaDesc,
    crumbs: [["Home", "/"], ["Trucks", "/trucks/"], [t.short, `/trucks/${t.slug}/`]],
    schema: [
      faqSchema(t.faqs),
      { "@type": "Service", name: `${t.name} sourcing in New Orleans`, serviceType: "Lifted truck sourcing", provider: { "@id": ORG_ID }, areaServed: { "@type": "City", name: "New Orleans" },
        ...(t.make !== "Multiple" ? { brand: { "@type": "Brand", name: t.make } } : {}),
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free truck search for buyers" } }
    ],
    body: `
<section class="page-hero"><div class="wrap two-col">
  <div>
    <p class="eyebrow">${esc(t.tag)} · From the ${esc(t.priceFrom)}*</p>
    <h1 class="h-xl">${esc(t.name)} for sale in New Orleans</h1>
    ${answerBox(t.answer)}
    <p><strong>Best for:</strong> ${esc(t.bestFor)}</p>
    ${t.pagePhoto ? pic(t.pagePhoto, { sizes: "(max-width: 980px) 100vw, 560px", cls: "page-photo" }) : ""}
  </div>
  ${leadForm({ id: "lead", heading: `Check ${t.short} availability`, preset: t.name })}
</div></section>
<section class="section section-alt"><div class="wrap narrow">
  <h2 class="h-lg">${esc(t.short)}: what to know before you buy</h2>
  <dl class="facts">${t.points.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
  <h3>Questions to ask about any ${esc(t.short)}</h3>
  <ul class="checks dark"><li>Exact lift height and tire size</li><li>Overall height (for your garage or carport)</li><li>Written warranty terms for the truck and the lift package</li><li>Towing and payload ratings after the lift</li><li>Whether the speedometer was recalibrated for the tires</li></ul>
</div></section>
${faqHtml(t.faqs, `${t.short} FAQ`)}
<section class="section"><div class="wrap">
  <h2 class="h-lg">Compare other lifted trucks</h2>
  <div class="grid-3">${others.map(truckCard).join("")}</div>
</div></section>
${ctaBand(t.name)}`
  });
}

// Financing
const finFaqs = [
  ["Can I finance a lifted truck with bad credit in New Orleans?", "Often, yes. Partner dealers work with banks, credit unions and specialty lenders that approve many credit situations, including past credit problems and first-time buyers. Your rate and down payment depend on your credit, income and the truck you choose."],
  ["Can I get a lifted truck with $0 down?", "Some qualifying buyers can get $0 down, depending on credit and the truck. A down payment or trade-in usually lowers your monthly payment and can improve approval odds."],
  ["Is the lift included in the loan?", "Yes, for dealer-sold builds like Black Widow. The lift package is part of the truck's price, so it is included in your financing."],
  ["Does getting pre-approved hurt my credit?", "Ask the dealer whether the first step is a soft or hard credit inquiry. A soft pull does not affect your score; a hard pull may lower it slightly for a short time."]
];
layout({
  path: "/financing/",
  title: "Lifted Truck Financing in New Orleans | All Credit Situations",
  desc: "Finance a lifted truck in New Orleans: options for all credit situations, $0 down on qualifying trucks, and trade-ins. Get pre-approved through partner dealers.",
  crumbs: [["Home", "/"], ["Financing", "/financing/"]],
  schema: [faqSchema(finFaqs)],
  body: `
<section class="page-hero"><div class="wrap two-col">
  <div>
    <h1 class="h-xl">Lifted truck financing for all credit situations</h1>
    ${answerBox("You can finance a lifted truck in New Orleans through our partner dealers, who work with lenders for good, fair and challenged credit. Some qualifying buyers can get $0 down, and trade-ins can lower your payment. Dealer-installed lifts like Black Widow are included in the truck loan.")}
    <ul class="checks dark"><li>Good, fair and rebuilding credit</li><li>First-time buyers</li><li>$0 down on qualifying trucks</li><li>Trade-ins welcome, even if you still owe</li></ul>
  </div>
  ${leadForm({ id: "lead", heading: "Get pre-approved", full: true })}
</div></section>
<section class="section section-alt"><div class="wrap narrow">
  <h2 class="h-lg">What affects your monthly payment</h2>
  <dl class="facts">
    <div><dt>Truck price</dt><dd>Half-ton builds cost less than Super Duty and Raptor builds. Used lifted trucks cost less again.</dd></div>
    <div><dt>Down payment &amp; trade-in</dt><dd>Money down or trade-in equity reduces the amount you borrow.</dd></div>
    <div><dt>Loan term</dt><dd>Longer terms lower the payment but increase the total interest you pay.</dd></div>
    <div><dt>Credit &amp; rate</dt><dd>Your credit profile sets your interest rate. Even a small rate difference adds up over a long loan.</dd></div>
  </dl>
  <p class="small">Financing is provided by lenders through licensed partner dealers and is subject to credit approval. ${esc(site.name)} is not a lender.</p>
</div></section>
${faqHtml(finFaqs, "Financing FAQ")}
${ctaBand()}`
});

// Areas index
layout({
  path: "/areas/",
  title: "Areas We Serve: Lifted Trucks Across Greater New Orleans",
  desc: "Lifted Trucks New Orleans serves New Orleans, Metairie, Kenner, the Westbank, Chalmette, Slidell, Mandeville, Covington and LaPlace.",
  crumbs: [["Home", "/"], ["Areas", "/areas/"]],
  body: `
<section class="page-hero"><div class="wrap narrow">
  <h1 class="h-xl">Lifted trucks across greater New Orleans</h1>
  ${answerBox("We help lifted truck buyers throughout greater New Orleans, including Orleans, Jefferson, St. Bernard, St. Tammany, Plaquemines and the River Parishes. Pick your area to see what local buyers choose most.")}
</div></section>
<section class="section"><div class="wrap"><ul class="area-list">${areas.map((a) => `<li><a href="/areas/${a.slug}/"><strong>${esc(a.displayName || a.name)}</strong><span>${esc(a.parish)}</span></a></li>`).join("")}</ul></div></section>
${ctaBand()}`
});

// Area pages
for (const a of areas) {
  const label = a.displayName || a.name;
  const areaFaqs = [
    [`Where can I buy a lifted truck near ${label}?`, `${site.name} finds lifted trucks for ${label} buyers at licensed partner dealers across the New Orleans area. Send your truck and budget through our form or call ${site.phone}, and we'll send available trucks and pricing.`],
    [`How much is a lifted truck in ${label}?`, generalFaqs[0][1]],
    [`Do you deliver to ${label}?`, `Many partner dealers can arrange delivery or paperwork help for ${label} buyers. Ask when you request trucks, and we'll confirm the options for the truck you choose.`]
  ];
  layout({
    path: `/areas/${a.slug}/`,
    title: a.title,
    desc: a.metaDesc,
    crumbs: [["Home", "/"], ["Areas", "/areas/"], [label, `/areas/${a.slug}/`]],
    schema: [faqSchema(areaFaqs),
      { "@type": "Service", name: `Lifted truck sourcing in ${label}`, serviceType: "Lifted truck sourcing", provider: { "@id": ORG_ID }, areaServed: { "@type": "Place", name: `${label}, Louisiana` } }],
    body: `
<section class="page-hero"><div class="wrap two-col">
  <div>
    <p class="eyebrow">${esc(a.parish)}</p>
    <h1 class="h-xl">${esc(a.title.replace(/ \|.*$/, ""))}</h1>
    ${answerBox(a.answer)}
    ${a.photo ? pic(a.photo, { sizes: "(max-width: 980px) 100vw, 560px", cls: "page-photo" }) : ""}
  </div>
  ${leadForm({ id: "lead", heading: `Find a lifted truck in ${label}`, area: label })}
</div></section>
<section class="section section-alt"><div class="wrap narrow">
  <h2 class="h-lg">What ${esc(label)} buyers look for</h2>
  ${a.local.map((p) => `<p>${esc(p)}</p>`).join("")}
  <h3>Communities we serve near ${esc(label)}</h3>
  <ul class="pills">${a.neighborhoods.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
</div></section>
<section class="section"><div class="wrap">
  <h2 class="h-lg">Popular lifted trucks in ${esc(label)}</h2>
  <div class="grid-3">${trucks.slice(0, 3).map(truckCard).join("")}</div>
</div></section>
${faqHtml(areaFaqs, `Lifted trucks in ${label}: FAQ`)}
${ctaBand("", label)}`
  });
}

// FAQ
layout({
  path: "/faq/",
  title: "Lifted Truck FAQ: Prices, Black Widow, Financing & Warranty",
  desc: "Answers to common lifted truck questions in New Orleans: prices, what a Black Widow is, warranty, insurance, garage clearance, financing and flood safety.",
  crumbs: [["Home", "/"], ["FAQ", "/faq/"]],
  schema: [faqSchema(generalFaqs)],
  body: `
<section class="page-hero"><div class="wrap narrow">
  <h1 class="h-xl">Lifted truck questions, answered</h1>
  <p class="lead">Straight answers about buying a lifted truck in New Orleans. Don't see your question? Call <a href="${tel}">${site.phone}</a>.</p>
</div></section>
${faqHtml(generalFaqs, "All questions")}
${ctaBand()}`
});

// About
layout({
  path: "/about/",
  title: "About Lifted Trucks New Orleans",
  desc: "Lifted Trucks New Orleans is a free truck-finding service that connects New Orleans-area buyers with lifted trucks at licensed partner dealers.",
  crumbs: [["Home", "/"], ["About", "/about/"]],
  schema: [{ "@type": "AboutPage", name: `About ${site.name}`, mainEntity: { "@id": ORG_ID } }],
  body: `
<section class="page-hero"><div class="wrap narrow">
  <h1 class="h-xl">About ${esc(site.name)}</h1>
  ${answerBox(`${site.name} is a free truck-finding service for the greater New Orleans area. We are not a dealership. We match buyers with lifted Black Widow, SCA and custom trucks at licensed partner dealers, and the buyer purchases directly from the dealer.`)}
  <h2 class="h-md">Why we started</h2>
  <p>Lifted trucks are hard to shop for. Inventory changes daily, many builds never make it onto a website before they sell, and driving from Metairie to the Westbank to the Northshore to compare trucks can eat a whole weekend. We do that searching for you.</p>
  <h2 class="h-md">How we work</h2>
  <ul class="checks dark"><li>Free for buyers, with no obligation to buy</li><li>We share your request only with partner dealers that can help</li><li>You see the truck, test drive it and buy from a licensed dealer</li><li>Every new truck comes with a factory warranty</li></ul>
  <p>We also run <a href="https://www.liftedtrucksbatonrouge.com">Lifted Trucks Baton Rouge</a> for buyers in the capital region.</p>
</div></section>
${ctaBand()}`
});

// Privacy
layout({
  path: "/privacy/",
  title: "Privacy Policy",
  desc: `How ${site.name} collects, uses and shares information submitted through this website.`,
  crumbs: [["Home", "/"], ["Privacy", "/privacy/"]],
  body: `
<section class="section"><div class="wrap narrow prose">
  <h1 class="h-xl">Privacy policy</h1>
  <p><em>Last updated ${site.lastUpdated}. Template text: have it reviewed before launch.</em></p>
  <h2>What we collect</h2><p>When you submit a form we collect the information you enter, such as your name, phone number, email, the truck you're interested in, your budget and any notes. Like most websites, we also collect basic technical information such as pages visited and browser type.</p>
  <h2>How we use it</h2><p>We use your information to find trucks that match your request and to connect you with partner dealers in the New Orleans area who can contact you about those vehicles by phone, text or email.</p>
  <h2>Who we share it with</h2><p>We share your request only with partner dealers and service providers that help us operate this website. We do not sell your information outside our dealer network.</p>
  <h2>Your choices</h2><p>You can ask us to stop contacting you or to delete your information at any time by calling ${site.phone}. You can reply STOP to any text message to opt out of texts.</p>
</div></section>`
});

// Thank you (noindex)
layout({
  path: "/thank-you/",
  title: "Thanks: We're Finding Your Truck",
  desc: "Your request was received.",
  noindex: true,
  body: `
<section class="section"><div class="wrap narrow center">
  <h1 class="h-xl">Got it. We're on it.</h1>
  <p class="lead">We're checking partner dealer inventory now. Expect a call or text soon during business hours (${site.hours}).</p>
  <p>Need something sooner? Call <a href="${tel}">${site.phone}</a>.</p>
  <p><a class="btn btn-red" href="/trucks/">Keep browsing trucks</a></p>
</div></section>`
});

// 404
layout({
  path: "/404.html",
  title: "Page Not Found",
  desc: "That page doesn't exist.",
  noindex: true,
  body: `
<section class="section"><div class="wrap narrow center">
  <h1 class="h-xl">That page took a wrong turn</h1>
  <p class="lead">Try one of these instead:</p>
  <p><a class="btn btn-red" href="/trucks/">Browse lifted trucks</a> <a class="btn btn-ghost-dark" href="/">Home</a></p>
</div></section>`
});

// ── SEO / AEO / GEO files ───────────────────────────────────
const urls = pages.map((p) => `  <url><loc>${abs(p.path)}</loc><lastmod>${site.lastUpdated}</lastmod></url>`).join("\n");
writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);

writeFileSync(join(OUT, "robots.txt"), `# Search engines and AI assistants are welcome to crawl and cite this site.
User-agent: *
Allow: /
Disallow: /api/
Disallow: /thank-you/

# AI crawlers (explicitly allowed for answer-engine visibility)
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: Bingbot
Allow: /

Sitemap: ${abs("/sitemap.xml")}
`);

const llms = `# ${site.name}

> ${site.description}

${site.name} is an independent, free truck-finding service, not a dealership. Buyers submit the truck and budget they want; we search licensed partner dealer inventory and send matching trucks with pricing. Vehicles are sold, financed and serviced by the dealers.

Key facts:
- Service area: ${areas.map((a) => a.displayName || a.name).join(", ")} (Louisiana)
- Phone: ${site.phone} · Hours: ${site.hours}
- Cost to buyers: free
- Typical new lifted truck prices near New Orleans: $60,000–$110,000; used from the $30,000s
- Financing for all credit situations through partner dealers; $0 down on qualifying trucks
- Sister site for Baton Rouge: https://www.liftedtrucksbatonrouge.com

## Trucks
${trucks.map((t) => `- [${t.name}](${abs(`/trucks/${t.slug}/`)}): ${t.answer}`).join("\n")}

## Areas
${areas.map((a) => `- [${a.displayName || a.name}](${abs(`/areas/${a.slug}/`)}): ${a.parish}`).join("\n")}

## Help
- [Financing](${abs("/financing/")})
- [FAQ](${abs("/faq/")})
- [About](${abs("/about/")})

## FAQ
${generalFaqs.map(([q, a]) => `### ${q}\n${a}`).join("\n\n")}
`;
writeFileSync(join(OUT, "llms.txt"), llms);

console.log(`Built ${pages.length} indexable pages → ${OUT}/`);
