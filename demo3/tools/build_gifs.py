"""Assemble exported frames into GIF previews and PNG sprite sheets.

Usage: python3 tools/build_gifs.py <framesDir> <outDir> [--scale 2] [--fps 12] [--cols 8] [--only gif|sheet]
Frames come from tools/export_frames.mjs (one folder per animation).
"""
import os
import sys

from PIL import Image


def main(argv):
    pos, opt, only = [], {'--scale': 2, '--fps': 12, '--cols': 8}, None
    it = iter(argv)
    for a in it:
        if a == '--only':
            only = next(it)
        elif a in opt:
            opt[a] = int(next(it))
        else:
            pos.append(a)
    src, out = pos
    os.makedirs(out, exist_ok=True)
    k, fps, cols = opt['--scale'], opt['--fps'], opt['--cols']
    for name in sorted(os.listdir(src)):
        files = sorted(f for f in os.listdir(os.path.join(src, name)) if f.endswith('.png'))
        frames = [Image.open(os.path.join(src, name, f)).convert('RGBA') for f in files]
        w, h = frames[0].size
        if only != 'sheet':
            big = [f.resize((w * k, h * k), Image.NEAREST).convert('RGB') for f in frames]
            big[0].save(os.path.join(out, name + '.gif'), save_all=True, append_images=big[1:],
                        duration=round(1000 / fps), loop=0, optimize=True)
        if only == 'gif':
            print(name, len(frames))
            continue
        c = min(cols, len(frames))
        sheet = Image.new('RGBA', (c * w, -(-len(frames) // c) * h))
        for i, f in enumerate(frames):
            sheet.paste(f, ((i % c) * w, (i // c) * h))
        sheet.save(os.path.join(out, '%s_sheet_%df.png' % (name, len(frames))))
        print(name, len(frames))


if __name__ == '__main__':
    main(sys.argv[1:])
