'use strict';
/* Main: render pipeline (pixel scene -> depth of field -> bloom -> lights -> grade), HUD, menus, input, audio. */

const stage = document.getElementById('stage');
const cv = document.getElementById('view'), ctx = cv.getContext('2d');
const low = document.createElement('canvas'); low.width = LW * RES; low.height = LH * RES;
const lctx = low.getContext('2d'); lctx.imageSmoothingEnabled = false;
const dof = document.createElement('canvas'); dof.width = LW; dof.height = LH; const dctx = dof.getContext('2d');
const bloom = document.createElement('canvas'); bloom.width = LW / 2; bloom.height = LH / 2; const bctx = bloom.getContext('2d');
const mask = document.createElement('canvas'); mask.width = 1; mask.height = LH;
(() => { const m = mask.getContext('2d'), g = m.createLinearGradient(0, 0, 0, LH);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.13, 'rgba(0,0,0,.85)'); g.addColorStop(.34, 'rgba(0,0,0,0)'); g.addColorStop(.8, 'rgba(0,0,0,0)'); g.addColorStop(.93, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  m.fillStyle = g; m.fillRect(0, 0, 1, LH); })();
const HAS_FILTER = 'filter' in lctx;
let MW = 960, MH = 540, U = 1;
function resize() {
  const r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const K = clamp(Math.round(r.width * dpr / LW), 2, 4);
  if (cv.width !== LW * K) { cv.width = LW * K; cv.height = LH * K; }
  MW = cv.width; MH = cv.height; U = MW / 960;
}
addEventListener('resize', resize);

/* ---------- view transform ---------- */
const View = { sx: 0, sy: 0, k: 2 };
const S = (x, y) => [(x - Cam.lx - View.sx) * View.k, (y - Cam.ly - View.sy) * View.k];
Object.defineProperty(S, 'k', { get: () => View.k });
function screenToWorld(px, py) { return [px / View.k + View.sx + Cam.lx, py / View.k + View.sy + Cam.ly]; }

