# Lifted Trucks New Orleans

Static, SEO/AEO/GEO-optimized lead-generation site for **www.liftedtrucksneworleans.com**, deployed as a Cloudflare Worker with static assets.

## Launch checklist

1. **Replace placeholders** in `src/site.config.mjs`: `phone`, `phoneE164`, and optionally `email` and `sameAs` (add your Google Business Profile and social links).
2. **Connect to Cloudflare** (one time):
   Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → pick `joshg1/liftedtrucksneworleans`.
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   Every push to `main` then redeploys automatically.
3. **Domain**: `wrangler.jsonc` attaches `liftedtrucksneworleans.com` and `www.` as custom domains. If either hostname already has a DNS record in Cloudflare, delete that record first or the deploy will fail. The Worker redirects the bare domain to `www`.
4. **Lead delivery** — Worker → Settings → Variables and Secrets:
   - `LEAD_WEBHOOK_URL`: send leads to Zapier/Make/CRM/Google Sheets, **and/or**
   - `RESEND_API_KEY` (secret), `LEAD_TO_EMAIL`, `LEAD_FROM_EMAIL`: email each lead via resend.com.
   Leads are always logged in the Worker's logs.
5. **Search & AI visibility after launch**
   - Add the site in Google Search Console and Bing Webmaster Tools; submit `/sitemap.xml`.
   - Create/verify a Google Business Profile (service-area business, hide address) and add its URL to `sameAs`.
   - Replace the drawn truck graphics with real truck photos when you have them (keep descriptive alt text).

## Editing

- Page copy: `src/content.mjs` (trucks, areas, FAQs).
- Templates and structured data: `build.mjs`. Styles: `public/styles.css`.
- `npm run build` writes the site to `dist/`. `npm run dev` previews locally.
- `node scripts/make-images.mjs` re-renders the share image and logo (needs Playwright).

## What's built in for SEO / AEO / GEO

- One page per model (7), per service area (8), plus financing, FAQ and about.
- "Quick answer" blocks and question-style headings that answer engines can quote.
- JSON-LD: Organization, WebSite, WebPage, BreadcrumbList, FAQPage, Service and ItemList.
- `sitemap.xml`, `robots.txt` (explicitly allows search and AI crawlers), and `llms.txt` (a plain-language summary for AI assistants).
- Canonical URLs, Open Graph/Twitter cards, a fast static build with no frameworks, self-hosted fonts and a mobile click-to-call bar.
