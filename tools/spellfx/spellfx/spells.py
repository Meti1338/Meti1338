"""Spell library. Each spell is a function that schedules effects on a World timeline.

Every spell follows the HD-2D battle rhythm from docs/ART_STYLE.md:
  1. anticipation - a rune circle opens and motes gather;
  2. action       - the element effect is released;
  3. impact       - hit-stop, screen flash, shake, white sprite flash, sparks, damage number;
  4. linger       - embers, mist, shards or dust drift away while the light fades.
"""
import math

import numpy as np

from .engine import Ease, clamp, lerp, ramp, rgb

SQ = .36          # ground-plane squash for anything lying on the floor

FIRE = ramp('#fffef0', '#fff4b0', '#ffd860', '#ffac38', '#f47020', '#d2401a', '#8a2014', k=1.25)
FIRE_PX = ramp('#fffef0', '#fff4b0', '#ffd860', '#ffac38', '#f47020', '#d2401a', '#8a2014')
SMOKE = ramp('#5a4640', '#4a3c3a', '#3a3234')


# ----------------------------------------------------------------------------------------------
# Shared building blocks
# ----------------------------------------------------------------------------------------------
_GLYPHS = [
    ['111', '010', '010'], ['101', '010', '101'], ['110', '011', '010'], ['010', '111', '010'],
    ['100', '111', '001'], ['011', '010', '110'], ['111', '101', '010'], ['010', '101', '111'],
]


def magic_circle(w, x, y, r, col, t0, t1, motes=True):
    """Rotating ground rune circle: outer rings, glyph band, hexagram, inner ring, rising motes."""
    col = rgb(col) if isinstance(col, str) else col
    white = rgb('#ffffff')

    def draw(cv, k, age):
        dur = t1 - t0
        g = Ease.outBack(clamp(age / .28)) * clamp((dur - age) / .25)
        if g <= 0:
            return
        R, rot = r * g, age * 1.1
        a = clamp(g)
        cv.ring('add', x, y, R, R * SQ, col * 1.3, a)
        cv.ring('add', x, y, R * .86, R * .86 * SQ, col, a * .8)
        cv.ring('glow', x, y, R, R * SQ, col, a * .35, th=2)
        for i in range(14):                                   # glyph band between the rings
            ang = i / 14 * 2 * math.pi + rot
            gx, gy = x + math.cos(ang) * R * .93, y + math.sin(ang) * R * .93 * SQ
            gl = _GLYPHS[(i * 5) % len(_GLYPHS)]
            for rr, row in enumerate(gl):
                for cc, bit in enumerate(row):
                    if bit == '1' and (rr < 2 or math.sin(ang) > -.2):
                        cv.px('add', gx + cc - 1, gy + (rr - 1) * .7, col * 1.1, a * .9)
        pts = []
        for i in range(6):                                    # hexagram, counter-rotating
            ang = i / 6 * 2 * math.pi - rot * 1.4
            pts.append((x + math.cos(ang) * R * .78, y + math.sin(ang) * R * .78 * SQ))
        for i in range(6):
            p, q = pts[i], pts[(i + 2) % 6]
            cv.line('add', p[0], p[1], q[0], q[1], col, a * .7)
        cv.ring('add', x, y, R * .28, R * .28 * SQ, white * .9, a)
        cv.disc('glow', x, y, R * 1.1, R * 1.1 * SQ, col, a * .35, soft=1)
        for i in range(int(R * 1.8)):                         # faint column of light above the circle
            yy = y - i
            cv.rect('glow', x - R * .8, yy, R * 1.6, 1, col, a * .12 * (1 - i / (R * 1.8)))

    w.shape(t0, t1 - t0, draw, order=-10)
    w.light(x, y - 6, r * 3.2, col, .9, t0, t1 - t0 + .1, attack=.25, curve=.3)
    if motes:
        def emit(w, k):
            for _ in range(2):
                ang = w.rnd(0, 2 * math.pi)
                w.part(x=x + math.cos(ang) * r * .9, y=y + math.sin(ang) * r * .9 * SQ, vy=-w.rnd(15, 32),
                       life=w.rnd(.35, .8), cols=[rgb('#ffffff'), col * 1.2, col], size=1, glow=.8)
        w.during(t0 + .1, t1 - .2, emit)


