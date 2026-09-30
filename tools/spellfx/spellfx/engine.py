"""Core of the spell renderer: timeline, particles, pixel canvas, lighting and HD-2D compositing.

The look comes from rendering in two resolutions at once, like HD-2D:
  * a low-res "pixel" layer (crisp squares after nearest-neighbour upscaling) for the scene,
    the sprite, pixel particles, rune circles and flame tongues;
  * a soft "glow" layer plus bloom that is upscaled smoothly, so light looks like it comes
    from a real 3D renderer sitting on top of the pixel art.
Spell lights tint the whole scene, and camera shake, screen flash and hit flashes sell impacts.
"""
import math

import numpy as np
from scipy.ndimage import gaussian_filter, zoom

W, H = 240, 160          # world (pixel-art) resolution
LIGHT_GAIN = .5          # spell light strength on the scene
GLOW_GAIN = .6           # soft glow layer strength


def rgb(h, k=1.0):
    """'#rrggbb' -> float RGB array, optionally scaled (values > 1 are HDR and bloom)."""
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32) * k


def ramp(*hexes, k=1.0):
    return [rgb(h, k) for h in hexes]


def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v


def lerp(a, b, t):
    return a + (b - a) * t


class Ease:
    out = staticmethod(lambda t: 1 - (1 - t) ** 2)
    inq = staticmethod(lambda t: t * t)
    outCubic = staticmethod(lambda t: 1 - (1 - t) ** 3)
    inCubic = staticmethod(lambda t: t ** 3)
    inOut = staticmethod(lambda t: 2 * t * t if t < .5 else 1 - 2 * (1 - t) ** 2)

    @staticmethod
    def outBack(t, c=1.9):
        return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2


def env(t, t0, t1, fade_in=0.1, fade_out=0.2):
    """Trapezoid envelope: 0 before t0, ramps up, holds, ramps down to 0 at t1."""
    if t <= t0 or t >= t1:
        return 0.0
    return min(1.0, (t - t0) / max(fade_in, 1e-6), (t1 - t) / max(fade_out, 1e-6))


