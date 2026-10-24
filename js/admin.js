/**
 * Admin workspace. Semua penyimpanan lewat ContentRepository
 * (js/appwrite-repository.js) — file ini hanya mengurus tampilan.
 *
 * Akses dijaga di dua lapis: layar masuk (kode 6 angka lewat email) dan,
 * yang sebenarnya menentukan, izin tulis di Appwrite (tim `pengurus`).
 */

(function () {
  const qs = (sel, root) => (root || document).querySelector(sel);
  const esc = (v) => RohisUtil.escapeHtml(v);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /**
   * Guards a view loader against out-of-order async responses: if the
   * same view is revisited (or a save triggers a reload) before an
   * earlier call finished, the earlier call's render is discarded
   * instead of overwriting the newer one.
   */
  function latestOnly(fn) {
    let token = 0;
    return async (...args) => {
      const mine = ++token;
      const isCurrent = () => mine === token;
      return fn(isCurrent, ...args);
    };
  }

  function toast(message) {
    const el = qs('#admin-toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-visible'), 2200);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function badge(status, activeLabel, inactiveLabel) {
    const allowedStatuses = new Set(['published', 'draft', 'active', 'inactive']);
    const safeStatus = allowedStatuses.has(status) ? status : 'unknown';
    const isActive = safeStatus === 'published' || safeStatus === 'active';
    const label = isActive ? activeLabel : inactiveLabel;
    return `<span class="admin-badge status-${safeStatus}">${label}</span>`;
  }

  // --------------------------------------------------------------------
  // View routing
  // --------------------------------------------------------------------
  const VIEWS = ['dashboard', 'kegiatan', 'tulisan', 'program', 'media', 'pengaturan'];

  function currentView() {
    const hash = (window.location.hash || '#dashboard').replace('#', '');
    return VIEWS.includes(hash) ? hash : 'dashboard';
  }

  // Set by the dashboard so the target form opens after the view switches.
  let pendingOpen = null;

  function renderView() {
    const view = currentView();
    qsa('[data-view-panel]').forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.viewPanel === view);
    });
    qsa('[data-nav-view]').forEach((link) => {
      const isActive = link.dataset.navView === view;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    const sidebar = qs('#sidebar');
    if (sidebar && window.innerWidth < 768) {
      sidebar.classList.add('hidden');
      qs('#sidebar-toggle')?.setAttribute('aria-expanded', 'false');
    }

    if (view === 'dashboard') loadDashboard();
    if (view === 'kegiatan') { showSubview('kegiatan', 'kegiatan-list'); loadActivityList(); }
    if (view === 'tulisan') { showSubview('tulisan', 'tulisan-list'); loadArticleList(); }
    if (view === 'program') { showSubview('program', 'program-list'); loadProgramList(); }
    if (view === 'media') loadMediaList();
    if (view === 'pengaturan') loadSettingsForm();

    if (pendingOpen) {
      const { type, id } = pendingOpen;
      pendingOpen = null;
      if (type === 'activity' && view === 'kegiatan') openActivityForm(id);
      if (type === 'article' && view === 'tulisan') openArticleForm(id);
    }
  }

  function showSubview(panelView, subviewName) {
    const panel = qs(`[data-view-panel="${panelView}"]`);
    qsa('[data-subview]', panel).forEach((el) => {
      el.classList.toggle('hidden', el.dataset.subview !== subviewName);
    });
  }

  // --------------------------------------------------------------------
  // Dashboard
  // --------------------------------------------------------------------
  const loadDashboard = latestOnly(async (isCurrent) => {
    const [activities, articles, programs, media] = await Promise.all([
      ContentRepository.getActivities(),
      ContentRepository.getArticles(),
      ContentRepository.getPrograms(),
      ContentRepository.getMedia(),
    ]);
    if (!isCurrent()) return;

    qs('[data-stat="kegiatan"]').textContent = activities.length;
    qs('[data-stat="tulisan"]').textContent = articles.length;
    qs('[data-stat="program"]').textContent = programs.filter((p) => p.status === 'active').length;
    qs('[data-stat="media"]').textContent = media.length;

    const recent = [
      ...activities.map((a) => ({ ...a, _type: 'Kegiatan', _sort: a.updatedAt || a.createdAt || a.date })),
      ...articles.map((a) => ({ ...a, _type: 'Tulisan', _sort: a.updatedAt || a.createdAt || a.date })),
    ]
      .sort((a, b) => new Date(b._sort || 0) - new Date(a._sort || 0))
      .slice(0, 6);

    const list = qs('[data-list="recent-activity"]');
    list.innerHTML = recent.length
      ? recent
          .map(
            (item) => `
        <button type="button" class="admin-row w-full text-left py-4 flex items-center justify-between gap-4 hover:bg-surface px-2 -mx-2 rounded-lg" data-open="${item._type === 'Kegiatan' ? 'activity' : 'article'}" data-id="${esc(item.id)}">
          <div class="min-w-0">
            <p class="text-xs text-muted uppercase tracking-widest mb-1">${esc(item._type)}</p>
            <p class="text-sm font-medium truncate">${esc(item.title)}</p>
          </div>
          ${badge(item.status, 'Published', 'Draft')}
        </button>`
          )
          .join('')
      : '<p class="text-sm text-muted py-4">Belum ada aktivitas.</p>';

    qsa('[data-open]', list).forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.open === 'activity') {
          pendingOpen = { type: 'activity', id: btn.dataset.id };
          window.location.hash = '#kegiatan';
        } else {
          pendingOpen = { type: 'article', id: btn.dataset.id };
          window.location.hash = '#tulisan';
        }
      });
    });
  });

  // --------------------------------------------------------------------
  // Kegiatan (Activities)
  // --------------------------------------------------------------------
  const loadActivityList = latestOnly(async (isCurrent) => {
    const activities = await ContentRepository.getActivities();
    if (!isCurrent()) return;
    const list = qs('[data-list="activities"]');
    list.innerHTML = activities.length
      ? activities
          .map(
            (a) => `
        <div class="admin-row py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">${badge(a.status, 'Published', 'Draft')}<span class="text-xs text-muted">${esc(formatDate(a.date))} &middot; Periode ${esc(RohisUtil.periodOf(a) || '—')}</span></div>
            <p class="font-medium truncate">${esc(a.title)}</p>
            <p class="text-xs text-muted truncate">${esc(a.category || '')}</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <button type="button" class="tap-target text-sm px-3 border border-line rounded-full hover:border-forest" data-edit="${esc(a.id)}">Edit</button>
            <button type="button" class="tap-target text-sm px-3 border border-line rounded-full hover:border-forest" data-preview="${esc(a.id)}">Preview</button>
            <button type="button" class="tap-target text-sm px-3 border border-line rounded-full text-red-700 hover:border-red-700" data-delete="${esc(a.id)}">Hapus</button>
          </div>
        </div>`
          )
          .join('')
      : '<p class="text-sm text-muted py-8">Belum ada kegiatan. Klik "+ Tambah Kegiatan" untuk mulai.</p>';

    qsa('[data-edit]', list).forEach((btn) => btn.addEventListener('click', () => openActivityForm(btn.dataset.edit)));
    qsa('[data-preview]', list).forEach((btn) => btn.addEventListener('click', () => previewSavedActivity(btn.dataset.preview)));
    qsa('[data-delete]', list).forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (confirm('Hapus kegiatan ini? Tindakan ini tidak dapat dibatalkan.')) {
          await ContentRepository.deleteActivity(btn.dataset.delete);
          toast('Kegiatan dihapus.');
          loadActivityList();
        }
      })
    );
  });

  async function previewSavedActivity(id) {
    const activity = await ContentRepository.getActivity(id);
    if (!activity) return;
    ContentRepository.setPreviewDraft('activity', activity);
    window.open('../kegiatan-detail.html?preview=true', '_blank');
  }

  async function openActivityForm(id) {
    const form = qs('[data-form="activity"]');
    form.reset();
    qs('[data-form-title="kegiatan"]').textContent = id ? 'Edit Kegiatan' : 'Kegiatan Baru';

    if (id) {
      const activity = await ContentRepository.getActivity(id);
      if (activity) {
        form.elements.id.value = activity.id;
        form.elements.title.value = activity.title || '';
        form.elements.date.value = (activity.date || '').slice(0, 10);
        form.elements.category.value = activity.category || '';
        form.elements.period.value = activity.period || '';
        form.elements.excerpt.value = activity.excerpt || '';
        form.elements.cover.value = activity.cover || '';
        form.elements.content.value = activity.content || '';
        form.elements.status.value = activity.status || 'draft';
      }
    }
    showSubview('kegiatan', 'kegiatan-form');
  }

  function readForm(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }

  function activityDraftFromForm(form) {
    const data = readForm(form);
    return {
      id: data.id || undefined,
      title: data.title,
      date: data.date,
      category: data.category,
      period: data.period,
      excerpt: data.excerpt,
      cover: data.cover,
      content: data.content,
      status: data.status,
    };
  }

  function initActivityForm() {
    const form = qs('[data-form="activity"]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const activity = activityDraftFromForm(form);
      try {
        await ContentRepository.saveActivity(activity);
      } catch (err) {
        toast('Gagal menyimpan: ' + RohisAuth.friendly(err));
        return;
      }
      toast('Kegiatan disimpan.');
      showSubview('kegiatan', 'kegiatan-list');
      loadActivityList();
    });

    qs('[data-action="preview-activity"]').addEventListener('click', () => {
      const draft = activityDraftFromForm(form);
      ContentRepository.setPreviewDraft('activity', draft);
      window.open('../kegiatan-detail.html?preview=true', '_blank');
    });
  }

  // --------------------------------------------------------------------
  // Tulisan (Articles)
  // --------------------------------------------------------------------
  const loadArticleList = latestOnly(async (isCurrent) => {
    const articles = await ContentRepository.getArticles();
    if (!isCurrent()) return;
    const list = qs('[data-list="articles"]');
    list.innerHTML = articles.length
      ? articles
          .map(
            (a) => `
        <div class="admin-row py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">${badge(a.status, 'Published', 'Draft')}<span class="text-xs text-muted">${esc(formatDate(a.date))} &middot; Periode ${esc(RohisUtil.periodOf(a) || '—')}</span></div>
            <p class="font-medium truncate">${esc(a.title)}</p>
            <p class="text-xs text-muted truncate">${esc(a.author || '')} &middot; ${esc(a.category || '')}</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <button type="button" class="tap-target text-sm px-3 border border-line rounded-full hover:border-forest" data-edit="${esc(a.id)}">Edit</button>
            <button type="button" class="tap-target text-sm px-3 border border-line rounded-full hover:border-forest" data-preview="${esc(a.id)}">Preview</button>
            <button type="button" class="tap-target text-sm px-3 border border-line rounded-full text-red-700 hover:border-red-700" data-delete="${esc(a.id)}">Hapus</button>
          </div>
        </div>`
          )
          .join('')
      : '<p class="text-sm text-muted py-8">Belum ada tulisan. Klik "+ Tulisan Baru" untuk mulai.</p>';

    qsa('[data-edit]', list).forEach((btn) => btn.addEventListener('click', () => openArticleForm(btn.dataset.edit)));
    qsa('[data-preview]', list).forEach((btn) => btn.addEventListener('click', () => previewSavedArticle(btn.dataset.preview)));
    qsa('[data-delete]', list).forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (confirm('Hapus tulisan ini? Tindakan ini tidak dapat dibatalkan.')) {
          await ContentRepository.deleteArticle(btn.dataset.delete);
          toast('Tulisan dihapus.');
          loadArticleList();
        }
      })
    );
  });

  async function previewSavedArticle(id) {
    const article = await ContentRepository.getArticle(id);
    if (!article) return;
    ContentRepository.setPreviewDraft('article', article);
    window.open('../tulisan-detail.html?preview=true', '_blank');
  }

  async function openArticleForm(id) {
    const form = qs('[data-form="article"]');
    form.reset();
    qs('[data-form-title="tulisan"]').textContent = id ? 'Edit Tulisan' : 'Tulisan Baru';

    if (id) {
      const article = await ContentRepository.getArticle(id);
      if (article) {
        form.elements.id.value = article.id;
        form.elements.title.value = article.title || '';
        form.elements.author.value = article.author || '';
        form.elements.readTime.value = article.readTime || '';
        form.elements.edition.value = article.edition || '';
        form.elements.date.value = (article.date || '').slice(0, 10);
        form.elements.category.value = article.category || '';
        form.elements.period.value = article.period || '';
        form.elements.cover.value = article.cover || '';
        form.elements.excerpt.value = article.excerpt || '';
        form.elements.content.value = article.content || '';
        form.elements.status.value = article.status || 'draft';
      }
    }
    showSubview('tulisan', 'tulisan-form');
  }

  function articleDraftFromForm(form, statusOverride) {
    const data = readForm(form);
    return {
      id: data.id || undefined,
      title: data.title,
      author: data.author,
      readTime: data.readTime,
      edition: data.edition,
      date: data.date,
      category: data.category,
      period: data.period,
      cover: data.cover,
      excerpt: data.excerpt,
      content: data.content,
      status: statusOverride || data.status,
    };
  }

  function initArticleForm() {
    const form = qs('[data-form="article"]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const article = articleDraftFromForm(form, e.submitter && e.submitter.dataset.submitStatus ? e.submitter.dataset.submitStatus : null);
      try {
        await ContentRepository.saveArticle(article);
      } catch (err) {
        toast('Gagal menyimpan: ' + RohisAuth.friendly(err));
        return;
      }
      toast(article.status === 'published' ? 'Tulisan diterbitkan.' : 'Draft tersimpan.');
      showSubview('tulisan', 'tulisan-list');
      loadArticleList();
    });

    qs('[data-action="preview-article"]').addEventListener('click', () => {
      const draft = articleDraftFromForm(form);
      ContentRepository.setPreviewDraft('article', draft);
      window.open('../tulisan-detail.html?preview=true', '_blank');
    });
  }

  // --------------------------------------------------------------------
  // Program
  // --------------------------------------------------------------------
  const loadProgramList = latestOnly(async (isCurrent) => {
    const programs = [...(await ContentRepository.getPrograms())].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!isCurrent()) return;
    const list = qs('[data-list="programs"]');
    list.innerHTML = programs.length
      ? programs
          .map(
            (p) => `
        <div class="admin-row py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
          <div class="min-w-0 flex items-start gap-3">
            <span class="text-xs font-mono text-muted mt-0.5">${esc(p.number || '')}</span>
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-1">${badge(p.status, 'Aktif', 'Nonaktif')}</div>
              <p class="font-medium truncate">${esc(p.title)}</p>
              <p class="text-xs text-muted truncate">${esc(p.description || '')}</p>
            </div>
          </div>
          <div class="flex gap-2 shrink-0">
            <button type="button" class="tap-target text-sm px-3 border border-line rounded-full hover:border-forest" data-edit="${esc(p.id)}">Edit</button>
            <button type="button" class="tap-target text-sm px-3 border border-line rounded-full hover:border-forest" data-toggle="${esc(p.id)}">${p.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</button>
            <button type="button" class="tap-target text-sm px-3 border border-line rounded-full text-red-700 hover:border-red-700" data-delete="${esc(p.id)}">Hapus</button>
          </div>
        </div>`
          )
          .join('')
      : '<p class="text-sm text-muted py-8">Belum ada program.</p>';

    qsa('[data-edit]', list).forEach((btn) => btn.addEventListener('click', () => openProgramForm(btn.dataset.edit)));
    qsa('[data-toggle]', list).forEach((btn) =>
      btn.addEventListener('click', async () => {
        const program = programs.find((p) => p.id === btn.dataset.toggle);
        program.status = program.status === 'active' ? 'inactive' : 'active';
        await ContentRepository.saveProgram(program);
        loadProgramList();
      })
    );
    qsa('[data-delete]', list).forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (confirm('Hapus program ini?')) {
          await ContentRepository.deleteProgram(btn.dataset.delete);
          toast('Program dihapus.');
          loadProgramList();
        }
      })
    );
  });

  async function openProgramForm(id) {
    const form = qs('[data-form="program"]');
    form.reset();
    qs('[data-form-title="program"]').textContent = id ? 'Edit Program' : 'Program Baru';

    if (id) {
      const programs = await ContentRepository.getPrograms();
      const program = programs.find((p) => p.id === id);
      if (program) {
        form.elements.id.value = program.id;
        form.elements.number.value = program.number || '';
        form.elements.order.value = program.order || '';
        form.elements.title.value = program.title || '';
        form.elements.description.value = program.description || '';
        form.elements.status.value = program.status || 'active';
      }
    } else {
      const programs = await ContentRepository.getPrograms();
      const nextOrder = programs.reduce((max, p) => Math.max(max, p.order || 0), 0) + 1;
      form.elements.order.value = nextOrder;
      form.elements.number.value = String(nextOrder).padStart(2, '0');
    }
    showSubview('program', 'program-form');
  }

  function initProgramForm() {
    const form = qs('[data-form="program"]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = readForm(form);
      try {
      await ContentRepository.saveProgram({
        id: data.id || undefined,
        number: data.number,
        title: data.title,
        description: data.description,
        status: data.status,
        order: Number(data.order) || 0,
      });
      } catch (err) {
        toast('Gagal menyimpan: ' + RohisAuth.friendly(err));
        return;
      }
      toast('Program disimpan.');
      showSubview('program', 'program-list');
      loadProgramList();
    });
  }

  // --------------------------------------------------------------------
  // Media library (prototype: dataURL stored in localStorage)
  // --------------------------------------------------------------------
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // batas bucket
  const MAX_EDGE = 1600; // sisi terpanjang setelah diperkecil (px)
  const KEEP_AS_IS_BYTES = 700 * 1024;

  /**
   * Foto dari iPad bisa 3–8 MB. Perkecil ke JPEG ±1600px sebelum diunggah
   * supaya halaman publik tetap ringan. GIF dibiarkan (agar tetap animasi).
   */
  async function prepareImage(file) {
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'gambar';
    if (file.type === 'image/gif') return { blob: file, name: file.name };
    let bitmap = null;
    try {
      bitmap = await createImageBitmap(file);
    } catch (err) {
      bitmap = null;
    }
    if (!bitmap) return { blob: file, name: file.name };
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= KEEP_AS_IS_BYTES) {
      bitmap.close && bitmap.close();
      return { blob: file, name: file.name };
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close && bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) return { blob: file, name: file.name };
    return { blob, name: baseName + '.jpg' };
  }

  function mediaThumbHTML(item, selectable) {
    const preview = item.dataUrl ? RohisUtil.safeUrl(item.dataUrl) : '';
    return `
      <div class="border border-line rounded-lg overflow-hidden group relative" data-media-id="${esc(item.id)}">
        ${
          preview
            ? `<img src="${esc(preview)}" alt="${esc(item.name)}" class="w-full aspect-square object-cover ${selectable ? 'cursor-pointer' : ''}" ${selectable ? 'data-select="1"' : ''}>`
            : `<div class="w-full aspect-square flex items-center justify-center bg-sage/20 text-muted text-xs p-3 text-center">${esc(item.previewError || 'Pratinjau tidak tersedia')}</div>`
        }
        <div class="p-2">
          <p class="text-xs truncate">${esc(item.name)}</p>
          ${
            selectable
              ? (preview ? '' : '<p class="text-xs text-muted mt-1">Tidak dapat dipilih tanpa pratinjau.</p>')
              : `<button type="button" class="text-xs text-red-700 mt-1" data-delete-media="${esc(item.id)}">Hapus</button>`
          }
        </div>
      </div>`;
  }

  const loadMediaList = latestOnly(async (isCurrent) => {
    const media = await ContentRepository.getMedia();
    if (!isCurrent()) return;
    const list = qs('[data-list="media"]');
    list.innerHTML = media.length
      ? media.map((m) => mediaThumbHTML(m, false)).join('')
      : '<p class="text-sm text-muted col-span-full py-8">Belum ada gambar yang diunggah.</p>';

    qsa('[data-delete-media]', list).forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (confirm('Hapus gambar ini dari media library?')) {
          await ContentRepository.deleteMedia(btn.dataset.deleteMedia);
          loadMediaList();
        }
      })
    );
  });

  function initMediaUpload() {
    qs('[data-action="upload-media"]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        toast('Hanya file gambar yang bisa diunggah.');
        return;
      }
      toast('Mengunggah…');
      try {
        const prepared = await prepareImage(file);
        if (prepared.blob.size > MAX_UPLOAD_BYTES) {
          toast('Gambar terlalu besar (maks 5 MB).');
          return;
        }
        const uploaded = await ContentRepository.saveMedia(prepared);
        if (uploaded && uploaded.previewUrl) {
          try { URL.revokeObjectURL(uploaded.previewUrl); } catch (err) { /* abaikan */ }
        }
        toast('Gambar diunggah secara privat. Pilih sebagai cover lalu terbitkan konten untuk membuka akses publik.');
        loadMediaList();
      } catch (err) {
        toast('Gagal mengunggah: ' + RohisAuth.friendly(err));
      }
    });
  }

  // ---- Media picker modal (used from Kegiatan/Tulisan cover field) -----
  let mediaPickerTargetId = null;

  function initMediaPicker() {
    qsa('[data-action="pick-media"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        mediaPickerTargetId = btn.dataset.targetInput;
        const media = await ContentRepository.getMedia();
        const grid = qs('[data-list="media-picker-grid"]');
        const empty = qs('[data-empty="media-picker"]');
        grid.innerHTML = media.map((m) => mediaThumbHTML(m, true)).join('');
        empty.classList.toggle('hidden', media.length > 0);
        qsa('[data-select]', grid).forEach((img) => {
          img.addEventListener('click', () => {
            const wrapper = img.closest('[data-media-id]');
            const item = media.find((m) => m.id === wrapper.dataset.mediaId);
            if (item && mediaPickerTargetId && item.url) {
              qs(`#${mediaPickerTargetId}`).value = item.url;
            }
            closeMediaPicker();
          });
        });
        qs('#media-picker').classList.remove('hidden');
      });
    });

    qs('[data-action="close-media-picker"]').addEventListener('click', closeMediaPicker);
    qs('#media-picker').addEventListener('click', (e) => {
      if (e.target.id === 'media-picker') closeMediaPicker();
    });
  }

  function closeMediaPicker() {
    qs('#media-picker').classList.add('hidden');
  }

  // --------------------------------------------------------------------
  // Pengaturan (Settings)
  // --------------------------------------------------------------------
  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  }

  function setPath(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    keys.slice(0, -1).forEach((k) => {
      cur[k] = cur[k] || {};
      cur = cur[k];
    });
    cur[keys[keys.length - 1]] = value;
  }

  async function loadSettingsForm() {
    const site = await ContentRepository.getSite();
    const form = qs('[data-form="settings"]');
    qsa('input, textarea', form).forEach((el) => {
      const value = getPath(site, el.name);
      if (value != null) el.value = value;
    });
  }

  function initSettingsForm() {
    const form = qs('[data-form="settings"]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const site = await ContentRepository.getSite();
      qsa('input, textarea', form).forEach((el) => setPath(site, el.name, el.value));
      await ContentRepository.saveSite(site);
      toast('Pengaturan disimpan.');
    });
  }

  // --------------------------------------------------------------------
  // Data export (download current localStorage content as data/*.json)
  // --------------------------------------------------------------------
  function initDataExport() {
    const getters = {
      site: () => ContentRepository.getSite(),
      programs: () => ContentRepository.getPrograms(),
      activities: () => ContentRepository.getActivities(),
      articles: () => ContentRepository.getArticles(),
    };

    qsa('[data-export]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.export;
        const data = await getters[key]();
        const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${key}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast(`${key}.json diunduh.`);
      });
    });
  }

  // --------------------------------------------------------------------
  // Dashboard quick actions + sidebar toggle
  // --------------------------------------------------------------------
  function initQuickActions() {
    qsa('[data-action="new-activity"]').forEach((btn) =>
      btn.addEventListener('click', () => {
        window.location.hash = '#kegiatan';
        openActivityForm(null);
      })
    );
    qsa('[data-action="new-article"]').forEach((btn) =>
      btn.addEventListener('click', () => {
        window.location.hash = '#tulisan';
        openArticleForm(null);
      })
    );
    qsa('[data-action="new-program"]').forEach((btn) =>
      btn.addEventListener('click', () => openProgramForm(null))
    );
    qsa('[data-action="back-to-list"]').forEach((btn) =>
      btn.addEventListener('click', () => showSubview(btn.dataset.target, `${btn.dataset.target}-list`))
    );
  }

  function initSidebarToggle() {
    const toggle = qs('#sidebar-toggle');
    const sidebar = qs('#sidebar');
    if (!toggle || !sidebar) return;
    toggle.addEventListener('click', () => {
      const isHidden = sidebar.classList.toggle('hidden');
      sidebar.classList.toggle('flex', !isHidden);
      toggle.setAttribute('aria-expanded', String(!isHidden));
    });
  }

  // --------------------------------------------------------------------
  // Login (kode 6 angka lewat email)
  // --------------------------------------------------------------------
  const gate = qs('#login-gate');

  function gateState(name) {
    qsa('[data-login-state]', gate).forEach((el) => { el.hidden = el.dataset.loginState !== name; });
    gate.hidden = false;
    const focusTarget = { email: '#login-email', code: '#login-code' }[name];
    if (focusTarget) setTimeout(() => qs(focusTarget, gate).focus(), 50);
  }

  function gateError(message) {
    const el = qs('[data-login-error]', gate);
    el.textContent = message || '';
    el.hidden = !message;
  }

  /** Menampilkan layar masuk sampai pengurus terdaftar berhasil login. */
  function requireLogin() {
    return new Promise((resolve) => {
      let userId = null;
      let email = '';
      const emailForm = qs('form[data-login-state="email"]', gate);
      const codeForm = qs('form[data-login-state="code"]', gate);

      function done(session) {
        qsa('[data-user-email]').forEach((el) => { el.textContent = session.user.email || ''; });
        gate.hidden = true;
        resolve(session);
      }

      function handleSession(session) {
        if (!session) return false;
        if (session.member) { done(session); return true; }
        qsa('[data-login-email]', gate).forEach((el) => { el.textContent = session.user.email; });
        gateError('');
        gateState('denied');
        return true;
      }

      function busy(form, on) {
        qsa('button, input', form).forEach((el) => { el.disabled = on; });
      }

      emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        email = qs('#login-email').value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) { gateError('Masukkan alamat email yang valid.'); return; }
        gateError('');
        busy(emailForm, true);
        try {
          userId = await RohisAuth.sendCode(email);
          qsa('[data-login-email]', gate).forEach((el) => { el.textContent = email; });
          qs('#login-code').value = '';
          gateState('code');
        } catch (err) {
          gateError(RohisAuth.friendly(err));
        } finally {
          busy(emailForm, false);
        }
      });

      codeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = qs('#login-code').value.trim();
        if (!code) { gateError('Masukkan kode dari email.'); return; }
        gateError('');
        busy(codeForm, true);
        try {
          const session = await RohisAuth.verify(userId, code);
          if (!handleSession(session)) gateError('Login gagal. Coba kirim kode baru.');
        } catch (err) {
          gateError(RohisAuth.friendly(err));
        } finally {
          busy(codeForm, false);
        }
      });

      qs('[data-login-back]', gate).addEventListener('click', () => { gateError(''); gateState('email'); });
      qs('[data-login-logout]', gate).addEventListener('click', async () => {
        await RohisAuth.logout();
        gateError('');
        gateState('email');
      });

      // Sesi lama yang masih berlaku -> langsung masuk.
      gateState('loading');
      RohisAuth.me()
        .then((session) => { if (!handleSession(session)) gateState('email'); })
        .catch((err) => { gateState('email'); gateError(RohisAuth.friendly(err)); });

      // Sesi habis saat bekerja -> kembali ke layar masuk.
      window.addEventListener('rohis:auth-expired', () => {
        if (!gate.hidden) return;
        gateError('Sesi habis. Silakan masuk lagi.');
        gateState('email');
      });
    });
  }

  // --------------------------------------------------------------------
  // Boot
  // --------------------------------------------------------------------
  window.addEventListener('unhandledrejection', (e) => {
    const err = e.reason;
    if (err && err.status === 401) return; // ditangani layar masuk
    console.error(err);
    toast('Gagal: ' + RohisAuth.friendly(err));
  });

  document.addEventListener('DOMContentLoaded', async () => {
    initSidebarToggle();
    initQuickActions();
    initActivityForm();
    initArticleForm();
    initProgramForm();
    initMediaUpload();
    initMediaPicker();
    initSettingsForm();
    initDataExport();
    qsa('[data-action="logout"]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        await RohisAuth.logout();
        window.location.reload();
      })
    );
    window.addEventListener('hashchange', renderView);

    await requireLogin();
    renderView();
  });
})();
