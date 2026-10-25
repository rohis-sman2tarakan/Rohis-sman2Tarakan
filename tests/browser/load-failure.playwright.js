/**
 * Manual browser check (not run in CI; needs Playwright installed globally):
 *   python3 -m http.server 8766 &
 *   BASE_URL=http://localhost:8766 NODE_PATH=$(npm root -g) node tests/browser/load-failure.playwright.js
 *
 * Fails a data/*.json request with HTTP 500 and checks that public pages still
 * reveal their content, show a status message in empty sections, and raise no
 * uncaught errors. Appwrite is blocked so the JSON fallback is exercised.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:8766';
const PAGES = ['index.html', 'tulisan.html', 'kegiatan.html', 'tulisan-detail.html?id=x', 'tentang.html'];
const FILES = ['site', 'programs', 'activities', 'articles'];

(async () => {
  const browser = await chromium.launch();
  let failures = 0;
  for (const file of FILES) {
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await page.route(new RegExp(`data/${file}\\.json`), (r) => r.fulfill({ status: 500, body: 'x' }));
    for (const url of PAGES) {
      await page.goto(`${BASE}/${url}`);
      await page.waitForTimeout(1500);
      const emptySections = await page.evaluate(() =>
        [...document.querySelectorAll('[data-list], [data-detail]')].filter((el) => !el.innerText.trim()).length
      );
      const ok = errors.length === 0 && emptySections === 0;
      if (!ok) failures += 1;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${file}.json=500  ${url}`, errors.splice(0).join(' | '));
    }
  }
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