# ----------------------------------------------------------------------------------------------
# Canvas: the per-frame drawing surface (all coordinates in world pixels)
# ----------------------------------------------------------------------------------------------
class Canvas:
    def __init__(self, base):
        self.base = base                                   # lit scene; 'normal' draws blend into it
        self.add = np.zeros((H, W, 3), np.float32)         # crisp additive pixels
        self.glow = np.zeros((H, W, 3), np.float32)        # soft additive light (blurred later)
        self.dark = np.zeros((H, W), np.float32)           # darkness (void magic)
        self.ui = np.zeros((H, W, 4), np.float32)          # crisp overlay drawn after bloom

    def _blend(self, layer, ys, xs, col, a):
        """a is a scalar or a mask shaped like the slice."""
        if layer == 'add':
            self.add[ys, xs] += col * (a[..., None] if np.ndim(a) else a)
        elif layer == 'glow':
            self.glow[ys, xs] += col * (a[..., None] if np.ndim(a) else a)
        elif layer == 'normal':
            aa = a[..., None] if np.ndim(a) else a
            self.base[ys, xs] += (col - self.base[ys, xs]) * aa
        elif layer == 'dark':
            self.dark[ys, xs] = np.minimum(1.0, self.dark[ys, xs] + a)
        elif layer == 'ui':
            aa = a[..., None] if np.ndim(a) else a
            self.ui[ys, xs, :3] += (col - self.ui[ys, xs, :3]) * aa
            self.ui[ys, xs, 3] = np.maximum(self.ui[ys, xs, 3], a)

    def rect(self, layer, x, y, w, h, col, a=1.0):
        x0, y0 = max(0, int(round(x))), max(0, int(round(y)))
        x1, y1 = min(W, int(round(x)) + int(w)), min(H, int(round(y)) + int(h))
        if x1 > x0 and y1 > y0 and a > 0:
            self._blend(layer, slice(y0, y1), slice(x0, x1), col, a)

    def px(self, layer, x, y, col, a=1.0, size=1):
        s = max(1, int(round(size)))
        self.rect(layer, x - (s >> 1), y - (s >> 1), s, s, col, a)

    def line(self, layer, x0, y0, x1, y1, col, a=1.0, th=1):
        n = max(1, int(math.ceil(max(abs(x1 - x0), abs(y1 - y0)))))
        for i in range(n + 1):
            u = i / n
            self.px(layer, lerp(x0, x1, u), lerp(y0, y1, u), col, a, th)

    def polyline(self, layer, pts, col, a=1.0, th=1):
        for p, q in zip(pts, pts[1:]):
            self.line(layer, p[0], p[1], q[0], q[1], col, a, th)

    def ring(self, layer, cx, cy, rx, ry, col, a=1.0, th=1, keep=None):
        n = max(16, int(2 * math.pi * max(rx, ry) * 1.3))
        for i in range(n):
            ang = i / n * 2 * math.pi
            if keep is None or keep(ang):
                self.px(layer, cx + math.cos(ang) * rx, cy + math.sin(ang) * ry, col, a, th)

    def disc(self, layer, cx, cy, rx, ry, col, a=1.0, soft=0.0):
        """Filled ellipse. soft=0 gives a hard pixel edge; soft=1 fades out from the centre."""
        if rx <= 0 or ry <= 0 or a <= 0:
            return
        x0, x1 = max(0, int(cx - rx - 1)), min(W, int(cx + rx + 2))
        y0, y1 = max(0, int(cy - ry - 1)), min(H, int(cy + ry + 2))
        if x1 <= x0 or y1 <= y0:
            return
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
        m = (d <= 1).astype(np.float32)
        if soft:
            m *= (1 - np.clip(d, 0, 1)) ** (1 + soft * 1.5)
        self._blend(layer, slice(y0, y1), slice(x0, x1), col, m * a)

    def poly(self, layer, pts, col, a=1.0):
        """Filled convex/concave polygon (even-odd rule), pixel exact."""
        pts = np.asarray(pts, np.float32)
        x0, x1 = max(0, int(pts[:, 0].min())), min(W, int(math.ceil(pts[:, 0].max())) + 1)
        y0, y1 = max(0, int(pts[:, 1].min())), min(H, int(math.ceil(pts[:, 1].max())) + 1)
        if x1 <= x0 or y1 <= y0 or a <= 0:
            return
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        xx += .5
        yy += .5
        inside = np.zeros(xx.shape, bool)
        n = len(pts)
        for i in range(n):
            (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % n]
            cond = (ya > yy) != (yb > yy)
            xint = (xb - xa) * (yy - ya) / ((yb - ya) + 1e-9) + xa
            inside ^= cond & (xx < xint)
        self._blend(layer, slice(y0, y1), slice(x0, x1), col, inside.astype(np.float32) * a)


