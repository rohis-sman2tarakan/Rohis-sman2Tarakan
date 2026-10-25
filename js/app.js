/**
 * Public site behaviour: renders JSON-driven content into the
 * editorial templates, plus the small interaction system (navbar,
 * mobile menu, scroll reveal). Every page sets <body data-page="...">
 * so this single script can decide what to render.
 */

(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const esc = (v) => RohisUtil.escapeHtml(v);
  const safeUrl = (v) => RohisUtil.safeUrl(v);
  // Link targets from site.json: http(s), same-page anchors or relative only.
  const safeHref = (v, fallback) => {
    const u = String(v || '').trim();
    return u && (u.startsWith('#') || RohisUtil.safeUrl(u)) ? u : fallback;
  };

  // Tautan luar dibuka di tab baru; tautan internal tetap di halaman yang sama.
  function setLink(el, url, fallback) {
    if (!el) return;
    const href = safeHref(url, fallback);
    if (href) el.href = href;
    if (/^https?:/i.test(el.getAttribute('href') || '')) {
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    }
  }

  // Semua tombol "Gabung" mengikuti satu alamat: Pengaturan -> Bergabung.
  function applyJoinLinks(site) {
    const url = site.join && site.join.ctaUrl;
    qsa('[data-join-link]').forEach((el) => setLink(el, url, el.getAttribute('href')));
  }

  function setText(el, value) {
    if (el && value != null) el.textContent = value;
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  // ------------------------------------------------------------------
  // Navbar: transparent -> ivory on scroll, mobile menu toggle
  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  // Page transitions: fade out before following an internal page link
  // ------------------------------------------------------------------
  function initPageTransitions() {
    window.addEventListener('pageshow', () => document.documentElement.classList.remove('is-leaving'));
    if (prefersReducedMotion) return;

    document.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('a[href]');
      if (!link || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same-page anchors keep their normal smooth scroll.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      e.preventDefault();
      document.documentElement.classList.add('is-leaving');
      setTimeout(() => { window.location.href = url.href; }, 180);
    });
  }

  function initNav() {
    const page = document.body.dataset.page;
    const rootPage = page === 'kegiatan-detail' ? 'kegiatan' : page === 'tulisan-detail' ? 'tulisan' : page;
    qsa('[data-nav]').forEach((link) => {
      if (link.dataset.nav === rootPage) link.setAttribute('aria-current', 'page');
    });

    const nav = qs('#site-nav');
    if (nav) {
      const onScroll = () => {
        nav.classList.toggle('is-scrolled', window.scrollY > 12);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    const toggle = qs('#nav-toggle');
    const menu = qs('#nav-menu');
    if (toggle && menu) {
      toggle.addEventListener('click', () => {
        const isOpen = menu.classList.toggle('flex');
        menu.classList.toggle('hidden');
        toggle.setAttribute('aria-expanded', String(isOpen));
      });
      qsa('a', menu).forEach((link) => {
        link.addEventListener('click', () => {
          menu.classList.add('hidden');
          menu.classList.remove('flex');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  // ------------------------------------------------------------------
  // Scroll reveal
  // ------------------------------------------------------------------
  function initReveal() {
    const items = qsa('[data-reveal]');
    if (!items.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    items.forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${Math.min(i % 4, 3) * 80}ms`);
      observer.observe(el);
    });
  }

  // ------------------------------------------------------------------
  // Footer + social (shared across every page)
  // ------------------------------------------------------------------
  function renderFooter(site) {
    setText(qs('[data-field="footer-org"]'), site.organization);
    setText(qs('[data-field="footer-school"]'), site.school);
    setText(qs('[data-field="footer-address"]'), site.contact && site.contact.address);

    // Social links: set the URL, or mark the link as "coming soon" when empty.
    const SOCIALS = [
      { key: 'instagram', label: 'Instagram' },
      { key: 'tiktok', label: 'TikTok' },
    ];
    SOCIALS.forEach(({ key, label }) => {
      qsa(`[data-field="social-${key}"]`).forEach((link) => {
        const url = site.social && site.social[key];
        if (url) {
          link.href = safeHref(url, '#');
          link.classList.remove('pointer-events-none', 'text-muted/50');
        } else {
          link.href = '#';
          link.setAttribute('aria-disabled', 'true');
          link.classList.add('pointer-events-none', 'text-muted/50');
          link.textContent = `${label} (segera hadir)`;
        }
      });
    });

    const email = qs('[data-field="footer-email"]');
    if (email) {
      if (site.contact && site.contact.email) {
        email.href = `mailto:${encodeURIComponent(site.contact.email).replace(/%40/g, '@')}`;
        email.textContent = site.contact.email;
        email.classList.remove('hidden');
      } else {
        email.classList.add('hidden');
      }
    }
  }

  // ------------------------------------------------------------------
  // Homepage sections
  // ------------------------------------------------------------------
  function renderHero(site) {
    const hero = site.hero || {};
    setText(qs('[data-field="hero-eyebrow"]'), hero.eyebrow);
    setText(qs('[data-field="hero-headline"]'), hero.headline);
    setText(qs('[data-field="hero-description"]'), hero.description);
    setText(qs('[data-field="hero-meta"]'), hero.meetingNote);
    setText(qs('[data-field="hero-location"]'), [site.school, site.contact && site.contact.address].filter(Boolean).join(' · '));

    // Optional photo: when site.hero.image is set it replaces the illustrated landscape.
    const heroEl = qs('#hero');
    const photo = safeUrl(hero.image);
    const photoLayer = heroEl && qs('.hero-bg', heroEl);
    if (photoLayer && photo) {
      photoLayer.style.backgroundImage = `linear-gradient(180deg, rgba(20, 40, 26, 0.55) 0%, rgba(20, 40, 26, 0.2) 55%, rgba(20, 40, 26, 0.6) 100%), url("${encodeURI(photo)}")`;
      heroEl.classList.add('has-photo');
    }

    const cta = qs('[data-field="hero-cta"]');
    if (cta) {
      setText(cta, hero.ctaLabel);
      setLink(cta, hero.ctaUrl, '#kontak');
    }

    if (heroEl) {
      // Let the browser paint the hidden state first so the entrance animates.
      requestAnimationFrame(() => heroEl.classList.add('is-ready'));
    }
  }

  function renderAbout(site) {
    const about = site.about || {};
    setText(qs('[data-field="about-eyebrow"]'), about.eyebrow);
    setText(qs('[data-field="about-lead"]'), about.lead);
    setText(qs('[data-field="about-body"]'), about.body);
  }

  function renderJoin(site) {
    const join = site.join || {};
    setText(qs('[data-field="join-eyebrow"]'), join.eyebrow);
    setText(qs('[data-field="join-headline"]'), join.headline);
    const cta = qs('[data-field="join-cta"]');
    if (cta) {
      setText(cta, join.ctaLabel);
      setLink(cta, join.ctaUrl, '#kontak');
    }
  }

  // Illustrated icon per known program id; others fall back to the number badge.
  const PROGRAM_ICONS = {
    'kajian-tematik': 'icon-al-quran',
    'aksi-sosial': 'icon-komunitas',
    'literasi-media': 'icon-dakwah',
  };

  function programItemHTML(program) {
    const icon = PROGRAM_ICONS[program.id];
    const badge = icon
      ? `<img src="./assets/images/${icon}.png" alt="" width="64" height="64" class="h-16 w-16" loading="lazy">`
      : `<span class="num-badge">${esc(program.number)}</span>`;
    return `
      <div class="card is-hoverable p-7" data-reveal>
        ${badge}
        <h3 class="font-serif-custom text-xl mt-5 mb-2">${esc(program.title)}</h3>
        <p class="text-sm text-muted leading-relaxed">${esc(program.description)}</p>
      </div>`;
  }

  async function renderPrograms() {
    const container = qs('[data-list="programs"]');
    if (!container) return;
    const programs = await ContentRepository.getPrograms();
    const active = [...programs]
      .filter((p) => p.status === 'active')
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    container.innerHTML = active.length
      ? active.map(programItemHTML).join('')
      : '<p class="text-sm text-muted">Program sedang disusun ulang.</p>';
  }

  // ------------------------------------------------------------------
  // Activities (Kegiatan)
  // ------------------------------------------------------------------
  const LEAF_ICON = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.5 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5.1-6.2C9.6 14.2 12 13 13 12"/></svg>';

  function coverHTML(item, aspect, fallbackIcon) {
    const src = safeUrl(item.cover);
    if (src) {
      return `<img src="${esc(src)}" alt="${esc(item.title)}" class="w-full ${aspect} object-cover" loading="lazy">`;
    }
    return `<div class="w-full ${aspect} cover-placeholder">${fallbackIcon}</div>`;
  }

  function activityCoverHTML(activity, aspect) {
    return coverHTML(activity, aspect, LEAF_ICON);
  }

  function activityCardHTML(activity) {
    return `
      <a href="./kegiatan-detail.html?id=${encodeURIComponent(activity.id)}" class="card group flex flex-col" data-reveal data-category="${esc(activity.category || '')}" data-period="${esc(RohisUtil.periodOf(activity))}">
        <div class="media-frame">${activityCoverHTML(activity, 'aspect-[4/3]')}</div>
        <div class="card-body flex flex-col flex-1">
          <span class="chip self-start mb-3">${esc(activity.category || 'Kegiatan')}</span>
          <h3 class="font-serif-custom text-lg leading-snug mb-2 group-hover:text-leaf transition">${esc(activity.title)}</h3>
          <p class="text-sm text-muted leading-relaxed line-clamp-2 mb-4">${esc(activity.excerpt || '')}</p>
          <time class="text-xs text-muted mt-auto" datetime="${esc(activity.date)}">${esc(formatDate(activity.date))}</time>
        </div>
      </a>`;
  }

  function publishedSortedByDate(list) {
    return list
      .filter((item) => item.status === 'published')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async function renderActivitiesPreview() {
    const container = qs('[data-list="activities-preview"]');
    if (!container) return;
    const activities = publishedSortedByDate(await ContentRepository.getActivities()).slice(0, 3);

    container.innerHTML = activities.length
      ? `<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${activities.map(activityCardHTML).join('')}</div>`
      : '<p class="text-sm text-muted" data-reveal>Belum ada kegiatan yang dipublikasikan. Nantikan kabar terbaru dari kami.</p>';
  }

  async function renderActivitiesFull() {
    const container = qs('[data-list="activities-full"]');
    if (!container) return;
    const activities = publishedSortedByDate(await ContentRepository.getActivities());

    if (!activities.length) {
      container.innerHTML = '<p class="text-sm text-muted py-10" data-reveal>Belum ada kegiatan yang dipublikasikan.</p>';
      return;
    }

    container.innerHTML = `<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">${activities.map(activityCardHTML).join('')}</div>`;
    initFilters(activities, container, 'activities-period', 'activities-category');
  }

  // ------------------------------------------------------------------
  // Articles (Tulisan / Rohis Journal)
  // ------------------------------------------------------------------
  function articleCardHTML(article) {
    return `
      <a href="./tulisan-detail.html?id=${encodeURIComponent(article.id)}" class="card group block p-6" data-reveal data-category="${esc(article.category || '')}" data-period="${esc(RohisUtil.periodOf(article))}">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="min-w-0">
            <span class="chip">${esc(article.category || 'Tulisan')}</span>
            <h3 class="font-serif-custom text-xl mt-3 group-hover:text-leaf transition">${esc(article.title)}</h3>
            <p class="text-xs text-muted mt-1.5">Ditulis oleh ${esc(article.author || 'Rohis')} &middot; ${esc(article.readTime || '')}</p>
          </div>
          <span class="text-sm font-semibold text-leaf shrink-0">Baca selengkapnya &rarr;</span>
        </div>
      </a>`;
  }

  async function renderArticlesPreview() {
    const container = qs('[data-list="articles-preview"]');
    if (!container) return;
    const articles = publishedSortedByDate(await ContentRepository.getArticles()).slice(0, 3);

    container.innerHTML = articles.length
      ? articles.map(articleCardHTML).join('')
      : '<p class="text-sm text-muted" data-reveal>Belum ada tulisan yang diterbitkan.</p>';
  }

  async function renderArticlesFull() {
    const container = qs('[data-list="articles-full"]');
    if (!container) return;
    const articles = publishedSortedByDate(await ContentRepository.getArticles());

    if (!articles.length) {
      container.innerHTML = '<p class="text-sm text-muted py-10" data-reveal>Belum ada tulisan yang diterbitkan.</p>';
      return;
    }

    container.innerHTML = `<div class="space-y-4">${articles.map(articleCardHTML).join('')}</div>`;
    initFilters(articles, container, 'articles-period', 'articles-category');
  }

  // ------------------------------------------------------------------
  // Filter periode + kategori (dipakai bersama, ringan)
  // ------------------------------------------------------------------
  const ALL_PERIODS = '';
  const chipClass = (on) =>
    'tap-target px-4 py-2 rounded-full text-xs font-semibold border transition ' +
    (on ? 'bg-forest text-white border-forest' : 'bg-white text-muted border-line hover:border-forest hover:text-forest');

  function initFilters(items, listContainer, periodFilterName, categoryFilterName) {
    const periodBar = qs(`[data-filter="${periodFilterName}"]`);
    const catBar = qs(`[data-filter="${categoryFilterName}"]`);
    if (!catBar) return;

    // Periode terbaru lebih dulu; secara bawaan yang tampil adalah periode terbaru.
    const periods = Array.from(new Set(items.map((i) => RohisUtil.periodOf(i)).filter(Boolean))).sort().reverse();
    const state = { period: periods.length > 1 ? periods[0] : ALL_PERIODS, cat: '' };

    function apply() {
      qsa('[data-category]', listContainer).forEach((el) => {
        const okPeriod = !state.period || el.dataset.period === state.period;
        const okCat = !state.cat || el.dataset.category === state.cat;
        el.classList.toggle('is-filtered-out', !(okPeriod && okCat));
      });
    }

    function renderCategoryChips() {
      const inScope = items.filter((i) => !state.period || RohisUtil.periodOf(i) === state.period);
      const categories = Array.from(new Set(inScope.map((i) => i.category).filter(Boolean)));
      if (state.cat && !categories.includes(state.cat)) state.cat = '';
      catBar.innerHTML = ['Semua', ...categories]
        .map((cat) => {
          const value = cat === 'Semua' ? '' : cat;
          return `<button type="button" class="${chipClass(value === state.cat)}" data-cat="${esc(value)}">${esc(cat)}</button>`;
        })
        .join('');
      qsa('button', catBar).forEach((btn) =>
        btn.addEventListener('click', () => {
          state.cat = btn.dataset.cat;
          renderCategoryChips();
          apply();
        })
      );
    }

    function renderPeriodChips() {
      if (!periodBar || periods.length < 2) {
        if (periodBar) periodBar.classList.add('hidden');
        return;
      }
      const options = [...periods.map((p) => [p, 'Periode ' + p]), [ALL_PERIODS, 'Semua periode']];
      periodBar.innerHTML = options
        .map(([value, label]) => `<button type="button" class="${chipClass(value === state.period)}" data-period-chip="${esc(value)}" aria-pressed="${value === state.period}">${esc(label)}</button>`)
        .join('');
      qsa('button', periodBar).forEach((btn) =>
        btn.addEventListener('click', () => {
          state.period = btn.dataset.periodChip;
          renderPeriodChips();
          renderCategoryChips();
          apply();
        })
      );
    }

    renderPeriodChips();
    renderCategoryChips();
    apply();
  }

  // ------------------------------------------------------------------
  // Detail pages
  // ------------------------------------------------------------------
  function getQueryId() {
    return new URLSearchParams(window.location.search).get('id');
  }

  function isPreview() {
    return new URLSearchParams(window.location.search).get('preview') === 'true';
  }

  function renderNotFound(root, backHref, label) {
    root.innerHTML = `
      <div class="text-center py-24">
        <p class="text-sm text-muted mb-4">${esc(label)} tidak ditemukan.</p>
        <a href="${backHref}" class="text-forest font-medium text-sm">&larr; Kembali ke daftar</a>
      </div>`;
  }

  async function renderActivityDetail() {
    const root = qs('[data-detail="activity"]');
    if (!root) return;

    let activity = isPreview() ? ContentRepository.getPreviewDraft('activity') : null;
    if (!activity) {
      const id = getQueryId();
      activity = id ? await ContentRepository.getActivity(id) : null;
    }

    if (!activity) {
      renderNotFound(root, './kegiatan.html', 'Kegiatan');
      return;
    }

    document.title = `${activity.title} — Rohis Al Ihsan`;

    const gallery = Array.isArray(activity.gallery) ? activity.gallery : [];
    root.innerHTML = `
      ${isPreview() ? '<p class="mb-6 text-xs uppercase tracking-widest text-forest bg-surface inline-block px-3 py-1.5 rounded-full" data-reveal>Mode pratinjau — belum tersimpan</p>' : ''}
      <a href="./kegiatan.html" class="inline-flex items-center gap-1 text-sm font-semibold text-leaf hover:text-forest mb-8" data-reveal>&larr; Kembali ke daftar kegiatan</a>
      <div class="flex items-center gap-3 text-xs text-muted mb-4" data-reveal>
        <span class="chip">${esc(activity.category || 'Kegiatan')}</span>
        <span>&middot;</span>
        <time datetime="${esc(activity.date)}">${esc(formatDate(activity.date))}</time>
      </div>
      <h1 class="font-serif-custom text-3xl md:text-5xl leading-tight mb-8" data-reveal>${esc(activity.title)}</h1>
      <div class="media-frame mb-10" data-reveal>${activityCoverHTML(activity, 'aspect-[16/9] rounded-3xl')}</div>
      <div class="card prose-content p-6 sm:p-10 text-charcoal leading-relaxed whitespace-pre-line" data-reveal>${esc(activity.content || '')}</div>
      ${
        gallery.length
          ? `<div class="mt-12 grid grid-cols-2 md:grid-cols-3 gap-3" data-reveal>${gallery
              .map((src) => `<div class="media-frame"><img src="${esc(safeUrl(src))}" alt="" loading="lazy" class="w-full aspect-square object-cover rounded-2xl"></div>`)
              .join('')}</div>`
          : ''
      }
    `;
  }

  async function renderArticleDetail() {
    const root = qs('[data-detail="article"]');
    if (!root) return;

    let article = isPreview() ? ContentRepository.getPreviewDraft('article') : null;
    if (!article) {
      const id = getQueryId();
      article = id ? await ContentRepository.getArticle(id) : null;
    }

    if (!article) {
      renderNotFound(root, './tulisan.html', 'Tulisan');
      return;
    }

    document.title = `${article.title} — Rohis Al Ihsan`;

    root.innerHTML = `
      ${isPreview() ? '<p class="mb-6 text-xs uppercase tracking-widest text-forest bg-surface inline-block px-3 py-1.5 rounded-full" data-reveal>Mode pratinjau — belum tersimpan</p>' : ''}
      <a href="./tulisan.html" class="inline-flex items-center gap-1 text-sm font-semibold text-leaf hover:text-forest mb-8" data-reveal>&larr; Kembali ke Rohis Journal</a>
      <div class="mb-1" data-reveal><span class="chip">${esc(article.category || 'Tulisan')}</span></div>
      <h1 class="font-serif-custom text-3xl md:text-5xl leading-tight mt-3 mb-4" data-reveal>${esc(article.title)}</h1>
      <p class="text-sm text-muted mb-8" data-reveal>Ditulis oleh ${esc(article.author || 'Rohis')} &middot; ${esc(formatDate(article.date))}${
      article.readTime ? ` &middot; ${esc(article.readTime)}` : ''
    }</p>
      ${safeUrl(article.cover) ? `<div class="media-frame mb-10" data-reveal><img src="${esc(safeUrl(article.cover))}" alt="${esc(article.title)}" class="w-full aspect-[16/9] object-cover rounded-3xl" loading="lazy"></div>` : ''}
      <div class="card prose-content p-6 sm:p-10 text-charcoal leading-relaxed whitespace-pre-line" data-reveal>${esc(article.content || '')}</div>
    `;
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  async function boot() {
    initNav();
    initPageTransitions();

    // Home hero: hide the copy until content is rendered, with a safety net.
    const heroEl = qs('#hero');
    if (heroEl) {
      heroEl.classList.add('is-prep');
      setTimeout(() => heroEl.classList.add('is-ready'), 2500);
    }

    const page = document.body.dataset.page;
    const site = await ContentRepository.getSite();
    renderFooter(site);
    applyJoinLinks(site);
    qsa('[data-field="motto"]').forEach((el) => {
      if (site.motto) el.textContent = site.motto;
      else (el.closest('.hero-motto') || el).classList.add('hidden');
    });

    if (page === 'home') {
      renderHero(site);
      renderAbout(site);
      renderJoin(site);
      await Promise.all([renderPrograms(), renderActivitiesPreview(), renderArticlesPreview()]);
    } else if (page === 'kegiatan') {
      await renderActivitiesFull();
    } else if (page === 'kegiatan-detail') {
      await renderActivityDetail();
    } else if (page === 'tulisan') {
      await renderArticlesFull();
    } else if (page === 'tulisan-detail') {
      await renderArticleDetail();
    } else if (page === 'tentang') {
      renderAbout(site);
      await renderPrograms();
    }

    initReveal();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
