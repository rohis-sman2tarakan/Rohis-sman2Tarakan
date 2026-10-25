/**
 * Mobile bottom tab bar. The sliding pill is a Lottie animation
 * (assets/lottie/tab-pill.json, played through lottie_light); tab icons and
 * labels are plain HTML so they stay real, accessible links. Without Lottie
 * (script blocked, offline) a CSS pill marks the active tab instead.
 */

(function () {
  const bar = document.querySelector('#tab-bar');
  if (!bar) return;

  const mobile = window.matchMedia('(max-width: 767px)');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const links = Array.from(bar.querySelectorAll('[data-tab]'));

  // Marker initials used in the animation: Power, Winner, Security, Awards, Profile.
  const INITIALS = ['P', 'W', 'S', 'A', 'Pr'];
  const IDLE = ['Power', 'Winner', 'Security', 'Awards', 'Profile'];
  const PAGE_TAB = { home: 0, kegiatan: 1, 'kegiatan-detail': 1, tulisan: 2, 'tulisan-detail': 2, tentang: 3 };
  const KONTAK = 4;

  const scriptBase = (document.currentScript && document.currentScript.src) || window.location.href;
  const url = (path) => new URL(path, scriptBase).href;

  let current = pageTab();
  let anim = null;
  let ready = false;
  let navigating = false;

  function pageTab() {
    const page = document.body.dataset.page;
    if (page === 'home' && window.location.hash === '#kontak') return KONTAK;
    return PAGE_TAB[page] != null ? PAGE_TAB[page] : 0;
  }

  function setActive(index) {
    links.forEach((link, i) => {
      const active = i === index;
      link.classList.toggle('is-active', active);
      if (active && link.dataset.tab !== 'kontak') link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    current = index;
  }

  function marker(name) {
    return (anim.markers || []).find((m) => m.payload.name === name);
  }

  function showIdle(index) {
    const m = marker(IDLE[index]);
    if (m) anim.goToAndStop(m.time + m.duration - 1, true);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = reject;
      document.head.appendChild(el);
    });
  }

  async function initLottie() {
    if (anim || !mobile.matches) return;
    try {
      if (!window.lottie) await loadScript(url('./vendor/lottie_light.min.js'));
      const holder = bar.querySelector('.tab-bar-anim');
      anim = window.lottie.loadAnimation({
        container: holder,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        path: url('../assets/lottie/tab-pill.json'),
        rendererSettings: { preserveAspectRatio: 'none' },
      });
      anim.addEventListener('DOMLoaded', () => {
        // Crop the 800x600 canvas to the bar itself.
        const svg = holder.querySelector('svg');
        if (svg) svg.setAttribute('viewBox', '30 238 740 124');
        anim.setSpeed(1.5);
        showIdle(current);
        ready = true;
        bar.classList.add('has-lottie');
      });
    } catch (err) {
      console.warn('Animasi tab bar tidak dimuat, memakai tampilan cadangan.', err);
    }
  }

  function go(index, href, mode) {
    if (navigating) return;
    navigating = true;
    const key = `${INITIALS[current]}n${INITIALS[index]}`;
    const m = marker(key);
    setActive(index);

    const finish = () => {
      navigating = false;
      if (mode === 'contact') {
        window.location.hash = '#kontak';
      } else if (mode === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } else {
        document.documentElement.classList.add('is-leaving');
        setTimeout(() => { window.location.href = href; }, 120);
      }
    };

    if (!m) { finish(); return; }
    const frames = m.duration;
    const ms = (frames / anim.frameRate / anim.playSpeed) * 1000;
    anim.playSegments([m.time, m.time + frames], true);
    setTimeout(finish, Math.min(ms, 700));
  }

  bar.addEventListener('click', (e) => {
    const link = e.target.closest('[data-tab]');
    if (!link) return;
    const index = links.indexOf(link);
    const target = new URL(link.href, window.location.href);
    const samePage = target.pathname === window.location.pathname;
    // On the home page the first and last tabs stay in-page: scroll instead of reloading.
    const mode = !samePage ? 'page' : link.dataset.tab === 'kontak' ? 'contact' : 'top';

    if (index === current && samePage && link.dataset.tab !== 'kontak') { e.preventDefault(); return; }
    // Without the animation (or with reduced motion) just follow the link normally.
    if (!ready || prefersReducedMotion) return;

    e.preventDefault();
    e.stopPropagation();
    go(index, target.href, mode);
  });

  window.addEventListener('pageshow', () => {
    navigating = false;
    setActive(pageTab());
    if (ready) showIdle(current);
  });

  setActive(current);
  initLottie();
  if (mobile.addEventListener) mobile.addEventListener('change', initLottie);
})();