# ----------------------------------------------------------------------------------------------
# Particles
# ----------------------------------------------------------------------------------------------
class Particle:
    __slots__ = ('x', 'y', 'vx', 'vy', 'ax', 'ay', 'drag', 'life', 'age', 'size', 'cols', 'layer',
                 'shape', 'glow', 'shrink', 'grow', 'fade', 'alpha', 'fn', 'streak', 'data')

    def __init__(self, x=0., y=0., vx=0., vy=0., ax=0., ay=0., drag=1., life=.5, size=1, cols=None,
                 layer='add', shape='sq', glow=.5, shrink=False, grow=0., fade=True, alpha=1., fn=None,
                 streak=.03, data=None):
        self.x, self.y, self.vx, self.vy, self.ax, self.ay = x, y, vx, vy, ax, ay
        self.drag, self.life, self.age, self.size = drag, life, 0., size
        self.cols = cols or [rgb('#ffffff')]
        self.layer, self.shape, self.glow, self.shrink, self.grow = layer, shape, glow, shrink, grow
        self.fade, self.alpha, self.fn, self.streak, self.data = fade, alpha, fn, streak, data

    def step(self, dt):
        self.age += dt
        if self.fn:
            self.fn(self, dt)
        self.vx += self.ax * dt
        self.vy += self.ay * dt
        if self.drag != 1:
            d = self.drag ** dt
            self.vx *= d
            self.vy *= d
        self.x += self.vx * dt
        self.y += self.vy * dt

    def draw(self, cv):
        k = self.age / self.life
        col = self.cols[min(len(self.cols) - 1, int(k * len(self.cols)))]
        a = self.alpha * (min(1., (1 - k) * 1.6) if self.fade else 1.)
        s = self.size * (1 - k * .7 if self.shrink else 1) + self.grow * k
        s = max(1, int(round(s)))
        x, y = self.x, self.y
        if self.shape == 'plus':
            cv.rect(self.layer, x - s, y, 2 * s + 1, 1, col, a)
            cv.rect(self.layer, x, y - s, 1, 2 * s + 1, col, a)
        elif self.shape == 'streak':
            cv.line(self.layer, x, y, x - self.vx * self.streak, y - self.vy * self.streak, col, a, s)
        elif self.shape == 'diamond':
            cv.px(self.layer, x, y, col, a, s)
            for dx, dy in ((-s, 0), (s, 0), (0, -s), (0, s)):
                cv.px(self.layer, x + dx * .6, y + dy * .6, col, a * .8)
        elif self.shape == 'soft':
            cv.disc(self.layer, x, y, s, s, col, a, soft=.6)
        else:
            cv.px(self.layer, x, y, col, a, s)
        if self.glow and self.layer == 'add':
            cv.px('glow', x, y, col, a * self.glow, s + 1)


# ----------------------------------------------------------------------------------------------
# World: the spell timeline and everything it drives
# ----------------------------------------------------------------------------------------------
class Light:
    def __init__(self, x, y, r, col, inten, t0, dur, attack=.05, flicker=0., curve=1.5):
        self.x, self.y, self.r, self.col, self.inten = x, y, r, col, inten
        self.t0, self.dur, self.attack, self.flicker, self.curve = t0, dur, attack, flicker, curve

    def level(self, t, rng):
        a = t - self.t0
        if a < 0 or a > self.dur:
            return 0.
        e = min(1., a / max(self.attack, 1e-6)) * (1 - a / self.dur) ** self.curve
        if self.flicker:
            e *= 1 - self.flicker * rng.random()
        return e * self.inten


