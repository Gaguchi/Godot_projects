"""Export the pop-ups' art to the game (game/): a face for every sprite that can speak or be named.

    python src/px-popups/export_game.py            (from tools/pxworld)

Writes
    game/public/sprites/faces/<sprite>.png   the face behind a niche's brass lip, 96 x 96
    game/src/ui/filigree/faces.json          where the head sits in each crop, for a niche smaller than the crop
    game/src/ui/filigree/figures.json        where the figure stands in its 832 x 1216 art (the box of what is drawn),
                                             so a screen can stand the full art by its feet at a chosen height

Six faces were given with the kit (assets/up/face_*.png) and are copied as they are. The others are CUT from the
character's own ComfyUI art in game/public/sprites/units/: a square of the art around the head, baked down to 96 px
by an alpha-weighted box mean (the same bake as the 104 x 152 board sprites). Nothing is redrawn, mirrored or
recoloured; a cut is a crop and a whole-number-ish step down, at the scale of the six given ones (they measure as a
324 to 336 px square of the 832 x 1216 art).

BOXES is chosen by eye, one per sprite: (x, y) of the square's top-left corner in the full art, side 330. A sprite
that holds something over its head (the brigand chief's axe) is why this is a table and not the top of the silhouette.
"""
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../..').replace('\\', '/')            # tools/pxworld
GAME = os.path.abspath(ROOT + '/../../game').replace('\\', '/')
UNITS = GAME + '/public/sprites/units'
FACES = GAME + '/public/sprites/faces'

SIDE = 330
OUT = 96

# the six given crops: where the head sits in a 52 px niche (kit64 FACE_CROP, with the foes seated by eye)
GIVEN = {'roy': (28, 14), 'marcus': (26, 10), 'lilina': (27, 20), 'bandit': (22, 8), 'ember_mage': (22, 8), 'warlord': (22, 8)}

# cut from the full art: sprite -> (x, y) of the 330 px square. The head sits in the upper middle of each.
BOXES = {
    'kael': (255, 6),
    'kael_left': (251, 0),
    'daren': (238, 0),
    'brigand_chief': (228, 215),
    'garrik': (240, 0),
    'lyra': (246, 45),
    'bandit_archer': (255, 24),
    'raider_mage': (285, 15),
    'raider_cleric': (226, 75),
    'shield_knight': (237, 66),
    'thief': (228, 210),
    'wolf': (249, 630),
    'alpha_wolf': (255, 210),
}
# a cut crop centres the head, a little above the middle: the same seat for all of them
CUT_SEAT = (22, 14)


def bake(full, x, y, side=SIDE, out=OUT):
    """A square of the full art, baked to `out` px: premultiplied box mean, so clear pixels never darken an edge."""
    a = np.asarray(full.convert('RGBA')).astype(np.float64)
    H, W = a.shape[:2]
    pad = np.zeros((H + 2 * side, W + 2 * side, 4))
    pad[side:side + H, side:side + W] = a
    sq = pad[y + side:y + 2 * side, x + side:x + 2 * side]
    pm = sq.copy()
    pm[..., :3] *= sq[..., 3:4] / 255.0
    ch = [np.asarray(Image.fromarray(pm[..., c].astype(np.float32), 'F').resize((out, out), Image.BOX)) for c in range(4)]
    al = ch[3]
    rgb = np.stack([np.where(al > 0, ch[c] / np.maximum(al, 1e-6) * 255.0, 0) for c in range(3)], -1)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(al, 0, 255)]).round().astype(np.uint8), 'RGBA')


def put(im, path):
    """Write only what changed: a file whose pixels are already these is left alone (no re-encoding churn in git)."""
    if os.path.exists(path):
        old = Image.open(path).convert('RGBA')
        if old.size == im.size and np.array_equal(np.asarray(old), np.asarray(im)):
            return
    im.save(path, optimize=True)


def faces():
    os.makedirs(FACES, exist_ok=True)
    seats = {}
    for name, seat in GIVEN.items():
        put(Image.open(f'{ROOT}/assets/up/face_{name}.png').convert('RGBA'), f'{FACES}/{name}.png')
        seats[name] = list(seat)
    for name, (x, y) in BOXES.items():
        src = f'{UNITS}/{name}.png'
        if not os.path.exists(src):
            print('  no art for', name, '(skipped)')
            continue
        put(bake(Image.open(src), x, y), f'{FACES}/{name}.png')
        seats[name] = list(CUT_SEAT)
    with open(GAME + '/src/ui/filigree/faces.json', 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(dict(sorted(seats.items())), fh, indent=2)
        fh.write('\n')
    print('exported', len(seats), 'faces')


def figures():
    """The box of what is drawn in each full art: x0, y0, x1, y1 (alpha over a tenth). The art itself is untouched."""
    out = {}
    for fn in sorted(os.listdir(UNITS)):
        if not fn.endswith('.png'):
            continue
        a = np.asarray(Image.open(f'{UNITS}/{fn}').convert('RGBA'))[..., 3] > 25
        ys, xs = np.where(a)
        out[fn[:-4]] = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
    with open(GAME + '/src/ui/filigree/figures.json', 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(out, fh, indent=2)
        fh.write('\n')
    print('measured', len(out), 'figures')


if __name__ == '__main__':
    faces()
    figures()
