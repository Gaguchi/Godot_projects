"""QA contact sheet: every heartland place cropped at 3x NEAREST, labelled. python sheet.py [page] -> qb/sheet<page>.png"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import land as LD   # noqa: E402

page = int(sys.argv[1]) if len(sys.argv) > 1 else 0
src = Image.open(os.path.join(HERE, 't', 'heart.png')).convert('RGB')
keys = sorted([k for k in LD.P if LD.NODE[k]['region'] == 'borderlands' and not LD.NODE[k].get('hidden')],
              key=lambda k: (LD.P[k][1] // 360, LD.P[k][0]))
per = 12
ks = keys[page * per:(page + 1) * per]
cw, ch, z = 110, 80, 3
cols = 4
out = Image.new('RGB', (cols * cw * z, ((len(ks) + cols - 1) // cols) * (ch * z + 14)), (30, 30, 30))
d = ImageDraw.Draw(out)
for i, k in enumerate(ks):
    x, y = LD.P[k]
    x, y = int(x), int(y)
    c = src.crop((x - cw // 2, y - ch // 2 - 8, x + cw // 2, y + ch // 2 - 8)).resize((cw * z, ch * z), Image.NEAREST)
    ox, oy = (i % cols) * cw * z, (i // cols) * (ch * z + 14)
    out.paste(c, (ox, oy + 14))
    d.text((ox + 4, oy + 1), f"{LD.NAMES[k]} ({LD.JOB.get(k, 'game')})", fill=(255, 255, 200))
out.save(os.path.join(HERE, 'qb', f'sheet{page}.png'))
print(len(keys), 'places; page', page, [LD.NAMES[k] for k in ks])
