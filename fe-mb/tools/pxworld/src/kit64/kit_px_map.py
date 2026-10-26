"""kit_px_map: the Borderlands as 1x pixel art for the Filigree kit (owner 2026-10-24: "go pixel everywhere").

kit.world_map() and kit.ground() find this module by name and use it; F64_PAINTED=1 forces the old paint.

    map_uri(company=True)    the accepted 1x Borderlands, exactly the world PxMap1x shows (pxworld.borderlands.render(1)),
                             as a 1280 x 720 PNG data URI. company=False: the same world without the company and its standard.
    ground_uri(w, h, seed=3) a plain 1x meadow of any size in pxworld's grass technique: half-step sun and shade patches,
                             grass tufts in clumps, flower sprigs and a few field stones. No hills, roads or water.
    company_patch(x, y)      the company stood with its middle figure's foot on stage point (x, y), y-sorted into the world
                             like everything else: (left, top, uri) of the small rectangle where that world differs from
                             map_uri(company=False) (the three minis, the standard, their ground shadows, whatever stands
                             in front of them). Lay it at 1:1 over world_map(company=False).
    company_img(x, y)        company_patch() as a positioned <img>, ready to concatenate after world_map(company=False).
    company_box(x, y)        (left, top, w, h) of that patch, to keep road beads and other markers off the figures.
    CAMP_FOOT                where the map itself stands them: (463, 420), by Frontier Camp's east gate.
    STAND[key] / stand(key)  where they stand at a stop, chosen on the pixel map so no house or tree cuts them: Frontier
                             Camp's east gate, the west end of Riverside Market's square, Pine Crossing's west road.
                             Other stops fall back to the camp's offset (anchor + (11, 10)); look at a crop before using one.
    road_paths()             every road as the pixel map draws it, {(a, b): [(x, y), ...]} in stage px: the painted curves,
                             except that the roads to Old Mill Crossing and Broken Bridge end on the bridge heads.

Everything is cached in the process and on disk (dirs/px-popups/cache/), keyed on the sources of pxworld and of the painted
world's data, so a fix to pxworld re-renders and nothing else does. A cold render of the world takes about 20 s.
"""
import base64
import hashlib
import io
import json
import os
import sys

import numpy as np

KIT = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(KIT)
CACHE = os.path.join(DIRS, 'px-popups', 'cache')
SOURCES = [os.path.join(DIRS, 'pxworld', f) for f in sorted(os.listdir(os.path.join(DIRS, 'pxworld'))) if f.endswith('.py')]
SOURCES += [os.path.join(DIRS, 'hyb-64', f) for f in ('world_map.py', 'paint.py')]
VERSION = 'kit_px_map 1'           # the world's cache key; the meadow carries its own GROUND_V
GROUND_V = 2
CAMP_FOOT = (463, 420)          # P['frontier_camp'] + (11, 10), as pxworld.borderlands stands the company
STAND = {'frontier_camp': CAMP_FOOT, 'riverside_market': (652, 405), 'pine_crossing': (1036, 414)}
_MEM = {}


def stand(key):
    """The company's foot point at a stop (stage px)."""
    if key in STAND:
        return STAND[key]
    import kit_world_map as WM
    x, y = WM.P[key]
    return (x + 11, y + 10)


def road_paths():
    """{(a, b): [(x, y), ...]}: each road's centre line on the pixel map, in stage px."""
    if 'roads' in _MEM:
        return _MEM['roads']
    path = _path('roads.json')
    if os.path.exists(path):
        d = json.load(open(path, encoding='utf-8'))
    else:
        BL, _, _, _ = _pxworld()
        d = {f'{a}|{b}': [[float(x), float(y)] for x, y in pts] for (a, b), pts in BL.road_paths(1).items()}
        _write(path, json.dumps(d).encode())
    out = {tuple(k.split('|')): [tuple(p) for p in v] for k, v in d.items()}
    _MEM['roads'] = out
    return out


def _key():
    if 'key' not in _MEM:
        h = hashlib.sha1(VERSION.encode())
        for p in SOURCES:
            if os.path.exists(p):
                h.update(open(p, 'rb').read())
        _MEM['key'] = h.hexdigest()[:12]
    return _MEM['key']


def _path(name):
    return os.path.join(CACHE, f'{_key()}_{name}')


def _write(path, data):
    os.makedirs(CACHE, exist_ok=True)
    tmp = f'{path}.{os.getpid()}.tmp'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, path)


def _pxworld(world=True):
    """Import pxworld without leaving its folders at the front of sys.path (borderlands puts hyb-64 there, whose
    common.py and world_map.py would shadow a caller's own modules of the same name). world=False skips the
    overworld (and the painted world's data it loads), for the meadow and the PNG writer."""
    saved = list(sys.path)
    try:
        if DIRS not in sys.path:
            sys.path.insert(0, DIRS)
        from pxworld import terrain, pal, canvas
        if not world:
            return None, terrain, pal, canvas
        from pxworld import borderlands
        return borderlands, terrain, pal, canvas
    finally:
        sys.path[:] = saved


