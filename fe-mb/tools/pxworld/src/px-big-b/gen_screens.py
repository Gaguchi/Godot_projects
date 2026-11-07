"""The big country under the pop-ups: the map screen (gen_boards.screen) in the run state each pop-up board stands in.

Writes t/screens/<Board>.html, one fragment per board, for src/px-popups (big_screen() there reads them):
the map screen's parts in their own .dir-hyb64 scope with px64's stylesheet, so they draw exactly as PxBigMap does
inside the kit's .f64 page. Each state's avoid box is the pop-up's own window: no place name is left cut at its edge.
Usage: python gen_screens.py [Board ...]   (then rebuild the pop-up boards)
"""
import os
import sys

import geo
import gen_boards as G
import land as LD
import world_big as WB
from px64 import css_base, SCOPE

OUT = os.path.join(G.HERE, 't', 'screens')


def centred(w, h):
    x, y = (1280 - w) // 2, (720 - h) // 2
    return (x, y, x + w, y + h)


def along(a, b, t):
    """The point t of the way along the drawn road from a to b (world px)."""
    key = (a, b) if (a, b) in G.road_px else (b, a)
    pts = G.road_px[key] if key[0] == a else G.road_px[key][::-1]
    pts = geo.resample(pts, 1.0)
    x, y = pts[int(t * (len(pts) - 1))]
    return (int(x), int(y))


def at_town(k, toward):
    """Where the company stands arriving at k: on the road in from `toward`, just clear of k's buildings."""
    key = (k, toward) if (k, toward) in G.road_px else (toward, k)
    pts = G.road_px[key] if key[0] == k else G.road_px[key][::-1]
    x0, y0, x1, y1 = G.foot(k)
    for x, y in geo.resample(pts, 1.0):
        if not (x0 - 8 <= x <= x1 + 8 and y0 - 6 <= y <= y1 + 14):
            return (int(x), int(y))
    raise ValueError(k)


ROAD = along('frontier_camp', 'traders_rest', 0.55)        # the hop begun: the point F64Check and F64Dialogue use
STATES = {
    # board: (screen kwargs, the company's standing point or None for the camp yard). At the camp the view is the
    # map board's own, so a pop-up opens over the map as the player left it; elsewhere `place` keeps the company in sight
    'F64Company': (dict(day=1, food=8, avoid=[(52, 80, 1230, 642)], hint=False), None),   # no room for the footnote
    'F64Pause': (dict(day=1, food=8, avoid=[centred(420, 334)]), None),
    'F64Contracts': (dict(here='pine_crossing', day=4, food=5, contracts='two open', avoid=[centred(660, 460)],
                          place=(1060, 400)), at_town('pine_crossing', 'rodericks_camp')),
    'F64Check': (dict(here=None, toward='traders_rest', day=2, food=7, avoid=[centred(604, 318)], place=(1000, 600)), ROAD),
    'F64Dialogue': (dict(here=None, toward='traders_rest', day=2, food=7, avoid=[(260, 460, 1020, 704)]), ROAD),
    'F64Name': (dict(here='riverside_market', day=2, food=7, contracts='one open', avoid=[centred(572, 232)],
                     place=(1000, 560)),
                at_town('riverside_market', 'frontier_camp')),
}

# px64's stylesheet without its page rule: the pop-up page keeps its own body
CSS = '\n'.join(r for r in css_base().split('\n') if not r.startswith('body{'))


def main():
    os.makedirs(OUT, exist_ok=True)
    worlds = {None: G.cv}
    only = sys.argv[1:]
    for board, (kw, stand) in STATES.items():
        if only and board not in only:
            continue
        if stand not in worlds:
            worlds[stand] = WB.render(company=stand)[0]
        parts, ox, oy = G.screen(hover=None, stand=stand, world=worlds[stand], **kw)
        frag = (f'<style>{CSS}</style>\n<div class="{SCOPE}" style="position:absolute;left:0;top:0;width:1280px;'
                f'height:720px;overflow:hidden">\n' + '\n'.join(parts) + '\n</div>\n')
        with open(os.path.join(OUT, board + '.html'), 'w', encoding='utf-8') as fh:
            fh.write(frag)
        print(board, len(frag), 'view', (ox, oy), 'company', stand)


if __name__ == '__main__':
    main()