def gather(w, x, y, col, t0, t1, radius=30, rate=3):
    """Motes streaking inward to a point (spell charge) with a growing core glow."""
    col = rgb(col) if isinstance(col, str) else col

    def emit(w, k):
        for _ in range(rate):
            ang, d = w.rnd(0, 2 * math.pi), w.rnd(radius * .6, radius)
            sx, sy = x + math.cos(ang) * d, y + math.sin(ang) * d * .8
            life = w.rnd(.22, .32)
            w.part(x=sx, y=sy, vx=(x - sx) / life, vy=(y - sy) / life, life=life, shape='streak', streak=.04,
                   cols=[col, col * 1.3, rgb('#ffffff')], size=1, glow=.9)

    w.during(t0, t1, emit)

    def core(cv, k, age):
        cv.disc('glow', x, y, 3 + k * 9, 3 + k * 9, col, .6 + k * .8, soft=1)
        cv.px('add', x, y, rgb('#ffffff'), .5 + k * .5, 1 + int(k * 2.5))
    w.shape(t0, t1 - t0, core)


def shockwave(w, x, y, t0, dur, rmax, col, th=2, sq=SQ):
    col = rgb(col) if isinstance(col, str) else col

    def draw(cv, k, age):
        R = 4 + rmax * Ease.outCubic(k)
        cv.ring('add', x, y, R, R * sq, col, (1 - k) * 1.2, th=max(1, round(th * (1 - k * .6))))
        cv.ring('glow', x, y, R, R * sq, col, (1 - k) * .6, th=th + 1)
    w.shape(t0, dur, draw)


def burst_star(w, x, y, t0, size, col):
    """Crisp pixel star lines + expanding ring at the hit point."""
    col = rgb(col) if isinstance(col, str) else col

    def draw(cv, k, age):
        L = size * (k / .25 if k < .25 else 1 - (k - .25) / .75) * 1.5
        c = rgb('#ffffff') * 1.3
        cv.line('add', x - L, y, x + L, y, c)
        cv.line('add', x, y - L * .8, x, y + L * .8, c)
        cv.line('add', x - L * .45, y - L * .45, x + L * .45, y + L * .45, col)
        cv.line('add', x - L * .45, y + L * .45, x + L * .45, y - L * .45, col)
        cv.ring('add', x, y, size * .3 + k * size * 1.5, size * .3 + k * size * 1.3, col, 1 - k)
        cv.disc('glow', x, y, size * 1.8, size * 1.8, col, (1 - k) ** 2 * .8, soft=1)
    w.shape(t0, .24, draw, order=5)


def sparks(w, x, y, n, cols, speed=90, up=40, grav=260, life=(.2, .5), size=(1, 2)):
    for _ in range(n):
        ang = w.rnd(0, 2 * math.pi)
        v = w.rnd(.4, 1.) * speed
        w.part(x=x, y=y, vx=math.cos(ang) * v, vy=math.sin(ang) * v - up, ay=grav, drag=.08,
               life=w.rnd(*life), cols=cols, size=int(round(w.rnd(*size))), shape='streak', streak=.025, glow=.8)


def hit(w, t, x, y, col, dmg, strength=1., flash=.45, shake=3., freeze_ms=70, dmg_col='#ffffff', dmg_dy=-56, dmg_dx=None):
    """The impact beat: hit-stop, flash, shake, sprite flash, star and damage number."""
    def fire(w):
        w.freeze(w.t, freeze_ms)
        w.do_flash(flash, col)
        w.do_shake(shake)
        w.scene.target.hit(strength)
        burst_star(w, x, y, w.t, 9 * strength, rgb(col))
        if dmg is not None:
            dx = w.rnd(-6, 6) if dmg_dx is None else dmg_dx
            w.damage(dmg, w.scene.target.x + dx, w.scene.target.y + dmg_dy, dmg_col)
    w.at(t, fire)


