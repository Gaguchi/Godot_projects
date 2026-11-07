"""PxOpenB: variant B of the open map, the camp at the hub and the wilds all round, under the Filigree UI.
Day 1 at Frontier Camp, pointing at Riverside Market. A copy of dirs/pxworld/gen_map.py with the world swapped for
world_b (the country laid round the camp) and the region window's strip swapped for an overview of the country.

Usage: python gen_open_b.py [out=path]
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(os.path.abspath(__file__))
while not os.path.isdir(os.path.join(DIRS, 'pxworld')):      # the scratchpad's dirs/ folder
    DIRS = os.path.dirname(DIRS)
for _p in (os.path.join(DIRS, 'hyb-64'), DIRS, HERE):
    if _p not in sys.path:
        sys.path.insert(0, _p)
import icons64 as I                      # noqa: E402
import px64 as P                         # noqa: E402
from px64 import C, B, Raster, window, rule, groove, css_base, wrap, write   # noqa: E402
import world_b as WB                     # noqa: E402
import overview as OV                    # noqa: E402
import geo                               # noqa: E402

ARGS = dict(a.split('=', 1) for a in sys.argv[1:])
PT, NAMES = WB.P, WB.NAMES
HOVER = 'riverside_market'
HOPS = WB.hops()

# ------------------------------------------------------------------ the pixel world, one PNG at 1:1
cv, info = WB.render(company=True)
os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
cv.save(os.path.join(HERE, 't', 'world_b.png'))
world = (f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
         f'width="1280" height="720" src="{cv.data_uri()}">')
parts = [world]
road_px = info['road_px']

# ------------------------------------------------------------------ the four roads out of camp: brass beads (hovered), bone beads
BEAD = ["..kkkkk..", ".k66655k.", "k6665544k", "k6655443k", "k6554433k", "k5544332k", "k4443322k", ".k33322k.", "..kkkkk.."]
BEAD_O = {'6': 'o6', '5': 'o5', '4': 'o4', '3': 'o3', '2': 'o1'}
BEAD_B = {'6': 'b5', '5': 'b4', '4': 'b3', '3': 'b2', '2': 'b0'}
beads = Raster(1280, 720)
arrow_at = None
for key, fine in road_px.items():
    if 'frontier_camp' not in key:
        continue
    pts = fine if key[0] == 'frontier_camp' else fine[::-1]
    pts = geo.resample(pts, 1.0)
    L = len(pts) - 1
    hov = HOVER in key
    gap = 14 if hov else 15
    acc = 0.0
    for i in range(1, len(pts)):
        acc += 1
        if acc >= gap and 52 < i < L - (62 if hov else 30):
            acc = 0
            beads.stamp(BEAD, int(pts[i][0]) - 4, int(pts[i][1]) - 4, keymap=BEAD_O if hov else BEAD_B)
    if hov:
        ax, ay = pts[max(0, L - 54)]
        arrow_at = (int(ax) - 3, int(ay) - 7)
if arrow_at:
    beads.blit(I.arrow_e(), *arrow_at)
parts.append(beads.svg(0, 0))

# bracket cursor on the hovered market
hx, hy = PT[HOVER]
bx0, by0, bx1, by1 = hx - 52, hy - 36, hx + 54, hy + 34
parts.append(I.brackets(bx0, by0, bx1, by1).svg(bx0, by0))

def text_w(s, px):
    return int(len(s) * px + .5)


# ------------------------------------------------------------------ UI boxes (windows, the card, the edge boards)
RW, RH = 472, 176
CARD = (684, 464, 330, 150)
UI = [(14, 14, 14 + RW + 2, 14 + RH + 2), (982, 14, 1268, 138), (14, 496, 408, 712),
      (CARD[0], CARD[1], CARD[0] + CARD[2] + 2, CARD[1] + CARD[3] + 2), (bx0, by0, bx1, by1),
      (hx + 26, by1, hx + 36, CARD[1])]
def caption_box(e):
    """The caption's box (x0, y0, x1, y1) and its text: the place the road leads to and its days."""
    sx, sy, bw, bh = e['board_box']
    cap = WB.sign_words(e)[1]
    cw = text_w(cap, 7.1)
    tip = 10 if e['tip'] else 0
    bx0, bx1 = sx + (tip if e['tip'] == 'w' else 0), sx + bw - (tip if e['tip'] == 'e' else 0)
    if e.get('align') == 'r':
        cx0 = bx1 - cw
    else:
        cx0 = int((bx0 + bx1) / 2 - cw / 2)
    cx0 = max(8, min(1272 - cw, int(cx0)))
    cy0 = sy + bh + 3 if e.get('cap', 'below') == 'below' else sy - 18
    return (cx0, cy0, cx0 + cw, cy0 + 16), cap, (bx0, bx1)


