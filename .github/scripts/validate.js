#!/usr/bin/env node
/**
 * Lightweight repository health check — no external dependencies.
 *
 * Checks:
 *  1. Every data/*.json file parses as valid JSON.
 *  2. Every record in the content collections has the fields the
 *     rest of the site relies on.
 *  3. Every relative link/asset reference in an .html file points at a
 *     file that exists; root-absolute paths are rejected (they break on
 *     a GitHub Pages project site).
 *  4. JS files parse; sitemap origin matches the canonical URL.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
let errors = 0;

function fail(message) {
  console.error(`✗ ${message}`);
  errors += 1;
}

function ok(message) {
  console.log(`✓ ${message}`);
}

// ---------------------------------------------------------------------
// 1 & 2. JSON validity + required fields
// ---------------------------------------------------------------------
const REQUIRED_FIELDS = {
  'site.json': null, // object, not an array — checked separately
  'programs.json': ['id', 'number', 'title', 'description', 'status', 'order'],
  'activities.json': ['id', 'title', 'date', 'category', 'excerpt', 'content', 'status'],
  'articles.json': ['id', 'title', 'author', 'date', 'category', 'excerpt', 'content', 'status'],
};

for (const [file, fields] of Object.entries(REQUIRED_FIELDS)) {
  const filePath = path.join(ROOT, 'data', file);
  if (!fs.existsSync(filePath)) {
    fail(`data/${file} tidak ditemukan.`);
    continue;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`data/${file} bukan JSON valid: ${err.message}`);
    continue;
  }
  ok(`data/${file} adalah JSON valid.`);

  if (fields === null) {
    const required = ['organization', 'school', 'hero', 'contact', 'social'];
    required.forEach((key) => {
      if (!(key in data)) fail(`data/${file} kehilangan field "${key}".`);
    });
    continue;
  }

  if (!Array.isArray(data)) {
    fail(`data/${file} seharusnya berupa array.`);
    continue;
  }

  const seenIds = new Set();
  data.forEach((item, i) => {
    fields.forEach((field) => {
      if (!(field in item) || item[field] === undefined) {
        fail(`data/${file}[${i}] kehilangan field "${field}".`);
      }
    });
    if (item.id) {
      if (seenIds.has(item.id)) fail(`data/${file} memiliki id duplikat: "${item.id}".`);
      seenIds.add(item.id);
    }
    if (item.date && Number.isNaN(Date.parse(item.date))) fail(`data/${file}[${i}] tanggal tidak valid: "${item.date}".`);
    if (item.status && !['draft', 'published', 'active', 'inactive'].includes(item.status)) {
      fail(`data/${file}[${i}] memiliki status tidak dikenal: "${item.status}".`);
    }
    if (item.status === 'published') {
      const publicText = [item.title, item.excerpt, item.content].filter(Boolean).join(' ');
      if (/(isi lengkap tulisan ini akan segera|akan segera dilengkapi|lorem ipsum|placeholder)/i.test(publicText)) {
        fail(`data/${file}[${i}] berstatus published tetapi masih mengandung teks placeholder.`);
      }
    }
  });
}

// ---------------------------------------------------------------------
// 3. Broken root-relative internal links / asset references
// ---------------------------------------------------------------------
function listHtmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listHtmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const REF_PATTERN = /(?:href|src)="([^"]*)"/g;

for (const htmlFile of listHtmlFiles(ROOT)) {
  const content = fs.readFileSync(htmlFile, 'utf8');
  const rel = path.relative(ROOT, htmlFile);
  let match;
  while ((match = REF_PATTERN.exec(content))) {
    const raw = match[1];
    if (/^([a-z][a-z0-9+.-]*:|\/\/|#|\$\{)/i.test(raw) || !raw) continue;
    const ref = raw.split('#')[0].split('?')[0];
    if (!ref) continue;
    // Root-absolute paths break under a GitHub Pages project path.
    if (ref.startsWith('/')) {
      fail(`${rel} memakai path root-absolute "${raw}" (gunakan path relatif).`);
      continue;
    }
    let target = path.resolve(path.dirname(htmlFile), ref);
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) fail(`${rel} mereferensikan path yang tidak ada: "${raw}".`);
  }

  // data-field / data-list hooks used by app.js must be consistent.
  if (/<script[^>]+src="[^"]*app\.js"/.test(content) && !/data-page="/.test(content)) {
    fail(`${rel} memuat app.js tetapi <body> tidak punya data-page.`);
  }
}

// JS files must at least parse.
for (const f of ['app.js', 'admin.js', 'data.js', 'hero-light.js', 'night-house.js', 'appwrite-repository.js']) {
  try {
    new (require('vm').Script)(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), { filename: f });
  } catch (err) {
    fail(`js/${f} tidak valid: ${err.message}`);
  }
}

// Sitemap must use the same origin as the canonical URLs.
const canonical = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/rel="canonical" href="([^"]+)"/) || [])[1];
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
if (canonical) {
  for (const loc of sitemap.match(/<loc>[^<]+<\/loc>/g) || []) {
    if (!loc.includes(canonical)) fail(`sitemap.xml ${loc} tidak diawali canonical ${canonical}.`);
  }
}

ok('Pemeriksaan tautan internal (root-relative) selesai.');


// Security regression checks for shared escaping and URL allowlist.
try {
  const browserWindow = {};
  const browserDocument = { currentScript: null, body: { dataset: {} } };
  const sandbox = { window: browserWindow, document: browserDocument, console, URL, Date, Math, fetch: () => Promise.reject(new Error('not called')), localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8'), sandbox, { timeout: 1000 });
  const util = browserWindow.RohisUtil;
  if (util.escapeHtml('<img src=x onerror="alert(1)">') !== '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;') fail('RohisUtil.escapeHtml tidak meng-escape markup berbahaya.');
  if (util.safeUrl('javascript:alert(1)') !== '') fail('RohisUtil.safeUrl menerima javascript: URL.');
  if (util.safeUrl('data:image/svg+xml,<svg onload=alert(1)>') !== '') fail('RohisUtil.safeUrl menerima SVG data URL.');
  if (util.safeUrl('https://example.com/image.webp') !== 'https://example.com/image.webp') fail('RohisUtil.safeUrl menolak HTTPS yang valid.');
  if (util.safeUrl('../assets/images/hero-rumah-lamin.jpg') !== '../assets/images/hero-rumah-lamin.jpg') fail('RohisUtil.safeUrl menolak path relatif yang valid.');
  if (errors === 0) ok('Uji regresi escaping HTML dan allowlist URL lolos.');
} catch (err) {
  fail('Uji keamanan helper gagal: ' + err.message);
}

// ---------------------------------------------------------------------
if (errors > 0) {
  console.error(`\n${errors} masalah ditemukan.`);
  process.exit(1);
}
console.log('\nSemua pemeriksaan lolos.');
