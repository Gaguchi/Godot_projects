"""Turn a painting the game already has into real pixel art: a fixed small palette, one colour per pixel, hard edges.

The board sprites are the 832 x 1216 paintings shrunk by averaging, which is why they are soft and carry thousands of
colours. This does the shrink the pixel-art way: fix a small palette from the painting, then give every block its most
common colour. No image model runs; the painting is only read.

    python reduce_art.py roy lilina        ->  out/<id>_px.png (104 x 152), out/<id>_px_small.png (52 x 76), a sheet
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
UNITS = os.path.abspath(HERE + '/../../../../game/public/sprites/units')
INK = (27, 21, 16)


def reduce_art(path, k=8, colours=28, outline=True):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im).copy()
    op = a[..., 3] >= 128
    pix = np.ascontiguousarray(a[op][:, :3])
    strip = Image.fromarray(pix.reshape(1, -1, 3), 'RGB')
    pal_im = strip.quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q = Image.fromarray(np.ascontiguousarray(a[..., :3]), 'RGB').quantize(palette=pal_im, dither=Image.Dither.NONE)
    idx = np.asarray(q).astype(np.int16)
    idx[~op] = -1
    H, W = idx.shape
    h, w = H // k, W // k
    blocks = idx[:h * k, :w * k].reshape(h, k, w, k).transpose(0, 2, 1, 3).reshape(h, w, k * k)
    out = np.full((h, w), -1, np.int16)
    for y in range(h):
        for x in range(w):
            b = blocks[y, x]
            b = b[b >= 0]
            if b.size * 2 >= k * k:
                out[y, x] = np.bincount(b, minlength=colours).argmax()
    pal = np.array(pal_im.getpalette()[:colours * 3], np.uint8).reshape(-1, 3)
    m = out >= 0
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[m, :3] = pal[out[m]]
    rgba[m, 3] = 255
    if outline:
        ring = np.zeros_like(m)
        ring[1:, :] |= m[:-1, :]
        ring[:-1, :] |= m[1:, :]
        ring[:, 1:] |= m[:, :-1]
        ring[:, :-1] |= m[:, 1:]
        ring &= ~m
        rgba[ring, :3] = INK
        rgba[ring, 3] = 255
    return Image.fromarray(rgba, 'RGBA'), len(np.unique(out[m]))


if __name__ == '__main__':
    ids = sys.argv[1:] or ['roy', 'lilina']
    os.makedirs(HERE + '/out', exist_ok=True)
    GRASS = (98, 126, 47, 255)
    big, small, now = [], [], []
    for i in ids:
        f, n = reduce_art(f'{UNITS}/{i}.png', 8)
        s, ns = reduce_art(f'{UNITS}/{i}.png', 16, colours=20)
        f.save(f'{HERE}/out/{i}_px.png')
        s.save(f'{HERE}/out/{i}_px_small.png')
        print(i, f.size, n, 'colours;', s.size, ns, 'colours')
        big.append(f)
        small.append(s)
        now.append(Image.open(f'{UNITS}/board/{i}.png').convert('RGBA'))
    bag = Image.open(HERE + '/out/bagrat.png').convert('RGBA')
    bag_s = Image.open(HERE + '/out/bagrat_small.png').convert('RGBA')

    def row(ims, z):
        gap = 10
        W = sum(i.width * z for i in ims) + gap * (len(ims) + 1)
        Hh = max(i.height * z for i in ims) + 2 * gap
        o = Image.new('RGBA', (W, Hh), GRASS)
        x = gap
        for i in ims:
            o.alpha_composite(i.resize((i.width * z, i.height * z), Image.NEAREST), (x, Hh - gap - i.height * z))
            x += i.width * z + gap
        return o

    # the figures: the hand-drawn one, the paintings made into pixels, the bakes the game has now
    row([bag] + big + now, 3).save(HERE + '/out/cast_figures.png')
    toks_now = [i.resize((52, 76), Image.BILINEAR) for i in now]
    row([bag_s] + small + toks_now, 5).save(HERE + '/out/cast_tokens.png')
