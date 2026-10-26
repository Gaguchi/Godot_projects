"""F64CombatEnemy: the foes' turn, the moment straight after Hyb64Combat. Round 1, Obsidian Fighter 1 acting: it has
taken its one step and its blow has landed.

Engine-true (dirs/consistency/probe_combat.mts play 7 4,3 move:3,3 Nobility 4,3): the game's own combat fixture
(flow/fixtures.ts skirmish: Ashfall Raiders at Frontier Camp, day 1, Open Ground) at seed 7, stepped through the
shipped reducer one decision at a time:
- Lilina (the Hyb64Combat board): free move (1,4) -> (4,3), Blaze at Obsidian Fighter 1, 15, 103 -> 88. She ends.
- The Foundling: free move (2,4) -> (2,3) -> (3,3), beside her, and Nobility on her (1 AP, an ally within 1):
  "Lilina takes 3 ward". He ends.
- Obsidian Fighter 1 (bandit AI, rusher): steps (6,3) -> (5,3), then swing at Lilina: 4 + STR 5 - floor(DEF 2 / 2) = 8;
  physical, so the ward takes 3 and HP 5: Lilina 62 -> 57, ward 3 -> 0. No guard: genatsvale (Oak's passive,
  combat/cover.ts) needs Oak orthogonally beside the one struck, and he is at (2,5). The float reads -5 on her tile.
- The log (ui/combat/chronicle.ts keeps 4; lines from engine/narration.ts): Lilina strikes Obsidian Fighter for 15,
  The Foundling plays Nobility, Lilina takes 3 ward, Obsidian Fighter strikes Lilina for 5. The engine names both
  fighters "Obsidian Fighter"; the boards add the 1 and 2 the brief asks for, here as on the plaques.
- Next: Obsidian Fighter 2, then the Ember Mage, then Oak; round 2 opens with Lilina and The Foundling.
- The hand is withdrawn: CardHand's HandRail, five empty wells and "<name> is acting". Every verb: "the enemy is acting".
"""
import math
from f64i import *  # noqa: F401,F403
import kit_icons as I

COLS, ROWS, TS = 14, 10, 48
BX, BY = 303, 18
W, H = COLS * TS, ROWS * TS


def txy(c, r):
    return BX + c * TS, BY + r * TS


UNITS = [  # id, name, side, (c, r), hp, max, board, face, lose
    ('lilina', 'Lilina', 'ally', (4, 3), 62, 62, 'board_lilina', 'face_lilina', 5),
    ('mc', 'The Foundling', 'ally', (3, 3), 73, 73, 'board_roy', 'face_roy', 0),
    ('oak', 'Bagrat "Oak"', 'ally', (2, 5), 84, 84, 'board_marcus', 'face_marcus', 0),
    ('of1', 'Obsidian Fighter 1', 'foe', (5, 3), 88, 103, 'board_bandit', 'face_bandit', 0),
    ('of2', 'Obsidian Fighter 2', 'foe', (6, 5), 103, 103, 'board_bandit', 'face_bandit', 0),
    ('mage', 'Ember Mage', 'foe', (6, 7), 90, 90, 'board_ember_mage', 'face_ember_mage', 0),
]
UD = {u[0]: u for u in UNITS}
ACT = 'of1'
FROM = (6, 3)
PATH = [(6, 3), (5, 3)]

parts = [world_field()]

# ------------------------------------------------------------------ board marks (as base/gen_combat.py): a lit seam, a bevelled edge
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