# ----------------------------------------------------------------------------------------------
# Spells
# ----------------------------------------------------------------------------------------------
def fire(w):
    """Flame Pillar: a column of pixel flame tongues erupts from the rune circle."""
    tg = w.scene.target
    x, y = tg.x, tg.y
    orange = rgb('#ff7a2a')
    magic_circle(w, x, y, 30, orange, .05, 1.25)
    gather(w, x, y - 16, rgb('#ffb040'), .35, .95, radius=34)
    T = 1.0

    def pillar(cv, k, age):
        dur = 1.0
        e = Ease.outBack(clamp(age / .14)) * clamp((dur - age) / .3)
        if e <= 0:
            return
        Hh, W0 = 78, 15
        for i in range(5):
            th = Hh * e * (.55 + .45 * abs(math.sin(i * 1.9 + 1))) * (.9 + .1 * math.sin(age * 18 + i))
            cx0 = x + (i - 2) * W0 * .42
            for yy in range(int(th)):
                u = yy / th
                wd = W0 * (.55 + .2 * math.sin(i)) * (1 - u) ** .75 * (1 + .15 * math.sin(age * 20 + yy * .4 + i))
                cx = cx0 + math.sin(yy * .22 - age * 18 + i * 2) * 2.4 * u
                ci = int(clamp(1.3 + u * 4.6 + abs(i - 2) * .7 + math.sin(yy * .5 + age * 25) * .3, 0, len(FIRE) - 1))
                cv.rect('normal', cx - wd, y - yy, max(1, round(wd * 2)), 1, FIRE_PX[ci], .95)
                if ci < 2:
                    cv.rect('add', cx - wd, y - yy, max(1, round(wd * 2)), 1, FIRE_PX[ci], .35)
                if yy % 2 == 0:
                    cv.rect('glow', cx - wd, y - yy, max(1, round(wd * 2)), 1, FIRE_PX[min(ci + 1, 6)], .15)
    w.shape(T, 1.0, pillar, order=4)

    def flames(w, k):
        for _ in range(8):
            w.part(x=x + w.gauss(10), y=y - w.rnd(2, 45), vx=w.gauss(8), vy=-w.rnd(40, 80), life=w.rnd(.3, .6),
                   size=int(w.rnd(2, 5)), cols=FIRE[2:], shrink=True, glow=.3,
                   fn=lambda p, dt: setattr(p, 'vx', p.vx + math.sin((p.age * 9 + p.y * .1)) * 60 * dt))
        if w.rng.random() < .6:
            w.part(x=x + w.gauss(10), y=y - w.rnd(35, 60), vx=w.gauss(5), vy=-w.rnd(10, 22), life=1.1,
                   size=3, grow=5, cols=SMOKE, layer='normal', alpha=.5, glow=0, shape='soft')
    w.during(T, T + .85, flames)

    def embers(w):
        for _ in range(40):
            w.part(x=x + w.gauss(12), y=y - w.rnd(0, 40), vx=w.gauss(30), vy=-w.rnd(15, 45), ay=-8, drag=.5,
                   life=w.rnd(.8, 1.5), cols=ramp('#fff4b0', '#ffb040', '#ff6a20', k=1.2), size=1, glow=1.)
    w.at(T + .15, embers)

    w.shape(T, 1.6, lambda cv, k, a: cv.disc('normal', x, y + 1, 20 * (1 - k * .3), 6, rgb('#1e0e0a'), .5 * (1 - k)), order=-20)
    w.shape(T, 1.2, lambda cv, k, a: cv.disc('glow', x, y - 30, 26, 44, rgb('#ff6a20'), clamp(1 - k) * .8, soft=1))
    shockwave(w, x, y, T, .45, 40, rgb('#ffa050'))
    w.light(x, y - 20, 90, rgb('#ff7a2a'), 2.2, T, 1.5, attack=.04, flicker=.12)
    hit(w, T + .04, x, y - 16, '#ff9a40', 1874, strength=1.2, flash=.5, shake=4)
    w.at(T + .06, lambda w: sparks(w, x, y - 14, 26, FIRE[1:], speed=120))


