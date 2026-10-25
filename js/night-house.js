/*
  Perjalanan waktu di beranda: pagi (hero) → tengah halaman → malam (footer).

  1. Latar halaman: dua lapisan warna tetap (fixed) yang sangat tipis;
     opacity-nya mengikuti progres scroll. Konten tidak diubah.
  2. Adegan malam di footer: foto rumah lamin yang SAMA dengan hero,
     diberi gradasi senja → malam, bulan, cahaya perak, bintang, dan
     lampu keemasan. Semua efek berupa overlay CSS di atas foto 2D
     (bukan model 3D).

  Tanpa JS, CSS sudah menampilkan adegan malam statis (bulan di posisi default).
  Hanya opacity yang dianimasikan; posisi diukur saat resize, bukan saat scroll.
*/
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ---------- 1. Latar halaman ---------- */
  ['journey-blue', 'journey-dusk', 'journey-glow', 'journey-warm'].forEach(function (name) {
    var d = document.createElement('div');
    d.className = 'journey-tint ' + name;
    d.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(d, document.body.firstChild);
  });
  root.classList.add('journey-on');

  /* ---------- 2. Adegan malam ---------- */
  var scene = document.querySelector('[data-night-house]');
  var img = scene && scene.querySelector('img');

  var PHOTO = { w: 1600, h: 1067 };
  /* Kandidat posisi bulan di area langit foto, urut prioritas:
     celah terang tempat matahari pagi, lalu langit di kanan atap, lalu kiri atas. */
  var MOON_SPOTS = [[1190, 215], [985, 55], [470, 40]];
  var ROOF = [640, 215];
  var LAMPS = [[720, 505, 1], [520, 515, 0.8], [880, 565, 0.85], [1255, 650, 0.7]];

  var layers = {};
  var sceneTop = 0, sceneH = 1, docH = 1, vh = 1;
  var tJ = 0, cJ = -1, tN = 0, cN = -1, raf = 0;

  function el(cls) {
    var d = document.createElement('div');
    d.className = 'nh-layer ' + cls;
    d.setAttribute('aria-hidden', 'true');
    scene.appendChild(d);
    return d;
  }

  function rand(seed) {
    var x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  }

  function objPos() {
    var cs = getComputedStyle(img).objectPosition.split(' ');
    return [parseFloat(cs[0]) / 100 || 0.5, parseFloat(cs[1]) / 100 || 0.5];
  }

  function measureScene() {
    var W = scene.clientWidth, H = scene.clientHeight;
    if (!W || !H) return;
    var op = objPos();
    var s = Math.max(W / PHOTO.w, H / PHOTO.h);
    var ox = (W - PHOTO.w * s) * op[0], oy = (H - PHOTO.h * s) * op[1];
    function X(px) { return ox + px * s; }
    function Y(py) { return oy + py * s; }

    var r = Math.max(14, Math.min(34, W * 0.024));
    var mx = -1, my = -1;
    for (var i = 0; i < MOON_SPOTS.length; i++) {
      var x = X(MOON_SPOTS[i][0]), y = Y(MOON_SPOTS[i][1]);
      if (x > r * 2.5 && x < W - r * 2.5 && y > r * 2 && y < H * 0.42) { mx = x; my = y; break; }
    }
    if (mx < 0) { mx = W * 0.78; my = Math.max(r * 2.2, H * 0.14); }

    var st = scene.style;
    st.setProperty('--nh-moon-x', mx.toFixed(1) + 'px');
    st.setProperty('--nh-moon-y', my.toFixed(1) + 'px');
    st.setProperty('--nh-moon-r', r.toFixed(1) + 'px');
    st.setProperty('--nh-roof-x', X(ROOF[0]).toFixed(1) + 'px');
    st.setProperty('--nh-roof-y', Y(ROOF[1]).toFixed(1) + 'px');

    var g = [];
    for (var k = 0; k < LAMPS.length; k++) {
      var L = LAMPS[k], lx = X(L[0]), ly = Y(L[1]);
      if (lx < -40 || lx > W + 40 || ly > H * 0.92) continue;
      var rad = Math.max(30, 78 * s) * L[2];
      g.push('radial-gradient(' + rad.toFixed(0) + 'px ' + (rad * 0.8).toFixed(0) + 'px at ' + lx.toFixed(0) + 'px ' + ly.toFixed(0) +
        'px, rgba(255, 210, 130, 0.95) 0%, rgba(255, 180, 92, 0.4) 38%, rgba(255, 180, 92, 0) 100%)');
    }
    layers.lamps.style.backgroundImage = g.join(',') || 'none';

    var n = W < 640 ? 16 : 30, sh = [];
    for (var j = 0; j < n; j++) {
      var sx = W * rand(j + 1), sy = H * (0.02 + rand(j + 101) * 0.3);
      if (Math.abs(sx - mx) < r * 3 && Math.abs(sy - my) < r * 3) continue;
      var a = (0.3 + rand(j + 201) * 0.6).toFixed(2);
      sh.push(sx.toFixed(0) + 'px ' + sy.toFixed(0) + 'px 0 ' + (rand(j + 301) < 0.2 ? '0.6px' : '0') + ' rgba(255, 252, 235, ' + a + ')');
    }
    layers.stars.style.boxShadow = sh.join(',');
  }

  function measure() {
    vh = window.innerHeight;
    docH = Math.max(document.documentElement.scrollHeight, vh + 1);
    if (scene) {
      var r = scene.getBoundingClientRect();
      sceneTop = r.top + window.scrollY;
      sceneH = r.height;
      measureScene();
    }
    read();
    schedule();
  }

  function smooth(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function read() {
    var y = window.scrollY;
    var maxScroll = Math.max(1, docH - vh);
    tJ = Math.min(1, Math.max(0, y / maxScroll));
    if (scene) {
      /* 0: adegan baru muncul di bawah layar; 1: tengah adegan di tengah layar
         (atau sejauh halaman bisa digulir). */
      var span = Math.max(1, Math.min(vh / 2 + sceneH / 2, maxScroll + vh - sceneTop));
      tN = Math.min(1, Math.max(0, (y + vh - sceneTop) / span));
    }
  }

  function apply() {
    var s = root.style;
    /* Pagi → siang keemasan → sore bercahaya → senja → biru malam. */
    s.setProperty('--journey-warm', (smooth(0.08, 0.3, cJ) * (1 - smooth(0.5, 0.72, cJ)) * 0.85).toFixed(4));
    s.setProperty('--journey-glow', (smooth(0.2, 0.42, cJ) * (1 - smooth(0.6, 0.8, cJ))).toFixed(4));
    s.setProperty('--journey-dusk', (smooth(0.48, 0.7, cJ) * (1 - smooth(0.82, 0.97, cJ)) * 0.9).toFixed(4));
    s.setProperty('--journey-blue', (smooth(0.78, 0.97, cJ) * 0.85).toFixed(4));
    if (scene) {
      var st = scene.style;
      var night = smooth(0.1, 0.85, cN);
      st.setProperty('--nh-night', night.toFixed(4));
      st.setProperty('--nh-dusk', (1 - night).toFixed(4));
      st.setProperty('--nh-moon', smooth(0.35, 0.95, cN).toFixed(4));
      st.setProperty('--nh-lamp', smooth(0.3, 0.9, cN).toFixed(4));
    }
  }

  function tick() {
    raf = 0;
    if (cJ < 0 || reduce) { cJ = tJ; cN = tN; }
    else { cJ += (tJ - cJ) * 0.12; cN += (tN - cN) * 0.12; }
    if (Math.abs(tJ - cJ) < 0.0008) cJ = tJ;
    if (Math.abs(tN - cN) < 0.0008) cN = tN;
    apply();
    if (cJ !== tJ || cN !== tN) schedule();
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  if (scene && img) {
    layers.dusk = el('nh-dusk');
    layers.night = el('nh-night');
    layers.silver = el('nh-silver');
    layers.lamps = el('nh-lamps');
    layers.stars = el('nh-stars');
    layers.moon = el('nh-moon');
    scene.classList.add('nh-on');
    if (!img.complete) img.addEventListener('load', measure);
  } else {
    scene = null;
  }

  window.addEventListener('scroll', function () { read(); schedule(); }, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
  measure();
})();