class World:
    def __init__(self, scene, duration=2.8, fps=25, seed=7):
        self.scene = scene
        self.fps, self.dt = fps, 1. / fps
        self.duration = duration
        self.nframes = int(round(duration * fps))
        self.rng = np.random.default_rng(seed)
        self.t = 0.
        self.parts, self.lights, self.texts = [], [], []
        self.events, self.emitters, self.shapes = [], [], []
        self.shake = 0.
        self.flash, self.flash_col = 0., rgb('#ffffff')
        self.ambient_fns = []          # callables t -> multiplier on ambient light
        self.hitstop = []              # (t0, t1) ranges where the simulation freezes

    # --- random helpers -------------------------------------------------------------------
    def rnd(self, a=0., b=1.):
        return a + (b - a) * self.rng.random()

    def gauss(self, s=1.):
        return float(self.rng.normal()) * s

    def pick(self, seq):
        return seq[int(self.rng.integers(len(seq)))]

    # --- scheduling -----------------------------------------------------------------------
    def at(self, t, fn):
        self.events.append([t, fn, False])

    def during(self, t0, t1, fn):
        """fn(world, k) every frame while t0 <= t < t1 (k goes 0 -> 1)."""
        self.emitters.append((t0, t1, fn))

    def shape(self, t0, dur, fn, order=0):
        """fn(canvas, k, age) draws every frame for dur seconds. Lower order draws first."""
        self.shapes.append((order, t0, dur, fn))

    def light(self, x, y, r, col, inten, t0, dur, **kw):
        L = Light(x, y, r, col, inten, t0, dur, **kw)
        self.lights.append(L)
        return L

    def part(self, **kw):
        p = Particle(**kw)
        self.parts.append(p)
        return p

    def ambient(self, fn):
        self.ambient_fns.append(fn)

    def freeze(self, t0, ms):
        """Hit-stop: particles and shapes pause for ms milliseconds (the scene keeps its flash)."""
        self.hitstop.append((t0, t0 + ms / 1000.))

    # --- impact helpers -------------------------------------------------------------------
    def do_shake(self, a):
        self.shake = max(self.shake, a)

    def do_flash(self, a, col='#ffffff'):
        self.flash = max(self.flash, a)
        self.flash_col = rgb(col) if isinstance(col, str) else col

    def damage(self, value, x, y, col='#ffffff', delay=0.):
        self.texts.append(dict(text=str(value), x=x, y=y, t0=self.t + delay, col=rgb(col) if isinstance(col, str) else col))

    # --- simulation -----------------------------------------------------------------------
    def _frozen(self, t):
        return any(a <= t < b for a, b in self.hitstop)

    def frames(self, scale=3, background=True):
        """Yield (H*scale, W*scale, 3) uint8 frames."""
        sim_t = 0.          # "game clock" (stops during hit-stop), shapes and effects follow it
        for i in range(self.nframes):
            real_t = i * self.dt
            self.t = sim_t
            for ev in self.events:
                if not ev[2] and ev[0] <= sim_t + 1e-6:
                    ev[2] = True
                    ev[1](self)
            if not self._frozen(real_t):
                for t0, t1, fn in self.emitters:
                    if t0 <= sim_t < t1:
                        fn(self, (sim_t - t0) / (t1 - t0))
                for p in self.parts:
                    p.step(self.dt)
                self.parts = [p for p in self.parts if p.age < p.life]
            yield self._render(sim_t, real_t, scale, background)
            if not self._frozen(real_t):
                sim_t += self.dt
            self.flash *= .6
            self.shake *= .78
            self.scene.target.tick(self.dt)

    # --- rendering ------------------------------------------------------------------------
    def _render(self, t, real_t, scale, background):
        sc = self.scene
        albedo = sc.backdrop.copy() if background else np.zeros((H, W, 3), np.float32)
        tmask = sc.target.draw(albedo, t) if sc.target else None

        # lighting: ambient * multipliers + coloured spell lights (ground-plane squashed)
        amb = sc.ambient.copy() if background else np.ones(3, np.float32)
        for f in self.ambient_fns:
            amb = amb * f(t)
        light_map = np.broadcast_to(amb, (H, W, 3)).copy()
        yy, xx = sc.grid
        for L in self.lights:
            lv = L.level(t, self.rng)
            if lv <= 0:
                continue
            d2 = ((xx - L.x) ** 2 + ((yy - L.y) * 1.7) ** 2) / (L.r * L.r)
            fall = np.exp(-d2 * 2.2) + .07      # the constant tints the whole scene with the spell colour
            light_map += fall[..., None] * (L.col * lv * LIGHT_GAIN)
        base = albedo * light_map if background else albedo

        if tmask is not None and sc.target.flash > 0:       # white hit flash on the sprite
            f = sc.target.flash * tmask[..., None]
            base += (sc.target.flash_col * 1.4 - base) * f

        cv = Canvas(base)
        for order, t0, dur, fn in sorted(self.shapes, key=lambda s: s[0]):
            if t0 <= t < t0 + dur:
                fn(cv, (t - t0) / dur, t - t0)
        for p in self.parts:
            p.draw(cv)
        self._draw_texts(cv, real_t)

        low = cv.base * (1 - cv.dark[..., None] * .92) + cv.add
        soft = (gaussian_filter(cv.glow, (2.2, 2.2, 0)) + gaussian_filter(cv.glow, (7, 7, 0)) * .6) * GLOW_GAIN
        bright = np.maximum(low - .85, 0)
        soft += gaussian_filter(bright, (1.6, 1.6, 0)) * .4 + gaussian_filter(bright, (6, 6, 0)) * .35

        # camera shake (whole-pixel offsets keep the pixel grid crisp)
        if self.shake > .3:
            dx = int(round(self.gauss(self.shake)))
            dy = int(round(self.gauss(self.shake * .6)))
            low, soft = _shift(low, dx, dy), _shift(soft, dx, dy)
            ui = _shift(cv.ui, dx, dy)
        else:
            ui = cv.ui

        hi = np.repeat(np.repeat(low, scale, 0), scale, 1)
        hi += zoom(soft, (scale, scale, 1), order=1)
        if self.flash > .01:
            hi += self.flash_col * self.flash
        hi = _tonemap(hi)
        if background:
            hi *= sc.vignette(scale)
        uih = np.repeat(np.repeat(ui, scale, 0), scale, 1)
        hi = hi * (1 - uih[..., 3:]) + uih[..., :3] * uih[..., 3:]
        return (np.clip(hi, 0, 1) * 255 + .5).astype(np.uint8)

    def _draw_texts(self, cv, t):
        for tx in self.texts:
            a = t - tx['t0']
            if a < 0 or a > 1.1:
                continue
            # pop up, bounce twice, hold, fade
            if a < .12:
                oy = -14 * Ease.outCubic(a / .12)
            elif a < .3:
                oy = -14 + 14 * Ease.inq((a - .12) / .18)
            elif a < .42:
                u = (a - .3) / .12
                oy = -5 * math.sin(u * math.pi)
            else:
                oy = 0
            alpha = 1 if a < .85 else 1 - (a - .85) / .25
            draw_text(cv, tx['text'], tx['x'], tx['y'] + oy, tx['col'], alpha)


