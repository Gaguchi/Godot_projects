"""Fast layout loop: python qa/fast.py <site> [z] [grid]  -> qa/fast_<site>.png
Loads the planning cache (qa/plan.py), runs one place builder on it, draws, crops NEAREST at z."""
import importlib
import os
import pickle
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import numpy as np
from PIL import Image, ImageDraw
from pxworld import places as PL, build as BD, canvas as CV
importlib.reload(BD)
importlib.reload(PL)

HERE = os.path.dirname(os.path.abspath(__file__))
site = sys.argv[1]
z = int(sys.argv[2]) if len(sys.argv) > 2 else 5
grid = len(sys.argv) > 3 and sys.argv[3] == 'grid'
c = np.load(os.path.join(HERE, 'plan_cache.npz'))
cv = CV.Canvas(1280, 720)
cv.ix[:] = c['ix']
sc = PL.Scene(cv, 1, seed=11)
sc.roads, sc.water, sc.fields = c['roads'], c['water'], c['fields']
sc.road_px = pickle.load(open(os.path.join(HERE, 'plan_roads.pkl'), 'rb'))
sc.ground = ('g', 'd', 'h', 't')
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(HERE)), 'hyb-64'))
import world_map as WM
P = WM.P
BOX = {'market': (590, 345, 150, 100), 'south_junction': (760, 490, 125, 95), 'pine_crossing': (1015, 360, 125, 90),
       'mill': (770, 255, 100, 70), 'broken_bridge': (900, 540, 110, 64)}
if site == 'market':
    PL.market(sc, *P['riverside_market'])
elif site == 'south_junction':
    PL.south_junction(sc, *P['south_junction'])
elif site == 'pine_crossing':
    PL.pine_crossing(sc, *P['pine_crossing'])
elif site == 'mill':
    x, y = P['old_mill_crossing']
    PL.mill(sc, x, y, min(WM.river_pts, key=lambda q: abs(q[1] - (y - 5)))[0])
elif site == 'broken_bridge':
    x, y = P['broken_bridge']
    PL.broken_bridge(sc, min(WM.river_pts, key=lambda q: abs(q[1] - y))[0], y)
elif site.startswith('farm'):
    i = int(site[4:])
    fx, fy = WM.FARMS[i]
    PL.farm(sc, fx, fy, i)
    BOX[site] = (int(fx) - 46, int(fy) - 34, 92, 62)
sc.draw()
x, y, w, h = BOX[site]
im = cv.image().convert('RGB').crop((x, y, x + w, y + h)).resize((w * z, h * z), Image.NEAREST)
if grid:
    d = ImageDraw.Draw(im)
    for gx in range((x // 10 + 1) * 10, x + w, 10):
        d.line([((gx - x) * z, 0), ((gx - x) * z, 6)], fill=(255, 255, 255))
        d.text(((gx - x) * z + 2, 2), str(gx), fill=(255, 255, 255))
    for gy in range((y // 10 + 1) * 10, y + h, 10):
        d.line([(0, (gy - y) * z), (6, (gy - y) * z)], fill=(255, 255, 255))
        d.text((2, (gy - y) * z + 2), str(gy), fill=(255, 255, 255))
im.save(os.path.join(HERE, f'fast_{site}.png'))
print('ok', site)
