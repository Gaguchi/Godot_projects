"""Renders today's country and variant A's with px-open-a/overview_a.py, large, for the choice canvas.
Run in its own process (the variant folders fork helpers with the same names). Writes t/ov_<k>.png + t/ov_<k>.json."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(DIRS, 'px-open-a'))
import numpy as np
from PIL import Image
import overview_a as OA
import country_a as CA
import layout_a as LA
import px64 as P

def save(k, R, info, w, h):
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for j in range(R.h):
        for i in range(R.w):
            c = R.px[j][i]
            if c is not None:
                hx = P.C[c]
                px[i, j] = tuple(int(hx[q:q + 2], 16) for q in (1, 3, 5)) + (255,)
    im.save(os.path.join(HERE, 't', f'ov_{k}.png'))
    reg = info['reg']
    lab = {}
    for r in ('borderlands', 'thornwood', 'ashfall'):
        ys, xs = np.nonzero(reg == r)
        lab[r] = (float(np.median(xs)), float(np.median(ys)))
    json.dump({'w': w, 'h': h, 'camp': info['camp'], 'throne': info['throne'], 'labels': lab},
              open(os.path.join(HERE, 't', f'ov_{k}.json'), 'w'), indent=1)

W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 600, int(sys.argv[2]) if len(sys.argv) > 2 else 520
R, T, info = OA.render(W, H)
save('a', R, info, W, H)

# today: world.json's own positions, drawn by the same painter (A's river and fields are A's, so leave them out)
world = CA.load_world()
today = {n['id']: (n['position']['x'] * 0.8, n['position']['y'] * 0.8) for n in world['nodes']}
CA.positions = lambda: dict(today)
LA.RIVER = [(-9e5, -9e5), (-9e5 + 1, -9e5), (-9e5 + 2, -9e5), (-9e5 + 3, -9e5)]
LA.FIELDS = []
th = int(sys.argv[3]) if len(sys.argv) > 3 else 200
R, T, info = OA.render(W, th, north_pad=0)
save('today', R, info, W, th)
print('ok')