/* ---------- world rendering ---------- */
function drawWorld() {
  const sh = Cam.shake;
  Cam.lx = Cam.px + (sh > .3 ? rnd(-sh, sh) : 0); Cam.ly = Cam.py + (sh > .3 ? rnd(-sh, sh) * .6 : 0);
  const off = { x: -Cam.lx, y: -Cam.ly };
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, LW * RES, LH * RES); lctx.setTransform(RES, 0, 0, RES, 0, 0); lctx.imageSmoothingEnabled = false;
  drawLayers(lctx, { lx: Cam.lx, ly: Cam.ly }, false);
  for (const e of FX.ground) e.draw(lctx, (Clock.t - e.t0) / e.dur, off);
  // shadows
  for (const u of B.all) {
    if (u.vis <= 0) continue;
    lctx.fillStyle = 'rgba(20,16,30,' + (.38 * u.vis) + ')';
    const sw = u.side === 'e' ? u.shadow : 8, air = u.fly ? (1 - clamp(-u.oy / 60, 0, .5)) : 1;
    lctx.beginPath(); lctx.ellipse(Math.round(u.x + u.ox + off.x), Math.round(u.y + (u.fly ? 0 : u.oy) + off.y + (u.fly ? u.oy * .4 : 0)), sw * air, sw * .28 * air, 0, 0, 7); lctx.fill();
  }
  // sprites, sorted by depth
  const list = B.all.filter(u => u.vis > 0).sort((a, b) => (a.y + a.oy * .3) - (b.y + b.oy * .3));
  for (const u of list) {
    const A = u.actor;
    A.rim = [255, 214, 150]; A.rimA = .26;
    let best = 0;
    for (const L of FX.lights) {
      const d = Math.hypot(L.x - (u.x + u.ox), L.y - (u.y - u.hgt / 2)); if (d > L.r) continue;
      const c = L.a * (1 - d / L.r);
      if (c > best) { best = c; A.rim = L.c.split(',').map(Number); A.rimA = clamp(.3 + c * .7, 0, .8); }
    }
    const opts = u.broken ? { tint: [70, 90, 200], tintA: .38 } : u.side === 'p' && !u.alive ? { tint: [60, 50, 80], tintA: .45 } : {};
    const spr = A.render(opts);
    u.sprLeft = u.x + u.ox - A.footX; u.sprTop = u.y + u.oy - u.fly - A.footY;
    u.top = u.y + u.oy - u.fly - u.hgt;
    lctx.globalAlpha = u.vis;
    lctx.drawImage(spr, Math.round((u.sprLeft + off.x) * RES) / RES, Math.round((u.sprTop + off.y) * RES) / RES, spr.width / A.px.d, spr.height / A.px.d);
    lctx.globalAlpha = 1;
  }
  for (const e of FX.low) e.draw(lctx, (Clock.t - e.t0) / e.dur, off);
  drawParts(lctx, off, false); drawParts(lctx, off, true);
  drawAmbientLow(lctx, { lx: Cam.lx, ly: Cam.ly }, Clock.t);
  drawLayers(lctx, { lx: Cam.lx, ly: Cam.ly }, true);
}
function composite() {
  const z = Cam.zoom, sw = LW / z, sh = LH / z;
  View.sx = clamp(Cam.fx - Cam.lx - sw / 2 + Cam.lx * 0, 0, LW - sw); View.sy = clamp(Cam.fy - Cam.ly - sh / 2, 0, LH - sh);
  View.sx = clamp(Cam.fx - sw / 2, 0, LW - sw); View.sy = clamp(Cam.fy - sh / 2, 0, LH - sh);
  View.k = MW / sw;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(low, View.sx * RES, View.sy * RES, sw * RES, sh * RES, 0, 0, MW, MH);
  if (HAS_FILTER) {
    dctx.clearRect(0, 0, LW, LH); dctx.filter = 'blur(1.6px)'; dctx.drawImage(low, 0, 0, LW, LH); dctx.filter = 'none';
    dctx.globalCompositeOperation = 'destination-in'; dctx.drawImage(mask, 0, 0, LW, LH); dctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true; ctx.drawImage(dof, View.sx, View.sy, sw, sh, 0, 0, MW, MH);
    bctx.clearRect(0, 0, LW / 2, LH / 2); bctx.filter = 'contrast(2.6) brightness(.85) saturate(1.3) blur(3px)'; bctx.drawImage(low, 0, 0, LW / 2, LH / 2); bctx.filter = 'none';
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .2; ctx.drawImage(bloom, View.sx / 2, View.sy / 2, sw / 2, sh / 2, 0, 0, MW, MH); ctx.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = true;
  // god rays + sun
  ctx.globalCompositeOperation = 'lighter';
  const t = Clock.t;
  for (let i = 0; i < 5; i++) {
    const x0 = MW * (.55 + i * .1) + Math.sin(t / 3000 + i) * 12 * U, g = ctx.createLinearGradient(x0, 0, x0 - 260 * U, MH * .8);
    g.addColorStop(0, 'rgba(255,226,160,' + (.09 + .03 * Math.sin(t / 1700 + i * 2)) + ')'); g.addColorStop(1, 'rgba(255,226,160,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 34 * U, 0); ctx.lineTo(x0 - 250 * U, MH * .8); ctx.lineTo(x0 - 330 * U, MH * .8); ctx.fill();
  }
  const sun = ctx.createRadialGradient(MW * .86, -20 * U, 0, MW * .86, -20 * U, 380 * U);
  sun.addColorStop(0, 'rgba(255,236,190,.55)'); sun.addColorStop(1, 'rgba(255,236,190,0)'); ctx.fillStyle = sun; ctx.fillRect(0, 0, MW, MH);
  for (const L of FX.lights) {
    const age = Clock.t - L.t0, env = Math.min(1, age / L.fadeIn) * (L.dur > 1e8 ? 1 : clamp((L.dur - age) / Math.min(300, L.dur), 0, 1));
    glowAt(ctx, S, L.x, L.y, L.r, L.c, L.a * env * .3);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const e of FX.high) { ctx.save(); e.draw(ctx, (Clock.t - e.t0) / e.dur, S); ctx.restore(); }
  if (FX.tint.a > .01) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(' + FX.tint.c + ',' + FX.tint.a * 2 + ')'; ctx.fillRect(0, 0, MW, MH); }
  ctx.globalCompositeOperation = 'soft-light'; const warm = ctx.createLinearGradient(0, 0, 0, MH);
  warm.addColorStop(0, 'rgba(255,230,180,.14)'); warm.addColorStop(1, 'rgba(40,60,90,.22)'); ctx.fillStyle = warm; ctx.fillRect(0, 0, MW, MH);
  ctx.globalCompositeOperation = 'source-over';
  const v = ctx.createRadialGradient(MW / 2, MH * .55, MH * .35, MW / 2, MH * .5, MW * .7);
  v.addColorStop(0, 'rgba(10,6,24,0)'); v.addColorStop(1, 'rgba(10,6,24,.62)'); ctx.fillStyle = v; ctx.fillRect(0, 0, MW, MH);
  if (FX.flash.a > .01) { ctx.fillStyle = 'rgba(' + FX.flash.c + ',' + FX.flash.a + ')'; ctx.fillRect(0, 0, MW, MH); }
}

/* ---------- HUD (canvas) ---------- */
const TYPE_COL = { Blade: '#dfe8f4', Spear: '#9ad4ff', Staff: '#e2b2ff', Fire: '#ff8a44', Wind: '#8ff0b8', Earth: '#d8a868' };
const FONT_T = '"Cinzel", "Times New Roman", serif';
function typeIcon(c, type, x, y, s, known) {
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(10,12,30,.9)'; c.strokeStyle = known ? 'rgba(230,196,120,.95)' : 'rgba(150,140,120,.7)'; c.lineWidth = Math.max(1, s * .07);
  c.beginPath(); if (c.roundRect) c.roundRect(-s / 2, -s / 2, s, s, s * .18); else c.rect(-s / 2, -s / 2, s, s); c.fill(); c.stroke();
  if (!known) { c.fillStyle = 'rgba(200,190,170,.85)'; c.font = '700 ' + (s * .62) + 'px ' + FONT_T; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, s * .04); c.restore(); return; }
  const col = TYPE_COL[type], k = s / 20; c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = 2 * k;
  c.beginPath();
  if (type === 'Blade') { c.moveTo(-6 * k, 6 * k); c.lineTo(6 * k, -6 * k); c.stroke(); c.beginPath(); c.moveTo(-6 * k, 1 * k); c.lineTo(-1 * k, 6 * k); c.stroke(); }
  else if (type === 'Spear') { c.moveTo(-6 * k, 6 * k); c.lineTo(4 * k, -4 * k); c.stroke(); c.beginPath(); c.moveTo(7 * k, -7 * k); c.lineTo(1 * k, -5 * k); c.lineTo(5 * k, -1 * k); c.closePath(); c.fill(); }
  else if (type === 'Staff') { c.moveTo(-5 * k, 7 * k); c.lineTo(3 * k, -2 * k); c.stroke(); c.beginPath(); c.arc(4.5 * k, -4 * k, 3 * k, 0, 7); c.fill(); }
  else if (type === 'Fire') { c.moveTo(0, -8 * k); c.bezierCurveTo(7 * k, -1 * k, 6 * k, 7 * k, 0, 7 * k); c.bezierCurveTo(-6 * k, 7 * k, -6 * k, 0, 0, -8 * k); c.fill(); c.fillStyle = '#fff2b0'; c.beginPath(); c.arc(0, 3 * k, 2.4 * k, 0, 7); c.fill(); }
  else if (type === 'Wind') { for (const [yy, l] of [[-4, 11], [0, 14], [4, 9]]) { c.beginPath(); c.moveTo(-7 * k, yy * k); c.lineTo((l - 9) * k, yy * k); c.arc((l - 9) * k, (yy - 2) * k, 2 * k, Math.PI / 2, -Math.PI / 2, true); c.stroke(); } }
  else if (type === 'Earth') { c.moveTo(-8 * k, 6 * k); c.lineTo(-2 * k, -6 * k); c.lineTo(2 * k, 0); c.lineTo(4 * k, -3 * k); c.lineTo(8 * k, 6 * k); c.closePath(); c.fill(); }
  c.restore();
}
function shieldBadge(c, x, y, s, n, broken, pop) {
  c.save(); c.translate(x, y); const sc = 1 + pop * .35; c.scale(sc, sc);
  c.beginPath(); c.moveTo(-s * .45, -s * .5); c.lineTo(s * .45, -s * .5); c.lineTo(s * .45, s * .05); c.quadraticCurveTo(s * .4, s * .38, 0, s * .55); c.quadraticCurveTo(-s * .4, s * .38, -s * .45, s * .05); c.closePath();
  const g = c.createLinearGradient(0, -s / 2, 0, s / 2);
  if (broken) { g.addColorStop(0, '#6a6470'); g.addColorStop(1, '#2e2a36'); } else { g.addColorStop(0, pop > .1 ? '#ffffff' : '#9ec8ff'); g.addColorStop(1, '#2c4a9a'); }
  c.fillStyle = g; c.fill(); c.lineWidth = Math.max(1, s * .08); c.strokeStyle = broken ? '#8a8090' : '#e8d49a'; c.stroke();
  c.fillStyle = '#ffffff'; c.font = '700 ' + (s * .56) + 'px ' + FONT_T; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = s * .12; c.strokeStyle = '#101428'; c.strokeText(broken ? '×' : n, 0, s * .02); c.fillText(broken ? '×' : n, 0, s * .02);
  c.restore();
}
function portrait(u) {
  if (u.portrait) return u.portrait;
  const A = u.actor; A.render();
  const J = A.J, s = u.side === 'p' ? 18 : u.actor.kind === 'Golem' ? 34 : 28;
  const hx = u.side === 'p' ? J.head.x : J.head.x, hy = u.side === 'p' ? J.head.y - 1 : J.head.y;
  const c = document.createElement('canvas'); c.width = s; c.height = s; const g = c.getContext('2d');
  const dd = A.px.d; g.drawImage(A.px.cv, Math.round(hx - s / 2) * dd, Math.round(hy - s / 2) * dd, s * dd, s * dd, 0, 0, s, s);
  u.portrait = c; return c;
}
function drawTurnOrder(c) {
  const cur = B.current && B.current.alive ? [B.current] : [], now = cur.concat(B.order.filter(u => u.alive)), next = turnList();
  let x = 18 * U; const y = 16 * U;
  c.font = '700 ' + 11 * U + 'px ' + FONT_T; c.textAlign = 'left'; c.textBaseline = 'top';
  c.fillStyle = 'rgba(240,226,190,.9)'; c.fillText('ROUND ' + B.round, x, y);
  const row = y + 16 * U;
  const drawP = (u, i, dim, big) => {
    const s = (big ? 38 : 30) * U, yy = row + (big ? 0 : 4 * U);
    c.save(); c.globalAlpha = dim ? .5 : 1;
    c.fillStyle = u.side === 'p' ? 'rgba(24,44,70,.95)' : 'rgba(70,20,30,.95)'; c.fillRect(x, yy, s, s);
    c.imageSmoothingEnabled = false; c.drawImage(portrait(u), x + 2 * U, yy + 2 * U, s - 4 * U, s - 4 * U);
    c.lineWidth = (big ? 2.5 : 1.5) * U; c.strokeStyle = big ? '#f2cf74' : u.side === 'p' ? '#7ab8e0' : '#d07070'; c.strokeRect(x, yy, s, s);
    if (u.broken) { c.fillStyle = 'rgba(80,90,200,.45)'; c.fillRect(x, yy, s, s); }
    c.restore();
    x += s + 5 * U;
  };
  now.forEach((u, i) => drawP(u, i, false, i === 0 && !!cur.length));
  x += 8 * U;
  c.fillStyle = 'rgba(240,226,190,.7)'; c.font = '600 ' + 9 * U + 'px ' + FONT_T; c.fillText('NEXT', x, row - 12 * U + 2 * U);
  next.slice(0, Math.max(3, 9 - now.length)).forEach(u => drawP(u, 0, true, false));
}
function drawPlates(c) {
  for (const e of B.enemies) {
    if (!e.alive && e.vis <= 0) continue; if (!e.alive) continue;
    const below = e.plate === 'below';
    const [sx, sy] = S(e.x + e.ox, below ? e.y + 8 : e.top - 10);
    const n = e.weak.length, iw = 20 * U, w = 30 * U + n * (iw + 3 * U);
    const x0 = sx - w / 2, y0 = sy - (below ? 0 : 26 * U);
    c.fillStyle = 'rgba(8,10,26,.62)'; c.fillRect(x0 - 4 * U, y0 - 3 * U, w + 8 * U, 30 * U);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x0, y0 + 23 * U, w, 3 * U);
    c.fillStyle = '#e25050'; c.fillRect(x0, y0 + 23 * U, w * e.hp / e.maxHp, 3 * U);
    const pop = e.shieldHit ? clamp(1 - (Clock.t - e.shieldHit) / 260, 0, 1) : 0;
    shieldBadge(c, x0 + 11 * U, y0 + 10 * U, 22 * U, e.shields, e.broken, pop);
    e.weak.forEach((w2, i) => typeIcon(c, w2, x0 + 32 * U + i * (iw + 3 * U), y0 + 10 * U, iw, e.tested.has(w2)));
    e.plateXY = [x0 + 11 * U, y0 + 10 * U];
  }
}
function drawBreaks(c) {
  for (const e of B.enemies) {
    if (!e.brokeAt) continue;
    const age = Clock.t - e.brokeAt; if (age > 1500) continue;
    const [px, py] = e.plateXY || S(e.x, e.top);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * 6.28 + .3, d = Ease.outCubic(Math.min(1, age / 700)) * (40 + (i % 3) * 18) * U;
      c.save(); c.globalAlpha = clamp(1 - age / 900, 0, 1); c.translate(px + Math.cos(a) * d, py + Math.sin(a) * d + age * age / 30000 * U); c.rotate(age / 90 + i);
      c.fillStyle = i % 2 ? '#bcd8ff' : '#ffffff'; c.beginPath(); c.moveTo(0, -5 * U); c.lineTo(4 * U, 3 * U); c.lineTo(-3 * U, 4 * U); c.fill(); c.restore();
    }
    const ch = chest(e), [cx0, cy0] = S(ch.x, ch.y);
    const k = Math.min(1, age / 200), sc = age < 200 ? lerp(2.6, 1, Ease.outBack(k)) : 1, al = age > 1100 ? 1 - (age - 1100) / 400 : 1;
    c.save(); c.globalAlpha = clamp(al, 0, 1); c.translate(cx0, cy0); c.scale(sc, sc); c.rotate(-.06);
    c.font = '900 ' + 40 * U + 'px ' + FONT_T; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 7 * U; c.strokeStyle = '#3a0a0a'; c.strokeText('BREAK', 0, 0);
    const g = c.createLinearGradient(0, -20 * U, 0, 20 * U); g.addColorStop(0, '#fff6c0'); g.addColorStop(.5, '#ffc640'); g.addColorStop(1, '#e0601a');
    c.fillStyle = g; c.fillText('BREAK', 0, 0);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = clamp(al, 0, 1) * (1 - k) ; c.fillStyle = '#ffffff'; c.fillText('BREAK', 0, 0);
    c.restore();
  }
}
function drawTexts(c) {
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const t of FX.texts) {
    const age = Clock.t - t.t0, [sx, sy] = S(t.x, t.y);
    if (t.kind === 'label') {
      const al = age > 650 ? 1 - (age - 650) / 250 : 1, yy = sy - Math.min(age, 300) / 300 * 10 * U;
      c.globalAlpha = clamp(al, 0, 1); c.font = '700 ' + 14 * U + 'px ' + FONT_T; c.lineWidth = 4 * U; c.strokeStyle = '#140a18';
      c.strokeText(t.txt, sx, yy); c.fillStyle = t.col; c.fillText(t.txt, sx, yy); continue;
    }
    const big = t.kind === 'weak' ? 1.3 : 1, pop = age < 90 ? lerp(1.9, 1, age / 90) : 1;
    const bounce = age < 360 ? -Math.abs(Math.sin(age / 360 * Math.PI * 2)) * 10 * U * (1 - age / 360) : 0;
    const al = age > 850 ? 1 - (age - 850) / 250 : 1, rise = age > 850 ? (age - 850) / 250 * 8 * U : 0;
    c.globalAlpha = clamp(al, 0, 1);
    c.font = '800 ' + 20 * U * big * pop + 'px ' + FONT_T; c.lineWidth = 5 * U;
    c.strokeStyle = t.kind === 'hurt' ? '#4a0010' : t.kind === 'heal' ? '#0a3a14' : '#10101c';
    c.strokeText(t.txt, sx, sy + bounce - rise);
    c.fillStyle = t.kind === 'weak' ? '#ffe070' : t.kind === 'heal' ? '#a8ffae' : t.kind === 'hurt' ? '#ffe0e0' : '#ffffff';
    c.fillText(t.txt, sx, sy + bounce - rise);
  }
  c.globalAlpha = 1;
}
let banner = null;
function showSkill(txt, type, atkType) { banner = { txt, type, atkType, t0: Clock.t }; }
function drawBanner(c) {
  if (!banner) return; const age = Clock.t - banner.t0; if (age > 1500) return;
  const al = age < 120 ? age / 120 : age > 1200 ? 1 - (age - 1200) / 300 : 1, w = 420 * U, y = 74 * U, cx = MW / 2;
  c.save(); c.globalAlpha = al;
  const g = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); g.addColorStop(0, 'rgba(10,14,40,0)'); g.addColorStop(.2, 'rgba(10,14,40,.85)'); g.addColorStop(.8, 'rgba(10,14,40,.85)'); g.addColorStop(1, 'rgba(10,14,40,0)');
  c.fillStyle = g; c.fillRect(cx - w / 2, y - 16 * U, w, 32 * U);
  const lg = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); lg.addColorStop(0, 'rgba(230,196,120,0)'); lg.addColorStop(.5, 'rgba(230,196,120,.95)'); lg.addColorStop(1, 'rgba(230,196,120,0)');
  c.fillStyle = lg; c.fillRect(cx - w / 2, y - 16 * U, w, 1.2 * U); c.fillRect(cx - w / 2, y + 15 * U, w, 1.2 * U);
  c.font = '700 ' + 17 * U + 'px ' + FONT_T; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f6ecd0';
  const tx = banner.type ? cx + 12 * U : cx;
  c.fillText(banner.txt, tx, y + 1 * U);
  if (banner.type) typeIcon(c, banner.type, tx - c.measureText(banner.txt).width / 2 - 16 * U, y, 18 * U, true);
  if (banner.atkType) { c.font = '600 ' + 10 * U + 'px ' + FONT_T; c.fillStyle = banner.atkType === 'phys' ? '#ffd35a' : '#9ad8ff'; c.fillText(banner.atkType === 'phys' ? 'PARRY WITH TIMING' : 'DODGE WITH TIMING', cx, y + 26 * U); }
  c.restore();
}
function drawRing(c) {
  const h = B.hit; if (!h) return;
  const ch = chest(h.tgt), [x, y] = S(ch.x, ch.y), p = clamp((Clock.t - h.start) / h.lead, 0, 1.3), d = Clock.t - h.T;
  const col = h.type === 'phys' ? '255,211,90' : '140,210,255', inWin = Math.abs(d) <= (h.type === 'phys' ? 105 : h.tgt.dodgeWin);
  const R = 24 * U;
  c.save();
  c.lineWidth = 4 * U; c.strokeStyle = 'rgba(' + col + ',' + (inWin ? 1 : .8) + ')'; c.beginPath(); c.arc(x, y, R, 0, 7); c.stroke();
  if (inWin) { c.fillStyle = 'rgba(' + col + ',.28)'; c.fill(); }
  c.lineWidth = 3 * U; c.strokeStyle = 'rgba(255,255,255,' + clamp(p * 2, 0, 1) + ')'; c.beginPath(); c.arc(x, y, R + (1 - Math.min(p, 1)) * 70 * U, 0, 7); c.stroke();
  c.font = '800 ' + 14 * U + 'px ' + FONT_T; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4 * U; c.strokeStyle = '#140a18';
  const lab = h.type === 'phys' ? 'PARRY' : 'DODGE';
  c.strokeText(lab, x, y - R - 16 * U); c.fillStyle = 'rgb(' + col + ')'; c.fillText(lab, x, y - R - 16 * U);
  c.font = '600 ' + 10 * U + 'px ' + FONT_T; c.strokeText('SPACE / TAP', x, y + R + 14 * U); c.fillStyle = '#f0e8d8'; c.fillText('SPACE / TAP', x, y + R + 14 * U);
  c.restore();
}
function drawCursors(c) {
  const bob = Math.sin(Clock.t / 140) * 3 * U;
  if (B.current && B.current.side === 'p' && UI.mode === 'pick') {
    const u = B.current, [x, y] = S(u.x + u.ox, u.top - 6);
    c.fillStyle = '#f2cf74'; c.beginPath(); c.moveTo(x - 6 * U, y - 10 * U + bob); c.lineTo(x + 6 * U, y - 10 * U + bob); c.lineTo(x, y + bob); c.fill();
  }
  if (UI.stage === 'target' && UI.mode === 'pick') {
    const ts = UI.ab.tg === 'all' ? living(B.enemies) : [UI.targets[UI.tIdx]];
    for (const t of ts) {
      if (!t) continue;
      const [x, y] = S(t.x + t.ox, t.side === 'e' ? chest(t).y : t.top - 4);
      const px = t.side === 'e' ? x + (t.hgt * .3 + 14) * View.k : x;
      c.save(); c.translate(px + (t.side === 'e' ? bob : 0), y + (t.side === 'e' ? 0 : bob - 10 * U));
      if (t.side === 'e') c.rotate(Math.PI / 2);
      c.fillStyle = '#ffe08a'; c.strokeStyle = '#3a2a0a'; c.lineWidth = 2 * U;
      c.beginPath(); c.moveTo(-9 * U, -14 * U); c.lineTo(9 * U, -14 * U); c.lineTo(0, 0); c.closePath(); c.fill(); c.stroke();
      c.restore();
      c.font = '700 ' + 12 * U + 'px ' + FONT_T; c.textAlign = 'center'; c.lineWidth = 4 * U; c.strokeStyle = '#10101c';
      const [nx, ny] = S(t.x + t.ox, t.side === 'e' ? t.y + 20 : t.y + 14);
      c.strokeText(t.name, nx, ny); c.fillStyle = '#ffffff'; c.fillText(t.name, nx, ny);
    }
  }
}
function drawHud() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true;
  if (UI.started) { drawTurnOrder(ctx); drawPlates(ctx); }
  drawBreaks(ctx); drawTexts(ctx); drawBanner(ctx); drawRing(ctx); drawCursors(ctx);
}

