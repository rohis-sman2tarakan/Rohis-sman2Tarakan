/**
 * Manual browser check (not run in CI; needs Playwright installed globally):
 *   python3 -m http.server 8766 &
 *   BASE_URL=http://localhost:8766 NODE_PATH=$(npm root -g) node tests/browser/admin-delete-failure.playwright.js
 *
 * Mocks a logged-in Appwrite team member whose DELETE is refused (403) and
 * checks that Kelola shows a specific error toast without an uncaught error.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:8766';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());
  await page.route(/^(?!http:\/\/localhost)(?!https:\/\/fra\.cloud\.appwrite\.io)/, (r) => r.abort());
  await page.route(/fra\.cloud\.appwrite\.io/, (route) => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.endsWith('/account')) return json({ $id: 'u1', email: 'a@b.c' });
    if (url.pathname.endsWith('/teams')) return json({ teams: [{ $id: 'pengurus' }] });
    if (route.request().method() === 'DELETE') return json({ message: 'Tidak diizinkan.', type: 'user_unauthorized' }, 403);
    if (/tables\/activities\/rows$/.test(url.pathname)) {
      return json({ rows: [{ $id: 'a1', title: 'Judul A', date: '2025-01-01', category: 'Kajian', status: 'published' }], total: 1 });
    }
    return json({ rows: [], total: 0 });
  });

  await page.goto(`${BASE}/kelola/#kegiatan`);
  await page.waitForTimeout(2000);
  await page.locator('[data-delete]').first().click();
  await page.waitForTimeout(800);
  const toast = await page.locator('#admin-toast').innerText();
  const ok = toast.startsWith('Gagal menghapus kegiatan') && errors.length === 0;
  console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(toast), errors);
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
