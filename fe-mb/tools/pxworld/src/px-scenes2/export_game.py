"""Export the dungeon's cave to the game (game/): the rock, and every chamber and passage a descent can have.

    python src/px-scenes2/export_game.py [quick]        (from tools/pxworld; about 85 renders, 15 to 25 minutes)

Writes
    game/public/art/cave/cave.png              the rock at 1x, 1280 x 720, with the stair and the hall at its foot
    game/public/art/cave/room_r<r>c<c>.png     one chamber, cut out where it lies (24 of them), and room_boss.png
    game/public/art/cave/way_<from>_<to>.png   one passage, cut out where it lies, with the gaps it opens in the
                                               walls of the two chambers it joins (58 of them)
    game/public/art/cave/prop_<kind>.png       cargo and kit for the chamber floors (crate, barrel, chest, bedroll...)
    game/src/ui/dungeon/caveArt.json           where every room stands, each piece's box, the props a room keeps

WHY PIECES. The board (F64Dungeon) is one painting of one descent. The game makes each descent from the run's
seed (`engine/procgen/dungeonGraph.ts`), so no painting made here can be the one a player is in. But every descent
is cut from the SAME lattice: 6 rows by 4 columns, a hall at the stair's foot above them and one boss chamber
below, and a passage only ever joins a room to the row under it, at most one column over. So every chamber and
every passage that can exist is painted here once, alone, in its own place, by the function that paints the board
(`cave.py`, undressed: no rubble or cargo, which one generator scatters across the whole cave), and what it
changed is cut out. The game lays the pieces of the descent it has over the bare rock, passages over chambers,
and gets the painting of that descent.

A passage is painted with its two chambers present and compared with those chambers alone, so its piece carries
the breach in each chamber's wall as well as its own floor. Two passages never cross and part company at a
chamber's rim, so their pieces do not fight.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../..').replace('\\', '/')            # tools/pxworld
GAME = os.path.abspath(ROOT + '/../../game').replace('\\', '/')
OUT = GAME + '/public/art/cave'
sys.path.insert(0, HERE)
import pxs                       # noqa: E402,F401  (first: the palette's Vault ramp)
sys.path.insert(0, ROOT + '/src/kit64')
import cave_graph as G           # noqa: E402
import cave as CV                # noqa: E402

ROWS, COLS = 6, 4
BOSS = f'r{ROWS}c0'


def scene(rooms, edges):
    """The cave with just these rooms and passages, undressed, as an RGB array."""
    G.ROOMS = dict(rooms)
    G.EDGES = {}
    G.ALL_EDGES = list(edges)
    G.WALKED = ['mouth']
    G.CLEARED = set()
    G.HERE = 'mouth'
    G.REACH = []
    G.HOVER = None
    CV.RIDS = list(rooms)
    CV.POOL = [(-90, -90), (-80, -90), (-80, -80), (-90, -80)]      # the board's seep lies where a chamber may: not here
    st, _ = CV.render(dress=False)
    return np.asarray(st.render().convert('RGB')).copy()


def near(points, mx, my):
    """The stage box round these points, grown by (mx, my): where a piece may have painted."""
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    m = np.zeros((720, 1280), bool)
    m[max(0, int(min(ys) - my)):int(max(ys) + my), max(0, int(min(xs) - mx)):int(max(xs) + mx)] = True
    return m


def cut(img, base, name, where):
    """What `img` changed in `base` within `where`, as a picture of just that: saved, and its box returned.
    `where` keeps out the painter's stray specks: a few pixels of moss by the stair fall differently in every
    render, because one generator is shared by the whole cave."""
    diff = np.any(img != base, axis=2) & where
    ys, xs = np.nonzero(diff)
    if not len(xs):
        raise RuntimeError(f'{name}: nothing was painted')
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    out[..., :3] = img[y0:y1, x0:x1]
    out[..., 3] = np.where(diff[y0:y1, x0:x1], 255, 0)
    Image.fromarray(out, 'RGBA').save(f'{OUT}/{name}.png', optimize=True)
    return [x0, y0, x1 - x0, y1 - y0]


def lay(base, img, box_mask):
    """`base` with the changed pixels of `img` laid on it."""
    out = base.copy()
    out[box_mask] = img[box_mask]
    return out


def props():
    """Cargo and kit for the chamber floors, as sprites with their foot anchors (cave.py's own)."""
    table = {}
    for kind, make in (('crate', lambda: CV.crate(seed=3)), ('barrel', CV.barrel), ('chest', CV.chest), ('bedroll', CV.bedroll), ('fire', CV.fire_ring), ('rag', CV.rag_flag)):
        sp = make()
        st = pxs.Stage(np.zeros((sp.h + 4, sp.w + 4), np.uint8), ground_ramps=('t', 'd', 'v'))
        rgba = np.zeros((sp.h, sp.w, 4), np.uint8)
        from pxworld import pal
        for y in range(sp.h):
            for x in range(sp.w):
                i = int(sp.ix[y, x])
                if i == pal.CLEAR:
                    continue
                h = pal.HEX[i]
                rgba[y, x] = (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)
        del st
        Image.fromarray(rgba, 'RGBA').save(f'{OUT}/prop_{kind}.png', optimize=True)
        table[kind] = {'w': sp.w, 'h': sp.h, 'ax': int(sp.ax), 'ay': int(sp.ay)}
    return table


# what a room keeps on its floor, by what it is: (prop, dx, dy) from the room's centre to the prop's foot
KEEPS = {
    'combat': [['crate', -34, 20], ['barrel', 32, 6]],
    'elite': [['crate', -34, 20], ['crate', 26, 22]],
    'treasure': [['chest', 26, 22]],
    'rest': [['bedroll', -38, 18], ['fire', -6, 17]],
    'event': [['barrel', -30, 18]],
    'boss': [['rag', 24, 2], ['crate', -62, 26], ['crate', -58, 12], ['barrel', 56, 22], ['barrel', 65, 10], ['crate', 40, 30], ['crate', -30, 32]],
}


def main(quick=False):
    os.makedirs(OUT, exist_ok=True)
    art = {'rows': ROWS, 'cols': COLS, 'mouth': list(G.MOUTH), 'rooms': {}, 'ways': {}, 'keeps': KEEPS}
    bare = scene({}, [])
    Image.fromarray(bare, 'RGB').save(f'{OUT}/cave.png', optimize=True)
    print('  cave.png', flush=True)

    slots = [(f'r{r}c{c}', 'combat') for r in range(ROWS) for c in range(COLS)] + [(BOSS, 'boss')]
    if quick:
        slots = [s for s in slots if s[0] in ('r0c1', 'r0c2', 'r1c1', 'r1c2', 'r5c1', BOSS)]
    alone = {}
    for rid, kind in slots:
        img = scene({rid: kind}, [])
        name = 'room_boss' if rid == BOSS else f'room_{rid}'
        x, y = G.pos(rid)
        where = near([(x, y)], 150 if kind == 'boss' else 110, 76)
        box = cut(img, bare, name, where)
        alone[rid] = (img, np.any(img != bare, axis=2) & where, kind)
        art['rooms'][rid] = {'x': int(x), 'y': int(y), 'file': name, 'box': box}
        print('  ', name, box, flush=True)

    ways = [('mouth', f'r0c{c}') for c in range(COLS)]
    for r in range(ROWS - 1):
        for c in range(COLS):
            for d in (-1, 0, 1):
                if 0 <= c + d < COLS:
                    ways.append((f'r{r}c{c}', f'r{r + 1}c{c + d}'))
    ways += [(f'r{ROWS - 1}c{c}', BOSS) for c in range(COLS)]
    for a, b in ways:
        if any(e != 'mouth' and e not in alone for e in (a, b)):
            continue
        rooms = {e: alone[e][2] for e in (a, b) if e != 'mouth'}
        base = bare
        for e in rooms:
            base = lay(base, alone[e][0], alone[e][1])
        img = scene(rooms, [(a, b)])
        name = f'way_{a}_{b}'
        box = cut(img, base, name, near([G.pos(a), G.pos(b)], 70, 56))
        art['ways'][f'{a}>{b}'] = {'file': name, 'box': box}
        print('  ', name, box, flush=True)

    art['props'] = props()
    if not quick:
        os.makedirs(GAME + '/src/ui/dungeon', exist_ok=True)
        with open(GAME + '/src/ui/dungeon/caveArt.json', 'w', encoding='utf-8', newline='\n') as fh:
            json.dump(art, fh, indent=1)
            fh.write('\n')
        print('  caveArt.json', flush=True)
    print('exported the cave:', len(art['rooms']), 'rooms,', len(art['ways']), 'ways')
    return art


if __name__ == '__main__':
    main(quick=len(sys.argv) > 1 and sys.argv[1] == 'quick')