def ice(w):
    """Glacial Spikes: crystal shards burst out of the ground around the target, then shatter."""
    tg = w.scene.target
    x, y = tg.x, tg.y
    cyan = rgb('#6ad0ff')
    magic_circle(w, x, y, 30, cyan, .05, 1.1)
    gather(w, x, y - 16, rgb('#bdf0ff'), .35, .95, radius=34)
    T, SHATTER = 1.0, 1.75

    def mist(w, k):
        if w.rng.random() < .45:
            ang = w.rnd(0, 2 * math.pi)
            w.part(x=x + math.cos(ang) * 16, y=y + 2 + math.sin(ang) * 5, vx=math.cos(ang) * w.rnd(15, 35),
                   vy=math.sin(ang) * 4, drag=.4, life=w.rnd(.9, 1.4), size=2, grow=4, shape='soft',
                   cols=ramp('#d8f4ff', '#a8d8f0'), layer='normal', alpha=.14, glow=0)
    w.during(.3, 2.4, mist)

    # shard layout: (x offset, lean, height, half width, delay); back row first, front row last
    shards = []
    for i, (ox, lean, h, hw) in enumerate([
            (-20, -.5, 22, 4), (18, .45, 26, 4.5), (-8, -.2, 36, 5), (7, .25, 32, 5), (0, 0, 48, 6.5),
            (-27, -.75, 16, 3.5), (26, .7, 17, 3.5), (-14, -.35, 26, 4.5), (13, .4, 22, 4)]):
        shards.append((ox, lean, h, hw, i * .025, 0 if i < 5 else 1))
    face_l, face_r = rgb('#b4e4ff'), rgb('#3a70c4')
    edge, dark_edge = rgb('#ffffff'), rgb('#274a8a')

    def draw_shard(cv, sx, sy, lean, h, hw, g, crack):
        tip = (sx + lean * h, sy - h * g)
        bl, br, bm = (sx - hw, sy + 1), (sx + hw, sy + 1), (sx + hw * .15, sy + 2)
        mid = (sx + lean * h * .55 + hw * .1, sy - h * g * .55)
        cv.poly('normal', [bl, tip, mid, bm], face_l, .92)
        cv.poly('normal', [bm, mid, tip, br], face_r, .92)
        cv.line('add', bl[0], bl[1], tip[0], tip[1], edge * .9, .9)
        cv.line('add', br[0], br[1], tip[0], tip[1], dark_edge, .6)
        cv.line('add', mid[0], mid[1], tip[0], tip[1], edge * .6, .6)
        cv.line('glow', bl[0], bl[1], tip[0], tip[1], cyan, .25, th=2)
        if crack:
            cv.line('add', lerp(bl[0], tip[0], .3), lerp(bl[1], tip[1], .3), mid[0], mid[1], edge * 1.3, crack)

    def spikes_back(cv, k, age):
        _draw_spikes(cv, age, 0)

    def spikes_front(cv, k, age):
        _draw_spikes(cv, age, 1)

    def _draw_spikes(cv, age, row):
        for ox, lean, h, hw, d, r in shards:
            if r != row:
                continue
            g = Ease.outBack(clamp((age - d) / .12), 2.4)
            if g <= 0:
                continue
            crack = clamp((age - (SHATTER - T - .25)) / .25)
            draw_shard(cv, x + ox, y + (2 if r else -1), lean, h, hw, g, crack)
    w.shape(T, SHATTER - T, spikes_back, order=-5)
    w.shape(T, SHATTER - T, spikes_front, order=6)
    w.shape(T, .6, lambda cv, k, a: cv.disc('glow', x, y - 20, 28, 34, cyan, (1 - k) ** 2 * .7, soft=1))

    def sparkle(w, k):
        for _ in range(2):
            w.part(x=x + w.gauss(18), y=y - w.rnd(0, 46), life=w.rnd(.2, .4), shape='plus', size=int(w.rnd(1, 3)),
                   cols=[rgb('#ffffff', 1.4), cyan], glow=.3)
    w.during(T + .1, SHATTER, sparkle)

    def shatter(w):
        w.do_flash(.25, '#c8f0ff')
        w.do_shake(3)
        w.scene.target.hit(.6)
        for ox, lean, h, hw, d, r in shards:
            for _ in range(int(h * .6)):
                u = w.rnd(0, 1)
                px, py = x + ox + lean * h * u + w.gauss(1.5), y - h * u
                ang = math.atan2(py - (y - 20), px - x) + w.gauss(.4)
                v = w.rnd(40, 130)
                w.part(x=px, y=py, vx=math.cos(ang) * v, vy=math.sin(ang) * v - 50, ay=320, drag=.5,
                       life=w.rnd(.35, .8), size=int(w.rnd(1, 3)), cols=[rgb('#ffffff', 1.3), face_l, face_r],
                       glow=.25, shape='diamond' if w.rng.random() < .3 else 'sq')
        for _ in range(18):
            w.part(x=x + w.gauss(16), y=y - w.rnd(0, 40), life=w.rnd(.3, .6), shape='plus', size=2,
                   cols=[rgb('#ffffff', 1.5), cyan], glow=.3)
        w.damage(638, x + 8, y - 60, '#bdf0ff')
    w.at(SHATTER, shatter)
    shockwave(w, x, y, T, .4, 38, cyan)
    shockwave(w, x, y, SHATTER, .35, 30, rgb('#ffffff'), th=1)
    w.light(x, y - 20, 90, rgb('#7aa8ff'), 1.6, T, 1.8, attack=.05, curve=1.2)
    w.light(x, y - 20, 70, rgb('#b0c8ff'), 1.0, SHATTER, .5)
    hit(w, T + .06, x, y - 16, '#9ae0ff', 1206, strength=1., flash=.4, shake=3.5)


def _bolt(w, x0, y0, x1, y1, rough=14, depth=5):
    pts = [(x0, y0), (x1, y1)]
    for d in range(depth):
        new = [pts[0]]
        for p, q in zip(pts, pts[1:]):
            mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
            new += [(mx + w.gauss(rough / (1.7 ** d)), my + w.gauss(rough * .15 / (1.7 ** d))), q]
        pts = new
    return pts


