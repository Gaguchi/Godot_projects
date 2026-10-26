"""KitPanels: windows, plates, the modal over the world, the talk box, faces, gauges, the bag and hands, empty states,
cards and board marks, the icon sheet and the palette. 1280 wide."""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import sys
sys.path.insert(0, ROOT + '/src/kit64')
from kit import *
import kit_icons as KI

W = 1280
FULL = W - 2 * EDGE
parts = []
y = EDGE


def onworld(x, y_, text, cls='s13 bone'):
    """A caption laid straight on the painted ground: inked so it reads."""
    return T(x, y_, text, cls + ' ol1d')


# ------------------------------------------------------------------ header
HH = 96
parts.append(window(EDGE, y, FULL, HH,
                    T(PAD, 46, 'Windows, plates, overlays, faces, gauges, the satchel and the hands, cards and board marks, every icon, the palette.', 's15 bone lt')
                    + T(PAD, 68, 'Real names, prices and numbers from the game. Day 1: 80 gold, 8 food in two rations, one Healing Potion.', 's13 dim'),
                    title='Panels', big=True, note='Filigree kit · sheet 2 of 2'))
y += HH + GAP

# ------------------------------------------------------------------ windows: idle, hover, chosen + plates on the world
WW, WH = 300, 150
cmds = lambda st: (T(PAD, 16, 'The Company', 's18 bone') + T(162, 19, 'roster and gear', 's13 dim') + groove(PAD, 43, WW - 2 * PAD)
                   + T(PAD, 50, 'Contracts', 's18 bone') + T(162, 53, 'none yet', 's13 dim') + groove(PAD, 77, WW - 2 * PAD)
                   + T(PAD, 84, 'Menu', 's18 bone') + T(160, 86, key('Esc'), 's14') + T(PAD, 116, f'state: {st}', 's13 faint'))
for i, (st, cap) in enumerate((('idle', 'idle · walnut moulding'), ('hover', 'hover · brass moulding'), ('chosen', 'chosen · brass + the bracket cursor'))):
    wx = EDGE + i * (WW + 24)
    parts.append(onworld(wx, y + 2, cap))
    parts.append(window(wx, y + 26, WW, WH, cmds(st), state=st))
px0 = EDGE + 3 * (WW + 24)
parts.append(onworld(px0, y + 2, 'plates: a road out · pointed at · quiet'))
parts.append(plate("Trader's Rest", x=px0, y=y + 32))
parts.append(plate('Riverside Market', 'lit', x=px0 + 120, y=y + 32))
parts.append(plate('a landmark', small=True, x=px0, y=y + 70))
parts.append(onworld(px0 + 150, y + 72, 'South Junction', 's14 bone'))
rw = W - EDGE - px0
parts.append(window(px0, y + 106, rw, 70, rule(PAD, 24, rw - 2 * PAD) + groove(PAD, 44, rw - 2 * PAD) + T(PAD, 50, 'rule() with its lozenge · groove()', 's13 dim')))
y += 26 + WH + GAP + 10

# ------------------------------------------------------------------ the modal over the world
MW, MH = 760, 470
parts.append(onworld(EDGE, y, 'modal over the world: a flat dim (no blur), then a large window. The event card from the road.'))
y += 22
mx, my = EDGE + 2, y + 2
parts.append(world_inset(mx, my, MW, MH, 'map', at=(330, 150)))
ev = (T(PAD, MODAL_Y, 'The driver shouts at his oxen. The road is narrow, and you\'d have to push or talk your way past.', 's16 lt bone', w=520, style='line-height:23px')
      + groove(PAD, MODAL_Y + 62, 520)
      + choice(PAD + 4, MODAL_Y + 76, 516, 1, 'Help push the wagon free.', 'hover', 'STR 6 · Oak 6', True)
      + choice(PAD + 4, MODAL_Y + 112, 516, 2, 'Talk him into letting you detour.', 'idle', 'SKL 7 · Lilina 5', False)
      + choice(PAD + 4, MODAL_Y + 148, 516, 3, 'Wait it out.', 'idle')
      + T(PAD, MODAL_Y + 194, 'Oak answers the strength check; Lilina is the best the company has for the other.', 's13 dim'))