def _uri(png):
    return 'data:image/png;base64,' + base64.b64encode(png).decode()


def _indices(png):
    from PIL import Image
    return np.array(Image.open(io.BytesIO(png)))


def _png_of(ix):
    """Palette-index array -> PNG bytes in pxworld's palette."""
    _, _, _, canvas = _pxworld(False)
    cv = canvas.Canvas(ix.shape[1], ix.shape[0])
    cv.ix[:] = ix
    return cv.png_bytes()


# ------------------------------------------------------------------ the world
def _map_png(company):
    k = ('map', company)
    if k in _MEM:
        return _MEM[k]
    path = _path(f'map_{"c1" if company is True else "c0" if company is False else "at_%d_%d" % company}.png')
    if os.path.exists(path):
        png = open(path, 'rb').read()
    else:
        BL, _, _, _ = _pxworld()
        cv, _info = BL.render(1, company=company)
        png = cv.png_bytes()
        _write(path, png)
    _MEM[k] = png
    return png


def map_uri(company=True):
    """The accepted 1x Borderlands (the PxMap1x world) as a 1280 x 720 PNG data URI; company=False leaves the company out."""
    return _uri(_map_png(bool(company)))


def _patch(x, y):
    x, y = int(round(x)), int(round(y))
    k = ('patch', x, y)
    if k in _MEM:
        return _MEM[k]
    path = _path(f'patch_{x}_{y}.json')
    if os.path.exists(path):
        d = json.load(open(path, encoding='utf-8'))
    else:
        if (x, y) == CAMP_FOOT:
            at = _indices(_map_png(True))
        else:
            BL, _, _, _ = _pxworld()
            cv, _info = BL.render(1, company=(x, y))
            at = cv.ix
        base = _indices(_map_png(False))
        ys, xs = np.nonzero(at != base)
        x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        d = {'left': x0, 'top': y0, 'w': x1 - x0, 'h': y1 - y0, 'uri': _uri(_png_of(at[y0:y1, x0:x1]))}
        _write(path, json.dumps(d).encode())
    _MEM[k] = d
    return d


def company_patch(x, y):
    """(left, top, uri): the company with its middle figure's foot on stage point (x, y), as the few world pixels that change."""
    d = _patch(x, y)
    return d['left'], d['top'], d['uri']


def company_box(x, y):
    """(left, top, w, h) of company_patch(x, y): keep markers laid over the world (road beads) off the figures."""
    d = _patch(x, y)
    return d['left'], d['top'], d['w'], d['h']


def company_img(x, y):
    """The company stood on stage point (x, y), as an <img> at 1:1 to lay over world_map(company=False)."""
    left, top, uri = company_patch(x, y)
    return (f'<img class="abs" alt="" style="left:{left}px;top:{top}px;image-rendering:pixelated" src="{uri}">')


# ------------------------------------------------------------------ a plain meadow
def _ground_png(w, h, seed):
    import random
    k = ('ground', w, h, seed)
    if k in _MEM:
        return _MEM[k]
    path = _path(f'ground{GROUND_V}_{w}x{h}_{seed}.png')
    if os.path.exists(path):
        png = open(path, 'rb').read()
    else:
        _, TR, _, canvas = _pxworld(False)
        cv = canvas.Canvas(w, h)
        TR.grass(cv, seed=4 + seed, g=1)                    # the map's meadow: base g5, half-step shade g4 and sun g6
        rng = random.Random(seed)

        def free(p):
            return 3 <= p[0] < w - 3 and 4 <= p[1] < h - 2
        centres = TR.poisson(rng, 0, 0, w, h, 46, max(200, w * h // 300), free)
        tpts = TR.clustered(rng, centres, (3, 8), 8, free) + TR.poisson(rng, 0, 0, w, h, 34, max(200, w * h // 400), free)
        kept = []                                           # tufts never overlap: a blade shifted twice reads as a bar
        for p in tpts:
            if all(abs(p[0] - q[0]) >= 8 or abs(p[1] - q[1]) >= 5 for q in kept):
                kept.append(p)
        TR.tufts(cv, rng, kept, 1)
        TR.flowers(cv, rng, TR.poisson(rng, 0, 0, w, h, 70, max(100, w * h // 1000), free), g=1)
        TR.stones(cv, rng, TR.poisson(rng, 0, 0, w, h, 90, max(60, w * h // 1600), free), g=1)
        png = cv.png_bytes()
        _write(path, png)
    _MEM[k] = png
    return png


def ground_uri(w, h, seed=3):
    """A plain 1x pixel meadow, w x h, as a PNG data URI."""
    return _uri(_ground_png(int(w), int(h), int(seed)))


if __name__ == '__main__':
    import time
    t = time.time()
    for c in (True, False):
        print('map company=%s' % c, len(map_uri(c)), round(time.time() - t, 1), 's')
    print('ground', len(ground_uri(560, 720)), round(time.time() - t, 1), 's')
    print('camp patch', company_patch(*CAMP_FOOT)[:2], round(time.time() - t, 1), 's')
