#!/usr/bin/env python3
"""Render HD-2D (Octopath Traveler style) spell animations to GIF.

    python make_gifs.py                     # all spells -> ../../docs/art/spells/
    python make_gifs.py fire ice --scale 2  # pick spells, smaller output
    python make_gifs.py dark --no-bg        # black background (use with additive/screen blending)
    python make_gifs.py wind --frames       # also dump a PNG sequence for a game engine
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spellfx.engine import World        # noqa: E402
from spellfx.scene import Scene         # noqa: E402
from spellfx.spells import SPELLS       # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'docs', 'art', 'spells'))


def render(name, scale, fps, seed, background):
    fn, title, duration = SPELLS[name]
    world = World(Scene(), duration=duration, fps=fps, seed=seed)
    fn(world)
    return [Image.fromarray(f) for f in world.frames(scale=scale, background=background)]


def save_gif(frames, path, fps):
    """ffmpeg builds one palette from the whole clip and uses ordered dithering, which keeps pixel
    art stable between frames and halves the size of per-frame palettes. Pillow is the fallback."""
    if shutil.which('ffmpeg'):
        with tempfile.TemporaryDirectory() as tmp:
            for i, f in enumerate(frames):
                f.save(os.path.join(tmp, f'{i:04d}.png'))
            vf = ('split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];'
                  '[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', os.path.join(tmp, '%04d.png'),
                            '-vf', vf, '-loop', '0', path], check=True)
    else:
        frames[0].save(path, save_all=True, append_images=frames[1:], duration=int(1000 / fps), loop=0,
                       optimize=False, disposal=1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('spells', nargs='*', help='spell names (default: all): ' + ', '.join(SPELLS))
    ap.add_argument('--out', default=DEFAULT_OUT, help='output directory')
    ap.add_argument('--scale', type=int, default=3, help='pixel scale; world is 240x160 (default 3 -> 720x480)')
    ap.add_argument('--fps', type=int, default=25)
    ap.add_argument('--seed', type=int, default=7, help='change for a different random variation')
    ap.add_argument('--no-bg', action='store_true', help='render on black instead of the forest diorama')
    ap.add_argument('--frames', action='store_true', help='also write a PNG sequence per spell')
    ap.add_argument('--sheet', action='store_true', help='also write a contact sheet of key frames')
    args = ap.parse_args()

    names = args.spells or list(SPELLS)
    for n in names:
        if n not in SPELLS:
            ap.error(f'unknown spell {n!r}; choose from {", ".join(SPELLS)}')
    os.makedirs(args.out, exist_ok=True)
    for n in names:
        frames = render(n, args.scale, args.fps, args.seed, not args.no_bg)
        suffix = '_nobg' if args.no_bg else ''
        path = os.path.join(args.out, f'{n}{suffix}.gif')
        save_gif(frames, path, args.fps)
        print(f'{SPELLS[n][1]:>16}: {path} ({len(frames)} frames, {os.path.getsize(path) / 1e6:.1f} MB)')
        if args.frames:
            d = os.path.join(args.out, f'{n}{suffix}_frames')
            os.makedirs(d, exist_ok=True)
            for i, f in enumerate(frames):
                f.save(os.path.join(d, f'{i:04d}.png'))
        if args.sheet:
            picks = [frames[int(len(frames) * k)] for k in (.2, .38, .45, .55, .7)]
            w, h = picks[0].size
            sheet = Image.new('RGB', (w * len(picks), h))
            for i, f in enumerate(picks):
                sheet.paste(f, (i * w, 0))
            sheet.save(os.path.join(args.out, f'{n}{suffix}_sheet.png'))


if __name__ == '__main__':
    main()