parts.append(modal(mx + 100, my + 70, 560, 330, ev, title='A caravan blocks the road', eyebrow='On the road', scrim_box=(mx, my, MW, MH)))
# scrim notes on the right
sx = EDGE + MW + 6 + GAP
sw = W - EDGE - sx
sc = (T(PAD, 46, 'The scrim is one flat ink tone at 62% over the whole stage. No blur, no vignette, no glow; the world stays legible underneath.', 's14 lt bone', w=sw - 2 * PAD)
      + label(PAD, 112, 'the world') + label(PAD + 216, 112, 'under the scrim')
      + world_inset(PAD + 2, 134, 200, 120, 'map', at=(560, 330))
      + world_inset(PAD + 218, 134, 200, 120, 'map', at=(560, 330)) + scrim(200, 120, PAD + 218, 134)
      + groove(PAD, 276, sw - 2 * PAD)
      + T(PAD, 288, 'How to place one', 's16 ochre')
      + T(PAD, 312, 'world_map() as the ground, then modal(x, y, w, h, body, title, eyebrow). Centre the window on the stage; keep 64 px of world showing above and below. One primary inside it at most; Esc closes it unless the beat must be answered.', 's14 lt dim', w=sw - 2 * PAD, style='line-height:20px'))
parts.append(window(sx, y, sw, MH + 4, sc, title='The scrim'))
y += MH + 4 + GAP + 6

# ------------------------------------------------------------------ the talk box
parts.append(onworld(EDGE, y, 'the talk box: whole face in a lit niche, the name at s20 bold (never Jacquard), the line at s18, the answers'))
y += 22
DW, DH = 880, 214
parts.append(dialogue(EDGE, y, DW, DH, 'face_bandit', 'Bandit Leader', 'Hold it right there! This road has a toll now. Pay up or draw steel.', [
    dict(text='Pay the toll (15 gold)', state='idle', tag='15 gold', ok=None),
    dict(text='Intimidate them', state='hover', tag='STR 6 · Oak 6', ok=True),
    dict(text='Fight them!', state='idle'),
]))
lx = EDGE + DW + GAP
lw = W - EDGE - lx
lk = (T(PAD, 46, 'The same answer when the purse holds less than 15 gold: it stays in the list, dimmed, with what it needs.', 's14 lt bone', w=lw - 2 * PAD, style='line-height:20px')
      + choice(PAD + 4, 118, lw - 2 * PAD - 4, 1, 'Pay the toll (15 gold)', 'locked', req='needs 15 gold')
      + groove(PAD, 162, lw - 2 * PAD)
      + T(PAD, 172, f'No answers: a Continue cue {key("Enter")} at the foot.', 's13 dim')
      + T(PAD, 194, f'Keys {key("1")}{key("2")}{key("3")} pick an answer.', 's13 dim'))
parts.append(window(lx, y, lw, DH, lk, title='A locked answer'))
y += DH + GAP

# ------------------------------------------------------------------ faces (left), sprite and cut-in (right)
FW, FH = 760, 336
f = label(PAD, 46, '96 · the whole face: talk box, forecast')
faces = ['face_roy', 'face_marcus', 'face_lilina', 'face_bandit', 'face_ember_mage', 'face_warlord']
names = ['The Foundling', 'Bagrat "Oak"', 'Lilina', 'Obsidian Fighter', 'Ember Mage', 'The Warlord']
for i, fk in enumerate(faces):
    f += face(fk, PAD + i * 118, 66, 96, lit=i == 2, flip=i >= 3)
    f += T(PAD + i * 118, 176, names[i], 's13 bone' if i < 3 else 's13 rust')
f += label(PAD, 204, '48 · rows, the turn order')
f += label(PAD + 380, 204, '32 · dense lists, the log')
for i, fk in enumerate(faces):
    f += face(fk, PAD + i * 58, 224, 48, lit=i == 2, flip=i >= 3)
    f += face(fk, PAD + 380 + i * 40, 232, 32, lit=i == 2, flip=i >= 3)