for e in WB.EXITS:
    sx, sy, bw, bh = e['board_box']
    UI.append((sx - 2, sy - 2, sx + bw + 2, sy + bh + 2))
    UI.append(caption_box(e)[0])

# ------------------------------------------------------------------ place labels, placed clear of roads, sprites and windows
FOOT = {   # each place's sprite footprint around its stage point (x0, y0, x1, y1)
    'frontier_camp': (-44, -34, 44, 30), 'traders_rest': (-24, -22, 32, 18), 'rodericks_camp': (-34, -22, 24, 22),
    'riverside_market': (-62, -30, 66, 42), 'south_junction': (-26, -44, 58, 28), 'pine_crossing': (-34, -32, 46, 30),
    'watchtower_ridge': (-30, -38, 30, 22), 'border_fortress': (-36, -54, 36, 20), 'smugglers_cave': (-42, -40, 48, 18),
    'bandit_hideout': (-30, -26, 32, 28), 'south_road_ambush': (-26, -8, 30, 14), 'old_mill_crossing': (-26, -20, 32, 12),
    'broken_bridge': (-30, -16, 26, 10), 'north_ridge_path': (-10, -16, 18, 8), 'borderland_shrine': (-10, -24, 30, 4),
}
SUB = {'frontier_camp': ('the company is here', 'rill'), 'smugglers_cave': ('locked for now', 'rust'),
       'south_road_ambush': ('a landmark', 'bone'), 'bandit_hideout': ('a landmark', 'dim'),
       'borderland_shrine': ('a landmark', 'dim')}          # DISCOVERY = landmark (run/overworld.ts#typeLabel)


def tier_of(k):
    if k == 'frontier_camp':
        return 'here'
    return 'out' if HOPS.get(k) == 1 else 'q'


def label_size(k):
    t = tier_of(k)
    name = NAMES[k]
    if t == 'out':
        w, h = text_w(name, 8.9) + 22, 26
    elif t == 'here':
        w, h = text_w(name, 9.6), 22
    else:
        w, h = text_w(name, 7.6), 18
    if k in SUB:
        w = max(w, text_w(SUB[k][0], 7.0))
        h += 18
    return w, h


road_samples = [p for v in road_px.values() for p in geo.resample(v, 3.0)
                if -10 < p[0] < 1290 and -10 < p[1] < 730]
boxes_sprite = {k: (PT[k][0] + f[0], PT[k][1] + f[1], PT[k][0] + f[2], PT[k][1] + f[3]) for k, f in FOOT.items()}
boxes_sprite[HOVER] = (bx0, by0, bx1, by1)            # the hovered place is measured from its bracket
river_samples = [p for p in geo.resample(WB.river_pts, 3.0) if -10 < p[1] < 730]


