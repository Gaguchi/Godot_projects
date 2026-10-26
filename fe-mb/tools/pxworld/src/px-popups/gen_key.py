"""Hyb64Key (px-popups copy of dirs/hyb-64/gen_key.py, round 3 "go pixel everywhere"): the 64-bit tier's spec card, 560 x 720.
The ground is now 1x pixel art from pxworld (its meadow, a dirt road with ruts and pebbles, tufts, flowers, a boulder), the copy
says the country is pixel art, and the swatches show every ramp the world is drawn with: the kit's seven plus pxworld's nine.
The Filigree windows, the field marks, the window anatomy, the type and the rules are the original card's.
Rebuild: python dirs/px-popups/gen_key.py
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import random
import sys

sys.path.insert(0, ROOT + '/src/hyb-64')
sys.path.insert(0, ROOT + '/src')
import numpy as np                                        # noqa: E402
import icons64 as I                                       # noqa: E402
import px64 as P                                          # noqa: E402
from px64 import C, B, RAMPS, Raster, window, rule, groove, css_base, wrap, write, numeral   # noqa: E402
from pxworld import pal as PAL, terrain as TR, places as PL, canvas as CV   # noqa: E402

rng = random.Random(3)
k = C['k0']

# ------------------------------------------------------------------ the pixel ground: pxworld's meadow and a road at board scale
PATH_Y = 188
RHW = 8.5                                                 # the road's half-width: a footpath at the scale of the board figures
cv = CV.Canvas(560, 720)
TR.grass(cv, seed=9, g=1)
road = TR.road(cv, [(-12, PATH_Y + .5), (572, PATH_Y + .5)], RHW, g=1, pebbles=.025, seed=5, ruts=False)
# two wheel ruts a step down the road's own ramp: long worn runs with short breaks, each run wandering a pixel
# (the map's ruts sit at the crown of a 7 px track; at board scale they sit under the wheels)
rr = random.Random(12)
for ry in (PATH_Y - 3, PATH_Y + 4):
    x, dy = rr.randint(0, 6), 0
    while x < 560:
        run = rr.randint(16, 40)
        for xx in range(x, min(560, x + run)):
            if road[ry + dy, xx]:
                cv.ix[ry + dy, xx] = PAL.shift_index(int(cv.ix[ry + dy, xx]), -1)
        x += run + rr.randint(3, 7)
        dy = rr.choice((0, 0, 1)) if ry < PATH_Y else rr.choice((0, 0, -1))
near_road = np.zeros_like(road)
for d in range(-3, 4):
    near_road |= np.roll(road, d, axis=0)


def free(p):
    x, y = int(p[0]), int(p[1])
    return 3 <= x < 557 and 4 <= y < 716 and not near_road[max(0, y - 2):y + 3, max(0, x - 3):x + 4].any()


centres = TR.poisson(rng, 0, 0, 560, 720, 40, 1500, free)
tpts = TR.clustered(rng, centres, (3, 7), 8, free) + TR.poisson(rng, 0, 0, 560, 720, 30, 1500, free)
kept = []                                                 # tufts never overlap: a blade shifted twice reads as a bar
for q in tpts:
    if all(abs(q[0] - o[0]) >= 8 or abs(q[1] - o[1]) >= 5 for o in kept):
        kept.append(q)
TR.tufts(cv, rng, kept, 1)
TR.flowers(cv, rng, TR.poisson(rng, 0, 0, 560, 720, 46, 900, free), g=1)
TR.stones(cv, rng, TR.poisson(rng, 0, 0, 560, 720, 80, 400, free), g=1)
sc = PL.Scene(cv, 1, seed=4)
sc.ground, sc.reink = ('g', 'd', 'h', 't'), True
sc.rock(404, 154, 6)
sc.rock(532, 160, 4)
sc.draw()
cv.save(ROOT + '/src/px-popups/t/key_ground.png')
ground = (f'<img class="abs" alt="" style="left:0;top:0;width:560px;height:720px;image-rendering:pixelated" width="560" height="720" '
          f'src="{cv.data_uri()}">')
FILT = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
        f'<filter id="h64-ol1" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">'
        '<feComponentTransfer in="SourceAlpha" result="sa"><feFuncA type="discrete" tableValues="0 0 1 1 1"/></feComponentTransfer>'
        f'<feMorphology in="sa" operator="dilate" radius="1" result="d"/><feFlood flood-color="{k}"/>'
        '<feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
        '</defs></svg>')
parts = [FILT, ground]

# ------------------------------------------------------------------ header
parts.append(window(12, 12, 536, 104, f'''
  <div class="abs bl48 straw nowrap" style="left:20px;top:8px;font-size:43px;line-height:43px">Filigree</div>
  <div class="abs s16 bone nowrap" style="left:172px;top:14px">the 64-bit tier</div>
  <div class="abs s14 dim nowrap" style="left:172px;top:33px;font-weight:400">over a 1× pixel country</div>
  <div class="abs s14 bone nowrap" style="left:20px;top:56px;font-weight:400">The country is 1× pixel art too, on the UI's ramps plus nine of its own.</div>
  <div class="abs s13 dim nowrap" style="left:20px;top:78px">borrows from <span class="straw">Final Fantasy Tactics · Tactics Ogre · Vagrant Story · Octopath</span></div>
'''))

# ------------------------------------------------------------------ the world strip: the field marks, at board scale
FEET = PATH_Y + 6


def ring(side, act=False):
    TS = 48
    back, front = Raster(TS, 16), Raster(TS, 16)
    rg = ('o5', 'o3') if act else (('s4', 's3') if side == 'ally' else ('x4', 'x3'))
    cy = 8
    for j in range(16):
        for i in range(TS):
            dx, dy = abs(i + .5 - TS / 2), abs(j + .5 - cy)
            tgt = front if j + .5 >= cy else back
            lit = rg[0] if j + .5 < cy else rg[1]
            if side == 'ally':
                if dx <= 18 and dy <= 6 and (dx >= 17 or dy >= 5) and not (dx >= 17 and dy >= 5):
                    tgt.set(i, j, lit)
                elif dx <= 19 and dy <= 7 and (dx >= 18 or dy >= 6) and not (dx >= 18.5 and dy >= 6.5):
                    tgt.set(i, j, 'k0')
                elif dx <= 16 and dy <= 4 and (dx >= 16 or dy >= 4):
                    tgt.set(i, j, 'k0')
            else:
                m = dx / 21 + dy / 7.2
                if .86 <= m < 1.0:
                    tgt.set(i, j, lit)
                elif .74 <= m < .86 or 1.0 <= m < 1.13:
                    tgt.set(i, j, 'k0')
    return back, front


figs = [('board_lilina', 'ally', True, 40), ('board_roy', 'ally', False, 90), ('board_marcus', 'ally', False, 140),
        ('board_bandit', 'foe', False, 418), ('board_ember_mage', 'foe', False, 488)]
for key, side, act, cx in figs:
    back, front = ring(side, act)
    parts.append(back.svg(cx - 24, FEET - 8))
    flip = 'transform:scaleX(-1);' if side == 'foe' else ''
    parts.append(f'<img class="abs" style="left:{cx - 26}px;top:{FEET + 2 - 76}px;width:52px;height:76px;filter:url(#h64-ol1);{flip}" src="{B(key)}">')
    parts.append(front.svg(cx - 24, FEET - 8))
parts.append(I.brackets(418 - 30, FEET - 66, 418 + 31, FEET + 10).svg(418 - 30, FEET - 66))
BEAD = ["..kkk..", ".k665k.", "k66554k", "k65543k", "k55432k", ".k432k.", "..kkk.."]
beads = Raster(560, 60)
for x in range(184, 372, 12):
    beads.stamp(BEAD, x, 22, keymap={'6': 'o6', '5': 'o5', '4': 'o4', '3': 'o3', '2': 'o1'})
parts.append(beads.svg(0, PATH_Y - 23))
parts.append(window(186, 124, 150, 26, '<div class="abs s15 bone nowrap sh1" style="left:0;width:150px;text-align:center;top:3px">boxed: a road out</div>', kind='tag', corners=False, shadow=1))
parts.append('<div class="abs s14 bone ol1d nowrap" style="left:200px;top:158px">inked: only a name</div>')

# ------------------------------------------------------------------ palette: every ramp the world is drawn with
# pxworld.pal.RAMPS: the Filigree kit's seven (the UI's and the world's) and pxworld's nine for the country, dark -> light
sys.path.append(ROOT + '/src/kit64')
from kit_px import text_w as _tw                                               # noqa: E402  (PIL metrics for Source Serif 4)
WRAMPS = [(name, cols) for name, _letter, cols in PAL.RAMPS]
PITCH, CH = 7, 15
cols4 = [WRAMPS[i * 4:(i + 1) * 4] for i in range(4)]
need = [max(_tw(n, 13, 600) for n, _ in c) + 6 + max(len(v) for _, v in c) * PITCH + 1 for c in cols4]
gap = (496 - sum(need)) // 3
pal = ''
cx = 20
for c_i, col_ramps in enumerate(cols4):
    lab_w = max(_tw(n, 13, 600) for n, _ in col_ramps) + 6
    for r_i, (name, hexes) in enumerate(col_ramps):
        cy = 34 + r_i * 22
        pal += f'<div class="abs s13 bone nowrap" style="left:{cx}px;top:{cy}px">{name}</div>'
        R = Raster(len(hexes) * PITCH + 1, CH)
        for j, hx in enumerate(hexes):
            x0 = j * PITCH
            for xx in range(x0, x0 + PITCH + 1):
                for yy in range(CH):
                    if xx in (x0, x0 + PITCH) or yy in (0, CH - 1):
                        if not (xx in (x0, x0 + PITCH) and yy in (0, CH - 1)):
                            R.set(xx, yy, 'k0')
                    else:
                        R.set(xx, yy, hx)
        pal += R.svg(cx + lab_w, cy + 1)
    cx += need[c_i] + gap
# the icon sheet, top right, where the old head note sat
icons = [I.sun(), I.coin(), I.ration(), I.potion(), I.flame(), I.burst(), I.shield(), I.orb()]
x = 516 - len(icons) * 23 + 1
for r in icons:
    pal += r.svg(x, 7)
    x += 23
parts.append(window(12, 206, 536, 126, f'''
  <div class="abs s14 ochre nowrap" style="left:20px;top:13px">Sixteen ramps, lit from the north-west</div>
  {pal}
'''))

# ------------------------------------------------------------------ window anatomy, corner at 5x
Z = 4
cw = 26
fr = P.frame(120, 80, 'win', shadow=2)
crop = Raster(cw, cw)
for j in range(cw):
    for i in range(cw):
        crop.set(i, j, fr.get(i, j))
zoom = (f'<svg class="abs" style="left:20px;top:40px" width="{cw * Z}" height="{cw * Z}" viewBox="0 0 {cw} {cw}" shape-rendering="crispEdges">'
        f'<rect x="6" y="6" width="{cw - 6}" height="{cw - 6}" fill="#2b2017"/>'
        + ''.join(f'<rect x="{i}" y="{j}" width="1" height="1" fill="#30241a"/>' for j in range(6, cw) for i in range(6, cw) if (i + j) % 2 == 0)
        + crop.paths() + '</svg>')
legend = [(['k0'], 'ink edge'), (['w6', 'w5', 'w4', 'w2'], 'walnut ×4'), (['k0', 'w0'], 'ink, recess'),
          (['o2', 'o1'], 'notched inlay'), (['o6', 'o4', 'o3', 'o1'], 'brass cap'), (['sh55'], '2 px drop')]
lab = ''
for i, (chips, t) in enumerate(legend):
    yy = 42 + i * 17
    R = Raster(len(chips) * 6 + 1, 9)
    for c_i, cc in enumerate(chips):
        for xx in range(c_i * 6, c_i * 6 + 7):
            for y2 in range(9):
                edge = xx in (c_i * 6, c_i * 6 + 6) or y2 in (0, 8)
                R.set(xx, y2, 'k0' if edge else cc)
    lab += R.svg(20 + cw * Z + 10 + (25 - R.w), yy + 4)
    lab += f'<div class="abs s13 bone nowrap" style="left:{20 + cw * Z + 10 + 30}px;top:{yy}px">{t}</div>'
parts.append(window(12, 340, 268, 190, f'''
  <div class="abs s14 ochre nowrap" style="left:20px;top:13px">A window, corner at 4×</div>
  {zoom}{lab}
  <div class="abs s13 dim" style="left:20px;top:152px;width:228px;line-height:16px">No translucency, blur or glow: a fill with a faint dither.</div>
'''))

# ------------------------------------------------------------------ type
d15 = numeral('15', 50, 'Oxblood')
d103 = numeral('103 → 88', 22, 'Bone')
parts.append(window(288, 340, 260, 190, f'''
  <div class="abs bl48 straw nowrap" style="left:20px;top:8px;font-size:43px;line-height:43px">Borderlands</div>
  <div class="abs s13 dim nowrap" style="left:20px;top:54px">Jacquard 24, 43 px: places, titles</div>
  {groove(20, 76, 220)}
  <div class="abs s20 rust nowrap" style="left:20px;top:82px">Obsidian Fighter 1</div>
  <div class="abs s13 bone nowrap" style="left:20px;top:106px">an encounter on the road: <span class="rust">4 in 10</span></div>
  <div class="abs s13 dim nowrap" style="left:20px;top:123px">Source Serif 4, 13 to 20 px</div>
  {groove(20, 144, 220)}
  {d15.svg(20, 146)}
  {d103.svg(84, 148)}
  <div class="abs s13 dim nowrap" style="left:84px;top:168px">cast digits</div>
'''))

# ------------------------------------------------------------------ rules + cost
rules = [
    'One grid, 1:1. Every frame, icon and digit is placed pixel by pixel.',
    'Windows are carved walnut with brass caps and a notched inlay.',
    'Blackletter for places and titles; a book serif for people and reading.',
    'Faces sit at 1× in brass niches; figures keep a 1 px ink edge.',
    'Ours stand on a square ring, theirs on a lozenge; brass is what you point at.',
]
rl = ''.join(f'<div class="abs s13 bone nowrap" style="left:20px;top:{14 + i * 18}px"><span class="straw">{i + 1}</span>&nbsp; {t}</div>' for i, t in enumerate(rules))
parts.append(window(12, 538, 536, 170, f'''{rl}
  {groove(20, 110, 496)}
  <div class="abs s13 dim" style="left:20px;top:118px;width:496px;line-height:17px"><span class="rust">What it costs:</span> a hand-pixelled UI kit (frames, caps, cursors, about 40 icons at 24 px, cast digits), and terrain, places and map minis pixelled to match.</div>
'''))

html = wrap('Key · Filigree, the house style on one card', '\n'.join(parts), css_base(), 560, 720)
print(write('Hyb64Key', html), len(html))
