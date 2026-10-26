"""QA crops: python qa/crops.py <tag> [png] [z]  -> qa/<tag>/<site>.png (NEAREST zoom) for every structure.
python qa/crops.py --pair <tagA> <tagB>  -> qa/pair/<site>.png, A above B, for side-by-side reading."""
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITES = {   # stage px boxes: x, y, w, h
    'mill': (762, 250, 110, 80),
    'broken_bridge': (898, 540, 124, 66),
    'ford_hideout_pine': (852, 392, 64, 56),
    'ford_junction_cave': (900, 490, 64, 56),
    'market': (596, 350, 132, 100),
    'south_junction': (764, 494, 116, 88),
    'pine_crossing': (1020, 366, 112, 84),
    'farm0': (546, 402, 82, 54), 'farm1': (278, 292, 82, 54), 'farm2': (832, 620, 82, 54),
    'farm3': (676, 422, 82, 54), 'farm4': (230, 418, 82, 54), 'farm5': (156, 300, 82, 54),
    'traders_rest': (488, 318, 84, 62),
    'rodericks_camp': (1176, 428, 96, 62),
    'frontier_camp': (396, 366, 116, 78),
    'watchtower': (1046, 282, 90, 78),
    'fortress': (1170, 292, 106, 84),
    'cave': (1008, 462, 112, 78),
    'hideout': (788, 398, 84, 62),
    'wreck': (606, 478, 64, 44),
    'cairn': (962, 262, 54, 44),
    'thornwood_sign': (1166, 588, 104, 62),
}


def crop(tag, png, z=5):
    out = os.path.join(HERE, tag)
    os.makedirs(out, exist_ok=True)
    im = Image.open(png).convert('RGB')
    for k, (x, y, w, h) in SITES.items():
        im.crop((x, y, x + w, y + h)).resize((w * z, h * z), Image.NEAREST).save(os.path.join(out, k + '.png'))
    print('cropped', len(SITES), 'sites into', out)


def pair(a, b):
    out = os.path.join(HERE, 'pair')
    os.makedirs(out, exist_ok=True)
    for k in SITES:
        A = Image.open(os.path.join(HERE, a, k + '.png'))
        B = Image.open(os.path.join(HERE, b, k + '.png'))
        im = Image.new('RGB', (A.width + B.width + 8, max(A.height, B.height)), (20, 14, 10))
        im.paste(A, (0, 0)); im.paste(B, (A.width + 8, 0))
        im.save(os.path.join(out, k + '.png'))
    print('paired into', out)


if __name__ == '__main__':
    if sys.argv[1] == '--pair':
        pair(sys.argv[2], sys.argv[3])
    else:
        tag = sys.argv[1]
        png = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(HERE), 't', 'world1x.png')
        z = int(sys.argv[3]) if len(sys.argv) > 3 else 5
        crop(tag, png, z)