/* ---------- DOM UI ---------- */
const UI = { mode: 'intro', stage: 'menu', actor: null, boost: 0, ab: null, targets: [], tIdx: 0, done: null, started: false };
const $ = id => document.getElementById(id);
function say(m) { $('log').textContent = m; }
const ICON = t => '<i class="ti" style="--c:' + (TYPE_COL[t] || '#a8ffae') + '">' + (t ? t.slice(0, 2) : '+') + '</i>';
function refreshHud() {
  const box = $('status');
  if (box.children.length !== B.party.length) { box.innerHTML = ''; B.party.forEach(() => box.appendChild(document.createElement('div'))); }
  B.party.forEach((p, i) => {
    const el = box.children[i];
    el.className = 'srow' + (p === B.current ? ' on' : '') + (!p.alive ? ' ko' : '');
    el.innerHTML = '<span class="nm" style="--c:' + p.col + '">' + p.name + '</span>' +
      '<span class="val"><b>HP</b> ' + p.hp + '<i class="bar"><i style="width:' + (p.hp / p.maxHp * 100) + '%" class="hp"></i></i></span>' +
      '<span class="val"><b>SP</b> ' + p.mp + '<i class="bar"><i style="width:' + (p.mp / p.maxMp * 100) + '%" class="sp"></i></i></span>' +
      '<span class="orbs" aria-label="' + p.bp + ' boost points">' + [0, 1, 2, 3, 4].map(n => '<i class="orb' + (n < p.bp ? ' full' : '') + (p === UI.actor && UI.mode === 'pick' && n >= p.bp - UI.boost && n < p.bp ? ' spend' : '') + '"></i>').join('') + '</span>';
  });
}
function renderCmd() {
  const w = $('cmd'); w.hidden = false;
  if (UI.mode === 'defend') {
    w.innerHTML = '<div class="cw-head"><span class="who">Enemy attack</span></div><p class="cw-desc">Act when the white ring meets the coloured ring. Gold: parry. Blue: dodge.</p><button class="defend" id="defendBtn">Defend</button>';
    $('defendBtn').addEventListener('pointerdown', e => { e.preventDefault(); defendInput(); });
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    return;
  }
  if (UI.mode !== 'pick') { w.innerHTML = ''; w.hidden = true; return; }
  const a = UI.actor, maxB = Math.min(3, a.bp);
  let h = '<div class="cw-head"><span class="who" style="--c:' + a.col + '">' + a.name + '</span>' +
    '<span class="boost"><button class="bb" id="bMinus" aria-label="Less boost"' + (UI.boost ? '' : ' disabled') + '>&minus;</button><span class="blv">BOOST ' + UI.boost + '</span><button class="bb" id="bPlus" aria-label="More boost"' + (UI.boost < maxB ? '' : ' disabled') + '>+</button></span></div>';
  if (UI.stage === 'menu') {
    h += '<div class="cw-list" id="cwList">' + a.abs.map((ab, i) => '<button class="cmdb" data-i="' + i + '"' + (a.mp < ab.mp ? ' disabled' : '') + '>' + ICON(ab.type) + '<span>' + ab.name + '</span><em>' + (ab.mp ? ab.mp + ' SP' : '') + '</em></button>').join('') + '</div>';
    h += '<p class="cw-desc" id="cwDesc">' + a.abs[0].desc + '</p>';
  } else {
    h += '<div class="cw-list" id="cwList">' + (UI.ab.tg === 'all' ? '<button class="cmdb" data-t="all"><span>All enemies</span></button>' :
      UI.targets.map((t, i) => '<button class="cmdb' + (i === UI.tIdx ? ' sel' : '') + '" data-t="' + i + '"><span>' + t.name + '</span><em>' + (t.side === 'e' ? (t.broken ? 'BROKEN' : t.shields + ' shields') : t.hp + '/' + t.maxHp) + '</em></button>').join('')) +
      '<button class="cmdb back" id="cwBack"><span>Back</span></button></div>';
    h += '<p class="cw-desc">' + UI.ab.name + ': choose a target. Arrows cycle, Enter confirms, Esc goes back.</p>';
  }
  w.innerHTML = h;
  $('bMinus').onclick = () => setBoost(UI.boost - 1); $('bPlus').onclick = () => setBoost(UI.boost + 1);
  w.querySelectorAll('.cmdb[data-i]').forEach(b => {
    const ab = a.abs[+b.dataset.i];
    b.onmouseenter = b.onfocus = () => { $('cwDesc').textContent = ab.desc; };
    b.onclick = () => chooseAbility(ab);
  });
  w.querySelectorAll('.cmdb[data-t]').forEach(b => {
    b.onclick = () => { if (b.dataset.t !== 'all') UI.tIdx = +b.dataset.t; confirmTarget(); };
    b.onmouseenter = b.onfocus = () => { if (b.dataset.t !== 'all') { UI.tIdx = +b.dataset.t; } };
  });
  const back = $('cwBack'); if (back) back.onclick = goBack;
  const first = w.querySelector(UI.stage === 'target' ? '.cmdb.sel, .cmdb[data-t]' : '.cmdb:not(:disabled)'); if (first && UI.focusMenu) first.focus({ preventScroll: true });
}
function setBoost(n) {
  const a = UI.actor; n = clamp(n, 0, Math.min(3, a.bp)); if (n === UI.boost) return;
  UI.boost = n; a.aura = n; sfx(n ? 'boost' : 'select'); if (n) fxBoostSurge(a.x + a.ox, a.y, n);
  refreshHud(); renderCmd();
}
function chooseAbility(ab) {
  sfx('select'); UI.ab = ab;
  if (ab.tg === 'all') { UI.targets = living(B.enemies); UI.stage = 'target'; }
  else { UI.targets = ab.tg === 'ally' ? living(B.party) : living(B.enemies); UI.tIdx = ab.tg === 'ally' ? UI.targets.indexOf(UI.targets.slice().sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]) : 0; UI.stage = 'target'; }
  renderCmd();
}
function goBack() { sfx('select'); UI.stage = 'menu'; renderCmd(); }
function confirmTarget() {
  if (UI.stage !== 'target' || UI.mode !== 'pick') return;
  sfx('confirm');
  const targets = UI.ab.tg === 'all' ? living(B.enemies) : [UI.targets[UI.tIdx]];
  const done = UI.done; UI.done = null; UI.mode = 'busy'; UI.stage = 'menu';
  $('cmd').hidden = true;
  tween(UI.actor, 'ox', 0, 120);
  done({ ab: UI.ab, targets, boost: UI.boost });
}
function playerCommand(u) {
  return new Promise(res => {
    UI.mode = 'pick'; UI.stage = 'menu'; UI.actor = u; UI.boost = 0; UI.ab = null; UI.done = res;
    tween(u, 'ox', -7, 160, Ease.out); sfx('turn');
    say(u.name + "'s turn. Boost with Q/E or the +/- buttons, then choose an action.");
    refreshHud(); renderCmd();
  });
}
function showOutro(win) {
  const s = B.stats;
  $('outTitle').textContent = win ? 'Victory' : 'The party falls';
  $('outBody').textContent = (win ? 'The Thornwood clearing is safe again. ' : 'The forest closes in. ') +
    'Rounds ' + B.round + ' · Breaks ' + s.breaks + ' · Parries ' + s.parries + ' · Dodges ' + s.dodges + ' · Best hit ' + s.maxHit + '.';
  $('outro').hidden = false; $('again').focus({ preventScroll: true });
}

