/**
 * Appwrite-backed ContentRepository.
 *
 * Dimuat setelah js/data.js. Menggantikan `window.ContentRepository`
 * dengan repository yang membaca/menulis ke Appwrite lewat REST, tanpa
 * SDK atau CDN tambahan:
 *
 *  - Halaman publik: hanya membaca. Baris berstatus published/active bisa
 *    dibaca siapa saja; draft hanya terlihat oleh tim `pengurus`. Jika
 *    Appwrite tidak terjangkau, otomatis kembali ke data/*.json supaya
 *    situs tetap tampil.
 *  - Halaman Kelola: login dengan kode 6 angka yang dikirim ke email,
 *    lalu menulis ke database. Izin tulis dijaga oleh Appwrite
 *    (team:pengurus), bukan oleh kode di browser ini.
 *
 * Tidak ada rahasia di file ini: project ID dan endpoint memang publik.
 */
(function (global) {
  'use strict';

  const base = global.ContentRepository;
  if (!base) return;

  const CFG = {
    endpoint: 'https://fra.cloud.appwrite.io/v1',
    project: '6ace47c90031991e50c8',
    db: 'rohis',
    bucket: 'media',
    team: 'pengurus',
    siteRow: 'main',
  };

  const IS_ADMIN = !!(document.body && document.body.dataset.page === 'kelola');
  const FALLBACK_KEY = 'rohis:aw-session';
  const TEAM = 'team:' + CFG.team;

  // ------------------------------------------------------------------
  // HTTP
  // ------------------------------------------------------------------
  class ApiError extends Error {
    constructor(status, message, type) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.type = type || '';
    }
  }

  function readFallback() {
    try { return localStorage.getItem(FALLBACK_KEY) || ''; } catch { return ''; }
  }
  function saveFallback(value) {
    try { localStorage.setItem(FALLBACK_KEY, value); } catch { /* abaikan */ }
  }
  function clearFallback() {
    try { localStorage.removeItem(FALLBACK_KEY); } catch { /* abaikan */ }
  }

  async function request(method, path, opts) {
    opts = opts || {};
    const url = new URL(CFG.endpoint + path);
    (opts.queries || []).forEach((q) => url.searchParams.append('queries[]', q));

    const headers = { 'X-Appwrite-Project': CFG.project };
    if (IS_ADMIN) {
      const fb = readFallback();
      if (fb) headers['X-Fallback-Cookies'] = fb;
    }
    let body;
    if (opts.form) {
      body = opts.form;
    } else if (opts.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.json);
    }

    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeout || 15000) : null;
    let res;
    try {
      res = await fetch(url.href, {
        method,
        headers,
        body,
        signal: ctrl ? ctrl.signal : undefined,
        credentials: 'omit',
        cache: IS_ADMIN ? 'no-store' : 'default',
      });
    } catch {
      const e = new ApiError(0, 'Tidak bisa terhubung ke server.', 'network');
      e.network = true;
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (IS_ADMIN) {
      const fb = res.headers.get('x-fallback-cookies');
      if (fb) saveFallback(fb);
    }

    let data = null;
    let responseText = '';
    if (opts.responseType !== 'blob' || !res.ok) {
      responseText = await res.text();
      if (responseText) {
        try { data = JSON.parse(responseText); } catch { data = null; }
      }
    }

    if (!res.ok) {
      const err = new ApiError(res.status, (data && data.message) || 'Permintaan gagal (' + res.status + ').', data && data.type);
      if (res.status === 401 && IS_ADMIN && !opts.silent401) {
        clearFallback();
        global.dispatchEvent(new Event('rohis:auth-expired'));
      }
      throw err;
    }
    if (opts.responseType === 'blob') return res.blob();
    return data;
  }

  // ------------------------------------------------------------------
  // Query helpers (format JSON yang dipakai Appwrite)
  // ------------------------------------------------------------------
  const Q = {
    limit: (n) => JSON.stringify({ method: 'limit', values: [n] }),
    orderDesc: (attr) => JSON.stringify({ method: 'orderDesc', attribute: attr }),
    orderAsc: (attr) => JSON.stringify({ method: 'orderAsc', attribute: attr }),
    cursorAfter: (id) => JSON.stringify({ method: 'cursorAfter', values: [id] }),
  };

  const PAGE = 100;
  const MAX_PAGES = 5;

  function rowsPath(table, id) {
    return '/tablesdb/' + CFG.db + '/tables/' + table + '/rows' + (id ? '/' + encodeURIComponent(id) : '');
  }

  async function listRows(table, order) {
    const out = [];
    let cursor = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const queries = [Q.limit(PAGE)].concat(order || []);
      if (cursor) queries.push(Q.cursorAfter(cursor));
      const data = await request('GET', rowsPath(table), { queries });
      const rows = (data && data.rows) || [];
      out.push.apply(out, rows);
      if (rows.length < PAGE) break;
      cursor = rows[rows.length - 1].$id;
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Pemetaan baris <-> objek yang dipakai UI
  // ------------------------------------------------------------------
  const periodOf = (item) => (global.RohisUtil ? global.RohisUtil.periodOf(item) : '');
  const clip = (value, max) => String(value == null ? '' : value).slice(0, max);

  function stamp(row, item) {
    item.id = row.$id;
    if (row.$createdAt) item.createdAt = row.$createdAt;
    if (row.$updatedAt) item.updatedAt = row.$updatedAt;
    return item;
  }

  const MAP = {
    activities: {
      table: 'activities',
      order: [Q.orderDesc('date')],
      fromRow(row) {
        return stamp(row, {
          title: row.title || '',
          date: row.date || '',
          category: row.category || '',
          cover: row.cover || '',
          excerpt: row.excerpt || '',
          content: row.content || '',
          period: row.period || '',
          status: row.status || 'draft',
        });
      },
      toData(a) {
        return {
          title: clip(a.title, 200),
          date: clip(a.date, 10),
          category: clip(a.category, 60),
          cover: clip(a.cover, 2000),
          excerpt: String(a.excerpt || ''),
          content: String(a.content || ''),
          period: clip(periodOf(a), 20),
          status: clip(a.status || 'draft', 20),
        };
      },
      published: (a) => a.status === 'published',
    },
    articles: {
      table: 'articles',
      order: [Q.orderDesc('date')],
      fromRow(row) {
        return stamp(row, {
          title: row.title || '',
          author: row.author || '',
          date: row.date || '',
          category: row.category || '',
          cover: row.cover || '',
          excerpt: row.excerpt || '',
          content: row.content || '',
          readTime: row.readTime || '',
          edition: row.edition || '',
          period: row.period || '',
          status: row.status || 'draft',
        });
      },
      toData(a) {
        return {
          title: clip(a.title, 200),
          author: clip(a.author, 120),
          date: clip(a.date, 10),
          category: clip(a.category, 60),
          cover: clip(a.cover, 2000),
          excerpt: String(a.excerpt || ''),
          content: String(a.content || ''),
          readTime: clip(a.readTime, 40),
          edition: clip(a.edition, 60),
          period: clip(periodOf(a), 20),
          status: clip(a.status || 'draft', 20),
        };
      },
      published: (a) => a.status === 'published',
    },
    programs: {
      table: 'programs',
      order: [Q.orderAsc('sortOrder')],
      fromRow(row) {
        return stamp(row, {
          number: row.number || '',
          title: row.title || '',
          description: row.description || '',
          status: row.status || 'active',
          order: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
        });
      },
      toData(p) {
        return {
          number: clip(p.number, 8),
          title: clip(p.title, 120),
          description: String(p.description || ''),
          status: clip(p.status || 'active', 20),
          sortOrder: Math.round(Number(p.order) || 0),
        };
      },
      // Hanya program aktif yang dibaca publik; program nonaktif khusus pengurus.
      published: (p) => p.status === 'active',
    },
  };

  // Draft hanya terlihat oleh pengurus; yang terbit terlihat semua orang.
  function permissionsFor(kind, item) {
    const visible = MAP[kind].published(item);
    return [
      visible ? 'read("any")' : 'read("' + TEAM + '")',
      'update("' + TEAM + '")',
      'delete("' + TEAM + '")',
    ];
  }

  // Media Appwrite hanya publik jika direferensikan oleh konten yang terbit.
  function mediaIdsIn(value) {
    const ids = new Set();
    const text = String(value || '');
    const pattern = /\/storage\/buckets\/media\/files\/([^/?#"'\s]+)\/(?:view|preview|download)/g;
    let match;
    while ((match = pattern.exec(text))) {
      try { ids.add(decodeURIComponent(match[1])); } catch { /* abaikan URL tidak valid */ }
    }
    return ids;
  }

  function mediaIdsInItem(item) {
    return new Set([...mediaIdsIn(item && item.cover), ...mediaIdsIn(item && item.content)]);
  }

  function mergeIds() {
    return new Set([].concat(...Array.from(arguments, (value) => Array.from(value || []))));
  }

  function mediaPermissionsFor(isPublic) {
    return [
      isPublic ? 'read("any")' : 'read("' + TEAM + '")',
      'update("' + TEAM + '")',
      'delete("' + TEAM + '")',
    ];
  }

  async function syncMediaPermissions(ids, override) {
    const targets = Array.from(new Set(ids || [])).filter((id) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(id));
    if (!targets.length) return;

    const publishedIds = new Set();
    // Scan all rows before changing any permissions. Never make a decision from
    // a truncated sample: if the safety cap is reached, fail closed.
    async function listAllRowsForMedia(table) {
      const out = [];
      let cursor = null;
      const maxPages = 100;
      for (let page = 0; page < maxPages; page++) {
        const queries = [Q.limit(PAGE)];
        if (cursor) queries.push(Q.cursorAfter(cursor));
        const data = await request('GET', rowsPath(table), { queries });
        const rows = (data && data.rows) || [];
        out.push.apply(out, rows);
        if (rows.length < PAGE) return out;
        cursor = rows[rows.length - 1].$id;
      }
      throw new Error('Terlalu banyak konten untuk memverifikasi izin media dengan aman.');
    }
    for (const kind of ['activities', 'articles']) {
      const rows = await listAllRowsForMedia(MAP[kind].table);
      for (const row of rows) {
        if (override && override.kind === kind && override.id === row.$id) continue;
        if (row.status === 'published') {
          mediaIdsInItem(row).forEach((id) => publishedIds.add(id));
        }
      }
    }

    // Site settings (e.g. hero image) are public when referenced by the live site.
    if (!(override && override.kind === 'site')) {
      try {
        const row = await request('GET', rowsPath('site', CFG.siteRow));
        if (row && row.payload) mediaIdsIn(row.payload).forEach((id) => publishedIds.add(id));
      } catch (err) {
        if (err.status !== 404) throw err;
      }
    }

    if (override && override.item) {
      if (override.kind === 'site') {
        mediaIdsIn(JSON.stringify(override.item)).forEach((id) => publishedIds.add(id));
      } else if (override.item.status === 'published') {
        mediaIdsInItem(override.item).forEach((id) => publishedIds.add(id));
      }
    }

    for (const id of targets) {
      const permissions = mediaPermissionsFor(publishedIds.has(id));
      await request('PATCH', '/storage/buckets/' + CFG.bucket + '/files/' + encodeURIComponent(id), {
        json: { permissions },
      });
    }
  }

  // Row ID maks. 36 karakter, hanya a-z A-Z 0-9 . - _
  function makeRowId(existingIds, title) {
    const ids = new Set(existingIds);
    const slug = (global.RohisUtil ? global.RohisUtil.slugify(title) : '').slice(0, 30).replace(/-+$/, '');
    const root = slug || 'item';
    let candidate = root;
    let n = 2;
    while (ids.has(candidate)) {
      const suffix = '-' + n;
      candidate = root.slice(0, 36 - suffix.length) + suffix;
      n += 1;
    }
    return candidate;
  }

  function randomSuffix() {
    return '-' + Math.random().toString(36).slice(2, 5);
  }

  // ------------------------------------------------------------------
  // Memo ringan untuk halaman publik (satu pemuatan halaman)
  // ------------------------------------------------------------------
  const memo = new Map();
  function once(key, fn) {
    if (IS_ADMIN) return fn();
    if (!memo.has(key)) {
      const p = fn().catch((err) => { memo.delete(key); throw err; });
      memo.set(key, p);
    }
    return memo.get(key);
  }

  async function withFallback(fn, fallback) {
    if (IS_ADMIN) return fn();
    try {
      return await fn();
    } catch (err) {
      console.warn('Appwrite tidak terjangkau, memakai data/*.json:', err && err.message);
      return fallback();
    }
  }

  // ------------------------------------------------------------------
  // Repository
  // ------------------------------------------------------------------
  const repo = Object.create(base);

  async function listKind(kind) {
    const m = MAP[kind];
    const rows = await listRows(m.table, m.order);
    return rows.map(m.fromRow);
  }

  async function getOne(kind, id) {
    const m = MAP[kind];
    try {
      const row = await request('GET', rowsPath(m.table, id));
      return m.fromRow(row);
    } catch (err) {
      if (err.status === 404 || err.status === 401) return null;
      throw err;
    }
  }

  async function saveKind(kind, item) {
    const m = MAP[kind];
    const data = m.toData(item);
    const permissions = permissionsFor(kind, data);
    const previous = item.id ? await getOne(kind, item.id) : null;
    const touched = mergeIds(mediaIdsInItem(previous), mediaIdsInItem(data));

    // Fail closed on unpublish/cover removal: adjust file access before the
    // content write, then restore permissions from persisted content on error.
    if (item.id && touched.size) {
      await syncMediaPermissions(touched, { kind, id: item.id, item: null });
    }

    try {
      if (item.id) {
        try {
          const row = await request('PATCH', rowsPath(m.table, item.id), { json: { data, permissions } });
          if (touched.size) await syncMediaPermissions(touched);
          return Object.assign(item, m.fromRow(row));
        } catch (err) {
          if (err.status !== 404) throw err;
          const row = await request('POST', rowsPath(m.table), { json: { rowId: item.id, data, permissions } });
          if (touched.size) await syncMediaPermissions(touched);
          return Object.assign(item, m.fromRow(row));
        }
      }

      const existing = (await listRows(m.table)).map((r) => r.$id);
      let rowId = makeRowId(existing, item.title);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const row = await request('POST', rowsPath(m.table), { json: { rowId, data, permissions } });
          if (touched.size) await syncMediaPermissions(touched);
          return Object.assign(item, m.fromRow(row));
        } catch (err) {
          if (err.status !== 409) throw err;
          rowId = rowId.slice(0, 32) + randomSuffix();
        }
      }
      throw new ApiError(409, 'Gagal membuat ID unik, coba lagi.');
    } catch (err) {
      if (touched.size) {
        try { await syncMediaPermissions(touched); } catch (syncErr) {
          console.error('Gagal memulihkan izin media setelah penyimpanan gagal.', syncErr);
        }
      }
      throw err;
    }
  }

  async function deleteKind(kind, id) {
    const previous = await getOne(kind, id);
    const touched = mediaIdsInItem(previous);
    if (touched.size) await syncMediaPermissions(touched, { kind, id, item: null });
    try {
      await request('DELETE', rowsPath(MAP[kind].table, id));
      if (touched.size) await syncMediaPermissions(touched);
    } catch (err) {
      if (touched.size) {
        try { await syncMediaPermissions(touched); } catch (syncErr) {
          console.error('Gagal memulihkan izin media setelah penghapusan gagal.', syncErr);
        }
      }
      if (err.status !== 404) throw err;
    }
  }

  Object.assign(repo, {
    // ---- Pengaturan situs ----------------------------------------------
    getSite() {
      return once('site', () =>
        withFallback(
          async () => {
            try {
              const row = await request('GET', rowsPath('site', CFG.siteRow));
              const site = JSON.parse(row.payload);
              if (site && typeof site === 'object') return site;
              throw new Error('payload site tidak valid');
            } catch (err) {
              if (IS_ADMIN && err.status === 404) return {};
              throw err;
            }
          },
          () => base.getSite()
        )
      );
    },

    async saveSite(site) {
      const data = { payload: JSON.stringify(site) };
      const permissions = ['read("any")', 'update("' + TEAM + '")', 'delete("' + TEAM + '")'];
      let previous = {};
      try {
        const row = await request('GET', rowsPath('site', CFG.siteRow));
        previous = JSON.parse(row.payload || '{}');
      } catch (err) {
        if (err.status !== 404) throw err;
      }
      const touched = mergeIds(mediaIdsIn(JSON.stringify(previous)), mediaIdsIn(JSON.stringify(site)));
      if (touched.size) await syncMediaPermissions(touched, { kind: 'site', id: CFG.siteRow, item: null });
      try {
        try {
          await request('PATCH', rowsPath('site', CFG.siteRow), { json: { data, permissions } });
        } catch (err) {
          if (err.status !== 404) throw err;
          await request('POST', rowsPath('site'), { json: { rowId: CFG.siteRow, data, permissions } });
        }
        if (touched.size) await syncMediaPermissions(touched);
        return site;
      } catch (err) {
        if (touched.size) {
          try { await syncMediaPermissions(touched); } catch (syncErr) {
            console.error('Gagal memulihkan izin media setelah pengaturan gagal.', syncErr);
          }
        }
        throw err;
      }
    },

    // ---- Program --------------------------------------------------------
    getPrograms() {
      return once('programs', () => withFallback(() => listKind('programs'), () => base.getPrograms()));
    },
    saveProgram(program) { return saveKind('programs', program); },
    deleteProgram(id) { return deleteKind('programs', id); },

    // ---- Kegiatan -------------------------------------------------------
    getActivities() {
      return once('activities', () => withFallback(() => listKind('activities'), () => base.getActivities()));
    },
    getActivity(id) {
      return withFallback(() => getOne('activities', id), () => base.getActivity(id));
    },
    saveActivity(activity) { return saveKind('activities', activity); },
    deleteActivity(id) { return deleteKind('activities', id); },

    // ---- Tulisan --------------------------------------------------------
    getArticles() {
      return once('articles', () => withFallback(() => listKind('articles'), () => base.getArticles()));
    },
    getArticle(id) {
      return withFallback(() => getOne('articles', id), () => base.getArticle(id));
    },
    saveArticle(article) { return saveKind('articles', article); },
    deleteArticle(id) { return deleteKind('articles', id); },

    // ---- Media (Appwrite Storage) ---------------------------------------
    async getMedia() {
      const data = await request('GET', '/storage/buckets/' + CFG.bucket + '/files', {
        queries: [Q.limit(100), Q.orderDesc('$createdAt')],
      });
      const files = ((data && data.files) || []).map(mediaFromFile);
      return Promise.all(files.map(async (item) => {
        // File previews are fetched with the authenticated project/team session.
        // A blob URL is local to this admin tab and is never persisted as content.
        try {
          const blob = await request(
            'GET',
            '/storage/buckets/' + CFG.bucket + '/files/' + encodeURIComponent(item.id) + '/view',
            { responseType: 'blob', silent401: false, timeout: 30000 }
          );
          item.dataUrl = URL.createObjectURL(blob);
        } catch (err) {
          item.dataUrl = '';
          item.previewError = err.message || 'Pratinjau tidak tersedia.';
        }
        return item;
      }));
    },

    async saveMedia(item) {
      if (!item || !item.blob) throw new Error('File gambar tidak ditemukan.');
      const form = new FormData();
      form.append('fileId', 'unique()');
      form.append('file', item.blob, item.name || 'gambar.jpg');
      form.append('permissions[]', 'read("' + TEAM + '")');
      form.append('permissions[]', 'update("' + TEAM + '")');
      form.append('permissions[]', 'delete("' + TEAM + '")');
      const file = await request('POST', '/storage/buckets/' + CFG.bucket + '/files', { form, timeout: 60000 });
      return mediaFromFile(file);
    },

    async deleteMedia(id) {
      try {
        await request('DELETE', '/storage/buckets/' + CFG.bucket + '/files/' + encodeURIComponent(id));
      } catch (err) {
        if (err.status !== 404) throw err;
      }
    },

    // Data kini ada di Appwrite; tidak ada salinan lokal yang perlu direset.
    async resetToSeed() {},
  });

  function fileUrl(id) {
    return CFG.endpoint + '/storage/buckets/' + CFG.bucket + '/files/' + encodeURIComponent(id) + '/view?project=' + CFG.project;
  }

  function mediaFromFile(file) {
    const url = fileUrl(file.$id);
    return {
      id: file.$id,
      name: file.name || file.$id,
      size: file.sizeOriginal || 0,
      createdAt: file.$createdAt,
      url,
      dataUrl: url, // nama lama dipertahankan agar UI Kelola tidak perlu diubah
    };
  }

  // ------------------------------------------------------------------
  // Login pengurus (kode 6 angka lewat email)
  // ------------------------------------------------------------------
  const ERRORS = {
    user_invalid_token: 'Kode salah atau sudah kedaluwarsa.',
    user_invalid_credentials: 'Kode salah atau sudah kedaluwarsa.',
    general_rate_limit_exceeded: 'Terlalu sering mencoba. Tunggu beberapa menit lalu ulangi.',
    general_argument_invalid: 'Email atau kode tidak valid.',
    user_blocked: 'Akun ini diblokir.',
    network: 'Tidak bisa terhubung ke server. Periksa koneksi internet.',
  };

  function friendly(err) {
    if (err && ERRORS[err.type]) return ERRORS[err.type];
    if (err && err.network) return ERRORS.network;
    return (err && err.message) || 'Terjadi kesalahan.';
  }

  const Auth = {
    friendly,

    /** @returns {Promise<null | {user: object, member: boolean}>} */
    async me() {
      try {
        const user = await request('GET', '/account', { silent401: true });
        const teams = await request('GET', '/teams', { silent401: true });
        const member = ((teams && teams.teams) || []).some((t) => t.$id === CFG.team);
        return { user, member };
      } catch (err) {
        if (err.status === 401) {
          clearFallback();
          return null;
        }
        throw err;
      }
    },

    async sendCode(email) {
      const token = await request('POST', '/account/tokens/email', {
        json: { userId: 'unique()', email: String(email).trim().toLowerCase() },
        silent401: true,
      });
      return token.userId;
    },

    async verify(userId, code) {
      await request('POST', '/account/sessions/token', {
        json: { userId, secret: String(code).replace(/\s+/g, '') },
        silent401: true,
      });
      return Auth.me();
    },

    async logout() {
      try {
        await request('DELETE', '/account/sessions/current', { silent401: true });
      } catch { /* sesi mungkin sudah habis */ }
      clearFallback();
    },
  };

  global.ContentRepository = repo;
  global.RohisAuth = Auth;
  global.RohisBackend = { config: CFG, ApiError, makeRowId, permissionsFor, mediaIdsIn, mediaPermissionsFor };
})(window);
