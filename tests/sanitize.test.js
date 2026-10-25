/**
 * Regression tests for RohisUtil.escapeHtml / RohisUtil.safeUrl (js/data.js).
 * No dependencies: run with `node --test tests/`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadUtil() {
  const window = {};
  const sandbox = {
    window,
    document: { currentScript: null },
    location: { href: 'https://rohis.example/' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async () => { throw new Error('offline'); },
    console,
    URL,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'), sandbox);
  return window.RohisUtil;
}

const { escapeHtml, safeUrl } = loadUtil();

test('escapeHtml neutralises markup and attribute breakouts', () => {
  const out = escapeHtml('"><img src=x onerror=alert(1)>\'&');
  assert.ok(!/[<>"']/.test(out), out);
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(0), '0');
});

const BLOCKED = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  ' javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  '\u0001javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
  'data:image/png;base64,AAAA" onerror="alert(1)',
  'vbscript:msgbox(1)',
  'blob:https://evil.example/x',
  'file:///etc/passwd',
  '//evil.example/x',
  '/\\evil.example/x',
  '\\\\evil.example\\x',
  '\\/evil.example/x',
  'https://ok.example/x" onload="alert(1)',
  "https://ok.example/x'onload='alert(1)",
  'https://ok.example/<x>',
  'https:\\\\evil.example',
  '',
  null,
  undefined,
];

for (const url of BLOCKED) {
  test(`safeUrl blocks ${JSON.stringify(url)}`, () => {
    assert.equal(safeUrl(url), '');
  });
}

const ALLOWED = [
  'https://example.org/a.jpg',
  'http://example.org/a.jpg?x=1&y=2',
  'data:image/png;base64,iVBORw0KGgo=',
  './assets/images/a.png',
  'assets/images/a.png',
  '/assets/images/a.png',
  '../a.png',
];

for (const url of ALLOWED) {
  test(`safeUrl keeps ${JSON.stringify(url)}`, () => {
    assert.equal(safeUrl(url), url);
  });
}

test('safeUrl output never resolves to a foreign host', () => {
  const base = 'https://rohis.example/page/';
  for (const url of BLOCKED.filter((u) => typeof u === 'string')) {
    const out = safeUrl(url);
    if (!out) continue;
    assert.equal(new URL(out, base).origin, 'https://rohis.example');
  }
});
