"""Variant A layout planner: draw a candidate layout as a flat schematic over the UI windows and check it.

python plan.py <layout_module> [out.png]
The layout module defines P (stage px, off-screen allowed), ROADS [(a, b, bend | [waypoints])], RIVER (pts),
CROSS (road keys allowed to cross the river: the mill, the broken bridge and the fords).
Checks: road/road crossings, road/river crossings outside CROSS, places under windows, compass coverage.
"""
import importlib
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'hyb-64'))
from paint import quad, quad_pts, sample_catmull   # noqa: E402

WINDOWS = {'region': (14, 14, 486, 190), 'menu': (982, 14, 1266, 136), 'company': (14, 496, 406, 710),
           'footnote': (424, 690, 900, 712)}


def road_pts(P, a, b, g, n=40):
    A, B = P[a], P[b]
    if isinstance(g, (int, float)):
        return quad_pts(A, B, quad(A, B, g), n)
    return sample_catmull([A] + list(g) + [B], 10)


def seg_x(p1, p2, p3, p4):
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-9:
        return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    if 0 < t < 1 and 0 < u < 1:
        return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))
    return None


def crossings(pa, pb):
    out = []
    for i in range(len(pa) - 1):
        for j in range(len(pb) - 1):
            x = seg_x(pa[i], pa[i + 1], pb[j], pb[j + 1])
            if x:
                out.append(x)
    return out


def main(modname, out=None):
    L = importlib.import_module(modname)
    P, ROADS = L.P, L.ROADS
    river = sample_catmull(L.RIVER, 14)
    geo = {(a, b): road_pts(P, a, b, g) for a, b, g in ROADS}
    # ---- checks
    keys = list(geo)
    print('road/road crossings:')
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            ka, kb = keys[i], keys[j]
            if set(ka) & set(kb):
                continue
            xs = crossings(geo[ka], geo[kb])
            if xs:
                print('  X', ka, kb, [tuple(int(v) for v in x) for x in xs])
    print('road/river crossings:')
    cross_ok = set(getattr(L, 'CROSS', ()))
    for k, pts in geo.items():
        xs = crossings(pts, river)
        if xs:
            tag = 'ok ' if (k in cross_ok or (k[1], k[0]) in cross_ok) else 'BAD'
            print(f'  {tag}', k, [tuple(int(v) for v in x) for x in xs])
    print('places under windows / labels:')
    for k, (x, y) in P.items():
        for wn, (x0, y0, x1, y1) in WINDOWS.items():
            if x0 - 30 <= x <= x1 + 30 and y0 - 20 <= y <= y1 + 30:
                print('  ', k, (x, y), 'near', wn)
    C = P['frontier_camp']
    print('camp', C, 'middle third:', 427 <= C[0] <= 853 and 240 <= C[1] <= 480)
    print('compass from camp (deg, 0 = north, clockwise), dist, hop length of each road:')
    for k, (x, y) in sorted(P.items(), key=lambda kv: math.degrees(math.atan2(kv[1][0] - C[0], -(kv[1][1] - C[1]))) % 360):
        ang = math.degrees(math.atan2(x - C[0], -(y - C[1]))) % 360
        on = 0 <= x <= 1280 and 0 <= y <= 720
        print(f'   {ang:5.0f}  {math.dist((x, y), C):5.0f}  {"  " if on else "off"} {k}')
    for k, pts in geo.items():
        Ln = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
        print(f'   road {k[0]:>18} - {k[1]:<18} {Ln:5.0f}')
    # ---- draw
    im = Image.new('RGB', (1280, 720), (98, 126, 47))
    d = ImageDraw.Draw(im)
    try:
        fnt = ImageFont.truetype('arial.ttf', 13)
    except OSError:
        fnt = ImageFont.load_default()
    for poly, kind in getattr(L, 'FORESTS', []):
        d.polygon(poly, fill=(40, 70, 30) if kind == 'leaf' else (25, 50, 35))
    for poly, kind in getattr(L, 'FIELDS', []):
        d.polygon(poly, fill=(200, 175, 90))
    for (x, y, rx, ry, _) in getattr(L, 'HILLS', []):
        d.ellipse((x - rx, y - ry, x + rx, y + ry), outline=(140, 160, 80), width=2)
    d.line(river, fill=(55, 110, 120), width=22)
    for k, pts in geo.items():
        d.line(pts, fill=(185, 157, 110), width=6)
    x0, y0, x1, y1 = 427, 240, 853, 480
    d.rectangle((x0, y0, x1, y1), outline=(255, 255, 255))
    for k, (x, y) in P.items():
        r = 9
        col = (240, 212, 136) if k == 'frontier_camp' else (230, 230, 230)
        d.ellipse((x - r, y - r, x + r, y + r), fill=col, outline=(0, 0, 0))
        tx, ty = max(4, min(1180, x - 30)), max(2, min(700, y + 10))
        d.text((tx, ty), L.NAMES.get(k, k), fill=(255, 255, 255), font=fnt, stroke_width=2, stroke_fill=(0, 0, 0))
    for wn, (a, b, c, e) in WINDOWS.items():
        d.rectangle((a, b, c, e), fill=(46, 34, 24), outline=(220, 177, 86))
    for x, y in getattr(L, 'EXTRA_MARKS', []):
        d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(255, 0, 0))
    out = out or os.path.join(HERE, 't', f'plan_{modname}.png')
    im.save(out)
    print('wrote', out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
