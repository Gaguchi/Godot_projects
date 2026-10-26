"""Planning schematic: places, roads, the river and the brook, the zones, the view frame and the UI windows.
python schem.py [heart|country]  -> t/schem_heart.png (0.5x) or t/schem_country.png (0.2x)"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import land as LD  # noqa: E402

mode = sys.argv[1] if len(sys.argv) > 1 else 'heart'
font = ImageFont.load_default()
if mode == 'heart':
    s, X0, Y0, W, H = 0.5, -40, -40, 2640, 1520
else:
    s, X0, Y0, W, H = 0.16, -1500, -1100, 5300, 3700
im = Image.new('RGB', (int(W * s), int(H * s)), (120, 150, 90))
d = ImageDraw.Draw(im)
T = lambda p: ((p[0] - X0) * s, (p[1] - Y0) * s)
for name, poly in LD.ZONES.items():
    col = {'thornwood': (60, 100, 60), 'ashfall': (150, 140, 120)}[name]
    d.polygon([T(p) for p in poly], fill=col)
d.rectangle([T((0, 0)), T((2560, 1440))], outline=(255, 255, 255))
vx, vy = LD.VIEW
d.rectangle([T((vx, vy)), T((vx + 1280, vy + 720))], outline=(230, 200, 80), width=2)
for (x0, y0, x1, y1) in LD.UI_WORLD:
    d.rectangle([T((x0, y0)), T((x1, y1))], outline=(90, 60, 40))
for course in (LD.RIVER, LD.BROOK):
    pts = LD.spline(course, 10)
    d.line([T(p) for p in pts], fill=(60, 110, 200), width=max(1, int(18 * s)))
hops = LD.hops()
for a, b, *_ in LD.roads():
    col = (90, 60, 30) if not (LD.NODE[a].get('hidden') or LD.NODE[b].get('hidden')) else (200, 120, 120)
    d.line([T(LD.P[a]), T(LD.P[b])], fill=col, width=2)
for k, p in LD.P.items():
    n = LD.NODE[k]
    c = {'TOWN': (240, 220, 120), 'CAMP': (240, 240, 240), 'TRAIL': (180, 180, 180), 'DISCOVERY': (230, 120, 90),
         'DUNGEON': (40, 40, 40), 'BOSS': (200, 0, 0)}[n['type']]
    x, y = T(p)
    r = 4 if mode == 'heart' else 2.5
    d.ellipse([x - r, y - r, x + r, y + r], fill=c, outline=(0, 0, 0))
    new = '*' if k in LD.NEW else ''
    lab = f"{n['name']}{new} {hops.get(k, '-')}" if mode == 'heart' else (f"{hops.get(k, '-')}")
    d.text((x + 5, y - 5), lab, fill=(0, 0, 0) if k in LD.NEW else (120, 0, 0), font=font)
out = os.path.join(HERE, 't', f'schem_{mode}.png')
im.save(out)
print(out)
