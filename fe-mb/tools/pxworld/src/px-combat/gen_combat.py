"""Hyb64Combat on the 1x pixel field (round 3, "go pixel everywhere"): a copy of dirs/hyb-64/gen_combat.py whose
world is kit_px_field.field_uri() (dirs/kit64/kit_px_field.py) instead of C's painted field (hyb-64/world_combat.py).
Everything else (board marks, units at the board sprites' half size, windows, cards, numbers, strings) is unchanged;
the only other change is that the seam overlay is gone, because the pixel field draws its own grid in its ramps.

Was: C's painted field under the 64-bit sprite UI.
Round 1, Lilina's turn: she has taken her free move (1,4) -> (1,3) (2,3) (3,3) -> (4,3), and Blaze is picked up and
aimed at Obsidian Fighter 1 two tiles off (Blaze reaches 1 to 2). 15 damage, 103 -> 88, AP 3 of 3 with Blaze spending 2.

Engine-true (dirs/consistency/probe_combat.mts play 7 4,3): the game's own combat fixture (flow/fixtures.ts skirmish:
Ashfall Raiders at Frontier Camp, day 1, Open Ground) at seed 7, whose opening hand is exactly Flame Burst, Barrier,
Blaze, Arcane Burst, Fire. (4,3) is in Lilina's reach (mov 5), the path is the one the BFS returns, and
forecast(): base 8 + MAG 7 + empower 0 - DR floor(RES 1 / 2) = 0 -> 15, hpLost 15, predictedHp 88.
Commands after the move: Move refused 'already moved this turn' (combat/reasons.ts ALREADY_MOVED), Capture refused
"no foe within arm's reach" (NO_FOE_IN_REACH), End turn secondary while a card is held (Hud.tsx Commands).

Usage: python gen_combat.py [units=smooth|px|ol|pxol] [out=path]
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import math
import sys
_D = ROOT + '/src'
sys.path.insert(0, _D + '/kit64')
sys.path.append(_D + '/hyb-64')      # read-only: the 64-bit sprite UI (px64, icons64) this board is drawn in
import kit_icons as KI   # noqa: E402  (the kit's small lock, for the refusal lines)
import kit_px_field as PXF   # noqa: E402  (the 1x pixel field)
import icons64 as I
import px64 as P
from px64 import C, B, Raster, window, rule, groove, css_base, wrap, write, numeral

ARGS = dict(a.split('=') for a in sys.argv[1:])
UNITS_V = ARGS.get('units', 'ol')
k = C['k0']

COLS, ROWS, TS = 14, 10, 48
BX, BY = PXF.OX, PXF.OY        # 303, 18
W, H = COLS * TS, ROWS * TS

UNITS = [  # key, name, side, (c, r), hp, max, sprite, face
    ('lilina', 'Lilina', 'ally', (4, 3), 62, 62, 'board_lilina', 'face_lilina'),   # after her free move from (1,4)
    ('roy', 'The Foundling', 'ally', (2, 4), 73, 73, 'board_roy', 'face_roy'),
    ('oak', 'Bagrat "Oak"', 'ally', (2, 5), 84, 84, 'board_marcus', 'face_marcus'),
    ('of1', 'Obsidian Fighter 1', 'foe', (6, 3), 103, 103, 'board_bandit', 'face_bandit'),
    ('of2', 'Obsidian Fighter 2', 'foe', (6, 5), 103, 103, 'board_bandit', 'face_bandit'),
    ('mage', 'Ember Mage', 'foe', (6, 7), 90, 90, 'board_ember_mage', 'face_ember_mage'),
]
ORDER = ['lilina', 'roy', 'of1', 'of2', 'mage', 'oak']
UD = {u[0]: u for u in UNITS}
FACE_CROP = {'face_roy': (28, 14), 'face_marcus': (26, 10), 'face_lilina': (27, 20), 'face_bandit': (26, 8), 'face_ember_mage': (26, 14)}


def tile_xy(c, r):
    return BX + c * TS, BY + r * TS


# ------------------------------------------------------------------ the pixel field at 1:1 (it draws its own seams)
FILT = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
        f'<filter id="h64-ol1" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">'
        '<feComponentTransfer in="SourceAlpha" result="sa"><feFuncA type="discrete" tableValues="0 0 1 1 1"/></feComponentTransfer>'
        f'<feMorphology in="sa" operator="dilate" radius="1" result="d"/><feFlood flood-color="{k}"/>'
        '<feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
        '</defs></svg>')
parts = [FILT, f'<img class="abs" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" src="{PXF.field_uri()}">']

# ------------------------------------------------------------------ board marks: the lit seam, a bevelled edge (the seams are in the field)
lit = Raster(W, H)
for c in range(1, COLS):
    for y in range(H):
        lit.set(c * TS + 1, y, 'b5')
for r in range(1, ROWS):
    for x in range(W):
        lit.set(x, r * TS + 1, 'b5')
parts.append(lit.svg(BX, BY, style='opacity:.07'))
edge = Raster(W + 6, H + 6)
for x in range(1, W + 5):
    edge.set(x, 0, 'k0'); edge.set(x, H + 5, 'k0')
    edge.set(x, 1, 'w4'); edge.set(x, H + 4, 'w1')
    edge.set(x, 2, 'k0'); edge.set(x, H + 3, 'k0')
for y in range(1, H + 5):
    edge.set(0, y, 'k0'); edge.set(W + 5, y, 'k0')
    edge.set(1, y, 'w4'); edge.set(W + 4, y, 'w1')
    edge.set(2, y, 'k0'); edge.set(W + 3, y, 'k0')
for (x, y) in ((1, 1), (W + 4, 1), (1, H + 4), (W + 4, H + 4)):
    edge.set(x, y, 'k0')
parts.append(edge.svg(BX - 3, BY - 3, style='opacity:.8'))

lx, ly = tile_xy(4, 3)
tx, ty = tile_xy(6, 3)


def tile_box(x, y, line, wash=None, op=.3):
    s = ''
    if wash:
        s += f'<div class="abs" style="left:{x + 1}px;top:{y + 1}px;width:{TS - 1}px;height:{TS - 1}px;background:{C[wash]};opacity:{op}"></div>'
    R = Raster(TS - 1, TS - 1)
    for i in range(TS - 1):
        for (xx, yy) in ((i, 0), (i, TS - 2), (0, i), (TS - 2, i)):
            R.set(xx, yy, line)
        for (xx, yy) in ((i, 1), (i, TS - 3), (1, i), (TS - 3, i)):
            if 1 <= i <= TS - 3:
                R.set(xx, yy, 'k0')
    return s + R.svg(x + 1, y + 1, style='opacity:.9')


parts.append(tile_box(tx, ty, 'x4', 'x3', .34))
parts.append(tile_box(lx, ly, 'o5', 'o4', .2))


# base plates: square for ours, diamond for theirs. The back half sits under the figure, the front half over its feet.
FEET = 37   # feet line inside the tile


def base_plates(key, side):
    """A ring on the ground at the feet, seen at a tilt: a flat rectangle for ours, a flat lozenge for theirs.
    The back half is drawn under the figure, the front half over its feet."""
    back, front = Raster(TS, TS), Raster(TS, TS)
    act = key == 'lilina'
    ring = ('o5', 'o3') if act else (('s4', 's3') if side == 'ally' else ('x4', 'x3'))
    cy = FEET + .5
    for j in range(TS):
        for i in range(TS):
            dx, dy = abs(i + .5 - TS / 2), abs(j + .5 - cy)
            tgt = front if j + .5 >= cy else back
            lit = ring[0] if j + .5 < cy else ring[1]
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


def contact_shadow(cx, fy):
    R = Raster(36, 9)
    for j in range(9):
        for i in range(36):
            e = ((i + .5 - 18) / 17) ** 2 + ((j + .5 - 4.5) / 4.2) ** 2
            if e <= .45:
                R.set(i, j, 'sh45')
            elif e <= 1 and (i + j) % 2 == 0:
                R.set(i, j, 'sh35')
    return R.svg(cx - 18, fy - 5)


# Blaze's arc: beads stepped on the pixel grid from Lilina's staff to the fighter
arc = Raster(W, H)
x0, y0 = 4 * TS + 34, 3 * TS - 20       # from her free hand, clear of the acting arrow over her head
x1, y1 = 6 * TS + 16, 3 * TS - 24
pts = []
for i in range(0, 241):
    t = i / 240
    pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 26 * math.sin(math.pi * t)))
acc = 0
SB = [".k.", "k5k", ".k."]
for i in range(1, len(pts)):
    acc += math.dist(pts[i - 1], pts[i])
    t = i / 240
    if acc >= 11 and .04 < t < .9:
        acc = 0
        xi, yi = int(pts[i][0]), int(pts[i][1])
        arc.stamp([".kkk.", "k665k", "k654k", "k543k", ".kkk."], xi - 2, yi - 2, keymap=P.BR)
parts.append(arc.svg(BX, BY))

# units, y-sorted: back plate, contact shadow, figure, front plate
for key, name, side, (c, r), hp, mx, spr, face in sorted(UNITS, key=lambda u: u[3][1]):
    x, y = tile_xy(c, r)
    cx = x + TS // 2
    back, front = base_plates(key, side)
    parts.append(back.svg(x, y))
    parts.append(contact_shadow(cx, y + FEET + 1))
    flip = 'transform:scaleX(-1);' if side == 'foe' else ''
    left, top = cx - 26, y + FEET + 2 - 76
    if UNITS_V == 'px':
        st = 'image-rendering:pixelated;'
    elif UNITS_V == 'pxol':
        st = 'image-rendering:pixelated;filter:url(#h64-ol1);'
    elif UNITS_V == 'ol':
        st = 'filter:url(#h64-ol1);'
    else:
        st = ''
    parts.append(f'<img class="abs" style="left:{left}px;top:{top}px;width:52px;height:76px;{st}{flip}" src="{B(spr)}">')
    parts.append(front.svg(x, y))


def hpbar(x, y, w, frac=1.0, lost=0.0, ramp=('s5', 's4', 's3', 's2'), h=7):
    R = Raster(w, h)
    keep = round((w - 2) * frac)
    nl = round((w - 2) * lost)
    for xx in range(w):
        for yy in range(h):
            if xx in (0, w - 1) or yy in (0, h - 1):
                if not ((xx in (0, w - 1)) and (yy in (0, h - 1))):
                    R.set(xx, yy, 'k0')
                continue
            i = xx - 1
            if i < keep:
                R.set(xx, yy, ramp[0] if yy == 1 else (ramp[3] if yy == h - 2 else (ramp[1] if yy < h / 2 else ramp[2])))
            elif i < keep + nl:
                R.set(xx, yy, 'b5' if yy < h / 2 else 'b3')
            else:
                R.set(xx, yy, 'w0' if yy == 1 else 'k1')
    return R.svg(x, y)


ALLY = ('s5', 's4', 's3', 's2')
FOE = ('x5', 'x4', 'x3', 'x2')
for key, name, side, (c, r), hp, mx, spr, face in UNITS:
    x, y = tile_xy(c, r)
    if key == 'of1':
        parts.append(hpbar(x + 9, y + TS - 6, 30, 88 / 103, 15 / 103, FOE, 5))
    else:
        parts.append(hpbar(x + 9, y + TS - 6, 30, 1.0, 0, ALLY if side == 'ally' else FOE, 5))

# ordinals on the two fighters: a small brass-lipped plaque with a cast numeral
for key, num in (('of1', '1'), ('of2', '2')):
    c, r = UD[key][3]
    x, y = tile_xy(c, r)
    n = numeral(num, 15, 'Bone', drop=0)
    pw, ph = 15, 19
    plate = P.frame(pw, ph, 'plate', shadow=1)
    parts.append(f'<div class="abs" style="left:{x + TS - 12}px;top:{y + 2}px;width:{pw}px;height:{ph}px;background:{C["x2"]}"></div>'
                 + plate.svg(x + TS - 12, y + 2) + n.svg(x + TS - 12 + (pw - n.w) // 2, y + 2 + (ph - n.h) // 2))

# the acting marker over Lilina; brackets and the cast numeral over the target
parts.append(I.arrow_down().svg(lx + 18, ly - 58))
parts.append(I.brackets(tx - 5, ty - 5, tx + TS + 6, ty + TS + 6).svg(tx - 5, ty - 5))
dmg = numeral('−15', 30, 'Oxblood')
parts.append(dmg.svg(tx + TS - 2, ty - 30))

# ------------------------------------------------------------------ windows
def face_niche(face, x, y, s=48, kind='plate', flip=False, bg='s1'):
    dx, dy = FACE_CROP.get(face, (22, 8))
    inner = s - 8
    off = (44 - inner) // 2
    fr = P.frame(s, s, kind, shadow=1)
    tf = 'transform:scaleX(-1);' if flip else ''
    left = -dx - off + 4
    if flip:
        left = -(96 - dx - 44) - off + 4
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{s}px;height:{s}px">'
            f'<div class="abs" style="left:4px;top:4px;width:{inner}px;height:{inner}px;overflow:hidden;background:{C[bg]}">'
            f'<img class="abs" style="left:{left}px;top:{-dy - off}px;width:96px;height:96px;{tf}" src="{B(face)}"></div>'
            f'{fr.svg(0, 0)}</div>')


rows = []
for i, kk in enumerate(ORDER):
    key, name, side, pos, hp, mx, spr, face = UD[kk]
    y = 66 + i * 56
    act = kk == 'lilina'
    rows.append(face_niche(face, 18, y, 48, 'platelit' if act else 'plate', flip=side == 'foe', bg='s1' if side == 'ally' else 'x1'))
    rows.append(f'<div class="abs s16 {"straw" if act else "bone"} nowrap" style="left:76px;top:{y + 3}px">{name}</div>')
    rows.append(I.side_glyph(side, act).svg(76, y + 29))
    rows.append(hpbar(90, y + 30, 110, 1.0, 0, ALLY if side == 'ally' else FOE))
    rows.append(f'<div class="abs s13 bone nowrap" style="right:18px;top:{y + 25}px">{hp}/{mx}</div>')
order = window(14, 14, 276, 458, f"""
  <div class="abs bl48 straw nowrap" style="left:20px;top:12px;font-size:43px;line-height:43px">Round</div>
  {numeral('1', 30, 'Ochre').svg(124, 18)}
  <div class="abs s13 dim nowrap" style="right:20px;top:30px">who moves when</div>
  {''.join(rows)}
  <div class="abs s13 straw nowrap" style="right:18px;top:{66 + 3}px">acting now</div>
  {groove(20, 408, 236)}
  <div class="abs s13 dim nowrap" style="left:20px;top:420px">{I.side_glyph('ally').inline('margin:-3px 6px 0 0')}square: ours<span style="display:inline-block;width:16px"></span>{I.side_glyph('foe').inline('margin:-3px 6px 0 0')}diamond: theirs</div>
