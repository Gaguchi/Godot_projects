"""F64Dungeon, round 3: Smuggler's Cave redrawn as 1x pixel art (cave.py) under the unchanged Filigree UI.
State: three rooms in (a fight, a rest, an elite), standing in the cleared elite room on row 3 of 7; three rooms open
below; the pointer is on the fight in the middle.

A copy of dirs/f64-places/gen_dungeon.py. Only the world changed: the painted SVG cave, its soft glyph shadows, the
SVG boot-prints and the SVG company give way to one pixel PNG at 1:1 (the boot-prints, the glyph contact shadows and
the company's three minis under the standard are drawn into it). The ways on are the pixel map's beads (brass on the
pointed way, bone on the others) and its brass arrowhead, turned to point down the passage.

Every number is the shipped reducer's (f64-places/probe_dungeon.mts, run seed 36, Smuggler's Cave unlocked):
  mouth -> r0c2 fight (Bandit Lookouts L2, won in 6) -> r1c1 rest (50% to the wounded, free) -> r2c2 elite
  (Brigand Raiders L2, won in 8). Party now The Foundling 65/73, Bagrat "Oak" 64/84, Lilina 23/62.
  Open: r3c1 treasure (50 gold + guaranteed kit), r3c2 fight (Bandit Lookouts L1: Lookout x2 99 HP, Watchbow 88 HP;
  killGold L1 = 23 each -> 69; dungeon fights drop kit 3 in 4), r3c3 rest. r3c2 leads on only to r4c3 (a fight).
  19 rooms, 3 cleared. Still below: fight x3, elite x1, treasure x2, rest x4, boss x1 (The Cargo Crew, L2, four).
Strings follow game/src/ui/screens/Dungeon.tsx and engine/run/dungeon.ts (ROOM_LABEL, leaveDungeon, the note).

Usage: python gen_dungeon.py"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import pxs                       # noqa: E402  (first: the palette's Vault ramp)
sys.path.insert(0, ROOT + '/src/kit64')
from kit import *                # noqa: E402,F401,F403
import kit_icons as KI           # noqa: E402
from kit_px import Icon, Raster, seg, union, circle, poly, cover   # noqa: E402
import cave as CV                # noqa: E402
import cave_graph as WV          # noqa: E402

LABEL = {'combat': 'a fight', 'elite': 'an elite', 'event': 'something', 'treasure': 'treasure', 'rest': 'a rest', 'boss': 'the boss'}
ICON = {'combat': 'fight', 'elite': 'elite', 'treasure': 'treasure', 'rest': 'rest', 'boss': 'boss'}
PARTY = [('The Foundling', 'face_roy', 'Lord', 65, 73), ('Bagrat "Oak"', 'face_marcus', 'Shield Knight', 64, 84),
         ('Lilina', 'face_lilina', 'Mage', 23, 62)]   # the 320 px window: the class alone (Oak's full kit line is 250 px)


def R(w, y, html, cls='s14 bone'):
    """Right-aligned text inside a window of width w."""
    return T(w - PAD, y, html, cls, style='transform:translateX(-100%)')


# ------------------------------------------------------------------ kit gap: the game's 'event' room ("something") has no kit icon
def event_icon():
    """Something: a bone question mark, 24 px, ink-edged, lit from the north-west like the kit's set."""
    I = Icon()
    hook = union(seg(6.5, 8.2, 8.4, 4.6, 1.9), seg(8.4, 4.6, 12, 3.2, 1.9), seg(12, 3.2, 15.6, 4.6, 1.9), seg(15.6, 4.6, 17.2, 8.2, 1.9),
                 seg(17.2, 8.2, 15.4, 11.4, 1.9), seg(15.4, 11.4, 12.2, 13.4, 1.9), seg(12.2, 13.4, 12.2, 15.6, 1.9))
    I.layer(hook, ['b1', 'b2', 'b3', 'b4', 'b5'], R=1.6, glint=False)
    I.layer(circle(12.2, 19.6, 2.1), ['b1', 'b2', 'b3', 'b4', 'b5'], R=1.4, glint=False)
    return I.raster()


def glyph(kind, dim=False):
    """The room's 24 px mark; dim = the walnut silhouette for rooms the company can no longer reach."""
    r = event_icon() if kind == 'event' else KI.get(ICON[kind])
    if dim:
        r = r.recolor(lambda c: 'k0' if c == 'k0' else ('w3' if c in ('b4', 'b5', 'o5', 'o6', 's5', 'x5', 'm5', 'w6') else 'w2'))
    return r


