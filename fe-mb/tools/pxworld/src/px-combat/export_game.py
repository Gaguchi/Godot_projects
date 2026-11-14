"""Export the combat field to the game (game/): the ground a battle is laid on, in pieces the game composes.

    python src/px-combat/export_game.py [ground|dirt|rocks|marks]        (from tools/pxworld; no argument = all)

Writes
    game/public/art/field/ground.png        the clearing in its wood at 1x, 1280 x 720, with NOTHING on it
    game/public/art/field/dirt_<n>.png      the dirt patch as 48 px tiles, one per neighbourhood (47), clear where
                                            the meadow shows; dirt_255_<v>.png are four takes of the inner tile
    game/public/art/field/rock_<v>.png      a boulder that fills a tile, with its scree and its thrown shadow
    game/public/art/field/base_<who>_<half>.png   the ring a unit stands in: ours a rectangle, theirs a lozenge,
                                            the acting one brass; `back` goes under the figure, `front` over its feet
    game/public/art/field/acting.png        the marker over whoever is acting
    game/src/ui/combat/fieldArt.json        the numbers: tile pitch, where the board sits, the pieces' boxes

WHY PIECES. The board (Hyb64Combat) is one painted field for one layout: kit_px_field draws the engine's "Open
Ground" at one seed. The game makes each battle's dirt patch from the battle's own seed (`engine/combat/seed.ts`,
`generateDirtRegion`) and reads its boulders from the battlefield, so no painting made here can match it. The
pieces are cut by the SAME functions that paint the board (the mask's rounded corners and worn edge, the crust and
clods, the pebbles, the boulder and its shadow), so a field composed in the game is the board's field for any layout.

A dirt tile is named by the eight neighbours that are also dirt: N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128, a corner
counted only when both edges beside it are dirt (47 cases). The worn edge is kept INSIDE the tile and is pinned to a
1 px inset where it crosses a tile line, so two neighbouring tiles always meet.
"""
import json
import os
import random
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../..').replace('\\', '/')            # tools/pxworld
GAME = os.path.abspath(ROOT + '/../../game').replace('\\', '/')
OUT = GAME + '/public/art/field'
sys.path.insert(0, ROOT + '/src/kit64')
import kit_px_field as F          # noqa: E402
from pxworld import pal           # noqa: E402
from pxworld.pal import ix        # noqa: E402

T = F.T
W, H = F.W, F.H
# where a lone tile is cut on the big canvas: well away from every edge
CX, CY = 480, 240
N, E, S, WEST, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128
ORTH = ((N, 0, -1), (E, 1, 0), (S, 0, 1), (WEST, -1, 0))
DIAG = ((NE, 1, -1, N, E), (SE, 1, 1, S, E), (SW, -1, 1, S, WEST), (NW, -1, -1, N, WEST))
INNER = 255
INNER_TAKES = 4
ROCK_TAKES = 3
ROCK_BOX = (-4, -4, T + 12, T + 4)      # the rock's picture round its tile: its shadow falls to the south-east


def canonical(bits):
    out = bits & 15
    for (bit, _, _, a, b) in DIAG:
        if bits & bit and bits & a and bits & b:
            out |= bit
    return out


def rgba(a, alpha):
    out = F.to_rgba(a)
    out[..., 3] = np.where(alpha, 255, 0)
    return out


def save(arr, name):
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(arr, 'RGBA').save(f'{OUT}/{name}.png', optimize=True)


def ground():
    a = F.render(bare=True)
    os.makedirs(OUT, exist_ok=True)
    with open(f'{OUT}/ground.png', 'wb') as fh:
        fh.write(F.png_bytes(a))
    print('  ground.png')