""")

# the acting unit: Lilina's sprite at 1x, her AP and her bag
gems = I.gem20('spend').inline('margin-right:2px') + I.gem20('spend').inline('margin-right:2px') + I.gem20('full').inline('')
pot = I.potion()
sprite = (f'<div class="abs" style="left:14px;top:14px;width:110px;height:166px;background:{C["w0"]};overflow:hidden">'
          f'<div class="abs" style="left:0;top:112px;width:110px;height:54px;background:url({B("tex_grass")}) 0 0/128px 128px;filter:brightness(1.25) saturate(.9)"></div>'
          f'<div class="abs" style="left:0;top:111px;width:110px;height:1px;background:{C["m1"]}"></div>'
          f'</div>'
          + P.frame(118, 174, 'well', shadow=0).svg(10, 10)
          + contact_shadow(66, 172)
          + f'<img class="abs" style="left:8px;top:22px;width:104px;height:152px;image-rendering:pixelated" src="{B("board_lilina")}">')
apwin = window(14, 512, 300, 194, f"""
  {sprite}
  <div class="abs s20 straw nowrap" style="left:136px;top:12px">Lilina</div>
  <div class="abs s13 dim nowrap" style="right:18px;top:17px">acting</div>
  <div class="abs s13 ochre nowrap" style="left:136px;top:40px;font-weight:700">AP</div>
  <div class="abs s16 bone nowrap" style="right:18px;top:37px">3 <span class="dim lt">of</span> 3</div>
  <div class="abs nowrap" style="left:132px;top:56px;height:26px">{gems}</div>
  <div class="abs s13 bone nowrap" style="left:136px;top:84px">Blaze spends <span class="straw">2 of 3</span></div>
  {groove(136, 106, 146)}
  <div class="abs s13 ochre nowrap" style="left:136px;top:114px;font-weight:700">Bag</div>
  <div class="abs s13 dim nowrap" style="right:18px;top:114px">discard <span class="bone">0</span></div>
  <div class="abs s13 bone nowrap" style="left:136px;top:134px">{pot.inline('margin:-4px 4px 0 -2px')}Healing Potion ×1</div>
  <div class="abs s13 dim nowrap" style="left:136px;top:158px">+10 HP · 1 AP to drink</div>
