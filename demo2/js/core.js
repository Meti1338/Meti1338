'use strict';
/* Core: math, game clock (with hitstop/slow motion), tweens, colours and the pixel rasterizer. */

const LW = 480, LH = 270;
const DENS = 2;                                   // sprite pixel density (fine pixels per logical pixel)                       // low-res pixel buffer (the "world" resolution)
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(rnd(a, b + 1));
const pickOne = arr => arr[Math.floor(Math.random() * arr.length)];
const Ease = {
  lin: t => t,
  out: t => 1 - (1 - t) * (1 - t),
  in: t => t * t,
  inOut: t => t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  outBack: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outElastic: t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * 2.094) + 1
};
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ---------- game clock ---------- */
const Clock = { t: 0, real: 0, scale: 1, stopUntil: 0, slowUntil: 0, slowScale: 1 };
const waits = [], tweens = [];
function hitstop(ms) { Clock.stopUntil = Math.max(Clock.stopUntil, Clock.real + ms); }
function slowmo(scale, ms) { Clock.slowScale = scale; Clock.slowUntil = Clock.real + ms; }
function wait(ms) { return new Promise(r => waits.push({ at: Clock.t + ms, r })); }
function tween(obj, key, to, ms, ease) {
  return new Promise(r => tweens.push({ obj, key, from: obj[key], to, t0: Clock.t, ms: Math.max(1, ms), ease: ease || Ease.out, r }));
}
function tickClock(dtReal) {
  dtReal = Math.min(dtReal, 50);
  Clock.real += dtReal;
  let s = Clock.scale;
  if (Clock.real < Clock.stopUntil) s = 0;
  else if (Clock.real < Clock.slowUntil) s *= Clock.slowScale;
  const dt = dtReal * s;
  Clock.t += dt;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i], k = clamp((Clock.t - w.t0) / w.ms, 0, 1);
    w.obj[w.key] = w.from + (w.to - w.from) * w.ease(k);
    if (k >= 1) { tweens.splice(i, 1); w.r(); }
  }
  for (let i = waits.length - 1; i >= 0; i--) if (Clock.t >= waits[i].at) { const w = waits[i]; waits.splice(i, 1); w.r(); }
  return dt;
}

/* ---------- colours ---------- */
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function u32(r, g, b, a) { return ((a === undefined ? 255 : a) << 24 | b << 16 | g << 8 | r) >>> 0; }
function hex32(h) { const [r, g, b] = hexRGB(h); return u32(r, g, b); }
function ramp(...hs) { return hs.map(hex32); }
function unpack(c) { return [c & 255, (c >> 8) & 255, (c >> 16) & 255, c >>> 24]; }
function mix32(c, r2, g2, b2, t) { const [r, g, b, a] = unpack(c); return u32(r + (r2 - r) * t | 0, g + (g2 - g) * t | 0, b + (b2 - b) * t | 0, a); }
function dimRamp(rp, k) {                        // darker, cooler ramp for far-side limbs
  k = k || .72;
  return rp.map(c => { const [r, g, b] = unpack(c); return u32(r * k * .92 | 0, g * k * .9 | 0, Math.min(255, b * k * 1.05 + 6) | 0); });
}
function css(c, a) { const [r, g, b] = unpack(c); return 'rgba(' + r + ',' + g + ',' + b + ',' + (a === undefined ? 1 : a) + ')'; }

/* ---------- pixel rasterizer ---------- */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LIGHT = (() => { const v = [-.5, -.72, .5], l = Math.hypot(...v); return v.map(x => x / l); })();