/* ---------- input ---------- */
addEventListener('keydown', e => {
  if (e.code === 'Space') { if (B.hit || UI.mode === 'defend') { e.preventDefault(); defendInput(); return; } }
  if (UI.mode !== 'pick') return;
  UI.focusMenu = true;
  if (e.key === 'q' || e.key === 'Q' || e.key === 'PageDown') { setBoost(UI.boost - 1); e.preventDefault(); }
  else if (e.key === 'e' || e.key === 'E' || e.key === 'PageUp') { setBoost(UI.boost + 1); e.preventDefault(); }
  else if (e.key === 'Escape' || e.key === 'Backspace') { if (UI.stage === 'target') { goBack(); e.preventDefault(); } }
  else if (UI.stage === 'target' && UI.ab.tg !== 'all' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1; UI.tIdx = (UI.tIdx + d + UI.targets.length) % UI.targets.length; sfx('select'); renderCmd(); e.preventDefault();
  } else if (UI.stage === 'target' && e.key === 'Enter') { confirmTarget(); e.preventDefault(); }
  else if (UI.stage === 'menu' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    const bs = [...document.querySelectorAll('#cwList .cmdb:not(:disabled)')]; if (!bs.length) return;
    const i = bs.indexOf(document.activeElement), n = e.key === 'ArrowDown' ? (i + 1) % bs.length : (i - 1 + bs.length) % bs.length;
    bs[n].focus(); sfx('select'); e.preventDefault();
  }
});
cv.addEventListener('pointerdown', e => {
  if (B.hit || UI.mode === 'defend') { e.preventDefault(); defendInput(); return; }
  if (UI.mode === 'pick' && UI.stage === 'target') {
    const r = cv.getBoundingClientRect(), [wx, wy] = screenToWorld((e.clientX - r.left) * MW / r.width, (e.clientY - r.top) * MH / r.height);
    const hit = UI.targets.find(t => Math.abs(wx - (t.x + t.ox)) < (t.side === 'e' ? t.hgt * .45 + 8 : 10) && wy > t.top - 4 && wy < t.y + 6);
    if (hit) { if (UI.ab.tg === 'all' || UI.targets[UI.tIdx] === hit) confirmTarget(); else { UI.tIdx = UI.targets.indexOf(hit); sfx('select'); renderCmd(); } }
  }
});