f += label(PAD, 290, 'ours on slate, theirs on oxblood and facing left; the brass lip marks the one acting or chosen')
parts.append(window(EDGE, y, FW, FH, f, title='Faces', note='face(key, x, y, size, lit, flip)'))
cx = EDGE + FW + GAP
cw = W - EDGE - cx
s = label(PAD, 46, 'sprite at 1x in a well') + sprite_well('board_lilina', PAD, 66) + sprite_well('board_bandit', PAD + 128, 66, flip=True)
s += T(PAD, 250, 'Lilina', 's13 bone') + T(PAD + 128, 250, 'Obsidian Fighter', 's13 rust')
s += label(PAD + 262, 46, 'cut-in of the full art') + cutin('full_roy', PAD + 262, 66, 196, 244, scale=.34, dy=-6)
s += T(PAD + 262, 314, 'The Foundling', 's13 bone')
parts.append(window(cx, y, cw, FH, s, title='Sprites and cut-ins', note='sprite_well() · cutin()'))
y += FH + GAP

# ------------------------------------------------------------------ gauges (left), the satchel (right)
GW, GH = 616, 392
g = label(PAD, 46, 'HP: ours, theirs, the forecast ghost, a heal preview')
g += T(PAD, 66, 'The Foundling', 's14 bone') + hp_bar(PAD + 150, 72, 120, 73, 73, 'ally') + T(PAD + 284, 66, '73/73', 's14 bone')
g += T(PAD, 88, 'Obsidian Fighter 1', 's14 rust') + hp_bar(PAD + 150, 94, 120, 103, 103, 'foe') + T(PAD + 284, 88, '103/103', 's14 bone')
g += T(PAD, 112, 'Blaze at the fighter', 's14 bone') + hp_bar(PAD + 150, 116, 236, 103, 103, 'foe', lose=15, h=11) + T(PAD + 396, 112, '15', 's14 rust')
g += T(PAD, 136, 'a potion after a fight', 's14 bone') + hp_bar(PAD + 150, 142, 120, 52, 62, 'ally', gain=10) + T(PAD + 284, 136, '52 → 62', 's14 bone')
g += groove(PAD, 166, GW - 2 * PAD)
g += label(PAD, 176, 'food: a pip a charge, a group a ration') + label(PAD + 300, 176, 'AP: gems; ringed = this card spends them')
g += T(PAD, 198, '8 food', 's14 bone') + food_pips(PAD + 64, 202, (4, 4))
g += T(PAD, 222, 'after a hop', 's14 dim') + food_pips(PAD + 96, 226, (4, 4), used=(1, 0))
g += ap_gems(PAD + 300, 196, 3) + T(PAD + 392, 200, '3 of 3', 's14 bone')
g += ap_gems(PAD + 300, 226, 3, spend=2) + T(PAD + 392, 230, 'Blaze spends 2 of 3', 's14 straw')
g += groove(PAD, 262, GW - 2 * PAD)
g += label(PAD, 272, 'an encounter on the road: 4 in 10') + meter(PAD, 294, 4, 10)
g += label(PAD + 260, 272, 'cast digits: headline numbers only')
g += num('15', PAD + 260, 290, 30, 'Oxblood') + num('103 → 88', PAD + 312, 293, 22, 'Bone') + num('1', PAD + 452, 290, 30, 'Ochre')
parts.append(window(EDGE, y, GW, GH, g, title='Gauges', note='hp_bar() · food_pips() · ap_gems() · meter() · num()'))
bx = EDGE + GW + GAP
bw = W - EDGE - bx
b = label(PAD, 46, 'the satchel, 8 by 4, on day 1: two rations of 4 and a Healing Potion')
b += bag(PAD, 66, [('food_rations', 0, 0, 4), ('food_rations', 1, 0, 4), ('healing_potion', 2, 0, None)], selected=(2, 0))
b += label(PAD + 368, 66, 'selected: the potion') + label(PAD + 368, 84, 'charges: ×4 on a ration') + label(PAD + 368, 102, 'a 1 x 2 item spans two')
cells = [('empty', None, 'empty', None), ('filled', 'iron_buckler', 'filled', None), ('selected', 'healing_potion', 'selected', None),
         ('equipped', 'fire_tome', 'equipped', None), ('stack', 'food_rations', 'filled', 3), ('refused', 'iron_sword', 'refused', None)]
for i, (lab, iid, st, n) in enumerate(cells):
    cx2 = PAD + i * 96
    b += label(cx2, 256, lab)
    b += bag_cell(cx2, 278, iid, st, n)