def lightning(w):
    """Thunderclap: the sky darkens, static crackles, then a jagged bolt slams into the target."""
    tg = w.scene.target
    x, y = tg.x, tg.y
    yellow, violet = rgb('#ffe860'), rgb('#b890ff')
    magic_circle(w, x, y, 28, violet, .05, 1.2)
    w.ambient(lambda t: 1 - .6 * clamp(t / .6) * clamp((2.2 - t) / .5) if t < 2.2 else 1.)
    T = 1.0

    def cloud(cv, k, age):                 # dark storm glow gathering above the frame
        a = clamp(age / .5) * clamp((1.9 - age) / .4)
        cv.disc('normal', x, -4, 130, 34, rgb('#141026'), .8 * a, soft=.4)
        cv.disc('glow', x, 2, 30, 10, violet, .5 * a * (.6 + .4 * math.sin(age * 40)), soft=1)
    w.shape(.2, 1.9, cloud, order=-15)

    def static(w, k):
        if w.rng.random() < .5:
            sx, sy = x + w.gauss(20), y - w.rnd(0, 36)
            pts = _bolt(w, sx, sy, sx + w.gauss(8), sy + w.gauss(8), rough=4, depth=3)
            w.shape(w.t, .08, lambda cv, k, a, pts=pts: cv.polyline('add', pts, yellow * 1.3, 1 - k))
    w.during(.4, T, static)
    gather(w, x, 4, yellow, .5, T, radius=26, rate=2)

    bolts = {}

    def main_bolt(cv, k, age):
        f = int(age / .06)
        if f not in bolts:
            bolts[f] = (_bolt(w, x + w.gauss(10), -4, x, y - 10),
                        [_bolt(w, x + w.gauss(6), 30 + w.rnd(0, 40), x + w.gauss(40), y - w.rnd(0, 30), rough=8, depth=4)
                         for _ in range(2)])
        main, branches = bolts[f]
        a = 1 if age < .22 else clamp(1 - (age - .22) / .2)
        if int(age * 50) % 3 == 2 and age > .12:
            a *= .35
        cv.polyline('glow', main, violet, .5 * a, th=3)
        cv.polyline('add', main, violet * 1.2, a * .8, th=3)
        cv.polyline('add', main, yellow * 1.2, a, th=2)
        cv.polyline('add', main, rgb('#ffffff') * 1.3, a, th=1)
        for b in branches:
            cut = b[:len(b) // 2 + 3]
            cv.polyline('add', cut, yellow * 1.2, a * .8)
            cv.polyline('glow', cut, violet, a * .25, th=2)
    w.shape(T, .45, main_bolt, order=8)

    w.at(T, lambda w: w.do_flash(.75, '#f0e8ff'))
    w.at(T + .12, lambda w: w.do_flash(.4, '#e8d8ff'))
    hit(w, T + .02, x, y - 12, '#ffe860', 2310, strength=1.3, flash=.3, shake=5.5, freeze_ms=110)
    w.at(T + .05, lambda w: sparks(w, x, y - 10, 34, ramp('#ffffff', '#fff4a0', '#ffe060', '#c890ff', k=1.3), speed=150))
    shockwave(w, x, y, T, .5, 46, yellow, th=2)

    def ground_arcs(w, k):
        for _ in range(2):
            ang = w.rnd(0, 2 * math.pi)
            d0, d1 = w.rnd(4, 12), w.rnd(18, 42)
            pts = _bolt(w, x + math.cos(ang) * d0, y + math.sin(ang) * d0 * SQ,
                        x + math.cos(ang) * d1, y + math.sin(ang) * d1 * SQ, rough=5, depth=3)
            col = w.pick([yellow, violet * 1.3, rgb('#ffffff')])
            w.shape(w.t, .1, lambda cv, k, a, pts=pts, col=col: (cv.polyline('add', pts, col, 1 - k),
                                                                 cv.polyline('glow', pts, col, (1 - k) * .6, th=2)))
    w.during(T + .05, T + .9, ground_arcs)

    def motes(w, k):
        w.part(x=x + w.gauss(14), y=y - w.rnd(0, 30), vx=w.gauss(10), vy=-w.rnd(5, 20), life=w.rnd(.3, .6),
               shape='plus', size=1, cols=[rgb('#ffffff', 1.3), yellow, violet], glow=1.)
    w.during(T + .1, T + 1.2, motes)
    w.light(x, y - 30, 110, rgb('#e8e0ff'), 2.2, T, .7, attack=.01, flicker=.5, curve=1.2)
    w.light(x, y - 10, 70, violet, 1.2, T, 1.3, flicker=.3)


def wind(w):
    """Gale Vortex: leaves spiral in, a tornado of pixel streaks forms, three wind slashes hit."""
    tg = w.scene.target
    x, y = tg.x, tg.y
    green, pale = rgb('#7af0a8'), rgb('#e6ffee')
    magic_circle(w, x, y, 30, green, .05, 1.2)
    leaf_cols = [ramp(c) for c in ('#b8f080', '#80d060', '#f0e070', '#5ea040')]
    T, END = .85, 2.05

    def leaves_in(w, k):
        for _ in range(2):
            a0, r0, h0 = w.rnd(0, 2 * math.pi), w.rnd(40, 70), w.rnd(0, 40)
            spd = w.rnd(4, 6)

            def spiral(p, dt, a0=a0, r0=r0, h0=h0, spd=spd):
                u = p.age / p.life
                ang = a0 + p.age * spd
                r = r0 * (1 - u * .8)
                p.x, p.y, p.vx, p.vy = x + math.cos(ang) * r, y - h0 * (1 - u * .5) + math.sin(ang) * r * .3, 0, 0
            w.part(life=1.2, cols=w.pick(leaf_cols), size=int(w.rnd(2, 4)), layer='normal', glow=0, fade=False, fn=spiral)
    w.during(.2, 1.9, leaves_in)

    def tornado(front):
        def draw(cv, k, age):
            e = clamp(age / .18) * clamp((END - T - age) / .25)
            if e <= 0:
                return
            for i in range(9):
                h = i * 7.5
                R = (6 + i * 3.4) * (.7 + .3 * e)
                cx, cy = x + math.sin(age * 8 + i * .7) * 2.5, y - h
                spd = age * 16 * (1 + i * .08)
                col = pale * 1.2 if front else green * .8
                keep = (lambda ang, i=i, spd=spd: (math.sin(ang) > 0) == front and math.sin(ang * 2 + spd + i) > -.1)
                cv.ring('add', cx, cy, R, R * .3, col, e * (.9 if front else .5), keep=keep)
                if front:
                    cv.ring('glow', cx, cy, R, R * .3, green, e * .25, th=2, keep=keep)
        return draw
    w.shape(T, END - T, tornado(False), order=-5)
    w.shape(T, END - T, tornado(True), order=6)
    w.shape(T, END - T, lambda cv, k, a: cv.disc('glow', x, y - 30, 34, 44, green, math.sin(k * math.pi) * .45, soft=1))

    def dust(w, k):
        for _ in range(2):
            ang = w.rnd(0, 2 * math.pi)
            w.part(x=x + math.cos(ang) * 14, y=y + math.sin(ang) * 4, vx=math.cos(ang) * w.rnd(30, 70), vy=-w.rnd(10, 40),
                   ay=60, drag=.3, life=w.rnd(.5, .9), size=int(w.rnd(1, 3)), cols=ramp('#c8a878', '#9a7a58', '#6a5440'),
                   layer='normal', alpha=.8, glow=0)
    w.during(T, END - .2, dust)

    def slash(t0, a0, a1, cy, flip):
        def draw(cv, k, age):
            r, sq, wd = 26, .45, 3
            sweep = Ease.outCubic(clamp(k / .4))
            fade = 1 if k < .4 else 1 - (k - .4) / .6
            head = a0 + (a1 - a0) * sweep
            tail = a0 + (a1 - a0) * max(0, sweep - .75 + (max(0, k - .4) * 1.2))
            n = int(abs(head - tail) * r * 1.4) + 2
            for i in range(n + 1):
                u = i / n
                ang = tail + (head - tail) * u
                px, py = x + math.cos(ang) * r * flip, cy + math.sin(ang) * r * sq
                th = max(1, round(wd * math.sin(u * math.pi * .92 + .1) * fade))
                cv.px('add', px, py, green, .35, th + 2)
                cv.px('add', px, py, rgb('#ffffff') * 1.2, .8, th)
                if i % 3 == 0:
                    cv.px('glow', px, py, green, .12, th + 2)
        w.shape(t0, .3, draw, order=9)

    for i, (dt, cy, flip) in enumerate([(.2, y - 22, 1), (.45, y - 12, -1), (.7, y - 26, 1)]):
        slash(T + dt, -2.6, .5, cy, flip)
        hit(w, T + dt + .08, x, cy, '#b0ffcc', [412, 438, 501][i], strength=.7, flash=.25, shake=2.5,
            freeze_ms=45, dmg_col='#e6ffee', dmg_dy=-48 - i * 6, dmg_dx=(i - 1) * 22)
        w.at(T + dt + .1, lambda w, cy=cy: sparks(w, x, cy, 10, ramp('#ffffff', '#c8ffd8', '#7af0a8', k=1.2), speed=110))
    w.light(x, y - 25, 100, green, 1.5, T, END - T + .3, attack=.15, curve=.8)


def holy(w):
    """Radiance: a pillar of light descends from above, feathers of light fall, glints flare."""
    tg = w.scene.target
    x, y = tg.x, tg.y
    gold, white = rgb('#ffd870'), rgb('#ffffff')
    magic_circle(w, x, y, 32, gold, .05, 1.35)
    gather(w, x, y - 16, rgb('#fff0b0'), .35, .9, radius=34)
    T = .95

    def beam(cv, k, age):
        grow = Ease.outCubic(clamp(age / .12))
        e = clamp((1.0 - age) / .45)
        if e <= 0:
            return
        wd = 13 * grow * (1 + .12 * math.sin(age * 40)) * (.4 + .6 * e)
        top = -10
        bot = lerp(top, y, Ease.outCubic(clamp(age / .1)))
        for yy in range(int(top), int(bot) + 1):
            u = (yy - top) / (y - top)
            wob = math.sin(yy * .15 - age * 30) * .8
            cv.rect('add', x - wd + wob, yy, wd * 2, 1, gold * .22, e)
            cv.rect('add', x - wd * .5 + wob, yy, wd, 1, rgb('#fff0b8') * .35, e)
            cv.rect('add', x - wd * .18, yy, max(1, wd * .36), 1, white * .7, e)
            cv.px('add', x - wd + wob, yy, gold * .9, e)
            cv.px('add', x + wd + wob - 1, yy, gold * .9, e)
            if yy % 2 == 0:
                cv.rect('glow', x - wd * 1.2, yy, wd * 2.4, 1, gold, .12 * e * (.6 + .4 * u))
        for s in range(5):                                          # scrolling vertical ray streaks
            sx = x + (s - 2) * wd * .42
            off = (age * 260 + s * 37) % 60
            for yy in range(int(top + off), int(bot), 60):
                cv.rect('add', sx, yy, 1, 18, white * .8, e * .7)
        cv.disc('glow', x, y - 4, 30, 10, gold, .7 * e, soft=1)
        cv.disc('add', x, y, wd * 1.6, wd * .5, rgb('#fff0b8'), .35 * e, soft=.5)
    w.shape(T, 1.05, beam, order=7)

    def feathers(w, k):
        if w.rng.random() < .8:
            ph = w.rnd(0, 6)

            def sway(p, dt, ph=ph):
                p.vx = math.sin(p.age * 5 + ph) * 18
            w.part(x=x + w.gauss(22), y=w.rnd(-5, 40), vy=w.rnd(22, 40), life=w.rnd(.9, 1.5),
                   cols=[white * 1.3, rgb('#fff4c8'), gold], shape='diamond', size=1, glow=.9, fn=sway)
        w.part(x=x + w.gauss(12), y=y - w.rnd(0, 6), vy=-w.rnd(20, 50), life=w.rnd(.5, .9),
               cols=[white * 1.3, gold], size=1, glow=1.)
    w.during(T, T + 1.5, feathers)

    def glints(cv, k, age):
        for i in range(6):
            gx = x + math.cos(i * 2.4) * (14 + i * 3)
            gy = y - 12 - math.sin(i * 1.7) * 16
            ph = clamp((age - i * .11) / .35)
            s = math.sin(ph * math.pi) * (4 + i % 3)
            if s <= .5:
                continue
            cv.line('add', gx - s, gy, gx + s, gy, white * 1.4)
            cv.line('add', gx, gy - s * 1.4, gx, gy + s * 1.4, white * 1.4)
            cv.px('glow', gx, gy, gold, 2., 3)
    w.shape(T + .15, 1.1, glints, order=9)
    shockwave(w, x, y, T + .05, .5, 44, gold)
    shockwave(w, x, y, T + .2, .5, 30, white, th=1)
    w.light(x, y - 25, 110, rgb('#ffe090'), 2.4, T, 1.5, attack=.06, curve=1.3)
    hit(w, T + .08, x, y - 16, '#fff0b0', 1560, strength=1.1, flash=.4, shake=3, dmg_col='#fff4c8')


def dark(w):
    """Umbral Collapse: a void orb drinks in light and particles, swallows the target, then implodes."""
    tg = w.scene.target
    x, y = tg.x, tg.y
    purple, magenta = rgb('#a070ff'), rgb('#ff60d0')
    magic_circle(w, x, y, 30, purple, .05, 1.35)
    w.ambient(lambda t: 1 - .55 * clamp((t - .2) / .7) * clamp((2.1 - t) / .5) if t < 2.1 else 1.)
    ox, oy = x, y - 40
    T_DROP, T_POP = 1.05, 1.35

    def orb_state(age):
        """Orb centre and radius over time (age from spell start)."""
        if age < T_DROP:
            return ox, oy, 11 * Ease.outBack(clamp((age - .25) / .5))
        if age < T_POP:
            u = (age - T_DROP) / (T_POP - T_DROP)
            cy = lerp(oy, y - 14, Ease.outCubic(clamp(u * 2.5)))
            r = 11 + 13 * Ease.outCubic(clamp(u * 2.5)) if u < .6 else 24 * (1 - Ease.inCubic((u - .6) / .4))
            return ox, cy, r
        return ox, y - 14, 0

    def orb(cv, k, age):
        cx, cy, r = orb_state(age)
        if r <= .5:
            return
        cv.disc('normal', cx, cy, r * 2.4, r * 2.4, rgb('#0a0612'), .45, soft=.8)
        cv.disc('normal', cx, cy, r, r, rgb('#0c0718'), 1.)
        cv.disc('normal', cx - r * .25, cy - r * .25, r * .55, r * .55, rgb('#221440'), .8)
        wob = age * 9
        cv.ring('add', cx, cy, r + 1, r + 1, purple * 1.3, 1., keep=lambda a: math.sin(a * 3 + wob) > -.4)
        cv.ring('add', cx, cy, r + 3, r + 3, magenta, .6, keep=lambda a: math.sin(a * 5 - wob * 1.3) > .5)
        cv.ring('glow', cx, cy, r + 2, r + 2, purple, .9, th=3)
    w.shape(0, T_POP, orb, order=8)

    def darken(cv, k, age):
        cx, cy, r = orb_state(age)
        if r > 0:
            cv.disc('dark', cx, cy, 20 + r * 3, (20 + r * 3) * .8, None, .6 * clamp(r / 11), soft=.5)
    w.shape(0, T_POP, darken, order=-30)

    def suck(w, k):
        cx, cy, r = orb_state(w.t)
        for _ in range(3):
            ang, d = w.rnd(0, 2 * math.pi), w.rnd(30, 60)
            sx, sy = cx + math.cos(ang) * d, cy + math.sin(ang) * d * .8
            life = w.rnd(.3, .45)
            w.part(x=sx, y=sy, vx=(cx - sx) / life, vy=(cy - sy) / life, life=life * .9, shape='streak', streak=.05,
                   cols=[purple * .8, purple * 1.3, magenta], size=1, glow=.9)
    w.during(.35, T_DROP + .15, suck)

    def pop(w):
        w.freeze(w.t, 90)
        w.do_flash(.45, '#d8b8ff')
        w.do_shake(6)
        w.scene.target.hit(1.3)
        burst_star(w, x, y - 14, w.t, 10, magenta)
        for _ in range(60):
            ang = w.rnd(0, 2 * math.pi)
            v = w.rnd(60, 190)
            w.part(x=x, y=y - 14, vx=math.cos(ang) * v, vy=math.sin(ang) * v * .8, drag=.05, life=w.rnd(.3, .7),
                   shape='streak', streak=.035, size=int(w.rnd(1, 3)), cols=ramp('#ffffff', '#ff90e8', '#a070ff', '#5030a0', k=1.1), glow=.3)
        for _ in range(26):
            ang = w.rnd(0, 2 * math.pi)
            w.part(x=x + math.cos(ang) * 6, y=y - 14 + math.sin(ang) * 6, vx=math.cos(ang) * w.rnd(20, 50),
                   vy=math.sin(ang) * w.rnd(10, 30) - 12, drag=.3, life=w.rnd(.8, 1.3), size=3, grow=7, shape='soft',
                   cols=ramp('#2a1840', '#1e1230', '#140c20'), layer='normal', alpha=.6, glow=0)
        w.damage(2048, x, y - 50, '#e8c8ff')
    w.at(T_POP, pop)
    shockwave(w, x, y, T_POP, .55, 50, magenta)
    shockwave(w, x, y, T_POP + .08, .5, 34, purple, th=1)

    def rise(w, k):
        w.part(x=x + w.gauss(16), y=y - w.rnd(0, 20), vy=-w.rnd(15, 35), vx=w.gauss(6), life=w.rnd(.5, 1.),
               cols=[magenta * 1.2, purple, purple * .5], size=1, glow=1., shape=w.pick(['sq', 'sq', 'plus']))
    w.during(T_POP, T_POP + 1.0, rise)
    w.light(ox, oy, 60, purple, .6, .3, T_POP - .3, attack=.4, curve=.2)
    w.light(x, y - 16, 100, rgb('#c080ff'), 1.6, T_POP, 1.0, attack=.02, curve=1.6)


SPELLS = {
    'fire': (fire, 'Flame Pillar', 2.8),
    'ice': (ice, 'Glacial Spikes', 3.0),
    'lightning': (lightning, 'Thunderclap', 2.6),
    'wind': (wind, 'Gale Vortex', 2.8),
    'light': (holy, 'Radiance', 2.8),
    'dark': (dark, 'Umbral Collapse', 2.8),
}
