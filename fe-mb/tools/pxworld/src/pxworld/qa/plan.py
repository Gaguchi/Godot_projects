"""Planning crops: the map with the settlements, farms and crossings left out, a faint grid every 10 px with
stage coordinates, NEAREST at z. python qa/plan.py [z]  -> qa/plan/<site>.png"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from PIL import Image, ImageDraw
from pxworld import borderlands as BL

HERE = os.path.dirname(os.path.abspath(__file__))
z = int(sys.argv[1]) if len(sys.argv) > 1 else 5
skip = {'riverside_market', 'south_junction', 'pine_crossing', 'old_mill_crossing', 'broken_bridge', 'farms'}
cv, info = BL.render(1, skip=skip)
import numpy as np, pickle
np.savez_compressed(os.path.join(HERE, 'plan_cache.npz'), ix=cv.ix, roads=info['roads'], water=info['water'], fields=info['fields'])
pickle.dump(info['road_px'], open(os.path.join(HERE, 'plan_roads.pkl'), 'wb'))
im = cv.image().convert('RGB')
im.save(os.path.join(HERE, 'plan_world.png'))
BOX = {'market': (590, 345, 150, 100), 'south_junction': (760, 490, 125, 95), 'pine_crossing': (1015, 360, 125, 90),
       'mill': (770, 255, 100, 70), 'broken_bridge': (900, 540, 110, 64),
       'farm0': (546, 402, 82, 54), 'farm1': (278, 292, 82, 54), 'farm2': (832, 620, 82, 54),
       'farm3': (676, 422, 82, 54), 'farm4': (230, 418, 82, 54), 'farm5': (156, 300, 82, 54)}
os.makedirs(os.path.join(HERE, 'plan'), exist_ok=True)
for k, (x, y, w, h) in BOX.items():
    c = im.crop((x, y, x + w, y + h)).resize((w * z, h * z), Image.NEAREST)
    d = ImageDraw.Draw(c)
    for gx in range((x // 10 + 1) * 10, x + w, 10):
        d.line([((gx - x) * z, 0), ((gx - x) * z, h * z)], fill=(255, 255, 255), width=1)
        d.text(((gx - x) * z + 2, 2), str(gx), fill=(255, 255, 255))
    for gy in range((y // 10 + 1) * 10, y + h, 10):
        d.line([(0, (gy - y) * z), (w * z, (gy - y) * z)], fill=(255, 255, 255), width=1)
        d.text((2, (gy - y) * z + 2), str(gy), fill=(255, 255, 255))
    c.save(os.path.join(HERE, 'plan', k + '.png'))
print('ok')