def dirt_tile(bits, seed):
    """One 48 px tile of the patch whose neighbours are `bits`, cut by the board's own mask and texture."""
    rng = random.Random(seed)
    tiles = np.zeros((H, W), bool)
    tiles[CY:CY + T, CX:CX + T] = True
    for (bit, dx, dy) in ORTH:
        if bits & bit:
            tiles[CY + dy * T:CY + dy * T + T, CX + dx * T:CX + dx * T + T] = True
    for (bit, dx, dy, _, _) in DIAG:
        if bits & bit:
            tiles[CY + dy * T:CY + dy * T + T, CX + dx * T:CX + dx * T + T] = True
    # the board's shaping (dirt_mask): outer corners rounded, inner corners eased
    D = ndimage.binary_opening(tiles, F.disk(7))
    D = ndimage.binary_closing(D, F.disk(3)) & tiles
    sdf = ndimage.distance_transform_edt(D) - ndimage.distance_transform_edt(~D)
    # the worn edge: the board's two noises, faded out to nothing at this tile's own lines so neighbours meet
    lx, ly = F.XX - CX, F.YY - CY
    lines = np.minimum(np.minimum(np.abs(lx), np.abs(T - lx)), np.minimum(np.abs(ly), np.abs(T - ly)))
    fade = np.clip((lines - 1) / 6, 0, 1)
    f = sdf - 1.2 - fade * (1.0 + 1.5 * F.smooth_noise(W, H, 14, seed + 1) + .8 * F.smooth_noise(W, H, 6, seed + 2))
    m = F.clean(f > 0, 3) & D
    m = F.drop_small(m, 40)
    cell = np.zeros((H, W), bool)
    cell[CY:CY + T, CX:CX + T] = True

    a = np.full((H, W), ix('g5'), np.uint8)
    a[m] = ix('d4')
    inner = ndimage.binary_erosion(m & cell, np.ones((3, 3), bool))
    F.dirt_texture(a, inner, rng, 1.0)
    # the lip: grass to the north and west throws a 1 px shadow onto the dirt
    a[m & (~F.nb(m, 0, -1, True) | ~F.nb(m, -1, 0, True))] = ix('d3')
    F.grass_over_dirt(a, m, seed)
    # grass creeping back in at the patch's edge, and a pebble or two, kept clear of the tile lines
    din = ndimage.distance_transform_edt(m)
    safe = inner & (lines > 5)
    pts = [p for p in F.poisson(rng, CX, CY, CX + T, CY + T, 11, 200)
           if safe[int(p[1]), int(p[0])] and 1.5 < din[int(p[1]), int(p[0])] < 9 and rng.random() < .5 - din[int(p[1]), int(p[0])] / 20]
    F.tufts(a, rng, pts, .5, dirt=True)
    for (x, y) in F.poisson(rng, CX, CY, CX + T, CY + T, 21, 60):
        if safe[int(y), int(x)] and din[int(y), int(x)] > 6 and lines[int(y), int(x)] > 8:
            r_ = rng.random()
            if r_ < .6:
                F.pebble(a, int(x), int(y), rng, big=False, ramp='t' if r_ < .35 else 'd', lift=0 if r_ < .35 else 1)
    out = rgba(a, m)
    return out[CY:CY + T, CX:CX + T]


def dirt():
    codes = sorted({canonical(b) for b in range(256)})
    assert len(codes) == 47, len(codes)
    for code in codes:
        if code == INNER:
            for v in range(INNER_TAKES):
                save(dirt_tile(code, 900 + v * 17), f'dirt_{code}_{v}')
        else:
            save(dirt_tile(code, 300 + code), f'dirt_{code}')
    print('  dirt tiles:', len(codes) - 1 + INNER_TAKES)
    return codes


