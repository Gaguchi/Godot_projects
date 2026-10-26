"""PxOpenA: variant A of the open map. Day 1 at Frontier Camp, pointing at Riverside Market.

world.json's graph unchanged (every place, every road); the Borderlands laid round the camp so roads leave it three
ways and run off all four edges. A copy of dirs/pxworld/gen_map.py with the world, the labels, the exits and the
region window's overview redone for this layout.

Usage (from the scratchpad): python dirs/px-open-a/gen_open_a.py   -> canvas/project/PxOpenA.dc.html
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
for p in (os.path.join(DIRS, 'hyb-64'), DIRS, HERE):
    if p not in sys.path:
        sys.path.insert(0, p)
import icons64 as I                      # noqa: E402
import px64 as P                         # noqa: E402
from px64 import C, B, Raster, window, rule, groove, css_base, wrap, write, Icon, cover, poly   # noqa: E402
import openworld as OW                   # noqa: E402
import layout_a as LA                    # noqa: E402
import overview_a as OA                  # noqa: E402

PT, NAMES = LA.P, LA.NAMES
HOVER = 'riverside_market'

# ------------------------------------------------------------------ the pixel world, one PNG at 1x
if '--cached' in sys.argv and os.path.exists(os.path.join(HERE, 't', 'world_a.png')):
    import base64                         # label and window work only: reuse the last world render
    uri = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(HERE, 't', 'world_a.png'), 'rb').read()).decode()
    info = {'road_px': OW.road_geo()}
else:
    cv, info = OW.render()
    cv.save(os.path.join(HERE, 't', 'world_a.png'), zoom=1)
    uri = cv.data_uri()
parts = [f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
         f'width="1280" height="720" src="{uri}">']
geo = info['road_px']


# ------------------------------------------------------------------ the three roads out: brass beads (hovered), bone beads
def arrow(angle):
    """A brass dart pointing along `angle` (radians, screen y down), 15 x 15, lit from the top-left. The notch in its
    back keeps the direction legible at any angle."""
    c, s = math.cos(angle), math.sin(angle)
    tri = [(7.2, 0), (-5.2, -5.4), (-2.0, 0), (-5.2, 5.4)]
    pts = [(7.5 + x * c - y * s, 7.5 + x * s + y * c) for x, y in tri]
    ic = Icon(15, 15)
    ic.layer(cover(poly(pts), 15, 15), ['o1', 'o2', 'o3', 'o4', 'o5'], R=2.2, glint=False)
    return ic.raster()


BEAD = ["..kkkkk..", ".k66655k.", "k6665544k", "k6655443k", "k6554433k", "k5544332k", "k4443322k", ".k33322k.", "..kkkkk.."]
BEAD_O = {'6': 'o6', '5': 'o5', '4': 'o4', '3': 'o3', '2': 'o1'}
BEAD_B = {'6': 'b5', '5': 'b4', '4': 'b3', '3': 'b2', '2': 'b0'}
beads = Raster(1280, 720)
arrow_at = None
for key in sorted(LA.OUT_ROADS):
    fine = geo[key]
    L = sum(math.dist(fine[i], fine[i + 1]) for i in range(len(fine) - 1))
    hov = key[1] == HOVER
    gap = 14 if hov else 15
    run, acc = 0.0, 0.0
    start, stop = 34, L - (40 if hov else 22)
    for i in range(1, len(fine)):
        d = math.dist(fine[i - 1], fine[i])
        run += d
        acc += d
        if acc >= gap and start < run < stop:
            acc = 0
            beads.stamp(BEAD, int(fine[i][0]) - 4, int(fine[i][1]) - 4, keymap=BEAD_O if hov else BEAD_B)
    if hov:
        run2 = 0.0
        for i in range(len(fine) - 1, 0, -1):
            run2 += math.dist(fine[i - 1], fine[i])
            if run2 >= 30:
                ax, ay = fine[i]
                ang = math.atan2(fine[i][1] - fine[i - 1][1], fine[i][0] - fine[i - 1][0])
                arrow_at = (int(ax) - 7, int(ay) - 7, ang)
                break
beads.blit(arrow(arrow_at[2]), arrow_at[0], arrow_at[1])
parts.append(beads.svg(0, 0))

hx, hy = PT[HOVER]
bx0, by0, bx1, by1 = hx - 56, hy - 36, hx + 58, hy + 40
parts.append(I.brackets(bx0, by0, bx1, by1).svg(bx0, by0))

# ------------------------------------------------------------------ place labels
LBL = {   # x, top, anchor (c | l | r), tier (here | out | q)
    'frontier_camp': (712, 306, 'l', 'here'),
    'traders_rest': (700, 106, 'c', 'out'),
    'riverside_market': (746, 518, 'c', 'out'),
    'south_road_ambush': (498, 350, 'c', 'out'),
    'old_mill_crossing': (962, 298, 'l', 'q'),
    'bandit_hideout': (602, 398, 'c', 'q'),
    'south_junction': (246, 340, 'c', 'q'),
    'watchtower_ridge': (1012, 150, 'c', 'q'),
    'pine_crossing': (826, 640, 'c', 'q'),
    'smugglers_cave': (232, 442, 'l', 'q'),
    'border_fortress': (1004, 462, 'r', 'q'),
    'rodericks_camp': (478, 574, 'c', 'q'),
}
SUB = {'frontier_camp': ('the company is here', 'rill'), 'smugglers_cave': ('locked for now', 'rust'),
       'south_road_ambush': ('a landmark', 'bone'), 'bandit_hideout': ('a landmark', 'dim')}   # DISCOVERY = landmark


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

# ------------------------------------------------------------------ the edges: what lies each way (real places only)
CHEV = {   # a bone chevron pointing off the view, beside each exit's name (place labels never carry one)
    'e': ["kk....", "k5k...", ".k55k.", "..k54k", ".k43k.", "k3k...", "kk...."],
}
CHEV['w'] = [r[::-1] for r in CHEV['e']]
CHEV['s'] = ["kk...kk", "k5k.k3k", ".k5k3k.", "..k4k..", "...k..."]
CHEV['n'] = CHEV['s'][::-1]
CHEV_B = {'5': 'b5', '4': 'b3', '3': 'b2', 'k': 'k0'}
EDGE_LBL = [   # text, sub, x, top, anchor, chevron (where it points), chevron x, chevron top
    ('North Ridge Path', None, 888, 20, 'r', 'n', 892, 26),
    ('Borderland Shrine', None, 1240, 384, 'r', 'e', 1243, 389),
    ('Thornwood Gate', 'into Thornwood', 1240, 466, 'r', 'e', 1243, 471),
    ('Southern Trail', 'into Thornwood', 522, 666, 'l', 's', 626, 672),
    ('Broken Bridge', None, 44, 354, 'l', 'w', 34, 359),
]
chev = Raster(1280, 720)
for text, sub, x, top, al, way, cx, cy in EDGE_LBL:
    pos = f'left:{x}px' if al == 'l' else f'right:{1280 - x}px;text-align:right'
    parts.append(f'<div class="abs nowrap s14 bone ol1d" style="{pos};top:{top}px">{text}</div>')
    if sub:
        parts.append(f'<div class="abs nowrap s13 dim ol1d" style="{pos};top:{top + 18}px">{sub}</div>')
    chev.stamp(CHEV[way], cx, cy, keymap=CHEV_B)
parts.append(chev.svg(0, 0))

# ------------------------------------------------------------------ windows
sun, coin, sack, potion = I.sun(), I.coin(), I.ration(), I.potion()


def icon(r, style=''):
    return r.inline(f'margin:-4px 6px 0 0;{style}')


# ---- the overview: the whole country, north up, drawn from the positions world.json would get (overview_a.py)
OVW, OVH = 172, 160
ov, T, _ov_info = OA.render(OVW, OVH)
ov_labels = OA.LABELS
frame = P.frame(OVW + 6, OVH + 6, 'plate', shadow=1)


def ov_label(text, X, Y, cls, al):
    pos = (f'left:{X}px' if al == 'l' else (f'left:{X - 60}px;width:120px;text-align:center' if al == 'c'
           else f'right:{OVW - X}px;text-align:right'))
    return f'<div class="abs nowrap s13 {cls} ol1d" style="{pos};top:{Y}px">{text}</div>'


OX0, OY0 = 330, 13                  # the overview's place in the region window
ov_html = (f'<div class="abs" style="left:{OX0}px;top:{OY0}px;width:{OVW}px;height:{OVH}px;background:{C["w1"]}">'
           f'{ov.svg(0, 0)}' + ''.join(ov_label(*lb) for lb in ov_labels) + f'{frame.svg(-3, -3)}</div>')


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


RW, RH = 520, 194
rations = pips(4, 4).inline('margin:0 0 0 0') + '<span style="display:inline-block;width:6px"></span>' + pips(4, 4).inline()
region = window(14, 14, RW, RH, f"""
  <div class="abs bl48 straw nowrap" style="left:20px;top:12px;font-size:43px;line-height:43px">The Borderlands</div>
  <div class="abs s20 bone nowrap" style="left:20px;top:62px">{icon(sun, 'margin-top:-5px')}Day 1</div>
  <div class="abs s14 dim nowrap" style="left:20px;top:96px">Roads here: an encounter on <span class="rust">4 hops in 10</span></div>
  {ov_html}
  {rule(20, 120, 290)}
  <div class="abs s15 bone nowrap" style="left:20px;top:130px">{icon(coin)}<span class="straw">80</span> gold</div>
  <div class="abs s15 bone nowrap" style="left:116px;top:130px">{icon(sack)}<span class="straw">8</span> food</div>
  <div class="abs nowrap" style="left:206px;top:130px;height:16px">{rations}</div>
  <div class="abs s15 bone nowrap" style="left:20px;top:154px">{icon(potion)}Healing Potion ×1</div>
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
    rows += f'<div class="abs s20 bone nowrap" style="left:82px;top:{y + 1}px">{nm}</div>'
    rows += f'<div class="abs s13 dim nowrap" style="left:82px;top:{y + 28}px">{role}</div>'
    rows += hpbar(250, y + 10, 64)
    rows += f'<div class="abs s14 bone nowrap" style="right:20px;top:{y + 4}px">{hp}/{hp}</div>'