/* ---------- audio (synthesised, no files) ---------- */
const AU = { c: null, out: null, noise: null, on: true };
function auInit() {
  if (AU.c) return;
  try {
    AU.c = new (window.AudioContext || window.webkitAudioContext)();
    AU.out = AU.c.createGain(); AU.out.gain.value = .45; AU.out.connect(AU.c.destination);
    const len = AU.c.sampleRate, b = AU.c.createBuffer(1, len, AU.c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; AU.noise = b;
  } catch (e) { AU.c = null; }
}
function tone(f0, f1, dur, type, vol, delay) {
  const c = AU.c, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(AU.out); o.start(t); o.stop(t + dur + .05);
}
function noise(dur, ftype, f0, f1, vol, q, delay) {
  const c = AU.c, t = c.currentTime + (delay || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = AU.noise; f.type = ftype; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(AU.out); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
}
function sfx(n) {
  if (!AU.c || !AU.on) return;
  try {
    switch (n) {
      case 'slash': noise(.14, 'bandpass', 4200, 900, .5, 1.2); break;
      case 'swish': noise(.18, 'bandpass', 2400, 600, .35, 1); break;
      case 'hit': tone(170, 50, .14, 'sine', .7); noise(.06, 'lowpass', 3000, 400, .4); break;
      case 'weak': tone(190, 45, .16, 'sine', .8); noise(.08, 'lowpass', 5000, 500, .5); tone(1320, 1320, .12, 'triangle', .12, .02); break;
      case 'hurt': tone(140, 40, .2, 'sine', .7); noise(.12, 'lowpass', 1800, 200, .5); break;
      case 'fire': noise(.9, 'lowpass', 1400, 200, .6, .7); noise(.5, 'bandpass', 3000, 1200, .15, 2, .1); tone(90, 40, .5, 'sine', .5); break;
      case 'wind': noise(1.1, 'bandpass', 500, 1800, .45, 3); noise(.9, 'bandpass', 1200, 400, .25, 4, .15); break;
      case 'rock': tone(90, 35, .3, 'sine', .8); noise(.35, 'lowpass', 900, 120, .6); break;
      case 'heal': [660, 880, 990, 1320].forEach((f, i) => tone(f, f, .5, 'sine', .14, i * .08)); break;
      case 'cast': tone(300, 900, .5, 'sine', .12); tone(450, 1350, .5, 'triangle', .05); break;
      case 'whoosh': noise(.35, 'bandpass', 600, 2200, .35, 1.5); break;
      case 'parry': tone(1900, 1700, .35, 'triangle', .3); tone(2600, 2400, .25, 'square', .06); noise(.05, 'highpass', 5000, 5000, .4); break;
      case 'block': tone(700, 500, .12, 'triangle', .3); noise(.05, 'highpass', 3000, 3000, .25); break;
      case 'dodge': noise(.2, 'bandpass', 1500, 3500, .3, 2); break;
      case 'break': noise(.5, 'highpass', 6000, 3000, .5); [1400, 1100, 800, 520].forEach((f, i) => tone(f, f * .9, .3, 'triangle', .18, i * .05)); tone(120, 40, .4, 'sine', .7); break;
      case 'boost': tone(420, 1260, .22, 'sine', .18); noise(.2, 'bandpass', 1000, 4000, .1, 2); break;
      case 'select': tone(1250, 1250, .03, 'square', .04); break;
      case 'confirm': tone(880, 1320, .07, 'square', .05); break;
      case 'turn': tone(660, 990, .09, 'triangle', .08); break;
      case 'step': noise(.06, 'lowpass', 600, 200, .15); break;
      case 'growl': tone(90, 60, .35, 'sawtooth', .08); noise(.3, 'lowpass', 400, 150, .2); break;
      case 'bubble': tone(300, 700, .1, 'sine', .15); break;
      case 'beam': tone(1200, 400, .45, 'sawtooth', .06); noise(.45, 'bandpass', 3000, 1000, .2, 3); break;
      case 'death': noise(.9, 'lowpass', 3000, 200, .35); tone(400, 60, .8, 'triangle', .12); break;
      case 'victory': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, f, i === 5 ? .7 : .18, 'triangle', .16, i * .13)); break;
    }
  } catch (e) { /* audio is optional */ }
}
$('mute').onclick = () => { AU.on = !AU.on; $('mute').textContent = AU.on ? 'Sound on' : 'Sound off'; $('mute').setAttribute('aria-pressed', String(!AU.on)); };

