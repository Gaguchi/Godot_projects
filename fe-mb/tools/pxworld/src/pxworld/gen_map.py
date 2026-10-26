"""PxMap1x / PxMap2x: the Borderlands redrawn as pixel art (pxworld) under the Filigree UI.
Day 1 at Frontier Camp, pointing at Riverside Market. A copy of dirs/hyb-64/gen_map.py with only the
world layer swapped: the painted SVG world and the scaled board sprites give way to one pixel PNG.

Usage: python gen_map.py grain=1|2 [out=path]
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(DIRS, 'hyb-64'))
sys.path.insert(0, DIRS)
import icons64 as I                      # noqa: E402
import world_map as WM                   # noqa: E402
import px64 as P                         # noqa: E402
from px64 import C, B, Raster, window, rule, groove, css_base, wrap, write   # noqa: E402
from pxworld import borderlands as BL    # noqa: E402

ARGS = dict(a.split('=') for a in sys.argv[1:])
GRAIN = int(ARGS.get('grain', '1'))
PT, NAMES = WM.P, WM.NAMES
HOVER = 'riverside_market'
k = C['k0']

# ------------------------------------------------------------------ the pixel world, one PNG at art resolution
cv, info = BL.render(GRAIN)
cv.save(os.path.join(HERE, 't', f'world{GRAIN}x.png'), zoom=GRAIN)
uri = cv.data_uri()
world = (f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
         f'width="1280" height="720" src="{uri}">')
parts = [world]

# ------------------------------------------------------------------ the three roads out: brass beads (hovered) and bone beads
BEAD = ["..kkkkk..", ".k66655k.", "k6665544k", "k6655443k", "k6554433k", "k5544332k", "k4443322k", ".k33322k.", "..kkkkk.."]
BEAD_O = {'6': 'o6', '5': 'o5', '4': 'o4', '3': 'o3', '2': 'o1'}
BEAD_B = {'6': 'b5', '5': 'b4', '4': 'b3', '3': 'b2', '2': 'b0'}
beads = Raster(1280, 720)
for a, b, _ in WM.ROADS:
    if (a, b) not in WM.OUT_ROADS:
        continue
    A_, B_, c, _pts = WM.road_geo[(a, b)]
    fine = [((1 - t) ** 2 * A_[0] + 2 * (1 - t) * t * c[0] + t * t * B_[0], (1 - t) ** 2 * A_[1] + 2 * (1 - t) * t * c[1] + t * t * B_[1])
            for t in [i / 600 for i in range(601)]]
    L = sum(math.dist(fine[i], fine[i + 1]) for i in range(600))
    hov = b == HOVER
    gap = 14 if hov else 15
    run, acc = 0.0, 0.0
    for i in range(1, 601):
        d = math.dist(fine[i - 1], fine[i])
        run += d
        acc += d
        if acc >= gap and 50 < run < L - (62 if hov else 26):
            acc = 0
            beads.stamp(BEAD, int(fine[i][0]) - 4, int(fine[i][1]) - 4, keymap=BEAD_O if hov else BEAD_B)
    if hov:
        # arrowhead where the hovered road meets the bracket
        for i in range(600, 0, -1):
            run2 = sum(math.dist(fine[j - 1], fine[j]) for j in range(i, 601))
            if run2 >= 54:
                ax, ay = fine[i]
                break
        arrow_at = (int(ax) - 3, int(ay) - 7)
beads.blit(I.arrow_e(), *arrow_at)
parts.append(beads.svg(0, 0))

# bracket cursor on the hovered market, and the gauntlet pointing at it
hx, hy = PT[HOVER]
bx0, by0, bx1, by1 = hx - 50, hy - 34, hx + 50, hy + 32
parts.append(I.brackets(bx0, by0, bx1, by1).svg(bx0, by0))

# ------------------------------------------------------------------ place labels
LBL = {   # x, top, anchor, tier
    'frontier_camp': (446, 438, 'c', 'here'),
    'traders_rest': (566, 306, 'c', 'out'),
    'riverside_market': (660, 438, 'c', 'out'),
    'south_road_ambush': (638, 516, 'c', 'out'),
    'old_mill_crossing': (852, 290, 'l', 'q'),
    'bandit_hideout': (830, 452, 'c', 'q'),
    'south_junction': (820, 566, 'c', 'q'),
    'north_ridge_path': (984, 262, 'r', 'q'),
    'watchtower_ridge': (1092, 266, 'c', 'q'),
    'pine_crossing': (1076, 436, 'c', 'q'),
    'smugglers_cave': (1066, 526, 'c', 'q'),
    'broken_bridge': (954, 592, 'c', 'q'),
    'border_fortress': (1262, 376, 'r', 'q'),
    'rodericks_camp': (1262, 486, 'r', 'q'),
}
SUB = {'frontier_camp': ('the company is here', 'rill'), 'smugglers_cave': ('locked for now', 'rust'),
       'south_road_ambush': ('a landmark', 'bone'), 'bandit_hideout': ('a landmark', 'dim')}   # DISCOVERY = landmark (run/overworld.ts#typeLabel)


def text_w(s, px=7.6):
    return int(len(s) * px)


def place_label(key):
    x, top, al, tier = LBL[key]
    name = NAMES[key]
    out = ''
    if al == 'c':
        pos = f'left:{x - 160}px;width:320px;text-align:center'
    elif al == 'l':
        pos = f'left:{x}px'
    else:
        pos = f'right:{1280 - x}px;text-align:right'
    if tier == 'out':
        hov = key == HOVER
        tw = text_w(name, 8.9) + 22
        tx = x - tw // 2
        out += window(tx, top, tw, 26, f'<div class="abs s16 {"straw" if hov else "bone"} nowrap sh1" style="left:0;width:{tw}px;text-align:center;top:3px">{name}</div>',
                      kind='taglit' if hov else 'tag', corners=False, shadow=1)
        sub_top = top + 30
    elif tier == 'here':
        out += f'<div class="abs nowrap s18 rill ol1d" style="{pos};top:{top}px">{name}</div>'
        sub_top = top + 24
    else:
        out += f'<div class="abs nowrap s14 bone ol1d" style="{pos};top:{top}px">{name}</div>'
        sub_top = top + 18
    if key in SUB:
        t, c = SUB[key]
        out += f'<div class="abs nowrap s13 {c} ol1d" style="{pos};top:{sub_top}px">{t}</div>'
    return out


for key in LBL:
    parts.append(place_label(key))

parts.append('<div class="abs s14 bone nowrap" style="left:1176px;top:600px;width:78px;text-align:center;font-weight:700">Thornwood</div>')
parts.append('<div class="abs s13 bone ol1d nowrap" style="right:16px;top:646px;text-align:right">the land runs on east</div>')

# ------------------------------------------------------------------ windows
sun, coin, sack, potion = I.sun(), I.coin(), I.ration(), I.potion()


def icon(r, style=''):
    return r.inline(f'margin:-4px 6px 0 0;{style}')


# the region window: where we are, the day, the whole land as a strip, what we carry
RW, RH = 472, 176
segs = [('Borderlands', ('m2', 'm3', 'm4', 'm5')), ('Thornwood', ('m0', 'm1', 'm2', 'm3')), ('Ashfall', ('b0', 'b0', 'b1', 'b2')), ('Iron Throne', ('x1', 'x1', 'x2', 'x3'))]
SX0, SY, SEGW, SEGH = 20, 92, 106, 12
strip = Raster(SEGW * 4 + 4, SEGH + 2)
for i, (n, ramp) in enumerate(segs):
    x0 = i * (SEGW + 1)
    for xx in range(x0, x0 + SEGW):
        for yy in range(SEGH + 2):
            edge = yy in (0, SEGH + 1) or xx in (x0, x0 + SEGW - 1)
            if edge:
                strip.set(xx, yy, 'k0')
            elif yy == 1:
                strip.set(xx, yy, ramp[3])
            elif yy == SEGH:
                strip.set(xx, yy, ramp[0])
            else:
                strip.set(xx, yy, ramp[2] if yy < 6 else ramp[1])
seg_html = strip.svg(SX0, SY)
for i, (n, _) in enumerate(segs):
    seg_html += f'<div class="abs s13 {"bone" if i == 0 else "faint"} nowrap" style="left:{SX0 + i * (SEGW + 1)}px;top:{SY + 17}px;width:{SEGW}px;text-align:center">{n}</div>'
# "you are here": a brass pin standing on the strip's west end
PIN = ["..kkk..", ".k565k.", "k56654k", "k56543k", ".k443k.", "..k3k..", "..k2k..", "..k2k..", "..k1k..", "...k..."]
seg_html += P.frame(SEGW + 6, SEGH + 8, 'plate', shadow=1).svg(SX0 - 3, SY - 3)
seg_html += P.from_rows(PIN, P.BR).svg(SX0 + 49, SY - 8)


def pips(n_on, n, on=('o5', 'o4', 'o3', 'o1'), off=('w3', 'w2', 'w1', 'k0')):
    R = Raster(n * 8, 11)
    for i in range(n):
        x0 = i * 8
        lit, mid, mid2, dk = on if i < n_on else off
        for xx in range(x0, x0 + 7):
            for yy in range(11):
                if xx in (x0, x0 + 6) and yy in (0, 10):
                    continue
                edge = xx in (x0, x0 + 6) or yy in (0, 10)
                R.set(xx, yy, 'k0' if edge else (lit if (yy == 1 or xx == x0 + 1) else (dk if yy == 9 else (mid if yy < 5 else mid2))))
    return R


rations = pips(4, 4).inline('margin:0 0 0 0') + '<span style="display:inline-block;width:6px"></span>' + pips(4, 4).inline()
region = window(14, 14, RW, RH, f"""
  <div class="abs bl48 straw nowrap" style="left:20px;top:12px;font-size:43px;line-height:43px">The Borderlands</div>
  <div class="abs s20 bone nowrap" style="right:20px;top:20px">{icon(sun, 'margin-top:-5px')}Day 1</div>
  <div class="abs s15 dim nowrap" style="left:20px;top:62px">Roads here: an encounter on <span class="rust">4 hops in 10</span></div>
  {seg_html}
  {rule(20, 136, RW - 40)}
  <div class="abs s15 bone nowrap" style="left:20px;top:144px">{icon(coin)}<span class="straw">80</span> gold</div>
  <div class="abs s15 bone nowrap" style="left:116px;top:144px">{icon(sack)}<span class="straw">8</span> food</div>
  <div class="abs nowrap" style="left:206px;top:144px;height:16px">{rations}</div>
  <div class="abs s15 bone nowrap" style="right:20px;top:144px">{icon(potion)}Healing Potion ×1</div>