def arrow_s():
    """The pixel map's brass arrowhead (icons64.arrow_e), turned to point south: 15 x 12, lit from the top-left."""
    I = Icon(15, 12)
    I.layer(cover(poly([(1, 1), (14, 1), (7.5, 11.4)]), 15, 12), ['o1', 'o2', 'o3', 'o4', 'o5'], R=2.2, glint=False)
    I.put(3, 2, 'o6'); I.put(4, 2, 'o6'); I.put(4, 3, 'o6')
    return I.raster()


# ------------------------------------------------------------------ the world: one pixel PNG at 1:1
st, info = CV.render()
hx, hy = WV.pos(WV.HERE)
CV.company(st, hx - 2, hy + 10)
im = st.render().convert('RGB')
os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
im.save(os.path.join(HERE, 't', 'dungeon_world.png'))
body = pxs.world_img(pxs.to_png_uri(im))

# ------------------------------------------------------------------ marks on the chart
marks = ''
for rid, kind in WV.ROOMS.items():
    x, y = WV.pos(rid)
    if rid == WV.HERE:
        continue
    dim = WV.past(rid) or rid in WV.CLEARED
    marks += glyph(kind, dim).svg(x - 12, y - 12)
    if rid in WV.CLEARED:
        marks += KI.check_mark('m4', small=False).svg(x + 6, y + 2)