parts.append(window(bx, y, bw, GH, b, title='The satchel', note='bag() · bag_cell()'))
y += GH + GAP

# ------------------------------------------------------------------ the two hands, then empty states
EH = 286
e = label(PAD, 46, 'Bagrat "Oak": a lance and a buckler') + label(PAD + 230, 46, 'Lilina: a tome; the off-hand free')
e += equip_slot(PAD, 66, 'left', 'iron_lance') + equip_slot(PAD + 100, 66, 'right', 'iron_buckler')
e += equip_slot(PAD + 230, 66, 'left', 'fire_tome') + equip_slot(PAD + 330, 66, 'right', None, 'target')
e += label(PAD + 330, 240, 'target: the picked gear can go here')
e += label(PAD + 620, 46, 'locked by a two-handed blade') + equip_slot(PAD + 620, 66, 'right', None, 'locked', reason='the off-hand is locked by Iron Greatsword')
e += label(PAD + 940, 46, 'refused') + equip_slot(PAD + 940, 66, 'left', 'iron_sword', 'refused', reason='Mages do not carry swords')
parts.append(window(EDGE, y, FULL, EH, e, title='The hands · the game has two: left (the weapon) and right (the off-hand)', note='equip_slot(x, y, hand, item, state, reason)'))
y += EH + GAP
MH2 = 140
m = empty_state(PAD, 52, 580, 'contract', 'No contracts yet.', 'Work is offered in taverns: reach a town and ask at the board.')
m += empty_state(PAD + 616, 52, 580, 'fight', 'Nothing has come of it yet.', "Oak's taking bets on who bleeds first. Lilina says it won't be her.")
parts.append(window(EDGE, y, FULL, MH2, m, title='Empty states', note='empty_state(x, y, w, icon, line, hint)'))
y += MH2 + GAP

# ------------------------------------------------------------------ cards (left), board marks on the field (right)
KH = 300
cards = [('Fire', 1, 'attack', 11, 'attack', 'magic', 'one foe', 'fire', 'idle', None),
         ('Arcane Burst', 2, 'attack', 13, 'attack', 'magic', 'one foe', 'arcane', 'hover', None),
         ('Blaze', 2, 'attack', 15, 'attack', 'magic', 'one foe', 'flame', 'chosen', None),
         ('Barrier', 1, 'ward', 3, 'armor', 'ward', 'an ally', 'ward', 'disabled', 'needs 1 AP')]
kk = ''
for i, (nm, cost, kind, mag, mw, l1, l2, art, st, why) in enumerate(cards):
    kx = PAD + i * 146
    kk += label(kx, 46, st)
    kk += card(kx, 98, nm, cost, kind, mag, mw, l1, l2, art, st, reason=why)
CW_ = 4 * 146 + 2 * PAD - 10
parts.append(window(EDGE, y, CW_, KH, kk, title='Cards', note='card()'))
fx = EDGE + CW_ + GAP
fw = W - EDGE - fx
# the field crop: tiles (0..8, 1..5) of the combat board (row 1 down, so Lilina's arrow at (4,3) stays inside it)
TS = 48
OX, OY = 303, 18
R0 = 1
crop_at = (OX, OY + R0 * TS)
fz_w, fz_h = 9 * TS, 5 * TS
fpx, fpy = PAD + 2, 50
fd = world_inset(fpx, fpy, fz_w, fz_h, 'field', at=crop_at)
units = [('board_lilina', 'ally', (4, 3), True, 62, 62), ('board_roy', 'ally', (2, 4), False, 73, 73), ('board_marcus', 'ally', (2, 5), False, 84, 84),
         ('board_bandit', 'foe', (6, 3), False, 103, 103), ('board_bandit', 'foe', (6, 5), False, 103, 103)]
for spr, side, (c, r), act, hp, mx in sorted(units, key=lambda u: u[2][1]):
    tx, ty = fpx + c * TS, fpy + (r - R0) * TS
    back, front = base_ring(tx, ty, side, act)
    flip = 'transform:scaleX(-1);' if side == 'foe' else ''
    fd += back + f'<img class="abs" style="left:{tx + TS // 2 - 26}px;top:{ty + 39 - 76}px;width:52px;height:76px;filter:url(#f64-ol1);{flip}" src="{B(spr)}">' + front
    fd += hp_bar(tx + 9, ty + TS - 6, 30, hp, mx, side, lose=15 if (c, r) == (6, 3) else 0, h=5)
