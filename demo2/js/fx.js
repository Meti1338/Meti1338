'use strict';
/* Effects: camera, particles (pixel layer), shape effects (pixel + glow layers), lights, damage text. */

const Cam = { px: 0, py: 0, zoom: 1, fx: 240, fy: 150, shake: 0, lx: 0, ly: 0 };
const FX = { parts: [], ground: [], low: [], high: [], lights: [], texts: [], tickers: [], flash: { a: 0, c: '255,255,255' }, tint: { a: 0, c: '255,140,60' } };

function camTo(fx, fy, zoom, ms, ease) { return Promise.all([tween(Cam, 'fx', fx, ms, ease), tween(Cam, 'fy', fy, ms, ease), tween(Cam, 'zoom', zoom, ms, ease)]); }
function camPan(px, py, ms, ease) { return Promise.all([tween(Cam, 'px', px, ms, ease), tween(Cam, 'py', py, ms, ease)]); }
function camReset(ms) { return Promise.all([camTo(240, 150, 1, ms || 400, Ease.inOut), camPan(0, 0, ms || 400, Ease.inOut)]); }
function shake(a) { Cam.shake = Math.max(Cam.shake, REDUCED ? a * .25 : a); }
function flash(a, c) { FX.flash.a = Math.max(FX.flash.a, a); FX.flash.c = c || '255,255,255'; }
function sceneTint(a, c, ms) { FX.tint.c = c; FX.tint.a = a; tween(FX.tint, 'a', 0, ms || 900, Ease.in); }
function light(x, y, r, c, a, dur, fadeIn) { const L = { x, y, r, c, a, t0: Clock.t, dur, fadeIn: fadeIn || 60 }; FX.lights.push(L); return L; }

/* ---------- particles ---------- */
function part(o) {
  const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, drag: 1, life: 500, age: 0, size: 1, cols: ['#ffffff'], add: true, shape: 'sq', delay: 0, fade: true, fn: null }, o);
  FX.parts.push(p); return p;
}
const FIRE = ['#ffffff', '#fff4b0', '#ffd050', '#ff9a30', '#f05a18', '#a82a14', '#4a2424'];
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

function updateFX(dt) {
  const f = dt / 16.667;
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i];
    if (p.delay > 0) { p.delay -= dt; continue; }
    p.age += dt;
    if (p.age >= p.life) { FX.parts.splice(i, 1); continue; }
    if (p.fn) p.fn(p, f);
    p.vx += p.ax * f; p.vy += p.ay * f;
    if (p.drag !== 1) { const d = Math.pow(p.drag, f); p.vx *= d; p.vy *= d; }
    p.x += p.vx * f; p.y += p.vy * f;
  }
  for (let i = FX.tickers.length - 1; i >= 0; i--) if (FX.tickers[i](dt) === false) FX.tickers.splice(i, 1);
  for (const L of [FX.ground, FX.low, FX.high, FX.lights]) for (let i = L.length - 1; i >= 0; i--) if (Clock.t - L[i].t0 > L[i].dur) L.splice(i, 1);
  for (let i = FX.texts.length - 1; i >= 0; i--) if (Clock.t - FX.texts[i].t0 > FX.texts[i].dur) FX.texts.splice(i, 1);
  FX.flash.a = Math.max(0, FX.flash.a - .045 * f);
  Cam.shake *= Math.pow(.84, f);
}
function drawParts(ctx, o, addPass) {
  ctx.globalCompositeOperation = addPass ? 'lighter' : 'source-over';
  for (const p of FX.parts) {
    if (p.delay > 0 || p.add !== addPass) continue;
    const k = p.age / p.life, cols = p.cols;
    ctx.fillStyle = cols[Math.min(cols.length - 1, Math.floor(k * cols.length))];
    ctx.globalAlpha = p.fade ? Math.min(1, (1 - k) * 1.6) : 1;
    const x = Math.round(p.x + o.x), y = Math.round(p.y + o.y), s = Math.max(1, Math.round(p.size * (p.shrink ? 1 - k * .7 : 1)));
    if (p.shape === 'plus') { ctx.fillRect(x - s, y, s * 2 + 1, 1); ctx.fillRect(x, y - s, 1, s * 2 + 1); }
    else if (p.shape === 'bub') { ctx.fillRect(x - s, y, 1, 1); ctx.fillRect(x + s, y, 1, 1); ctx.fillRect(x, y - s, 1, 1); ctx.fillRect(x, y + s, 1, 1); ctx.fillRect(x - 1, y - 1, 1, 1); }
    else ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

/* ---------- pixel drawing helpers (low-res canvas) ---------- */
function pxEllipse(ctx, cx, cy, rx, ry, th, keep) {
  const n = Math.max(16, Math.round(Math.PI * 2 * Math.max(rx, ry) * 1.3));
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    if (keep && !keep(a)) continue;
    ctx.fillRect(Math.round(cx + Math.cos(a) * rx - th / 2), Math.round(cy + Math.sin(a) * ry - th / 2), th, th);
  }
}
function pxLine(ctx, x0, y0, x1, y1, th) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(lerp(x0, x1, i / n) - th / 2), Math.round(lerp(y0, y1, i / n) - th / 2), th, th);
}
function addShape(layer, dur, draw) { const e = { t0: Clock.t, dur, draw }; FX[layer].push(e); return e; }
function glowAt(ctx, S, x, y, r, c, a) {
  const [sx, sy] = S(x, y), rr = r * S.k;
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
  g.addColorStop(0, 'rgba(' + c + ',' + a + ')'); g.addColorStop(.4, 'rgba(' + c + ',' + a * .45 + ')'); g.addColorStop(1, 'rgba(' + c + ',0)');
  ctx.fillStyle = g; ctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
}