class Pix {
  /* d = pixel density: logical coordinates are multiplied by d, so a sprite keeps its size but gains d x d finer pixels */
  constructor(w, h, d) {
    d = d || 1; this.d = d; this.lw = w; this.lh = h; w *= d; h *= d;
    this.w = w; this.h = h;
    this.buf = new Uint32Array(w * h);
    this.cv = document.createElement('canvas'); this.cv.width = w; this.cv.height = h;
    this.cx = this.cv.getContext('2d');
    this.img = this.cx.createImageData(w, h);
    this.out = new Uint32Array(this.img.data.buffer);
  }
  clear() { this.buf.fill(0); }
  fset(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.buf[y * this.w + x] = c; }
  set(x, y, c) { const d = this.d, fx = Math.floor(x) * d, fy = Math.floor(y) * d; for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) this.fset(fx + i, fy + j, c); }
  dot(x, y, c) { this.fset(Math.floor(x * this.d), Math.floor(y * this.d), c); }   // one fine pixel
  get(x, y) { const d = this.d; x = Math.floor(x * d); y = Math.floor(y * d); return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.buf[y * this.w + x]; }
  shade(rp, s, x, y, dither) {
    const n = rp.length, d = ((BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16 - .5) * (dither === undefined ? (this.d > 1 ? .35 : .85) : dither);
    return rp[clamp(Math.floor(s * n + d), 0, n - 1)];
  }
  lambert(nx, ny, nz, amb) { const A = amb === undefined ? .3 : amb, l = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]; return clamp(A + (1 - A) * Math.max(0, l), 0, .999); }
  _ellipse(cx, cy, rx, ry, rp, o) {
    o = o || {};
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const nx = (x + .5 - cx) / rx, ny = (y + .5 - cy) / ry, d = nx * nx + ny * ny;
      if (d > 1) continue;
      if (o.ring && d < o.ring) continue;
      let c;
      if (o.flat !== undefined) c = rp[o.flat];
      else { const s = this.lambert(nx, ny, Math.sqrt(1 - d), o.amb) + (o.bias || 0); c = this.shade(rp, clamp(s, 0, .999), x, y, o.dither); }
      this.fset(x, y, c);
    }
  }
  _capsule(x1, y1, x2, y2, r1, r2, rp, o) {
    o = o || {};
    const rm = Math.max(r1, r2), minx = Math.floor(Math.min(x1, x2) - rm), maxx = Math.ceil(Math.max(x1, x2) + rm);
    const miny = Math.floor(Math.min(y1, y2) - rm), maxy = Math.ceil(Math.max(y1, y2) + rm);
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1e-6;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const px = x + .5, py = y + .5;
      const t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
      const qx = x1 + dx * t, qy = y1 + dy * t, r = r1 + (r2 - r1) * t;
      const ex = px - qx, ey = py - qy, d2 = ex * ex + ey * ey;
      if (d2 > r * r) continue;
      let c;
      if (o.flat !== undefined) c = rp[o.flat];
      else {
        const nx = ex / r, ny = ey / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        c = this.shade(rp, clamp(this.lambert(nx, ny, nz, o.amb) + (o.bias || 0), 0, .999), x, y, o.dither);
      }
      this.fset(x, y, c);
    }
  }
  /* polygon fill; shading via o.flat index, or o.grad = [ax, ay, bx, by] (light at a, dark at b), or o.fn(x,y)->s */
  _poly(pts, rp, o) {
    o = o || {};
    let miny = 1e9, maxy = -1e9;
    for (const p of pts) { miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
    const g = o.grad, gl2 = g ? ((g[2] - g[0]) ** 2 + (g[3] - g[1]) ** 2) || 1 : 1;
    for (let y = Math.floor(miny); y <= Math.ceil(maxy); y++) {
      const sy = y + .5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + (sy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - .5); x <= Math.floor(xs[k + 1] - .5); x++) {
          let c;
          if (o.flat !== undefined) c = rp[o.flat];
          else if (g) { const t = clamp(((x + .5 - g[0]) * (g[2] - g[0]) + (sy - g[1]) * (g[3] - g[1])) / gl2, 0, 1); c = this.shade(rp, clamp((1 - t) * (o.hi || .95) + (o.lo || 0), 0, .999), x, y, o.dither); }
          else if (o.fn) c = this.shade(rp, clamp(o.fn(x / this.d, y / this.d), 0, .999), x, y, o.dither);
          else c = rp[rp.length >> 1];
          this.fset(x, y, c);
        }
      }
    }
  }
  _line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (let i = 0; i < 2000; i++) {
      this.fset(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  ellipse(cx, cy, rx, ry, rp, o) { const d = this.d; this._ellipse(cx * d, cy * d, rx * d, ry * d, rp, o); }
  capsule(x1, y1, x2, y2, r1, r2, rp, o) { const d = this.d; this._capsule(x1 * d, y1 * d, x2 * d, y2 * d, r1 * d, r2 * d, rp, o); }
  poly(pts, rp, o) {
    const d = this.d; o = o || {};
    const oo = o.grad ? Object.assign({}, o, { grad: o.grad.map(v => v * d) }) : o;
    this._poly(pts.map(([x, y]) => [x * d, y * d]), rp, oo);
  }
  line(x0, y0, x1, y1, c, th) {                     // thin line in fine pixels (th = logical thickness, default 1)
    const d = this.d, t = Math.max(1, Math.round((th || 1) * d));
    for (let k = 0; k < t; k++) this._line(x0 * d, y0 * d + k, x1 * d, y1 * d + k, c);
  }
  hair(x0, y0, x1, y1, c) { const d = this.d; this._line(x0 * d, y0 * d, x1 * d, y1 * d, c); }   // always 1 fine pixel
  /* Outline + rim light + flash/tint, written to the canvas. */
  finish(o) {
    o = o || {};
    const w = this.w, h = this.h, b = this.buf, out = this.out;
    const rim = o.rim || null, rimA = o.rimA || 0, fl = o.flash || 0, tint = o.tint || null, tintA = o.tintA || 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, c = b[i];
      if (!c) { out[i] = 0; continue; }
      let cc = c;
      if (rim && rimA) {
        const open = (x < w - 1 && !b[i + 1]) || (y > 0 && !b[i - w]);
        if (open) cc = mix32(cc, rim[0], rim[1], rim[2], rimA);
      }
      if (tint && tintA) cc = mix32(cc, tint[0], tint[1], tint[2], tintA);
      if (fl) cc = mix32(cc, 255, 255, 255, fl);
      out[i] = cc;
    }
    if (o.outline !== false) {                     // outline as thick as one logical pixel
      const src = this._src || (this._src = new Uint32Array(w * h));
      let first = true;
      for (let pass = 0; pass < this.d; pass++) {
        src.set(first ? b : out);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = y * w + x; if (src[i]) continue;
          let n = 0;
          if (x > 0 && src[i - 1]) n = src[i - 1]; else if (x < w - 1 && src[i + 1]) n = src[i + 1];
          else if (y > 0 && src[i - w]) n = src[i - w]; else if (y < h - 1 && src[i + w]) n = src[i + w];
          if (!n) continue;
          let oc;
          if (first) { const [r, g, bl] = unpack(n); oc = u32(r * .2 + 10 | 0, g * .16 + 6 | 0, bl * .28 + 18 | 0); if (fl) oc = mix32(oc, 255, 255, 255, fl); }
          else oc = n;
          out[i] = oc;
        }
        if (first) { first = false; for (let i = 0; i < w * h; i++) if (!b[i] && out[i]) b[i] = 0; }
      }
    }
    this.cx.putImageData(this.img, 0, 0);
    return this.cv;
  }
}