def rock(take):
    """A boulder on one tile, as kit_px_field.walls() sets it down: the pixels it adds, and its shadow as a dim."""
    flat = np.full((H, W), ix('g5'), np.uint8)
    st = F.Stage(flat.copy())
    keep = F.WALLS
    F.WALLS = [((CX - F.OX) // T, (CY - F.OY) // T)]
    try:
        x, y, _, _ = F.tile_rect(*F.WALLS[0])
        F.walls(st, 5 + take * 3)
    finally:
        F.WALLS = keep
    a = st.render()
    x0, y0, x1, y1 = x + ROCK_BOX[0], y + ROCK_BOX[1], x + ROCK_BOX[2], y + ROCK_BOX[3]
    sub = a[y0:y1, x0:x1]
    shade = pal.lut(-1)[ix('g5')]
    out = F.to_rgba(sub)
    solid = (sub != ix('g5')) & (sub != shade)
    out[..., 3] = np.where(solid, 255, 0)
    k0 = pal.HEX[ix('k0')]
    dim = sub == shade
    out[dim] = (int(k0[1:3], 16), int(k0[3:5], 16), int(k0[5:7], 16), 56)      # one ramp step down, near enough
    return out


def rocks():
    for v in range(ROCK_TAKES):
        save(rock(v), f'rock_{v}')
    print('  rocks:', ROCK_TAKES)


def marks():
    """The ring a unit stands in (px-combat/gen_combat.py#base_plates) and the acting marker, as files."""
    import kit_icons as KI
    import kit_px as KP
    hexof = lambda key: tuple(int(KP.col(key)[i:i + 2], 16) for i in (1, 3, 5)) + (255,)     # noqa: E731
    feet = 37
    for who, ring, shape in (('ours', ('s4', 's3'), 'box'), ('theirs', ('x4', 'x3'), 'loz'), ('acting', ('o5', 'o3'), 'box'), ('acting_theirs', ('o5', 'o3'), 'loz')):
        back = np.zeros((T, T, 4), np.uint8)
        front = np.zeros((T, T, 4), np.uint8)
        cy = feet + .5
        for j in range(T):
            for i in range(T):
                dx, dy = abs(i + .5 - T / 2), abs(j + .5 - cy)
                tgt = front if j + .5 >= cy else back
                lit = ring[0] if j + .5 < cy else ring[1]
                if shape == 'box':
                    if dx <= 18 and dy <= 6 and (dx >= 17 or dy >= 5) and not (dx >= 17 and dy >= 5):
                        tgt[j, i] = hexof(lit)
                    elif dx <= 19 and dy <= 7 and (dx >= 18 or dy >= 6) and not (dx >= 18.5 and dy >= 6.5):
                        tgt[j, i] = hexof('k0')
                    elif dx <= 16 and dy <= 4 and (dx >= 16 or dy >= 4):
                        tgt[j, i] = hexof('k0')
                else:
                    mm = dx / 21 + dy / 7.2
                    if .86 <= mm < 1.0:
                        tgt[j, i] = hexof(lit)
                    elif .74 <= mm < .86 or 1.0 <= mm < 1.13:
                        tgt[j, i] = hexof('k0')
        save(back, f'base_{who}_back')
        save(front, f'base_{who}_front')
    R = KI.arrow_down()
    arr = np.zeros((R.h, R.w, 4), np.uint8)
    for yy in range(R.h):
        for xx in range(R.w):
            c = R.px[yy][xx]
            if c is None:
                continue
            arr[yy, xx] = (*bytes.fromhex(KP.C['k0'][1:]), round(int(c[2:]) * 2.55)) if c.startswith('sh') else hexof(c)
    save(arr, 'acting')
    print('  base plates and the acting marker')
    return {'acting': [R.w, R.h], 'feet': feet}


def numbers(codes, mk):
    art = {
        'tile': T,
        'board': {'cols': F.COLS, 'rows': F.ROWS, 'x': F.OX, 'y': F.OY},
        'dirt': {'codes': codes, 'inner': INNER, 'innerTakes': INNER_TAKES},
        'rock': {'takes': ROCK_TAKES, 'box': list(ROCK_BOX)},
        'feet': mk['feet'],
        'acting': mk['acting'],
    }
    with open(GAME + '/src/ui/combat/fieldArt.json', 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(art, fh, indent=2)
        fh.write('\n')
    print('  fieldArt.json')


if __name__ == '__main__':
    part = sys.argv[1] if len(sys.argv) > 1 else 'all'
    print('exporting the field:', part)
    if part in ('all', 'ground'):
        ground()
    if part in ('all', 'rocks'):
        rocks()
    mk = marks() if part in ('all', 'marks') else None
    codes = dirt() if part in ('all', 'dirt') else None
    if part == 'all':
        numbers(codes, mk)