def _shift(a, dx, dy):
    if dx == 0 and dy == 0:
        return a
    pad = [(abs(dy), abs(dy)), (abs(dx), abs(dx))] + [(0, 0)] * (a.ndim - 2)
    p = np.pad(a, pad, mode='edge')
    y0, x0 = abs(dy) - dy, abs(dx) - dx
    return p[y0:y0 + a.shape[0], x0:x0 + a.shape[1]]


def _tonemap(x):
    """Hot colours bleed toward white (fire cores), then a soft shoulder instead of hard clipping."""
    over = np.maximum(x.max(axis=2, keepdims=True) - 1, 0)
    x = x + over * .45
    knee = .78
    return np.where(x < knee, x, knee + (1 - knee) * (1 - np.exp(-(x - knee) / (1 - knee))))


# ----------------------------------------------------------------------------------------------
# Tiny pixel font for damage numbers (5x7, drawn with a 1px dark outline)
# ----------------------------------------------------------------------------------------------
_FONT = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
    '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
}


def draw_text(cv, text, cx, cy, col, alpha=1.0):
    w = len(text) * 6 - 1
    x0, y0 = int(round(cx - w / 2)), int(round(cy - 3))
    outline = np.array([.08, .05, .1], np.float32)
    shade = col * .62
    for pass_ in (0, 1):
        for i, ch in enumerate(text):
            g = _FONT.get(ch)
            if not g:
                continue
            for r, row in enumerate(g):
                for c, bit in enumerate(row):
                    if bit != '1':
                        continue
                    x, y = x0 + i * 6 + c, y0 + r
                    if pass_ == 0:
                        for dx in (-1, 0, 1):
                            for dy in (-1, 0, 1):
                                cv.rect('ui', x + dx, y + dy, 1, 1, outline, alpha)
                    else:
                        cv.rect('ui', x, y, 1, 1, col if r < 4 else shade, alpha)