def overlap(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    return max(0, w) * max(0, h)


PREFER = {'frontier_camp': ['bl', 'b', 'l'], 'riverside_market': ['a', 'al', 'ar'], 'north_ridge_path': ['a', 'ar', 'r'],
          'border_fortress': ['bl', 'b', 'l'], 'rodericks_camp': ['l', 'a'], 'south_road_ambush': ['b', 'bl'],
          'borderland_shrine': ['b', 'bl', 'br']}


def place_labels():
    placed = {}
    order = sorted([k for k in PT if WB.drawn(k)], key=lambda k: (tier_of(k) != 'here', tier_of(k) != 'out', k))
    for k in order:
        w, h = label_size(k)
        x0, y0, x1, y1 = boxes_sprite[k]
        cx = (x0 + x1) / 2
        cands = {
            'b': (cx - w / 2, y1 + 4), 'a': (cx - w / 2, y0 - 4 - h), 'r': (x1 + 6, (y0 + y1) / 2 - h / 2),
            'l': (x0 - 6 - w, (y0 + y1) / 2 - h / 2), 'br': (x1 - 10, y1 + 2), 'bl': (x0 + 10 - w, y1 + 2),
            'ar': (x1 - 10, y0 - 2 - h), 'al': (x0 + 10 - w, y0 - 2 - h),
        }
        pref = PREFER.get(k, []) + [c for c in ('b', 'a', 'r', 'l', 'br', 'bl', 'ar', 'al') if c not in PREFER.get(k, [])]
        if k in FIXED:
            pref = [FIXED[k]]
        if k in AT:
            cands['at'] = AT[k]
            pref = ['at']
        best = None
        for rank, c in enumerate(pref):
            lx, ly = cands[c]
            box = (lx, ly, lx + w, ly + h)
            score = rank * 6
            if box[0] < 6 or box[1] < 4 or box[2] > 1274 or box[3] > 716:
                score += 4000
            g = (box[0] - 2, box[1] - 2, box[2] + 2, box[3] + 2)
            score += 3 * sum(1 for (px, py) in road_samples if g[0] <= px <= g[2] and g[1] <= py <= g[3])
            score += 5 * sum(1 for (px, py) in river_samples if g[0] - 12 <= px <= g[2] + 12 and g[1] <= py <= g[3])
            score += sum(overlap(box, u) for u in UI if u != (bx0, by0, bx1, by1)) * 4
            score += sum(overlap(box, b) for kk, b in boxes_sprite.items() if kk != k) * 2
            score += sum(overlap(box, b) for b in placed.values()) * 6
            if best is None or score < best[0]:
                best = (score, box, c)
        placed[k] = best[1]
        LABEL_REPORT.append((k, best[2], round(best[0])))
    return placed


LABEL_REPORT = []
FIXED = {HOVER: 'a'}                 # the pointed-at market's tag sits right over its bracket
AT = {'south_road_ambush': (412, 496),   # west of the south road, under the camp's own label
      'north_ridge_path': (394, 258)}     # west of the cairn's patch, clear of its edge
LBL = place_labels()


def place_label(k):
    x0, y0, x1, y1 = LBL[k]
    w = x1 - x0
    t = tier_of(k)
    name = NAMES[k]
    out = ''
    pos = f'left:{int(x0)}px;width:{int(w)}px;text-align:center'
    if t == 'out':
        hov = k == HOVER
        tw = text_w(name, 8.9) + 22
        tx = int(x0 + (w - tw) / 2)
        out += window(tx, int(y0), tw, 26, f'<div class="abs s16 {"straw" if hov else "bone"} nowrap sh1" '
                      f'style="left:0;width:{tw}px;text-align:center;top:3px">{name}</div>',
                      kind='taglit' if hov else 'tag', corners=False, shadow=1)
        sub_top = y0 + 30
    elif t == 'here':
        out += f'<div class="abs nowrap s18 rill ol1d" style="{pos};top:{int(y0)}px">{name}</div>'
        sub_top = y0 + 22
    else:
        out += f'<div class="abs nowrap s14 bone ol1d" style="{pos};top:{int(y0)}px">{name}</div>'
        sub_top = y0 + 18
    if k in SUB:
        s, c = SUB[k]
        out += f'<div class="abs nowrap s13 {c} ol1d" style="{pos};top:{int(sub_top)}px">{s}</div>'
    return out


for k in LBL:
    parts.append(place_label(k))

# ------------------------------------------------------------------ the edge boards: the place on the board, the region and the days under it
for e in WB.EXITS:
    sx, sy, bw, bh = e['board_box']
    (cx0, cy0, cx1, _), cap, (bx0, bx1) = caption_box(e)
    parts.append(f'<div class="abs s14 bone nowrap sh1" style="left:{bx0}px;top:{sy + 2}px;width:{bx1 - bx0}px;'
                 f'text-align:center;font-weight:700">{WB.sign_words(e)[0]}</div>')
    parts.append(f'<div class="abs s13 bone ol1d nowrap" style="left:{cx0}px;top:{cy0}px;width:{cx1 - cx0}px;'
                 f'text-align:{"right" if e.get("align") == "r" else "center"}">{cap}</div>')

# ------------------------------------------------------------------ windows
sun, coin, sack, potion = I.sun(), I.coin(), I.ration(), I.potion()


def icon(r, style=''):
    return r.inline(f'margin:-4px 6px 0 0;{style}')


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


# the region window: where we are, the day, the whole country as an overview, what we carry
OVW, OVH = 156, 104
ov, marks = OV.overview(OVW, OVH)
OX, OY = 292, 16                                     # the overview's plate frame, inside the window
ov_html = P.frame(OVW + 8, OVH + 8, 'plate', shadow=1).svg(OX - 4, OY - 4)
ov_html += (f'<img class="abs" alt="" style="left:{OX}px;top:{OY}px;width:{OVW}px;height:{OVH}px;'
            f'image-rendering:pixelated" width="{OVW}" height="{OVH}" src="{ov.data_uri()}">')
PIN = ["..kkk..", ".k565k.", "k56654k", "k56543k", ".k443k.", "..k3k..", "..k2k..", "..k2k..", "..k1k..", "...k..."]
pcx, pcy = marks['camp']
ov_html += P.from_rows(PIN, P.BR).svg(OX + int(pcx) - 3, OY + int(pcy) - 9)
for name, (lx, ly), anchor, cls in (('Thornwood', marks['labels']['Thornwood'], 'c', 'bone'),
                                    ('Ashfall', marks['labels']['Ashfall'], 'c', 'bone'),
                                    ('Borderlands', marks['labels']['Borderlands'], 'c', 'bone'),
                                    ('Iron Throne', marks['throne'], 'r', 'bone')):
    if anchor == 'c':
        ov_html += (f'<div class="abs s13 {cls} ol1d nowrap" style="left:{OX + int(lx) - 50}px;top:{OY + int(ly) - 9}px;'
                    f'width:100px;text-align:center">{name}</div>')
    else:
        ov_html += (f'<div class="abs s13 {cls} ol1d nowrap" style="left:{OX + int(lx) + 7}px;top:{OY + int(ly) - 14}px">'
                    f'{name}</div>')
rations = pips(4, 4).inline('margin:0 0 0 0') + '<span style="display:inline-block;width:6px"></span>' + pips(4, 4).inline()
region = window(14, 14, RW, RH, f"""
  <div class="abs bl48 straw nowrap" style="left:20px;top:12px;font-size:43px;line-height:43px">The Borderlands</div>
  <div class="abs s20 bone nowrap" style="left:20px;top:64px">{icon(sun, 'margin-top:-5px')}Day 1</div>
  <div class="abs s15 dim nowrap" style="left:20px;top:94px">Roads here:</div>
  <div class="abs s15 dim nowrap" style="left:20px;top:113px">an encounter on <span class="rust">4 hops in 10</span></div>
  {ov_html}
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
FACE_CROP = {'face_roy': (28, 14), 'face_marcus': (26, 10), 'face_lilina': (27, 20)}
members = [
    ('The Foundling', 'face_roy', 73, 'Lord · Iron Sword'),
    ('Bagrat "Oak"', 'face_marcus', 84, 'Shield Knight · Iron Lance, Iron Buckler'),
    ('Lilina', 'face_lilina', 62, 'Mage · Fire Tome'),
]


def face_niche(face, x, y, s=52, kind='plate'):
    dx, dy = FACE_CROP.get(face, (22, 8))
    fr = P.frame(s, s, kind, shadow=1)
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{s}px;height:{s}px">'
            f'<div class="abs" style="left:4px;top:4px;width:{s - 8}px;height:{s - 8}px;overflow:hidden;background:{C["s1"]}">'
            f'<img class="abs" style="left:{-dx + 4}px;top:{-dy + 4}px;width:96px;height:96px" src="{B(face)}"></div>'
            f'{fr.svg(0, 0)}</div>')


def hpbar(x, y, w, frac=1.0, ramp=('s5', 's4', 's3', 's2')):
    R = Raster(w, 7)
    keep = round((w - 2) * frac)
    for xx in range(w):
        for yy in range(7):
            if xx in (0, w - 1) or yy in (0, 6):
                if not ((xx in (0, w - 1)) and (yy in (0, 6))):
                    R.set(xx, yy, 'k0')
                continue
            if xx - 1 < keep:
                R.set(xx, yy, ramp[0] if yy == 1 else (ramp[3] if yy == 5 else (ramp[1] if yy < 4 else ramp[2])))
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
parts.append(window(14, 496, 392, 214, f"""
  <div class="abs s16 ochre nowrap" style="left:20px;top:13px">The Company</div>
  <div class="abs s13 dim nowrap" style="right:20px;top:16px">three of us</div>
  {groove(20, 36, 352)}
  {rows}
"""))

# the forecast, pinned under the market, with a brass leader up to the bracket
fx, fy, fw, fh = CARD
parts.append(window(fx, fy, fw, fh, f"""
  <div class="abs bl48 straw nowrap" style="left:20px;top:12px;font-size:43px;line-height:43px">Riverside Market</div>
  <div class="abs s13 dim nowrap" style="left:20px;top:56px">town · inn, shop and tavern</div>
  <div class="abs s18 bone nowrap" style="left:20px;top:76px">{icon(sun)}1 day<span style="display:inline-block;width:22px"></span>{icon(sack)}1 food</div>
  <div class="abs s14 straw nowrap" style="right:20px;top:80px">click to march</div>
  <div class="abs s15 bone nowrap" style="left:20px;top:104px">an encounter on the road: <span class="meadow">none</span></div>
  <div class="abs s13 dim nowrap" style="left:20px;top:124px">a market road is walked by everyone</div>
""", kind='lit'))
lx = hx + 30
ly0, ly1 = by1 + 2, fy - 2
lead = Raster(5, ly1 - ly0 + 1)
lead.stamp(['..k..', '.k5k.', 'k545k', 'kkkkk'], 0, 0, keymap=P.BR)
for j in range(4, lead.h):
    lead.set(0, j, 'k0'); lead.set(1, j, 'o5'); lead.set(2, j, 'o3'); lead.set(3, j, 'k0')
parts.append(lead.svg(lx - 2, ly0))

parts.append('<div class="abs s14 bone ol1d nowrap" style="left:424px;top:694px">Four roads out of camp. Point at one, click to march.</div>')

TITLE = 'Map · day 1 at Frontier Camp, pointing at Riverside Market'
html = wrap(TITLE, '\n'.join(parts), css_base(), 1280, 720)
out = ARGS.get('out')
if out:
    open(out, 'w', encoding='utf-8').write(html)
    print('wrote', out, len(html))
else:
    print(write('PxOpenB', html), len(html))
for r in LABEL_REPORT:
    if r[2] > 30:
        print('label', r)