""")
parts.append(region)

cmds = window(982, 14, 284, 122, f"""
  <div class="abs s18 bone nowrap" style="left:20px;top:16px">The Company</div>
  <div class="abs s13 dim nowrap" style="left:162px;top:19px">roster and gear</div>
  {groove(20, 43, 244)}
  <div class="abs s18 bone nowrap" style="left:20px;top:50px">Contracts</div>
  <div class="abs s13 dim nowrap" style="left:162px;top:53px">none yet</div>
  {groove(20, 77, 244)}
  <div class="abs s18 bone nowrap" style="left:20px;top:84px">Menu</div>
  <div class="abs nowrap" style="left:160px;top:86px"><span class="key">Esc</span></div>
""")
parts.append(cmds)

# the company: faces at 1x, cropped in brass-lipped niches
FACE_CROP = {'face_roy': (28, 14), 'face_marcus': (26, 10), 'face_lilina': (27, 20), 'face_bandit': (26, 8), 'face_ember_mage': (26, 14)}
members = [
    ('The Foundling', 'face_roy', 73, 'Lord · Iron Sword'),
    ('Bagrat "Oak"', 'face_marcus', 84, 'Shield Knight · Iron Lance, Iron Buckler'),
    ('Lilina', 'face_lilina', 62, 'Mage · Fire Tome'),
]


def face_niche(face, x, y, s=52, kind='plate', flip=False, crop=None):
    dx, dy = crop or FACE_CROP.get(face, (22, 8))
    fr = P.frame(s, s, kind, shadow=1)
    tf = 'transform:scaleX(-1);' if flip else ''
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{s}px;height:{s}px">'
            f'<div class="abs" style="left:4px;top:4px;width:{s - 8}px;height:{s - 8}px;overflow:hidden;background:{C["s1"]}">'
            f'<img class="abs" style="left:{-dx + 4}px;top:{-dy + 4}px;width:96px;height:96px;{tf}" src="{B(face)}"></div>'
            f'{fr.svg(0, 0)}</div>')


def hpbar(x, y, w, frac=1.0, lost=0.0, ramp=('s5', 's4', 's3', 's2')):
    """A fine bar: ink frame, a lit top row, the fill, a dark foot. lost = fraction shown as the forecast loss."""
    R = Raster(w, 7)
    keep = round((w - 2) * frac)
    for xx in range(w):
        for yy in range(7):
            if xx in (0, w - 1) or yy in (0, 6):
                if not ((xx in (0, w - 1)) and (yy in (0, 6))):
                    R.set(xx, yy, 'k0')
                continue
            i = xx - 1
            if i < keep:
                R.set(xx, yy, ramp[0] if yy == 1 else (ramp[3] if yy == 5 else (ramp[1] if yy < 4 else ramp[2])))
            elif i < keep + round((w - 2) * lost):
                R.set(xx, yy, 'b5' if yy < 3 else 'b3')
            else:
                R.set(xx, yy, 'w0' if yy == 1 else 'k1')
    return R.svg(x, y)


rows = ''
for i, (nm, face, hp, role) in enumerate(members):
    y = 42 + i * 52
    rows += face_niche(face, 18, y)
    rows += f'<div class="abs s16 bone nowrap" style="left:82px;top:{y + 4}px">{nm}</div>'
    rows += f'<div class="abs s13 dim nowrap" style="left:82px;top:{y + 27}px">{role}</div>'
    rows += hpbar(250, y + 10, 64)
    rows += f'<div class="abs s14 bone nowrap" style="right:20px;top:{y + 4}px">{hp}/{hp}</div>'
company_win = window(14, 496, 392, 214, f"""
  <div class="abs s16 ochre nowrap" style="left:20px;top:13px">The Company</div>
  <div class="abs s13 dim nowrap" style="right:20px;top:16px">three of us</div>
  {groove(20, 36, 352)}
  {rows}
