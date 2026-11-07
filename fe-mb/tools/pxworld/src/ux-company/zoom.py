"""python dirs/ux-company/zoom.py Board x y w h scale name  -> dirs/ux-company/t/name.png (PIL NEAREST)."""
import sys
from PIL import Image
b, x, y, w, h, s, name = sys.argv[1:8]
x, y, w, h, s = map(int, (x, y, w, h, s))
im = Image.open(f'preview/{b}.png').crop((x, y, x + w, y + h))
im.resize((w * s, h * s), Image.NEAREST).save(f'dirs/ux-company/t/{name}.png')