fd += ordinal(1, fpx + 6 * TS + TS - 12, fpy + (3 - R0) * TS + 2) + ordinal(2, fpx + 6 * TS + TS - 12, fpy + (5 - R0) * TS + 2)
fd += arrow_down(fpx + 4 * TS + 18, fpy + (3 - R0) * TS - 58)   # Lilina after her free move, (4,3): Blaze reaches 1 to 2
t6x, t6y = fpx + 6 * TS, fpy + (3 - R0) * TS
fd += brackets(t6x - 5, t6y - 5, TS + 11, TS + 11)
fd += num('−15', t6x + TS - 2, t6y - 30, 30, 'Oxblood')
fd += label(fpx + fz_w + 14, 54, 'square ring: ours')
fd += label(fpx + fz_w + 14, 72, 'lozenge: theirs')
fd += label(fpx + fz_w + 14, 90, 'brass ring + arrow:')
fd += label(fpx + fz_w + 14, 106, 'acting now')
fd += label(fpx + fz_w + 14, 128, 'brackets: aimed at')
fd += label(fpx + fz_w + 14, 150, 'plaque: 1 and 2')
fd += label(fpx + fz_w + 14, 172, 'ghost: the loss')
fd += T(fpx + fz_w + 14, 198, side_glyph('ally', True) + side_glyph('ally') + side_glyph('foe'), 's13')
parts.append(window(fx, y, fw, KH, fd, title='Board marks', note='base_ring() · ordinal() · arrow_down()'))
y += KH + GAP

# ------------------------------------------------------------------ the icon sheet
CELL = 82
rows_n = sum(1 + (len(ns) - 1) // 15 for _, ns in ICON_GROUPS)
IH = 46 + len(ICON_GROUPS) * 22 + rows_n * 56 + 8
ic = ''
iy = 46
for gname, ns in ICON_GROUPS:
    ic += T(PAD, iy, gname, 's13 ochre')
    iy += 20
    for j, n in enumerate(ns):
        ix = PAD + (j % 15) * CELL
        if j and j % 15 == 0:
            iy += 56
        ic += icon(n, ix + (CELL - 24) // 2 - 22, iy) + T(ix - 22, iy + 28, n, 's13 dim c', w=CELL)
    iy += 58
parts.append(window(EDGE, y, FULL, IH, ic, title=f'Icons · 24 px, 4 to 5 tones, ink edge, lit from the north-west · {sum(len(n) for _, n in ICON_GROUPS)} of them',
                    note="icon(name, x, y) · icon_inline(name) · silhouette(name, x, y)"))
y += IH + GAP

# ------------------------------------------------------------------ palette
PH = 150
pal = ''
for i, (name, ramp) in enumerate(RAMPS):
    colx = PAD + (i % 4) * 306
    rowy = 46 + (i // 4) * 48
    pal += T(colx, rowy, name, 's13 bone')
    R = Raster(len(ramp) * 30 + 1, 19)
    for j, (kk_, hx) in enumerate(ramp):
        for xx in range(j * 30, j * 30 + 29):
            for yy in range(19):
                e_ = xx in (j * 30, j * 30 + 28) or yy in (0, 18)
                if e_ and not (xx in (j * 30, j * 30 + 28) and yy in (0, 18)):
                    R.set(xx, yy, 'k0')
                elif not e_:
                    R.set(xx, yy, kk_)
    pal += R.svg(colx + 64, rowy - 1)
    for j, (k_, _) in enumerate(ramp):
        pal += T(colx + 64 + j * 30, rowy + 20, k_, 's13 faint', w=29, align='center')
pal += T(PAD + 3 * 306, 94, 'C["o5"] · rgba("k0", .62)', 's13 dim')
parts.append(window(EDGE, y, FULL, PH, pal, title='Palette · seven ramps, dark to light', note='C[key] · RAMP[name]'))
y += PH + EDGE

H = y
html = board_html('Kit · panels, faces, gauges, the satchel, cards and icons', ground(W, H) + '\n'.join(parts), W, H)
print(write('KitPanels', html), H, len(html))