# ------------------------------------------------------------------ the walk: where the fighter stood, and the steps it took
fx0, fy0 = txy(*FROM)
ghost = Raster(TS - 1, TS - 1)
for i in range(TS - 1):
    for (xx, yy) in ((i, 0), (i, TS - 2), (0, i), (TS - 2, i)):
        if (i // 3) % 2 == 0:
            ghost.set(xx, yy, 'x4')
parts.append(ghost.svg(fx0 + 1, fy0 + 1, style='opacity:.85'))
# the lozenge it left behind, drawn faint
gb, gf = base_ring(fx0, fy0, 'foe')
parts.append(f'<div class="abs" style="left:0;top:0;opacity:.45">{gb}{gf}</div>')

steps = Raster(W, H)
FOOT = {'6': 'x5', '5': 'x4', '4': 'x3', '3': 'x2'}
BEAD = [".kkk.", "k654k", "k543k", "k433k", ".kkk."]
y_line = 3 * TS + 38                         # along the feet line of row 3
x_start, x_end = FROM[0] * TS + 22, PATH[-1][0] * TS + TS + 12
x = x_start
while x > x_end:
    steps.stamp(BEAD, x - 2, y_line - 2, keymap=FOOT)
    x -= 12
# an arrowhead pointing west, into the tile it stopped on
ar = I.arrow_e(9)
aw = Raster(ar.w, ar.h)
for j in range(ar.h):
    for i in range(ar.w):
        aw.set(ar.w - 1 - i, j, ar.px[j][i])
parts.append(steps.svg(BX, BY))
parts.append(aw.svg(BX + x_end - 10, BY + y_line - 4))

# ------------------------------------------------------------------ units, y-sorted (back ring, figure, front ring)
for uid, name, side, (c, r), hp, mx, spr, fc, lose in sorted(UNITS, key=lambda u: (u[3][1], u[3][0])):
    x, y = txy(c, r)
    back, front = base_ring(x, y, side, act=uid == ACT)
    flip = 'transform:scaleX(-1);' if side == 'foe' else ''
    parts.append(back)
    parts.append(f'<img class="abs" style="left:{x + TS // 2 - 26}px;top:{y + 39 - 76}px;width:52px;height:76px;filter:url(#f64-ol1);{flip}" src="{B(spr)}">')
    parts.append(front)
    parts.append(hp_bar(x + 9, y + TS - 6, 30, hp, mx, side, lose=lose, h=5))   # in depth order: a unit in front covers the bar behind
for uid, n in (('of1', 1), ('of2', 2)):
    x, y = txy(*UD[uid][3])
    parts.append(ordinal(n, x + TS - 12, y + 2))

# the one acting: the brass arrow over the fighter
ax, ay = txy(*PATH[-1])
parts.append(arrow_down(ax + 18, ay - 58))

# the blow, on Lilina: an impact star at her shoulder and the cast float, as the screen floats `-5` on her tile
ox, oy = txy(4, 3)
star = Raster(17, 17)
for j in range(17):
    for i in range(17):
        dx, dy = abs(i - 8), abs(j - 8)
        m = min(dx, dy)
        if (dx + dy <= 8 and m <= 1) or (dx == dy and dx <= 4):
            star.set(i, j, 'b5' if dx + dy <= 3 else 'b3')
outl = Raster(19, 19)
for j in range(17):
    for i in range(17):
        if star.px[j][i] is not None:
            for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ii, jj = i + 1 + ddx, j + 1 + ddy
                if not (0 <= ii - 1 < 17 and 0 <= jj - 1 < 17 and star.px[jj - 1][ii - 1] is not None):
                    outl.set(ii, jj, 'k0')
outl.blit(star, 1, 1)
parts.append(outl.svg(ox + 22, oy - 6))
parts.append(num('−5', ox - 2, oy - 64, 30, 'Oxblood'))

# ------------------------------------------------------------------ the turn order: the one acting, the rest of the round, then round 2
ORDER = ['of1', 'of2', 'mage', 'oak', 'lilina', 'mc']
rows = ''
ry = {}
y = 66
for i, uid in enumerate(ORDER):
    if i == 4:
        rows += groove(PAD, y + 2, 236)
        y += 8
    ry[uid] = y
    _, name, side, _, hp, mx, _, fc, lose = UD[uid]
    act = uid == ACT
    if act:   # the one acting: a band behind its row, as a list marks the row in hand
        rows += f'<div class="row hov" style="left:14px;top:{y - 4}px;width:248px;height:56px"></div>'
    rows += face(fc, 18, y, 48, lit=act, flip=side == 'foe')
    rows += T(76, y + 3, name, f's16 {"straw" if act else "bone"}')
    rows += side_glyph(side, act, 76, y + 29)
    rows += hp_bar(90, y + 30, 110, hp, mx, side, lose=lose)
    rows += T(258, y + 25, f'{hp - lose}/{mx}', 's13 bone', style='transform:translateX(-100%)')
    y += 56
rows += T(258, ry['lilina'] + 3, 'took 5', 's13 rust', style='transform:translateX(-100%)')
rows += T(258, ry['mc'] + 3, 'round 2', 's13 dim', style='transform:translateX(-100%)')
leg_y = y + 6
rows += groove(PAD, leg_y, 236)
rows += T(PAD, leg_y + 12, f'{side_glyph("ally")}square: ours<span style="display:inline-block;width:16px"></span>{side_glyph("foe")}diamond: theirs', 's13 dim')
order = window(14, 14, 276, 470, T(PAD, 12, 'Round', 'tt') + num('1', 124, 18, 30, 'Ochre') + T(256, 30, 'who moves when', 's13 dim', style='transform:translateX(-100%)') + rows)

# ------------------------------------------------------------------ the one acting: the fighter at 1x, what its turn spent
act = (sprite_well('board_bandit', 10, 9, flip=True)
       + T(134, 10, 'Obsidian<br>Fighter 1', 's20 straw', w=146)          # s20 bold; the column is 146 px, so two lines
       + T(134, 60, f'{side_glyph("foe", True)}enemy turn', 's13 rust')
       + T(134, 82, 'HP', 's13 ochre') + T(280, 80, '88 <span class="dim lt">of</span> 103', 's16 bone', style='transform:translateX(-100%)')
       + hp_bar(134, 104, 146, 88, 103, 'foe')
       + groove(134, 120, 146)
       + T(134, 128, 'This turn', 's13 ochre')
       + T(134, 146, 'Moved', 's13 bone') + T(280, 146, '1 tile', 's13 dim', style='transform:translateX(-100%)')
       + T(134, 164, 'Struck', 's13 bone') + T(280, 164, 'its one blow', 's13 dim', style='transform:translateX(-100%)'))
actwin = window(14, 512, 300, 194, act)

# ------------------------------------------------------------------ the hand, withdrawn while a foe acts
hand = ''
HX0, CW, CG = 322, 136, 6
for i in range(5):
    hand += card_slot(HX0 + i * (CW + CG), 534)
hand += plate('Obsidian Fighter 1 is acting', x=HX0 + (5 * CW + 4 * CG) // 2, y=606, center=True)

# ------------------------------------------------------------------ the blow: who it was meant for, who took it, what it cost
five = numeral('5', 50, 'Oxblood')
h62, arr, h57 = numeral('62', 22, 'Bone'), numeral('→', 22, 'Ochre'), numeral('57', 22, 'Bone')
blow = (T(PAD, 14, 'Obsidian Fighter 1 strikes', 's13 dim')
        + person(PAD, 31, f'{side_glyph("ally")}Lilina', 'rill')
        + rule(PAD, 62, 236)
        + face('face_lilina', PAD, 72, 96)
        + T(140, 74, 'damage', 's13 dim') + five.svg(138, 92)
        + T(140, 146, '8 struck', 's13 bone') + T(140, 162, 'the ward took 3', 's13 dim')
        + T(PAD, 192, 'HP', 's13 dim')
        + h62.svg(46, 188) + arr.svg(46 + h62.w + 4, 188 + (h62.h - arr.h) // 2) + h57.svg(46 + h62.w + arr.w + 8, 188)
        + T(256, 192, 'of 62', 's13 dim', style='transform:translateX(-100%)')
        + hp_bar(PAD, 216, 236, 62, 62, 'ally', lose=5, h=11)
        + T(PAD, 236, 'No guard: Oak is not beside her.', 's13 dim'))
blowin = window(990, 14, 276, 264, blow)

# ------------------------------------------------------------------ the log: the last four lines, newest at the foot
LOG = [  # (parts, tone, this turn?)
    (['Lilina strikes Obsidian Fighter 1 for ', 15], 'harm', False),
    (['The Foundling plays Nobility'], 'plain', False),
    (['Lilina takes ', 3, ' ward'], 'mend', False),
    (['Obsidian Fighter 1 strikes Lilina for ', 5], 'harm', True),
]
lg = section_head('Blow by blow', w=236, note='the last four')
ly = 46
for prts, tone, now in LOG:
    txt = ''.join(f'<span class="{"meadow" if tone == "mend" else "rust"}" style="font-weight:700">{p}</span>' if isinstance(p, int) else p for p in prts)
    cls = 's14 bone' if now else 's14 dim lt'
    lg += T(PAD, ly, txt, cls, w=236)
    n = max(1, math.ceil(text_w(''.join(str(p) for p in prts), 14, 600 if now else 400) / 230))
    ly += n * 18 + 8
logwin = window(990, 290, 276, 210, lg)

# ------------------------------------------------------------------ the commands: kept in place, every verb dark and saying why
dis = lambda t: f'<span class="cmd dis">{t}</span>'
cm = (T(PAD - 16, 14, dis('Move'), '')
      + T(PAD - 16, 42, dis('Capture'), '')
      + T(PAD, 70, '<span class="why">the enemy is acting</span>', 's13')
      + f'<div class="abs" style="left:18px;top:94px"><span class="btn dis" style="width:196px;text-align:left;padding-left:12px;font-size:18px">End turn</span></div>'
      + T(PAD, 140, f'Danger zone {key("Tab")} <span class="dim">off</span>', 's13 bone')
      + T(PAD, 164, f'Menu {key("Esc")}', 's13 bone'))
cmds = window(1034, 512, 232, 194, cm)

parts += [order, actwin, hand, blowin, logwin, cmds]
write('F64CombatEnemy', board_html("Combat · round 1, the foes' turn, Obsidian Fighter 1 strikes Lilina", '\n'.join(parts), 1280, 720))
print('ok')