""")
parts.append(company_win)

# the forecast, pinned over the market, with a brass leader down to the bracket
fx, fy, fw, fh = 500, 128, 330, 150
meter = Raster(10 * 12, 10)
for i in range(10):
    x0 = i * 12
    on = i < 4
    for xx in range(x0, x0 + 10):
        for yy in range(10):
            if xx in (x0, x0 + 9) or yy in (0, 9):
                if not (xx in (x0, x0 + 9) and yy in (0, 9)):
                    meter.set(xx, yy, 'k0')
                continue
            if on:
                meter.set(xx, yy, 'x5' if yy == 1 else ('x2' if yy >= 7 else ('x4' if yy < 4 else 'x3')))
            else:
                meter.set(xx, yy, 'w0' if yy == 1 else 'k1')
forecast = window(fx, fy, fw, fh, f"""
  <div class="abs bl48 straw nowrap" style="left:20px;top:12px;font-size:43px;line-height:43px">Riverside Market</div>
  <div class="abs s13 dim nowrap" style="left:20px;top:56px">town · inn, shop and tavern</div>
  <div class="abs s18 bone nowrap" style="left:20px;top:76px">{icon(sun)}1 day<span style="display:inline-block;width:22px"></span>{icon(sack)}1 food</div>
  <div class="abs s14 straw nowrap" style="right:20px;top:80px">click to march</div>
  <div class="abs s15 bone nowrap" style="left:20px;top:104px">an encounter on the road: <span class="meadow">none</span></div>
  <div class="abs s13 dim nowrap" style="left:20px;top:124px">a market road is walked by everyone</div>
""", kind='lit')
parts.append(forecast)
lx = hx + 30
ly0, ly1 = fy + fh + 2, by0
lead = Raster(5, ly1 - ly0 + 1)
for j in range(lead.h - 4):
    lead.set(0, j, 'k0'); lead.set(1, j, 'o5'); lead.set(2, j, 'o3'); lead.set(3, j, 'k0')
lead.stamp(['kkkkk', 'k454k', '.k3k.', '..k..'], 0, lead.h - 4, keymap=P.BR)
parts.append(lead.svg(lx - 2, ly0))

parts.append('<div class="abs s14 bone ol1d nowrap" style="left:424px;top:692px">Three roads out of camp. Point at one, click to march.</div>')

TITLE = {1: 'Map · pixel world, day 1 at Frontier Camp, pointing at Riverside Market',
         2: 'Map · pixel world at 2×, day 1 at Frontier Camp, pointing at Riverside Market'}[GRAIN]
html = wrap(TITLE, '\n'.join(parts), css_base(), 1280, 720)
out = ARGS.get('out')
if out:
    open(out, 'w', encoding='utf-8').write(html)
    print('wrote', out, len(html))
else:
    print(write(f'PxMap{GRAIN}x', html), len(html))
