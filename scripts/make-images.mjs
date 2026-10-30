// Renders public/img/og-image.png (1200x630) and public/img/logo.png (512x512).
// Run: node scripts/make-images.mjs   (needs Playwright + Chromium)
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const font = readFileSync("node_modules/@fontsource/oswald/files/oswald-latin-700-normal.woff2").toString("base64");
const css = `@font-face{font-family:O;src:url(data:font/woff2;base64,${font})}*{margin:0;box-sizing:border-box}body{font-family:O,sans-serif}`;
const truck = `<svg viewBox="0 0 400 200" style="width:100%"><path fill="#d7191f" d="M28 66 L166 66 L166 34 Q166 26 174 26 L258 26 Q268 26 274 34 L298 66 L360 72 Q374 74 374 88 L374 106 Q374 114 366 114 L34 114 Q28 114 28 108 Z"/><path fill="#3b4350" d="M178 36 L226 36 L226 64 L178 64 Z M234 36 L257 36 Q263 36 266 40 L284 64 L234 64 Z"/><rect fill="#fff" x="84" y="114" width="14" height="24" rx="3"/><rect fill="#fff" x="300" y="114" width="14" height="24" rx="3"/><circle cx="91" cy="150" r="38" fill="#000" stroke="#2c2c32" stroke-width="6"/><circle cx="91" cy="150" r="17" fill="#3a3a42" stroke="#6b6b75" stroke-width="3"/><circle cx="307" cy="150" r="38" fill="#000" stroke="#2c2c32" stroke-width="6"/><circle cx="307" cy="150" r="17" fill="#3a3a42" stroke="#6b6b75" stroke-width="3"/></svg>`;

const og = `<html><head><style>${css}
body{width:1200px;height:630px;background:radial-gradient(900px 500px at 10% 0%,#3a0e10,transparent 60%),#0d0d0f;color:#fff;display:flex;align-items:center;padding:70px;gap:40px;border-bottom:14px solid #d7191f}
.l{flex:1.1}.k{color:#d7191f;letter-spacing:.16em;font-size:26px}h1{font-size:96px;line-height:.95;text-transform:uppercase;margin:16px 0 22px}
p{font-size:30px;color:#c9c9d1;letter-spacing:.03em}.r{flex:.9}</style></head><body>
<div class="l"><div class="k">LIFTEDTRUCKSNEWORLEANS.COM</div><h1>Lifted Trucks<br>New Orleans</h1><p>BLACK WIDOW · SCA · CUSTOM BUILDS<br>FINANCING FOR ALL CREDIT</p></div><div class="r">${truck}</div></body></html>`;

const logo = `<html><head><style>${css}
body{width:512px;height:512px;background:#0d0d0f;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff}
.m{font-size:128px;letter-spacing:.06em;line-height:1}.b{width:330px;height:12px;background:#d7191f;margin:10px 0 16px}.s{font-size:30px;letter-spacing:.2em;color:#a9a9b3}</style></head><body>
<div class="m">LIFTED</div><div class="b"></div><div class="s">TRUCKS NEW ORLEANS</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og); await page.screenshot({ path: "public/img/og-image.png" });
await page.setViewportSize({ width: 512, height: 512 });
await page.setContent(logo); await page.screenshot({ path: "public/img/logo.png" });
await browser.close();
console.log("images written");
