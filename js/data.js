/**
 * Fallback content repository backed by seed JSON and localStorage.
 *
 * js/appwrite-repository.js loads after this file and replaces the fallback
 * with the Appwrite-backed repository. Public pages use Appwrite first and
 * fall back to seed JSON when the service is unavailable. localStorage is a
 * local fallback/cache, not the production source of truth. */

(function (global) {
  const STORAGE_KEYS = {
    site: 'rohis:site',
    programs: 'rohis:programs',
    activities: 'rohis:activities',
    articles: 'rohis:articles',
    media: 'rohis:media',
  };

  // Resolved against this script's own URL so the same paths work from
  // any page depth (/, /kelola/) and under a GitHub Pages project path.
  const SCRIPT_URL = document.currentScript && document.currentScript.src;
  const SEED_PATHS = {
    site: '../data/site.json',
    programs: '../data/programs.json',
    activities: '../data/activities.json',
    articles: '../data/articles.json',
  };

  // Only the admin workspace reads/writes the local draft cache. Public
  // pages always read the published JSON, so edits to data/*.json reach
  // every visitor and stale local copies never shadow them.
  const IS_ADMIN = document.body && document.body.dataset.page === 'kelola';

  function readCache(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('Gagal membaca cache lokal untuk', key, err);
      return null;
    }
  }

  function writeCache(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn('Gagal menyimpan ke localStorage (kemungkinan penuh):', err);
      throw err;
    }
  }

  async function loadSeed(seedPath) {
    const url = SCRIPT_URL ? new URL(seedPath, SCRIPT_URL).href : seedPath;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`Gagal memuat ${seedPath}: ${res.status}`);
    }
    return res.json();
  }

  async function loadCollection(key) {
    const storageKey = STORAGE_KEYS[key];
    if (!IS_ADMIN) return loadSeed(SEED_PATHS[key]);
    const cached = readCache(storageKey);
    if (cached !== null) return cached;
    const seed = await loadSeed(SEED_PATHS[key]);
    writeCache(storageKey, seed);
    return seed;
  }

  function slugify(text) {
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60);
  }

  function makeId(existing, title) {
    const base = slugify(title) || 'item';
    let candidate = base;
    let n = 2;
    const ids = new Set(existing.map((item) => item.id));
    while (ids.has(candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    return candidate;
  }

  class LocalStorageRepository {
    // ---- Site settings -------------------------------------------------
    async getSite() {
      return loadCollection('site');
    }

    async saveSite(site) {
      writeCache(STORAGE_KEYS.site, site);
      return site;
    }

    // ---- Programs --------------------------------------------------------
    async getPrograms() {
      return loadCollection('programs');
    }

    async saveProgram(program) {
      const list = await this.getPrograms();
      const isNew = !program.id;
      if (isNew) {
        program.id = makeId(list, program.title);
      }
      const idx = list.findIndex((p) => p.id === program.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...program };
      } else {
        list.push(program);
      }
      writeCache(STORAGE_KEYS.programs, list);
      return program;
    }

    async deleteProgram(id) {
      const list = await this.getPrograms();
      const next = list.filter((p) => p.id !== id);
      writeCache(STORAGE_KEYS.programs, next);
    }

    // ---- Activities (Kegiatan) -------------------------------------------
    async getActivities() {
      return loadCollection('activities');
    }

    async getActivity(id) {
      const list = await this.getActivities();
      return list.find((a) => a.id === id) || null;
    }

    async saveActivity(activity) {
      const list = await this.getActivities();
      const isNew = !activity.id;
      if (isNew) {
        activity.id = makeId(list, activity.title);
        activity.createdAt = new Date().toISOString();
      }
      activity.updatedAt = new Date().toISOString();
      const idx = list.findIndex((a) => a.id === activity.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...activity };
      } else {
        list.unshift(activity);
      }
      writeCache(STORAGE_KEYS.activities, list);
      return activity;
    }

    async deleteActivity(id) {
      const list = await this.getActivities();
      const next = list.filter((a) => a.id !== id);
      writeCache(STORAGE_KEYS.activities, next);
    }

    // ---- Articles (Tulisan / Journal) ------------------------------------
    async getArticles() {
      return loadCollection('articles');
    }

    async getArticle(id) {
      const list = await this.getArticles();
      return list.find((a) => a.id === id) || null;
    }

    async saveArticle(article) {
      const list = await this.getArticles();
      const isNew = !article.id;
      if (isNew) {
        article.id = makeId(list, article.title);
        article.createdAt = new Date().toISOString();
      }
      article.updatedAt = new Date().toISOString();
      const idx = list.findIndex((a) => a.id === article.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...article };
      } else {
        list.unshift(article);
      }
      writeCache(STORAGE_KEYS.articles, list);
      return article;
    }

    async deleteArticle(id) {
      const list = await this.getArticles();
      const next = list.filter((a) => a.id !== id);
      writeCache(STORAGE_KEYS.articles, next);
    }

    // ---- Media library (prototype: dataURL in localStorage) --------------
    async getMedia() {
      return readCache(STORAGE_KEYS.media) || [];
    }

    async saveMedia(item) {
      const list = await this.getMedia();
      item.id = item.id || `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      item.createdAt = item.createdAt || new Date().toISOString();
      list.unshift(item);
      writeCache(STORAGE_KEYS.media, list);
      return item;
    }

    async deleteMedia(id) {
      const list = await this.getMedia();
      const next = list.filter((m) => m.id !== id);
      writeCache(STORAGE_KEYS.media, next);
    }

    // ---- Prototype utilities ----------------------------------------------
    async resetToSeed() {
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    }

    // ---- Preview drafts (session-only, never "published") -----------------
    setPreviewDraft(type, data) {
      try {
        sessionStorage.setItem(`rohis:preview:${type}`, JSON.stringify(data));
      } catch (err) {
        console.warn('Gagal menyimpan draft pratinjau', err);
      }
    }

    getPreviewDraft(type) {
      try {
        const raw = sessionStorage.getItem(`rohis:preview:${type}`);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        return null;
      }
    }
  }

  global.ContentRepository = new LocalStorageRepository();
  
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Only http(s), same-site relative paths and data:image/ URLs may be used
  // as image sources; anything else (javascript:, etc.) collapses to ''.
  function safeUrl(value) {
    const v = String(value == null ? '' : value).trim();
    if (!v || /[\u0000-\u001f\u007f"'\\\\<>]/.test(v)) return '';
    if (/^https?:\/\//i.test(v)) {
      try {
        const parsed = new URL(v);
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? v : '';
      } catch (err) {
        return '';
      }
    }
    if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(v)) return v;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('//')) return '';
    return v;
  }

  // Periode kepengurusan. Diisi manual jika ada; jika kosong, otomatis dari
  // tahun pada tanggal (pergantian pengurus biasanya Desember-Januari).
  function periodOf(item) {
    const manual = String((item && item.period) || '').trim();
    if (manual) return manual;
    const year = String((item && item.date) || '').slice(0, 4);
    return /^\d{4}$/.test(year) ? year : '';
  }

  global.RohisUtil = { slugify, escapeHtml, safeUrl, periodOf };
})(window);
