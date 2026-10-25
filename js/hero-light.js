/*
  Cahaya pagi di hero (enhancement progresif).

  - Sinar matahari lembut: berkas conic-gradient berbaur "screen" yang
    memancar dari celah matahari pada foto, di dalam .hero-bg (ikut drift foto).
  - Debu cahaya keemasan: partikel kecil di canvas, bergerak pelan di area sinar.

  Foto rumah lamin asli tidak diubah. Tanpa JS / tanpa foto: hero tampil seperti biasa.
  prefers-reduced-motion: sinar diam, partikel digambar sekali tanpa gerak.
*/
(function () {
  'use strict';

  var hero = document.getElementById('hero');
  if (!hero) return;
  var bg = hero.querySelector('.hero-bg');
  if (!bg) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PHOTO = { w: 1600, h: 1067 };
  var SUN = [1190, 235]; /* titik matahari pada foto (px) */

  var built = false, rays, canvas, ctx, sprite;
  var W = 0, H = 0, dpr = 1, sunX = 0, sunY = 0;
  var dust = [], running = false, visible = true, raf = 0, last = 0;

  function mapPoint(px, py, w, h) {
    var s = Math.max(w / PHOTO.w, h / PHOTO.h);
    return [(w - PHOTO.w * s) / 2 + px * s, (h - PHOTO.h * s) / 2 + py * s];
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* Berkas sinar: beberapa garis tipis tak beraturan yang jatuh ke kiri-bawah. */
  function raysGradient(x, y) {
    var stops = ['rgba(255,236,190,0) 0deg'];
    var a = 168;
    while (a < 262) {
      var w = rnd(1.4, 4.2);
      var alpha = rnd(0.16, 0.42).toFixed(2);
      stops.push('rgba(255,236,190,0) ' + a.toFixed(1) + 'deg');
      stops.push('rgba(255,236,190,' + alpha + ') ' + (a + w / 2).toFixed(1) + 'deg');
      stops.push('rgba(255,236,190,0) ' + (a + w).toFixed(1) + 'deg');
      a += w + rnd(3.5, 9);
    }
    stops.push('rgba(255,236,190,0) 360deg');
    return 'conic-gradient(from 0deg at ' + x.toFixed(0) + 'px ' + y.toFixed(0) + 'px, ' + stops.join(', ') + ')';
  }

  function makeSprite() {
    var c = document.createElement('canvas');
    c.width = c.height = 32;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,246,214,1)');
    grd.addColorStop(0.25, 'rgba(255,222,150,0.75)');
    grd.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return c;
  }

  function seed() {
    var n = W < 640 ? 18 : 34;
    dust = [];
    for (var i = 0; i < n; i++) dust.push(spawn(true));
  }

  /* Partikel lahir di sekitar berkas sinar (dari matahari ke kiri-bawah). */
  function spawn(anywhere) {
    var t = Math.random();
    var bx = sunX - t * W * 0.45 + rnd(-W * 0.12, W * 0.12);
    var by = sunY + t * H * 0.7 + rnd(-H * 0.12, H * 0.12);
    var life = rnd(14, 24);                       /* detik */
    return {
      x: bx, y: by,
      r: rnd(0.8, W < 640 ? 1.8 : 2.2),
      vx: rnd(-1.2, 2.2), vy: rnd(-3.2, -1.2),    /* px per detik: melayang pelan */
      a: rnd(0.35, 0.8),
      ph: rnd(0, Math.PI * 2), sp: rnd(0.5, 1),
      life: life, age: anywhere ? rnd(0, life) : 0
    };
  }

  function measure() {
    var w = bg.offsetWidth, h = bg.offsetHeight;
    if (!w || !h) return;
    var p = mapPoint(SUN[0], SUN[1], w, h);
    sunX = p[0]; sunY = p[1];
    rays.style.backgroundImage = raysGradient(sunX, sunY);
    var m = 'radial-gradient(' + (w * 0.8).toFixed(0) + 'px ' + (h * 1.05).toFixed(0) + 'px at ' +
      sunX.toFixed(0) + 'px ' + sunY.toFixed(0) + 'px, #000 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0) 72%)';
    rays.style.webkitMaskImage = m;
    rays.style.maskImage = m;
    rays.style.transformOrigin = sunX.toFixed(0) + 'px ' + sunY.toFixed(0) + 'px';

    W = w; H = h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    seed();
    draw(performance.now(), 0);
  }

  function draw(t, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i];
      if (dt) {
        d.age += dt;
        /* Ayunan horizontal sangat lambat (periode ~20 detik), tanpa sentakan. */
        d.x += (d.vx + Math.sin(t * 0.0003 * d.sp + d.ph) * 1.2) * dt;
        d.y += d.vy * dt;
        if (d.age >= d.life) dust[i] = d = spawn(false);
      }
      /* Muncul dan hilang perlahan sepanjang umurnya (tidak pernah "pop"). */
      var life = reduce ? 1 : Math.sin(Math.PI * Math.min(1, d.age / d.life));
      var dist = Math.hypot(d.x - sunX, d.y - sunY) / Math.max(W, H);
      var near = Math.max(0.25, 1 - dist * 1.3);
      var tw = reduce ? 1 : 0.8 + 0.2 * Math.sin(t * 0.0006 * d.sp + d.ph);
      ctx.globalAlpha = Math.min(1, d.a * near * tw * life);
      var s = d.r * 4;
      ctx.drawImage(sprite, d.x - s / 2, d.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    if (!running) return;
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    draw(t, dt);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (reduce || running || !visible || document.hidden || !built) return;
    running = true; last = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  function build() {
    if (built || !hero.classList.contains('has-photo')) return;
    var test = document.createElement('canvas');
    ctx = test.getContext && test.getContext('2d');
    if (!ctx) return;
    built = true;

    rays = document.createElement('div');
    rays.className = 'hero-rays';
    rays.setAttribute('aria-hidden', 'true');
    bg.appendChild(rays);

    canvas = test;
    canvas.className = 'hero-dust';
    canvas.setAttribute('aria-hidden', 'true');
    bg.parentNode.insertBefore(canvas, bg.nextSibling);

    sprite = makeSprite();
    hero.classList.add('light-on');
    measure();
    start();
  }

  window.addEventListener('resize', function () { if (built) measure(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting;
      if (visible) start(); else stop();
    }).observe(hero);
  }
  if ('ResizeObserver' in window) new ResizeObserver(function () { if (built) measure(); }).observe(hero);
  if ('MutationObserver' in window) new MutationObserver(build).observe(hero, { attributes: true, attributeFilter: ['class'] });
  build();
})();