""")

# the hand: five cards
CARDS = [
    ('Flame Burst', 2, I.burst(40), '11', 'attack', 'magic', 'a wide blast'),
    ('Barrier', 1, I.shield(40), '3', 'armor', 'ward', 'an ally'),
    ('Blaze', 2, I.flame(40), '15', 'attack', 'magic', 'one foe'),
    ('Arcane Burst', 2, I.orb(40), '13', 'attack', 'magic', 'one foe'),
    ('Fire', 1, I.flame(40, core=False), '11', 'attack', 'magic', 'one foe'),
]
CW, CH, GAP = 136, 172, 6
HX0 = 322
small_gem = ["..kkk..", ".k554k.", "k55543k", "k54432k", "k43321k", ".k321k.", "..kkk.."]
hand = []
for i, (nm, cost, art, mag, kind, l1, l2) in enumerate(CARDS):
    x = HX0 + i * (CW + GAP)
    sel = nm == 'Blaze'
    y = 514 if sel else 534
    cg = ''.join(P.from_rows(small_gem, P.BR).inline('margin-right:3px') for _ in range(cost))
    mramp = 'Slate' if kind == 'armor' else 'Oxblood'
    num = numeral(mag, 30, mramp, track=3)
    plate = art.svg(16, 56)
    hand.append(window(x, y, CW, CH, f"""
  <div class="abs nowrap" style="left:14px;top:13px;height:9px">{cg}</div>
  <div class="abs s13 {'straw' if sel else 'dim'} nowrap" style="right:14px;top:11px">{cost} AP</div>
  <div class="abs s16 {'straw' if sel else 'bone'} nowrap" style="left:14px;top:28px">{nm}</div>
  {plate}
  {num.svg(70, 58)}
  <div class="abs s13 dim nowrap" style="left:70px;top:{58 + num.h + 1}px">{kind}</div>
  {groove(14, 110, CW - 28)}
  <div class="abs s13 dim nowrap" style="left:14px;top:118px">{l1}</div>
  <div class="abs s13 bone nowrap" style="left:14px;top:136px">{l2}</div>