/* ---------- effects ---------- */
function fxSlash(x, y, o) {
  const r = o.r || 18, a0 = o.a0, a1 = o.a1, sq = o.sq || .8, w = o.w || 3, dur = o.dur || 280;
  addShape('low', dur, (ctx, k, off) => {
    const sweep = Ease.outCubic(clamp(k / .38, 0, 1)), fade = k < .38 ? 1 : 1 - (k - .38) / .62;
    const head = a0 + (a1 - a0) * sweep, tail = a0 + (a1 - a0) * Math.max(0, sweep - .75 + (k > .38 ? (k - .38) * 1.2 : 0));
    const n = Math.ceil(Math.abs(head - tail) * r * 1.4) + 2, pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = tail + (head - tail) * u, rr = r * (.9 + .1 * u);
      pts.push([x + Math.cos(a) * rr + off.x, y + Math.sin(a) * rr * sq + off.y, Math.max(1, Math.round(w * Math.sin(u * Math.PI * .92 + .1) * fade))]);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = o.glow || 'rgba(120,200,255,.9)';
    for (const [px, py, th] of pts) ctx.fillRect(Math.round(px - th / 2 - 1), Math.round(py - th / 2 - 1), th + 2, th + 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = o.col || '#ffffff';
    for (const [px, py, th] of pts) ctx.fillRect(Math.round(px - th / 2), Math.round(py - th / 2), th, th);
  });
  addShape('high', dur, (ctx, k, S) => {
    const sweep = Ease.outCubic(clamp(k / .38, 0, 1)), a = (1 - k) * .55;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(' + (o.glowRGB || '140,210,255') + ',' + a + ')';
    ctx.lineWidth = w * 3 * S.k; ctx.lineCap = 'round';
    const [cx, cy] = S(x, y); ctx.beginPath(); ctx.ellipse(cx, cy, r * S.k, r * sq * S.k, 0, Math.min(a0, a0 + (a1 - a0) * sweep), Math.max(a0, a0 + (a1 - a0) * sweep)); ctx.stroke(); ctx.restore();
  });
}
function fxImpact(x, y, o) {
  o = o || {};
  const size = o.size || 10, col = o.col || '#ffffff', rgb = o.rgb || '255,240,200';
  addShape('low', 220, (ctx, k, off) => {
    const L = size * (k < .25 ? k / .25 : 1 - (k - .25) / .75) * 1.4;
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col;
    pxLine(ctx, x - L + off.x, y + off.y, x + L + off.x, y + off.y, 1);
    pxLine(ctx, x + off.x, y - L * .8 + off.y, x + off.x, y + L * .8 + off.y, 1);
    pxLine(ctx, x - L * .45 + off.x, y - L * .45 + off.y, x + L * .45 + off.x, y + L * .45 + off.y, 1);
    pxLine(ctx, x - L * .45 + off.x, y + L * .45 + off.y, x + L * .45 + off.x, y - L * .45 + off.y, 1);
    ctx.fillStyle = 'rgba(' + rgb + ',' + (1 - k) + ')';
    pxEllipse(ctx, x + off.x, y + off.y, size * .3 + k * size * 1.5, size * .3 + k * size * 1.3, 1);
    ctx.globalCompositeOperation = 'source-over';
  });
  addShape('high', 260, (ctx, k, S) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowAt(ctx, S, x, y, size * 2.6, rgb, (1 - k) * (1 - k) * .9); ctx.restore(); });
  const n = REDUCED ? 5 : (o.sparks || 12);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), v = rnd(1, 2.6) * (o.speed || 1);
    part({ x, y, vx: Math.cos(a) * v + (o.dir || 0), vy: Math.sin(a) * v - .8, ay: .12, drag: .93, life: rnd(220, 480), cols: o.sparkCols || ['#ffffff', '#fff2b0', '#ffc860', '#ff8a40'], size: rnd(1, 2.2) | 0 });
  }
  light(x, y, size * 7, rgb, .45, 220);
}
function fxClaw(x, y) {
  for (let i = 0; i < 3; i++) {
    const d = i * 45;
    addShape('low', 320 + d, (ctx, k, off) => {
      const t = Clock.t, local = clamp((k * (320 + d) - d) / 90, 0, 1); if (local <= 0) return;
      const fade = clamp(1 - (k * (320 + d) - d - 90) / 230, 0, 1);
      const x0 = x - 9 + i * 5 + off.x, y0 = y - 13 + off.y, x1 = x0 + 15 * local, y1 = y0 + 24 * local;
      ctx.globalAlpha = fade; ctx.fillStyle = '#ff4a5a'; pxLine(ctx, x0 - 1, y0, x1 - 1, y1, 2); ctx.fillStyle = '#ffffff'; pxLine(ctx, x0, y0, x1, y1, 1); ctx.globalAlpha = 1;
    });
  }
  addShape('high', 300, (ctx, k, S) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowAt(ctx, S, x, y, 26, '255,80,90', (1 - k) * .55); ctx.restore(); });
}
function fxMagicCircle(x, y, rgb, r) {
  const h = { t0: Clock.t, ending: 0, done: false };
  const col = a => 'rgba(' + rgb + ',' + a + ')';
  const draw = (ctx, k, off) => {
    const age = Clock.t - h.t0, g = Ease.outBack(clamp(age / 260, 0, 1)) * (h.ending ? 1 - clamp((Clock.t - h.ending) / 300, 0, 1) : 1);
    if (g <= 0) return;
    const rot = age / 900, R = r * g, cx = x + off.x, cy = y + off.y, sq = .36;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = col(.95); pxEllipse(ctx, cx, cy, R, R * sq, 1); ctx.fillStyle = col(.6); pxEllipse(ctx, cx, cy, R * .84, R * .84 * sq, 1);
    ctx.fillStyle = col(.9);
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + rot, rx = cx + Math.cos(a) * R * .92, ry = cy + Math.sin(a) * R * .92 * sq;
      ctx.fillRect(Math.round(rx), Math.round(ry), i % 3 ? 1 : 2, 1); if (i % 2) ctx.fillRect(Math.round(rx), Math.round(ry) - 1, 1, 1);
    }
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 - rot * 1.4; pts.push([cx + Math.cos(a) * R * .8, cy + Math.sin(a) * R * .8 * sq]); }
    ctx.fillStyle = col(.7);
    for (let i = 0; i < 6; i++) { const a = pts[i], b = pts[(i + 2) % 6]; pxLine(ctx, a[0], a[1], b[0], b[1], 1); }
    ctx.fillStyle = col(.9); pxEllipse(ctx, cx, cy, R * .22, R * .22 * sq, 1);
    ctx.globalCompositeOperation = 'source-over';
  };
  const e = { t0: Clock.t, dur: 1e9, draw }; FX.ground.push(e);
  const hi = { t0: Clock.t, dur: 1e9, draw: (ctx, k, S) => {
    const age = Clock.t - h.t0, g = clamp(age / 260, 0, 1) * (h.ending ? 1 - clamp((Clock.t - h.ending) / 300, 0, 1) : 1);
    const [sx, sy] = S(x, y); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(sx, sy); ctx.scale(1, .36);
    const rr = r * 1.3 * S.k, gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rr); gr.addColorStop(0, col(.5 * g)); gr.addColorStop(1, col(0));
    ctx.fillStyle = gr; ctx.fillRect(-rr, -rr, rr * 2, rr * 2); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cg = ctx.createLinearGradient(0, sy - 60 * S.k, 0, sy); cg.addColorStop(0, col(0)); cg.addColorStop(1, col(.22 * g));
    ctx.fillStyle = cg; ctx.fillRect(sx - r * .9 * S.k, sy - 60 * S.k, r * 1.8 * S.k, 60 * S.k); ctx.restore();
  } };
  FX.high.push(hi);
  const L = light(x, y - 10, r * 5, rgb, .5, 1e9, 200);
  FX.tickers.push(() => {
    if (h.done) return false;
    if (!h.ending && Math.random() < .7) {
      const a = rnd(0, Math.PI * 2);
      part({ x: x + Math.cos(a) * r * .9, y: y + Math.sin(a) * r * .9 * .36, vy: rnd(-.5, -1.1), life: rnd(400, 800), cols: ['#ffffff', 'rgb(' + rgb + ')'], size: 1 });
    }
    if (h.ending && Clock.t - h.ending > 320) { e.dur = 0; hi.dur = 0; L.dur = 0; h.done = true; return false; }
  });
  h.end = () => { h.ending = Clock.t; };
  return h;
}
function fxGather(x, y, rgb, ms) {                  // motes converging on a point (spell charge)
  const end = Clock.t + ms;
  FX.tickers.push(() => {
    if (Clock.t > end) return false;
    for (let i = 0; i < 2; i++) {
      const a = rnd(0, Math.PI * 2), d = rnd(14, 26), sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d * .8;
      part({ x: sx, y: sy, vx: (x - sx) / 16, vy: (y - sy) / 16, life: 260, cols: ['rgb(' + rgb + ')', '#ffffff'], size: 1, shape: Math.random() < .2 ? 'plus' : 'sq' });
    }
  });
  addShape('high', ms, (ctx, k, S) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowAt(ctx, S, x, y, 6 + k * 10, rgb, .4 + k * .5); ctx.restore(); });
}
function fxProjectile(x0, y0, x1, y1, ms, o) {
  const st = Clock.t, arc = o.arc || 0;
  const pos = k => [lerp(x0, x1, k), lerp(y0, y1, k) - Math.sin(k * Math.PI) * arc];
  addShape('low', ms, (ctx, k, off) => {
    const [x, y] = pos(k), s = o.size || 3;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = o.col || '#ff9a30'; ctx.fillRect(Math.round(x - s + off.x), Math.round(y - s + off.y), s * 2 + 1, s * 2 + 1);
    ctx.fillStyle = o.core || '#ffffff'; ctx.fillRect(Math.round(x - s / 2 + off.x), Math.round(y - s / 2 + off.y), s + 1, s + 1);
    ctx.globalCompositeOperation = 'source-over';
  });
  addShape('high', ms, (ctx, k, S) => { const [x, y] = pos(k); ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowAt(ctx, S, x, y, (o.size || 3) * 5, o.rgb || '255,150,60', .8); ctx.restore(); });
  const L = light(x0, y0, 70, o.rgb || '255,150,60', .5, ms);
  FX.tickers.push(() => {
    const k = (Clock.t - st) / ms; if (k >= 1) return false;
    const [x, y] = pos(k); L.x = x; L.y = y;
    for (let i = 0; i < (o.trail || 3); i++) part({ x: x + gauss() * 2.5, y: y + gauss() * 2.5, vx: gauss() * .4, vy: rnd(-.7, 0), life: rnd(220, 460), cols: o.trailCols || FIRE.slice(1), size: rnd(1, (o.size || 3) + 1) | 0, shrink: true });
  });
  return wait(ms);
}
function fxFlamePillar(x, y, sc) {
  sc = sc || 1;
  const st = Clock.t, dur = 900 + sc * 200, H = 58 * sc, W0 = 11 * sc;
  const FR = ['#fffef0', '#fff4b0', '#ffd860', '#ffac38', '#f47020', '#d2401a', '#8a2014'];
  const env = () => { const a = Clock.t - st; return a < 140 ? Ease.outBack(a / 140) : a > dur - 260 ? clamp((dur - a) / 260, 0, 1) : 1; };
  /* solid pixel flame tongues */
  addShape('low', dur, (ctx, k, off) => {
    const e = env(), tt = Clock.t - st; if (e <= 0) return;
    for (let i = 0; i < 5; i++) {
      const tongueH = H * e * (.55 + .45 * Math.abs(Math.sin(i * 1.9 + 1))) * (.9 + .1 * Math.sin(tt / 70 + i)), cx0 = x + (i - 2) * W0 * .42;
      for (let yy = 0; yy < tongueH; yy++) {
        const u = yy / tongueH, w = W0 * (.55 + .2 * Math.sin(i)) * Math.pow(1 - u, .75) * (1 + .15 * Math.sin(tt / 50 + yy * .4 + i));
        const cx = cx0 + Math.sin(yy * .22 - tt / 55 + i * 2) * 2.2 * u * sc;
        const ci = clamp(Math.floor(1.3 + u * 4.6 + (Math.abs(i - 2) * .7) + Math.sin(yy * .9 + tt / 40) * .5), 0, FR.length - 1);
        ctx.fillStyle = FR[ci];
        ctx.fillRect(Math.round(cx - w + off.x), Math.round(y - yy + off.y), Math.max(1, Math.round(w * 2)), 1);
      }
    }
  });
  FX.tickers.push(() => {
    const age = Clock.t - st; if (age > dur) return false;
    const n = Math.round((REDUCED ? 2 : 7) * sc);
    for (let i = 0; i < n; i++) part({ x: x + gauss() * 9 * sc, y: y - rnd(4, 40) * sc, vx: gauss() * .3, vy: -rnd(1.2, 2.8) * Math.sqrt(sc), life: rnd(300, 620), size: rnd(2, 4.5) | 0, cols: FR.slice(2).concat(['#4a2424']), shrink: true, fn: (p, f) => { p.vx += Math.sin((p.age + p.y) / 60) * .04 * f; } });
    if (Math.random() < .5) part({ x: x + gauss() * 10 * sc, y: y - rnd(30, 60) * sc, vy: -rnd(.3, .7), vx: gauss() * .2, life: 1000, size: 3, cols: ['rgba(70,44,40,.55)', 'rgba(56,42,42,.4)', 'rgba(44,38,38,.2)'], add: false, fn: (p) => { p.size = 3 + p.age / 300; } });
  });
  for (let i = 0; i < 30 * sc; i++) part({ x: x + gauss() * 12, y: y - rnd(0, 40), vx: gauss() * 1.4, vy: -rnd(.6, 1.8), ay: -.004, life: rnd(900, 1600), delay: rnd(150, 800), cols: ['#fff4b0', '#ffb040', '#ff6a20'], size: 1 });
  addShape('ground', 1800, (ctx, k, off) => { ctx.fillStyle = 'rgba(30,14,10,' + (.5 * (1 - k)) + ')'; ctx.beginPath(); ctx.ellipse(x + off.x, y + off.y, 16 * sc, 5 * sc, 0, 0, 7); ctx.fill(); });
  addShape('ground', 500, (ctx, k, off) => { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,160,60,' + (1 - k) + ')'; const R = 6 + Ease.outCubic(k) * 34 * sc; pxEllipse(ctx, x + off.x, y + off.y, R, R * .32, 2); ctx.globalCompositeOperation = 'source-over'; });
  addShape('high', dur, (ctx, k, S) => {
    const [sx, sy] = S(x, y), a = env() * .32, w = 24 * sc * S.k, h = H * 1.3 * S.k;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, sy - h, 0, sy); g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(.5, 'rgba(255,120,40,' + a * .35 + ')'); g.addColorStop(1, 'rgba(255,190,90,' + a * .7 + ')');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy - h / 2, w, h / 2, 0, 0, 7); ctx.fill(); ctx.restore();
  });
  light(x, y - 20, 170 * sc, '255,110,30', .7, dur + 200, 40);
  sceneTint(.1, '255,100,30', dur + 300);
  fxImpact(x, y - 14, { size: 12 * sc, rgb: '255,130,50', sparkCols: FR.slice(1), sparks: 24 });
  shake(3 + sc * 2);
}
function fxTornado(x, y, dur, sc) {
  sc = sc || 1;
  const st = Clock.t;
  const drawT = front => (ctx, k, off) => {
    const age = Clock.t - st, env = Math.min(1, age / 150) * Math.min(1, (dur - age) / 200);
    if (env <= 0) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const h = i * 7.5 * sc, R = (5 + i * 3.1) * sc * (.8 + .2 * env), cx = x + Math.sin(age / 120 + i * .7) * 2 * sc + off.x, cy = y - h + off.y, spd = age / 70 * (1 + i * .08);
      ctx.fillStyle = front ? 'rgba(230,255,235,' + .9 * env + ')' : 'rgba(120,220,160,' + .45 * env + ')';
      pxEllipse(ctx, cx, cy, R, R * .3, 1, a => (Math.sin(a) > 0) === front && Math.sin(a * 2 + spd + i) > -.1);
    }
    ctx.globalCompositeOperation = 'source-over';
  };
  addShape('low', dur, drawT(false));
  addShape('low', dur, drawT(true));
  addShape('high', dur, (ctx, k, S) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowAt(ctx, S, x, y - 26 * sc, 40 * sc, '150,255,190', Math.sin(k * Math.PI) * .45); ctx.restore(); });
  for (let i = 0; i < 22 * sc; i++) {
    const a0 = rnd(0, 6.28), h0 = rnd(0, 50 * sc), rr = rnd(6, 20) * sc, spd = rnd(.12, .22);
    part({ x, y, life: dur, delay: rnd(0, 200), cols: [pickOne(['#b8f080', '#80d060', '#f0e070', '#ffffff'])], size: 1, add: false, fade: false,
      fn: (p) => { const a = a0 + p.age / 1000 * 6.28 * spd * 6; p.x = x + Math.cos(a) * rr; p.y = y - h0 - p.age / dur * 16 + Math.sin(a) * rr * .3; p.vx = p.vy = 0; } });
  }
  light(x, y - 20, 120 * sc, '150,255,190', .55, dur);
}
function fxWindStreaks(ms) {
  addShape('high', ms, (ctx, k, S) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const y = (40 + i * 23) * S.k * 1, p = ((k * 1.6 + i * .37) % 1), x = (1 - p) * ctx.canvas.width * 1.3 - 100;
      ctx.strokeStyle = 'rgba(200,255,220,' + (.35 * Math.sin(k * Math.PI)) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 140 * S.k / 2, y + 6); ctx.stroke();
    }
    ctx.restore();
  });
}
function fxRockSpikes(x, y, sc) {
  sc = sc || 1;
  const P = new Pix(80, 60), earth = ramp('#2a1e16', '#4e3a28', '#7a5c3c', '#a8845a', '#d4b27c');
  const spikes = [[40, 26, 7], [30, 18, 5], [51, 20, 5.5], [22, 12, 4], [58, 13, 4]];
  for (const [cx, h, w] of spikes) P.poly([[cx - w, 58], [cx - w * .4, 58 - h * 1.8], [cx + w * .15, 58 - h * 2], [cx + w, 58]], earth, { grad: [cx - w, 58 - h * 2, cx + w, 58], hi: .98 });
  const cv = P.finish();
  const dur = 900, rise = 150;
  addShape('low', dur, (ctx, k, off) => {
    const age = k * dur, up = age < rise ? Ease.outBack(age / rise) : age > dur - 220 ? 1 - Ease.in((age - dur + 220) / 220) : 1;
    const hh = 60 * sc, ww = 80 * sc;
    ctx.save(); ctx.beginPath(); ctx.rect(x - ww / 2 + off.x, y - hh - 4 + off.y, ww, hh + 6); ctx.clip();
    ctx.drawImage(cv, Math.round(x - ww / 2 + off.x), Math.round(y - hh + 2 + off.y + (1 - up) * hh), ww, hh); ctx.restore();
  });
  for (let i = 0; i < 16 * sc; i++) part({ x: x + gauss() * 14 * sc, y: y - rnd(0, 6), vx: gauss() * 1.4, vy: -rnd(1.5, 3.2), ay: .16, life: rnd(500, 800), cols: ['#a8845a', '#7a5c3c', '#4e3a28'], size: rnd(1, 3) | 0, add: false, fade: false });
  for (let i = 0; i < 14 * sc; i++) part({ x: x + gauss() * 18 * sc, y: y - rnd(0, 4), vx: gauss() * .6, vy: -rnd(.1, .5), life: rnd(600, 1000), cols: ['rgba(200,176,130,.7)', 'rgba(180,160,120,.45)', 'rgba(160,140,110,.2)'], size: 3, add: false, fn: (p) => { p.size = 3 + p.age / 250; } });
  light(x, y - 10, 90 * sc, '255,210,150', .35, 400);
  shake(4 + sc * 2);
}
function fxShockwave(x, y, sc) {
  sc = sc || 1;
  addShape('ground', 500, (ctx, k, off) => {
    const R = 6 + Ease.outCubic(k) * 42 * sc;
    ctx.fillStyle = 'rgba(255,230,180,' + (1 - k) + ')'; pxEllipse(ctx, x + off.x, y + off.y, R, R * .32, 2);
    ctx.fillStyle = 'rgba(255,255,255,' + (1 - k) + ')'; pxEllipse(ctx, x + off.x, y + off.y, R * .8, R * .8 * .32, 1);
  });
  for (let i = 0; i < 26 * sc; i++) { const a = rnd(0, 6.28); part({ x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 3, vx: Math.cos(a) * rnd(1, 2.4), vy: Math.sin(a) * .6 - rnd(.2, .8), drag: .94, life: rnd(500, 900), cols: ['rgba(210,190,150,.8)', 'rgba(180,160,130,.5)', 'rgba(150,130,110,.25)'], size: 2, add: false, fn: (p) => { p.size = 2 + p.age / 300; } }); }
  light(x, y, 120 * sc, '255,220,160', .5, 300);
  shake(7 * sc);
}
function fxHeal(x, y) {
  addShape('high', 1200, (ctx, k, S) => {
    const [sx, sy] = S(x, y), a = Math.sin(k * Math.PI), w = (10 + a * 12) * S.k;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createLinearGradient(sx - w, 0, sx + w, 0);
    hg.addColorStop(0, 'rgba(190,255,170,0)'); hg.addColorStop(.35, 'rgba(210,255,190,.35)'); hg.addColorStop(.5, 'rgba(255,255,240,.9)'); hg.addColorStop(.65, 'rgba(210,255,190,.35)'); hg.addColorStop(1, 'rgba(190,255,170,0)');
    ctx.fillStyle = hg;
    const strips = 14, top = sy - 150 * S.k;
    for (let i = 0; i < strips; i++) { const u = i / strips; ctx.globalAlpha = a * Math.pow(u, 1.4) * .8; ctx.fillRect(sx - w, top + (sy - top) * u, w * 2, (sy - top) / strips + 1); }
    ctx.globalAlpha = 1; ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowAt(ctx, S, x, y - 4, 26, '200,255,180', a * .6); ctx.restore();
  });
  addShape('ground', 900, (ctx, k, off) => { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(180,255,170,' + (1 - k) + ')'; const R = 6 + k * 22; pxEllipse(ctx, x + off.x, y + off.y, R, R * .34, 1); ctx.globalCompositeOperation = 'source-over'; });
  for (let i = 0; i < 26; i++) part({ x: x + gauss() * 9, y: y - rnd(0, 30), vy: -rnd(.3, .8), life: rnd(600, 1100), delay: rnd(0, 500), cols: ['#ffffff', '#e0ffc0', '#9af08a'], size: rnd(1, 2.5) | 0, shape: 'plus' });
  light(x, y - 18, 130, '190,255,170', .7, 1100, 200);
}
function fxBeam(x0, y0, x1, y1, ms, rgb) {
  addShape('high', ms, (ctx, k, S) => {
    const [a, b] = S(x0, y0), [c, d] = S(x1, y1), env = Math.sin(k * Math.PI), wob = 1 + Math.sin(Clock.t / 25) * .2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const [w, al] of [[16, .25], [8, .5], [3, 1]]) { ctx.strokeStyle = w === 3 ? 'rgba(255,255,255,' + env + ')' : 'rgba(' + rgb + ',' + al * env + ')'; ctx.lineWidth = w * S.k / 2 * wob * env; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
    ctx.restore();
  });
  const st = Clock.t;
  FX.tickers.push(() => {
    if (Clock.t - st > ms) return false;
    for (let i = 0; i < 3; i++) { const u = Math.random(); part({ x: lerp(x0, x1, u) + gauss() * 2, y: lerp(y0, y1, u) + gauss() * 2, vx: gauss() * .3, vy: gauss() * .3, life: rnd(200, 500), cols: ['#ffffff', 'rgb(' + rgb + ')'], shape: Math.random() < .3 ? 'plus' : 'sq' }); }
  });
  light(x1, y1, 120, rgb, .7, ms);
}
function fxDissolve(actor, left, top) {
  const px = actor.px, w = px.w, h = px.h, out = px.out;
  let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = out[y * w + x]; if (!(c >>> 24)) continue;
    if (Math.random() > (REDUCED ? .15 : .55)) continue;
    const [r, g, b] = unpack(c);
    part({ x: left + x, y: top + y, vx: gauss() * .25, vy: -rnd(.2, .9), ay: -.004, drag: .99, life: rnd(600, 1200), delay: y * 7 + rnd(0, 160), cols: ['rgb(' + r + ',' + g + ',' + b + ')', '#ffd0d0', '#ff7a7a', '#a02030'], add: false, fn: (p, f) => { p.vx += Math.sin(p.age / 90 + p.y) * .02 * f; } });
    n++;
  }
  flash(.25, '255,230,230');
  return n;
}
function fxBoostSurge(x, y, level) {
  const cols = level >= 3 ? ['#ffffff', '#ffd0f0', '#ff70c0'] : level === 2 ? ['#fff4b0', '#ffa040', '#ff5a20'] : ['#fff6c0', '#ffd050', '#e8a030'];
  for (let i = 0; i < 30 + level * 10; i++) { const a = rnd(0, 6.28); part({ x: x + Math.cos(a) * 3, y: y - 16 + Math.sin(a) * 3, vx: Math.cos(a) * rnd(.6, 2), vy: Math.sin(a) * rnd(.6, 2) - .5, drag: .92, life: rnd(400, 700), cols, size: rnd(1, 2.5) | 0 }); }
  addShape('ground', 500, (ctx, k, off) => { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,210,120,' + (1 - k) + ')'; const R = 4 + k * 26; pxEllipse(ctx, x + off.x, y + off.y, R, R * .34, 1); ctx.globalCompositeOperation = 'source-over'; });
  light(x, y - 16, 110, level >= 3 ? '255,150,220' : '255,190,90', .8, 500);
}
function auraTick(u) {                              // continuous boost aura while BP is being spent
  const lv = u.aura; if (!lv || !u.alive) return;
  const cols = lv >= 3 ? ['#ffffff', '#ffc8f0', '#ff60b8'] : lv === 2 ? ['#fff0a0', '#ff9a40', '#e04a18'] : ['#fff6c0', '#ffd050', '#d89028'];
  const n = REDUCED ? 1 : lv + 1;
  for (let i = 0; i < n; i++) part({ x: u.x + u.ox + gauss() * 7, y: u.y - rnd(0, 34), vx: gauss() * .1, vy: -rnd(.5, 1.3), life: rnd(300, 600), cols, size: 1 });
}

/* ---------- damage / label text ---------- */
function dmgText(u, value, kind) {
  const recent = FX.texts.filter(t => t.u === u && Clock.t - t.t0 < 650 && t.kind !== 'label').length;
  FX.texts.push({ u, x: u.x + u.ox + rnd(-3, 3), y: u.y + u.oy - u.fly - u.hgt * .6 - recent * 11, txt: String(value), kind: kind || 'dmg', t0: Clock.t, dur: 1100 });
}
function labelText(u, txt, col, dy) { FX.texts.push({ u, x: u.x + u.ox, y: u.y + u.oy - u.fly - u.hgt * .6 - 20 + (dy || 0), txt, kind: 'label', col, t0: Clock.t, dur: 900 }); }
