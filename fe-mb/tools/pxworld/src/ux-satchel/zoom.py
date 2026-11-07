"""QA crops: python dirs/ux-satchel/zoom.py <Board> x y w h scale name  ->  dirs/ux-satchel/z/<name>.png (PIL NEAREST)."""
import os
import sys

from PIL import Image

ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
board, x, y, w, h, s, name = sys.argv[1], *map(int, sys.argv[2:7]), sys.argv[7]
im = Image.open(f'{ROOT}/out/preview/{board}.png').crop((x, y, x + w, y + h))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'z', f'{name}.png')
im.resize((w * s, h * s), Image.NEAREST).save(out)
print(out)
