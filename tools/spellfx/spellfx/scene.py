"""The battle diorama the spells play in: a dusk forest clearing and a target enemy.

Everything is procedural so the tool has no asset dependencies. The backdrop is drawn in
albedo (unlit colour); the World multiplies it by ambient light plus spell lights, which is
what makes the whole clearing glow orange during a fire spell, blue during ice, and so on.
"""
import math

import numpy as np
from scipy.ndimage import gaussian_filter, zoom

from .engine import H, W, Ease, rgb

HORIZON = 62


def _noise(rng, h, w, cell):
    """Smooth value noise in [0, 1]."""
    g = rng.random((h // cell + 3, w // cell + 3)).astype(np.float32)
    n = zoom(g, cell, order=3)[:h, :w]
    return (n - n.min()) / (n.max() - n.min() + 1e-6)


def _mix(a, b, t):
    return a + (b - a) * t[..., None]


def make_backdrop(seed=3):
    rng = np.random.default_rng(seed)
    img = np.zeros((H, W, 3), np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    # sky, seen through the canopy
    sky_t = np.clip(yy / HORIZON, 0, 1)
    img[:] = _mix(np.broadcast_to(rgb('#8a9aa8'), (H, W, 3)), np.broadcast_to(rgb('#e0cfa0'), (H, W, 3)), sky_t ** 1.3)

    # tree lines: clusters of shaded canopy blobs (far = hazy blue-green, near = darker, warmer rim)
    tex = _noise(rng, H, W, 3)
    for layer, (dark, mid, lite, n_trees, y_top, r_rng, haze) in enumerate([
            ('#3d5a58', '#56766c', '#7c9a86', 16, 16, (7, 13), .45),
            ('#1f3326', '#2f4a32', '#4f6e3c', 11, 8, (9, 17), .12)]):
        cov = np.zeros((H, W), bool)
        shade = np.zeros((H, W), np.float32)
        xs = np.linspace(-10, W + 10, n_trees) + rng.uniform(-8, 8, n_trees)
        for tx in xs:
            top = y_top + rng.uniform(0, 22) + (8 if 70 < tx < 170 else 0)
            trunk_w = 2 if layer else 1
            img[int(top) + 10:HORIZON + 2, int(tx):int(tx) + trunk_w] = rgb('#2a2620' if layer else '#44504a')
            for b in range(rng.integers(5, 9)):
                r = rng.uniform(*r_rng) * (.75 if b else 1)
                bx = tx + rng.uniform(-1.2, 1.2) * r
                by = top + r + rng.uniform(0, 1.6) * r
                d = np.sqrt((xx - bx) ** 2 + ((yy - by) * 1.1) ** 2) / r
                m = d < 1
                # light from upper-left: shade by offset inside the blob
                sh = np.clip(.65 - ((xx - bx) * .6 + (yy - by)) / r * .45, 0, 1)
                shade = np.where(m, sh, shade)
                cov |= m
        cov &= yy < HORIZON + 3
        lv = np.clip(shade + (tex - .5) * .35, 0, 1)
        col = np.where((lv < .38)[..., None], rgb(dark), np.where((lv < .7)[..., None], rgb(mid), rgb(lite)))
        img = np.where(cov[..., None], col, img)
        fade = np.clip(1 - (HORIZON - yy) / 70, 0, 1) * haze + haze * .4
        img = _mix(img, np.broadcast_to(rgb('#b9b49c'), (H, W, 3)), cov * fade)

    # overhanging foliage framing the top corners (very dark, strongly out of focus)
    frame = np.zeros((H, W), bool)
    for _ in range(26):
        side = rng.random() < .5
        bx = rng.uniform(-20, 45) if side else rng.uniform(W - 45, W + 20)
        by = rng.uniform(-18, 18) + (abs(bx - (0 if side else W)) * .1)
        r = rng.uniform(9, 20)
        frame |= np.sqrt((xx - bx) ** 2 + (yy - by) ** 2) < r
    fr_col = rgb('#141c14')[None, None] * (.8 + .5 * tex[..., None])
    img = np.where(frame[..., None], fr_col, img)

    # ground: grass with a dirt clearing, darker and hazier toward the horizon
    g = yy >= HORIZON
    grass_n, detail = _noise(rng, H, W, 10), _noise(rng, H, W, 3)
    grass = _mix(np.broadcast_to(rgb('#3d5a2a'), (H, W, 3)), np.broadcast_to(rgb('#6d8a3a'), (H, W, 3)),
                 np.clip(grass_n * .8 + detail * .4 - .1, 0, 1))
    clear = ((xx - 120) / 82) ** 2 + ((yy - 121) / 26) ** 2
    dirt_t = np.clip((1.15 - clear - (detail - .5) * .5) * 2.2, 0, 1)
    dirt = _mix(np.broadcast_to(rgb('#6e5236'), (H, W, 3)), np.broadcast_to(rgb('#a88458'), (H, W, 3)), detail)
    ground = _mix(grass, dirt, (dirt_t > .5).astype(np.float32) * .9 + dirt_t * .1)
    # ordered dithering on the dirt/grass boundary
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16
    dith = bayer[(yy % 4).astype(int), (xx % 4).astype(int)]
    edge_band = (dirt_t > .25) & (dirt_t < .75)
    ground = np.where((edge_band & (dith < dirt_t))[..., None], dirt, ground)
    depth = np.clip((yy - HORIZON) / (H - HORIZON), 0, 1)
    ground = _mix(ground, np.broadcast_to(rgb('#9aa08a'), (H, W, 3)), (1 - depth) ** 3 * .55)
    img = np.where(g[..., None], ground, img)

    # grass blades and pebbles
    for _ in range(700):
        x, y = rng.integers(0, W), rng.integers(HORIZON + 2, H)
        if dirt_t[y, x] < .4:
            h = 1 + int((y - HORIZON) / 30)
            img[max(HORIZON, y - h):y, x] = rgb('#8fae4a') * (.8 + .4 * rng.random())
    for _ in range(90):
        x, y = rng.integers(4, W - 4), rng.integers(HORIZON + 6, H - 2)
        if dirt_t[y, x] > .6:
            img[y, x:x + 2] = rgb('#c8b08a')
            img[y + 1, x:x + 2] = rgb('#5a4430')

    # foreground grass tufts (dark, will be blurred: depth of field)
    for _ in range(60):
        x = rng.integers(-4, W + 4)
        side = min(x, W - x)
        if side > 60 and rng.random() < .7:
            continue
        for b in range(rng.integers(3, 7)):
            h = rng.integers(6, 16)
            bx = x + rng.integers(-3, 4)
            lean = rng.uniform(-.5, .5)
            for i in range(h):
                px, py = int(bx + lean * i), H - 1 - i
                if 0 <= px < W:
                    img[py, px] = rgb('#203018') * (1 + i / h * .6)

    # tilt-shift depth of field: blur the top (trees) and bottom (foreground) bands
    top = gaussian_filter(img, (1.2, 1.2, 0))
    bot = gaussian_filter(img, (1.0, 1.0, 0))
    wt = np.clip((HORIZON - 4 - yy) / 26, 0, 1)[..., None]
    img = np.where(frame[..., None], gaussian_filter(img, (2.5, 2.5, 0)), img)
    wb = np.clip((yy - (H - 18)) / 14, 0, 1)[..., None]
    img = img * (1 - wt) + top * wt
    img = img * (1 - wb) + bot * wb
    return img.astype(np.float32)


# ----------------------------------------------------------------------------------------------
# Target: a shaded pixel-art gel with hue-shifted ramps, coloured outline and idle breathing
# ----------------------------------------------------------------------------------------------
class Target:
    RAMP = [rgb(h) for h in ('#231c44', '#3a3a8c', '#5463c8', '#7f9cec', '#cfe6ff')]
    OUTLINE = rgb('#170f2a')

    def __init__(self, x=120, y=120, rx=17, ry=15):
        self.x, self.y, self.rx, self.ry = x, y, rx, ry
        self.flash, self.flash_col = 0., rgb('#ffffff')
        self.jolt, self.squash = 0., 0.
        self.visible = True

    def hit(self, strength=1.0, col='#ffffff'):
        self.flash = 1.0
        self.flash_col = rgb(col)
        self.jolt = 3 * strength
        self.squash = .22 * strength

    def tick(self, dt):
        self.flash = max(0., self.flash - dt * 6)
        self.jolt *= .7
        self.squash *= .8

    @property
    def center(self):
        return self.x, self.y - self.ry

    def draw(self, img, t):
        """Draw into the albedo buffer; return a coverage mask for the hit flash."""
        mask = np.zeros((H, W), np.float32)
        # contact shadow
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        sh = ((xx - self.x) / (self.rx + 5)) ** 2 + ((yy - self.y) / 4.5) ** 2 < 1
        img[sh] *= .45
        if not self.visible:
            return mask
        breathe = math.sin(t * 2 * math.pi / 1.3)
        sy = 1 + .05 * breathe - self.squash
        sx = 1 - .03 * breathe + self.squash * .8
        rx, ry = self.rx * sx, self.ry * 2 * sy * .5
        jx = round(self.jolt * math.sin(t * 90))
        cx, base_y = self.x + jx, self.y
        cy = base_y - ry
        x0, x1 = int(cx - rx - 2), int(cx + rx + 3)
        y0, y1 = int(cy - ry - 6), int(base_y + 1)
        L = np.array([-.55, -.65, .52], np.float32)
        L /= np.linalg.norm(L)
        jj, ii = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        u = (ii + .5 - cx) / rx
        v = (jj + .5 - cy) / ry
        # dome top with a little curled tip, flat-ish bottom
        tip = np.where(v < -.6, np.maximum(0., 1 - np.abs(u + .12 - v * .15) * 5) * .55, 0.)
        vv = np.where(v < 0, v + tip, v ** 3)
        d = u * u + vv * vv
        body = (d <= 1) & (jj + .5 <= base_y)
        nz = np.sqrt(np.maximum(0., 1 - d))
        nrm = np.sqrt(u * u + vv * vv + nz * nz) + 1e-6
        ndl = (u * L[0] + vv * L[1] + nz * L[2]) / nrm
        shade = np.maximum(0., ndl) * .9 + .12 + np.where(v > .55, .25, 0.) * (1 - np.abs(u))
        shade = np.where(body, shade, 0.).astype(np.float32)
        # posterise into the ramp (pixel-art shading) with a specular dot
        idx = np.clip((shade * 4.2).astype(int), 0, 3)
        cols = np.array(self.RAMP)[idx]
        spec = (shade > .93)
        cols[spec] = self.RAMP[4]
        # outline: 1px, coloured (not black)
        pad = np.pad(body, 1)
        edge = body & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
        cols[edge] = self.OUTLINE
        # eyes
        ey = int(cy - ry * .05)
        for ex in (int(cx - rx * .35), int(cx + rx * .15)):
            for dy in range(4):
                for dx in range(2):
                    jj, ii = ey + dy - y0, ex + dx - x0
                    if 0 <= jj < body.shape[0] and 0 <= ii < body.shape[1] and body[jj, ii]:
                        cols[jj, ii] = rgb('#140c24') if not (dy == 0 and dx == 1) else rgb('#ffffff')
        ys, xs = slice(max(0, y0), min(H, y1)), slice(max(0, x0), min(W, x1))
        bj, bi = slice(ys.start - y0, ys.stop - y0), slice(xs.start - x0, xs.stop - x0)
        region = img[ys, xs]
        b = body[bj, bi]
        region[b] = cols[bj, bi][b]
        mask[ys, xs] = b
        return mask


class Scene:
    def __init__(self, seed=3):
        self.backdrop = make_backdrop(seed)
        self.ambient = np.array([.78, .76, .9], np.float32)     # cool dusk ambient; spells warm it
        self.grid = np.mgrid[0:H, 0:W].astype(np.float32)
        self.target = Target()
        self._vig = {}

    def vignette(self, scale):
        if scale not in self._vig:
            h, w = H * scale, W * scale
            yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
            d = ((xx / w - .5) ** 2 * 1.2 + (yy / h - .5) ** 2) * 2.2
            self._vig[scale] = np.clip(1 - d ** 1.6 * .55, 0, 1)[..., None]
        return self._vig[scale]
