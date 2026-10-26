"""Plot the whole country (positions in world_b.P, every B road) at 1:5, with the view's frame."""
import os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import world_b as W
xs = [p[0] for p in W.P.values()]; ys = [p[1] for p in W.P.values()]
x0, y0, x1, y1 = min(xs) - 150, min(ys) - 150, max(xs) + 150, max(ys) + 150
s = 5
im = Image.new('RGB', (int((x1 - x0) / s), int((y1 - y0) / s)), (235, 228, 210))
d = ImageDraw.Draw(im)
f = ImageFont.truetype('C:/Windows/Fonts/georgia.ttf', 10)
T = lambda p: ((p[0] - x0) / s, (p[1] - y0) / s)
d.rectangle([T((0, 0)), T((1280, 720))], outline=(0, 0, 0))
h = W.hops()
col = {'borderlands': (90, 140, 60), 'thornwood': (20, 80, 50), 'ashfall': (150, 60, 40)}
for a, b, *_ in W.b_roads():
    if W.NODE[a].get('hidden') or W.NODE[b].get('hidden'):
        continue
    d.line([T(W.P[a]), T(W.P[b])], fill=(120, 100, 80), width=1)
for k, p in W.P.items():
    x, y = T(p)
    c = col[W.NODE[k]['region']]
    d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=c)
    d.text((x + 5, y - 6), f"{W.NAMES[k]} {h.get(k, '-')}", fill=(0, 0, 0), font=f)
im.save(os.path.join(HERE, 'qa', 'country.png'))
print(im.size)
