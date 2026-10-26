"""crop.py name x0 y0 x1 y1 zoom [src]: a NEAREST crop of a render into dirs/px-open-a/qa/<name>.png"""
import sys, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
n, x0, y0, x1, y1, z = sys.argv[1], *map(int, sys.argv[2:7])
src = sys.argv[7] if len(sys.argv) > 7 else os.path.join(HERE, '..', '..', 'preview', 'PxOpenA.png')
im = Image.open(src).convert('RGB').crop((x0, y0, x1, y1))
im.resize(((x1 - x0) * z, (y1 - y0) * z), Image.NEAREST).save(os.path.join(HERE, 'qa', n + '.png'))