# the ways on: the pixel map's beads, brass on the pointed way, bone on the others, and the arrowhead
BEAD = ["..kkkkk..", ".k66655k.", "k6665544k", "k6655443k", "k6554433k", "k5544332k", "k4443322k", ".k33322k.", "..kkkkk.."]
BEAD_O = {'6': 'o6', '5': 'o5', '4': 'o4', '3': 'o3', '2': 'o1', 'k': 'k0'}
BEAD_B = {'6': 'b5', '5': 'b4', '4': 'b3', '3': 'b2', '2': 'b0', 'k': 'k0'}
beads = Raster(1280, 720)
arrow_at = None
for rid in WV.REACH:
    pts = [(x, y + CV.HC // 2) for x, y in WV.edge_pts(WV.HERE, rid, 200)]   # onto the passage's visible floor
    keep = [p for p in pts if math.hypot(p[0] - hx, (p[1] - hy) * 1.5) > 40
            and math.hypot(p[0] - WV.pos(rid)[0], (p[1] - WV.pos(rid)[1]) * 1.5) > 44]
    hov = rid == WV.HOVER
    spaced, run_ = [keep[0]], 0.0
    for q0, q1 in zip(keep, keep[1:]):
        run_ += math.hypot(q1[0] - q0[0], q1[1] - q0[1])
        if run_ >= 12:
            spaced.append(q1)
            run_ = 0.0
    if hov:
        spaced = spaced[:-1]
        ax, ay = keep[-1]
        arrow_at = (int(round(ax)) - 7, int(round(ay)) - 4)
    for p in spaced:
        beads.stamp(BEAD, int(round(p[0])) - 4, int(round(p[1])) - 4, keymap=BEAD_O if hov else BEAD_B)
body += beads.svg(0, 0) + marks
if arrow_at:
    body += arrow_s().svg(*arrow_at)

# plates on the open rooms; the pointed one lit and bracketed
for rid in WV.REACH:
    x, y = WV.pos(rid)
    body += plate(LABEL[WV.ROOMS[rid]], 'lit' if rid == WV.HOVER else 'idle', small=True, x=x, y=y + 22, center=True)
hx2, hy2 = WV.pos(WV.HOVER)
body += brackets(hx2 - 52, hy2 - 34, 104, 82)

# ------------------------------------------------------------------ left: the place and the descent
LW = 320
lt = T(PAD, 9, "Smuggler's Cave", 'tt')
lt += T(PAD, 60, 'Below · row 3 of 7', 's15 bone')
lt += R(LW, 60, '3 of 19 cleared', 's15 dim')
lt += groove(PAD, 88, LW - 2 * PAD)
lt += section_head('Still below', y=98, w=LW - 2 * PAD, note='11 rooms')
STILL = [('combat', 3), ('elite', 1), ('treasure', 2), ('rest', 4), ('boss', 1)]
for i, (kind, n) in enumerate(STILL):
    y = 132 + i * 30
    lt += glyph(kind).svg(PAD, y)
    lt += T(PAD + 34, y + 3, LABEL[kind], 's15 bone')
    lt += R(LW, y + 3, f'×{n}', 's15 bone')
lt += groove(PAD, 286, LW - 2 * PAD)
lt += f'<div class="abs" style="left:{PAD}px;top:298px">{button("Back to daylight", "secondary", "disabled", reason="the only way out is through the boss")}</div>'
LH = 368
body += window(EDGE, EDGE, LW, LH, lt)

KY = EDGE + LH + GAP
KH = 720 - EDGE - KY
k = section_head('The Company', w=LW - 2 * PAD, note='three of us')
for i, (nm, fk, role, hp, mx) in enumerate(PARTY):
    y = 44 + i * 70
    k += face(fk, PAD, y + 4, 48)
    k += T(80, y + 3, nm, 's16 bone')
    k += T(80, y + 24, role, 's13 dim')
    k += hp_bar(80, y + 46, LW - PAD - 80, hp, mx, 'ally')
    low = hp * 2 < mx
    k += R(LW, y + 3, f'<span class="{"rust" if low else "bone"}">{hp}</span>/{mx}', 's15 bone')
    if i < 2:
        k += groove(PAD, y + 63, LW - 2 * PAD)
k += T(PAD, 258, 'There is no innkeeper down here. What the company spends, it spends for good.', 's13 it dim', w=LW - 2 * PAD, style='line-height:18px')
body += window(EDGE, KY, LW, KH, k)

# ------------------------------------------------------------------ right: the way on, and the room pointed at
RX, RW = 1280 - EDGE - 320, 320
r = section_head('The way on', w=RW - 2 * PAD, note='3 rooms open')
OPEN = [('treasure', 'treasure', '50 gold and a piece of kit', 'idle'),
        ('combat', 'a fight', 'Bandit Lookouts, three of them', 'hover'),
        ('rest', 'a rest', 'the wounded mend half, free', 'idle')]
for i, (kind, name, sub, st_) in enumerate(OPEN):
    r += row(PAD + 6, 42 + i * 46, RW - 2 * PAD - 6, name, sub, icon_name=ICON[kind], state=st_, h=44)
r += groove(PAD, 186, RW - 2 * PAD)
r += T(PAD, 198, 'a fight · row 4 of 7', 's13 dim')
r += person(PAD, 220, 'Bandit Lookouts', 'rust')
FOE_ROWS = [(262, 'Lookout', 'level 1 · 99 HP each', '×2', 'face'), (318, 'Watchbow', 'level 1 · 88 HP', '×1', 'bow')]
for y, nm, sub, n, art in FOE_ROWS:
    if art == 'face':
        r += face('face_bandit', PAD + 4, y + 2, 48, flip=True)
    else:   # no portrait for a Watchbow in the art set: its weapon stands in the same seat
        r += icon('bow', PAD + 16, y + 14)
    r += T(PAD + 66, y + 6, nm, 's16 rust') + T(PAD + 66, y + 28, sub, 's13 dim')
    r += R(RW, y + 16, n, 's16 bone')
r += groove(PAD, 376, RW - 2 * PAD)
r += T(PAD, 388, f'{icon_inline("gold", "margin:-4px 6px 0 0")}69 gold, and kit 3 times in 4', 's14 bone')
r += T(PAD, 414, 'Beyond it, one passage on: a fight.', 's14 dim')
r += f'<div class="abs" style="left:{PAD}px;top:448px">{button("Enter: a fight", "primary", "idle", w=RW - 2 * PAD)}</div>'
r += T(PAD, 492, f'or click the room · {key("Enter")}', 's13 dim')
r += groove(PAD, 522, RW - 2 * PAD)
r += section_head('At the bottom', y=534, w=RW - 2 * PAD, note='the boss')
r += row(PAD, 568, RW - 2 * PAD, 'The Cargo Crew', 'four of them, level 2', icon_name='boss', h=44)
r += T(PAD, 618, 'Cave Runner ×2, Crossbow Watch, Cargo Master. Every way down ends in their hold.', 's13 it dim', w=RW - 2 * PAD, style='line-height:18px')
body += window(RX, EDGE, RW, 720 - 2 * EDGE, r)

write('F64Dungeon', board_html("Dungeon · Smuggler's Cave, row 3 of 7, pointing at the fight below", body))
print('ok')