/* ---------- boot ---------- */
async function startBattle() {
  auInit(); if (AU.c && AU.c.state === 'suspended') AU.c.resume();
  $('intro').hidden = true; $('outro').hidden = true;
  for (const L of [FX.parts, FX.ground, FX.low, FX.high, FX.lights, FX.texts, FX.tickers]) L.length = 0;
  newBattle(); UI.started = true; UI.mode = 'wait'; UI.actor = null; refreshHud(); renderCmd();
  for (const e of B.enemies) e.vis = 0;
  Cam.zoom = 1.25; Cam.fx = 170; Cam.fy = 150;
  camTo(240, 150, 1, 1100, Ease.inOut);
  showSkill('Thornwood Clearing', null); say('Enemies emerge from the brambles!');
  for (const e of B.enemies) {
    await wait(220); const c = chest(e);
    tween(e, 'vis', 1, 260); fxImpact(c.x, c.y, { size: 16, rgb: '255,200,220', sparkCols: ['#ffffff', '#ffc0e0', '#a070ff'] }); sfx('whoosh');
  }
  await wait(600);
  battleLoop();
}
$('begin').onclick = startBattle; $('again').onclick = startBattle;

let last = performance.now();
function frame(ts) {
  const dt = ts - last; last = ts;
  const gdt = tickClock(dt);
  for (const u of B.all) { u.actor.update(); auraTick(u); }
  tickDefense();
  updateFX(gdt);
  drawWorld(); composite(); drawHud();
  requestAnimationFrame(frame);
}
buildScene(); newBattle(); resize(); refreshHud(); renderCmd();
window.__G = { B, UI, Clock, defendInput, startBattle, FX, Cam };
requestAnimationFrame(t => { last = t; frame(t); });
