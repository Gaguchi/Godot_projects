"""Zoom a crop of a preview render with NEAREST: python dirs/ux-tavern/zoom.py Board x y w h scale name -> dirs/ux-tavern/t/name.png"""
import sys
from PIL import Image
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
b, x, y, w, h, s, n = sys.argv[1], *map(int, sys.argv[2:7]), sys.argv[7]
im = Image.open(f'{ROOT}/out/preview/{b}.png').convert('RGB').crop((x, y, x + w, y + h))
im.resize((w * s, h * s), Image.NEAREST).save(f'{ROOT}/src/ux-tavern/t/{n}.png')
print(n, w * s, h * s)
