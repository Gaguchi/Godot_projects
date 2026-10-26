"""Zoom a crop of a preview render with NEAREST: python dirs/ux-market/zoom.py Board x y w h scale name"""
import sys
from PIL import Image
SP = 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad'
b, x, y, w, h, s, n = sys.argv[1], *map(int, sys.argv[2:7]), sys.argv[7]
im = Image.open(f'{SP}/preview/{b}.png').convert('RGB').crop((x, y, x + w, y + h))
im.resize((w * s, h * s), Image.NEAREST).save(f'{SP}/dirs/ux-market/z/{n}.png')
print(n, w * s, h * s)
