"""Fast layout check: the view as flat zones, river, roads, place dots with their hop count, label boxes,
the UI windows and the forecast card as boxes. python qa_schematic.py [out.png]"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import world_b as W  # noqa: E402

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'qa', 'schematic.png')
im = Image.new('RGB', (1280, 720), (110, 140, 60))
d = ImageDraw.Draw(im)
try:
    font = ImageFont.truetype('C:/Windows/Fonts/georgiab.ttf', 13)
    small = ImageFont.truetype('C:/Windows/Fonts/georgia.ttf', 11)
except OSError:
    font = small = ImageFont.load_default()

for name, poly in W.ZONES.items():
    col = {'thornwood': (30, 70, 45), 'ashfall': (130, 120, 105), 'wood': (60, 100, 40), 'field': (190, 170, 90)}[name.split(':')[0]]
    for p in (poly if isinstance(poly[0][0], (list, tuple)) else [poly]):
        d.polygon([tuple(q) for q in p], fill=col)
d.line(W.river_pts, fill=(60, 120, 140), width=20)
hops = W.hops()
for key, pts in W.road_paths().items():
    hidden = any(W.NODE[k].get('hidden') for k in key if k in W.NODE)
    d.line(pts, fill=(150, 110, 70) if not hidden else (120, 120, 120), width=4 if not hidden else 1)
for k, (x, y) in W.P.items():
    if not (0 <= x <= 1280 and 0 <= y <= 720):
        continue
    if W.NODE[k].get('hidden'):
        d.ellipse((x - 4, y - 4, x + 4, y + 4), outline=(200, 200, 200))
        continue
    r = 9
    d.ellipse((x - r, y - r, x + r, y + r), fill=(240, 220, 160), outline=(0, 0, 0))
    d.text((x - 4, y - 7), str(hops.get(k, '?')), fill=(0, 0, 0), font=small)
for k, box in W.label_boxes().items():
    d.rectangle(box, outline=(255, 255, 255))
    d.text((box[0] + 2, box[1] + 1), W.NAMES[k], fill=(255, 255, 255), font=small)
for (x0, y0, x1, y1, nm) in W.UI_BOXES:
    d.rectangle((x0, y0, x1, y1), fill=(45, 33, 24), outline=(220, 180, 90))
    d.text((x0 + 6, y0 + 4), nm, fill=(220, 200, 160), font=font)
for s in W.SIGNS:
    x, y = s['at']
    d.rectangle((x, y - 24, x + s['w'], y - 2), fill=(95, 70, 50), outline=(0, 0, 0))
    d.text((x + 4, y - 21), s['text'], fill=(240, 230, 200), font=small)
    d.text((x + 4, y + 1), s['sub'], fill=(255, 255, 255), font=small)
im.save(out)
print('wrote', out)