company_win = window(14, 496, 392, 214, f"""
  <div class="abs s16 ochre nowrap" style="left:20px;top:13px">The Company</div>
  <div class="abs s13 dim nowrap" style="right:20px;top:16px">three of us</div>
  {groove(20, 36, 352)}
  {rows}
""")
parts.append(company_win)

# ---- the forecast, over the pines in the south-east, its brass leader stepping out of the bracket and down to it
fx, fy, fw, fh = 900, 540, 330, 150
forecast = window(fx, fy, fw, fh, f"""
  <div class="abs bl48 straw nowrap" style="left:20px;top:12px;font-size:43px;line-height:43px">Riverside Market</div>
  <div class="abs s13 dim nowrap" style="left:20px;top:56px">town · inn, shop and tavern</div>
  <div class="abs s18 bone nowrap" style="left:20px;top:76px">{icon(sun)}1 day<span style="display:inline-block;width:22px"></span>{icon(sack)}1 food</div>
  <div class="abs s14 straw nowrap" style="right:20px;top:80px">click to march</div>
  <div class="abs s15 bone nowrap" style="left:20px;top:104px">an encounter on the road: <span class="meadow">none</span></div>
  <div class="abs s13 dim nowrap" style="left:20px;top:124px">a market road is walked by everyone</div>
""", kind='lit')
parts.append(forecast)
# the leader: a brass rod (ink, lit brass, brass, ink), out of the bracket's east side and down into the card's
# top edge: one level run, one drop, a square corner
lx0, ly = bx1 - 2, by1 - 16                 # off the bracket's east side, near its foot
lxd = fx + 26                               # where it drops into the card, under the card's brass cap
lead = Raster(lxd - lx0 + 6, fy - ly + 6)
D = lxd - lx0                               # the drop's column in the leader raster; the run's row is 4
for X in range(D + 3):                      # the level run, lit on its top
    for dy_, k in ((-2, 'k0'), (-1, 'o5'), (0, 'o4'), (1, 'o2'), (2, 'k0')):
        lead.set(X, 4 + dy_, k)
for Y in range(3, fy - ly + 5):             # the drop, lit on its west face, opening out of the run
    for dx_, k in ((-2, 'k0'), (-1, 'o5'), (0, 'o4'), (1, 'o2'), (2, 'k0')):
        if Y > 4 or dx_ == 2:
            lead.set(D + dx_, Y, k)
lead.set(D + 2, 2, 'k0')
parts.append(lead.svg(lx0, ly - 2))

parts.append('<div class="abs s14 bone ol1d nowrap" style="right:16px;top:694px">Roads leave camp north, south-west and south. Point at one, click to march.</div>')

TITLE = 'Map · day 1 at Frontier Camp, pointing at Riverside Market'
html = wrap(TITLE, '\n'.join(parts), css_base(), 1280, 720)
print(write('PxOpenA', html), len(html))