""", kind='cardlit' if sel else 'card'))
bx = HX0 + 2 * (CW + GAP)
hand.append(I.brackets(bx - 7, 514 - 7, bx + CW + 9, 514 + CH + 9).svg(bx - 7, 514 - 7))

# the forecast: who casts what at whom, and what it does
lose = numeral('103', 22, 'Bone')
arr = numeral('→', 22, 'Ochre')
keep_n = numeral('88', 22, 'Bone')
big = numeral('15', 50, 'Oxblood')
fc = window(990, 14, 276, 304, f"""
  <div class="abs s13 dim nowrap" style="left:20px;top:16px">Lilina casts</div>
  <div class="abs s18 straw nowrap" style="left:20px;top:34px">{I.flame().inline('margin:-5px 6px 0 -2px')}Blaze</div>
  <div class="abs s16 bone nowrap" style="right:20px;top:36px">2 <span class="dim lt">of</span> 3 <span class="dim lt">AP</span></div>
  {rule(20, 68, 236)}
  <div class="abs s13 dim nowrap" style="left:20px;top:80px">at</div>
  <div class="abs s20 rust nowrap" style="left:40px;top:75px">Obsidian Fighter 1</div>
  <div class="abs" style="left:20px;top:104px;width:104px;height:104px">
    <div class="abs" style="left:4px;top:4px;width:96px;height:96px;background:{C['x1']};overflow:hidden">
      <img class="abs" style="left:0;top:0;width:96px;height:96px;transform:scaleX(-1)" src="{B('face_bandit')}"></div>
    {P.frame(104, 104, 'plate', shadow=1).svg(0, 0)}</div>
  <div class="abs s13 dim nowrap" style="left:140px;top:106px">damage</div>
  {big.svg(138, 126)}
  <div class="abs s13 dim nowrap" style="left:20px;top:222px">HP</div>
  {lose.svg(46, 218)}{arr.svg(46 + lose.w + 4, 218 + (lose.h - arr.h) // 2)}{keep_n.svg(46 + lose.w + arr.w + 8, 218)}
  <div class="abs s13 dim nowrap" style="right:20px;top:222px">of 103</div>
  {hpbar(20, 248, 236, 88 / 103, 15 / 103, FOE, 11)}
  <div class="abs s14 straw nowrap" style="left:20px;top:268px">Click the fighter to cast.</div>
""", kind='lit')
log = window(990, 330, 276, 170, f"""
  <div class="abs s16 ochre nowrap" style="left:20px;top:13px">Blow by blow</div>
  {groove(20, 38, 236)}
  <div class="abs s16 bone" style="left:20px;top:48px">Nothing has come of it yet.</div>
  <div class="abs s14 dim" style="left:20px;top:74px;width:236px;line-height:20px;font-weight:400">Oak's taking bets on who bleeds first. Lilina says it won't be her.</div>
""")
btn = (f'<div class="abs" style="left:18px;top:98px;width:{232 - 36}px;height:34px;background:{C["w3"]}"></div>'
       + P.frame(232 - 36 + 0, 34, 'tag', shadow=1).svg(18, 98)
       + f'<div class="abs s18 bone nowrap sh1" style="left:30px;top:104px">End turn</div>')
lock = KI.lock_small().inline('margin:-2px 6px 0 0')
cmds = window(1034, 512, 232, 194, f"""
  <div class="abs s18 faint nowrap" style="left:20px;top:12px">Move</div>
  <div class="abs s13 rust nowrap" style="left:20px;top:35px">{lock}already moved this turn</div>
  <div class="abs s18 faint nowrap" style="left:20px;top:54px">Capture</div>
  <div class="abs s13 rust nowrap" style="left:20px;top:77px">{lock}no foe within arm's reach</div>
  {btn}
  <div class="abs s13 bone nowrap" style="left:20px;top:144px">Danger zone <span class="key">Tab</span> <span class="dim">off</span></div>
  <div class="abs s13 bone nowrap" style="left:20px;top:166px">Menu <span class="key">Esc</span></div>
""")

parts += [order, apwin] + hand + [fc, log, cmds]
html = wrap('Combat · round 1, Lilina has moved, Blaze aimed at Obsidian Fighter 1', '\n'.join(parts), css_base(), 1280, 720)
out = ARGS.get('out')
if out:
    open(out, 'w', encoding='utf-8').write(html)
    print('wrote', out, len(html))
else:
    print(write('Hyb64Combat', html), len(html))
