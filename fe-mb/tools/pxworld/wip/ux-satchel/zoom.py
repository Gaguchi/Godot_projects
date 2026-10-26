"""QA crops: python dirs/ux-satchel/zoom.py <Board> x y w h scale name  ->  dirs/ux-satchel/z/<name>.png (PIL NEAREST)."""
import os
import sys

from PIL import Image

SP = 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad'
board, x, y, w, h, s, name = sys.argv[1], *map(int, sys.argv[2:7]), sys.argv[7]
im = Image.open(f'{SP}/preview/{board}.png').crop((x, y, x + w, y + h))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'z', f'{name}.png')
im.resize((w * s, h * s), Image.NEAREST).save(out)
print(out)
