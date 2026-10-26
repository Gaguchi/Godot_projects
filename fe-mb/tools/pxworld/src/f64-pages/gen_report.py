"""F64Report: the Field Report after the road fight on the first hop south out of Frontier Camp, won.

South Road Ambush itself is a landmark (checkEvents/south_road_ambush.json, the wrecked cart), not a fight; the fight is
on the ROAD to it. Every number is the shipped engine's own: dirs/consistency/probe_road_report.mts south_road_ambush 190
walks a real run (seed 190) from Frontier Camp toward South Road Ambush. The hop rolls brigand_raiders off the
borderlands_road table (group 'brigands': Brigand x3 and the Brigand Chief, bandit class, L2, 101 HP each) on Open Ground
(obstacles 6,2 and 10,6, the painted field), and the shipped careful policy plays it out:
  rounds 8 · defeated 4 · goldEarned 124 (80 -> 204) · survivors The Foundling 12/73, Oak 76/84, Lilina 62/62 · fallen none
  loot none · prisoners none · consumed healing_potion (The Foundling drank it, round 4) · day 2
  field: Foundling (3,5), Oak (2,6), Lilina (4,6); Brigand 1 fell at (6,3), Brigand 2 at (5,4), Brigand 3 at (2,5),
  the Brigand Chief at (3,6).
The foot reads placeName(run.nodeId) (ui/screens/FieldReport.tsx): the hop has not landed while the report is up, so the
run still stands at Frontier Camp; after Close the ledger it lands at South Road Ambush and the wrecked cart opens.
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import sys
sys.path.insert(0, ROOT + '/src/kit64')
from kit import *  # noqa: E402,F403
import kit  # noqa: E402

TS, OX, OY = 48, 303, 18          # the field's board in world_field coordinates
CROP_X = 275                      # shift the field left so the board sits at x 28 on the stage
BX, BY = OX - CROP_X, OY          # the board's top-left on the stage

REPORT = dict(rounds=8, defeated=4, gold=124, purse=204, place='Frontier Camp', day=2)
STANDING = [  # name, face, class word, hp, max
    ('The Foundling', 'face_roy', 'Lord', 12, 73),
    ('Bagrat "Oak"', 'face_marcus', 'Shield Knight', 76, 84),
    ('Lilina', 'face_lilina', 'Mage', 62, 62),
]
TOKENS = [  # board key, side, tile, hp, max, state, ordinal (the brigands are one sprite, the bandit art)
    ('board_roy', 'ally', (3, 5), 12, 73, 'up', None),
    ('board_marcus', 'ally', (2, 6), 76, 84, 'up', None),
    ('board_lilina', 'ally', (4, 6), 62, 62, 'up', None),
    ('board_bandit', 'foe', (6, 3), 0, 101, 'fallen', 1),
    ('board_bandit', 'foe', (5, 4), 0, 101, 'fallen', 2),
    ('board_bandit', 'foe', (2, 5), 0, 101, 'fallen', 3),
    ('board_bandit', 'foe', (3, 6), 0, 101, 'fallen', None),
]


def tile_xy(c, r):
    """Top-left of tile (c, r) on the stage."""
    return BX + TS * c, BY + TS * r


def field():
    """The field as it stood: the combat painting shifted left, its eastern wood carried on behind the report."""
    out = world_field(crop=(CROP_X, 0, 1005, 720))
    out += f'<div class="abs" style="left:1005px;top:0;width:275px;height:720px;overflow:hidden">{world_field(crop=(1000, 0, 275, 720), grid=False)}</div>'
    return out


def tokens():
    """Who stood where when it ended: ours ringed and standing, the dead grey where they fell, the prisoner in irons."""
    out = ''
    for key, side, (c, r), hp, mx, state, n in sorted(TOKENS, key=lambda t: t[2][1]):
        x, y = tile_xy(c, r)
        cx = x + TS // 2
        if state == 'captured':
            back, front = base_ring(x, y, side)
            out += back + icon('capture', cx - 12, y + 14) + front
        else:
            back, front = base_ring(x, y, side)
            flip = 'transform:scaleX(-1);' if side == 'foe' else ''
            look = 'filter:url(#f64-ol1) grayscale(1) brightness(.88) contrast(.85);' if state == 'fallen' else 'filter:url(#f64-ol1);'
            if state == 'fallen':
                # laid down where they fell: the figure turned a quarter (an exact 90 degree turn keeps every pixel), drained of colour
                rot = 'rotate(-90deg)' if side == 'foe' else 'rotate(90deg)'
                out += kit._contact_shadow(cx, y + 34)
                out += (f'<img class="abs" style="left:{cx - 26}px;top:{y + 24 - 38}px;width:52px;height:76px;{look}'
                        f'transform:{rot}{" scaleX(-1)" if side == "foe" else ""};transform-origin:26px 38px" src="{B(key)}">')
                out += kit._I.cross_mark('x4').svg(cx + 12, y + 30)
            else:
                out += back + kit._contact_shadow(cx, y + 38)
                out += f'<img class="abs" style="left:{cx - 26}px;top:{y + 39 - 76}px;width:52px;height:76px;{look}{flip}" src="{B(key)}">'
                out += front + hp_bar(x + 9, y + TS - 6, 30, hp, mx, side, h=5)
        if n:
            out += ordinal(n, x + TS - 12, y + 2)
    return out


def report_window(x, y, w, h):
    """The report: verdict, the count, who is standing and how badly, what came off the field, the foot, the verbs."""
    b = ''
    b += T(PAD, 64, 'The field was held.', 's20 bone')
    b += T(PAD, 92, 'Four brigands in the ditch. The last potion kept the Foundling up.', 's15 lt it dim', w=w - 2 * PAD)
    # the count: the purse is the headline number; rounds and foes read as a plain line
    g = numeral(f'+{REPORT["gold"]}', 30, 'Ochre')
    b += icon('gold', PAD, 132) + g.svg(PAD + 28, 128) + T(PAD + 28 + g.w + 8, 137, 'gold', 's16 bone')
    b += T(w - PAD, 130, f'{REPORT["rounds"]} rounds · {REPORT["defeated"]} foes down', 's15 bone', style='transform:translateX(-100%)')
    b += T(w - PAD, 152, f'the purse now holds {REPORT["purse"]}', 's13 dim', style='transform:translateX(-100%)')
    b += rule(PAD, 190, w - 2 * PAD)
    # standing
    b += section_head('Standing', y=208, w=w - 2 * PAD, note='no one fell')
    yy = 240
    for name, fk, cls, hp, mx in STANDING:
        frac = hp / mx
        if frac <= .25:
            word, wc, vc = 'badly hurt', 'rust', 'rust'
        elif hp < mx:
            word, wc, vc = 'wounded', 'dim', 'bone'
        else:
            word, wc, vc = 'unhurt', 'meadow', 'bone'
        sub = f'{cls} · <span class="{wc}">{word}</span>'
        b += row(PAD - 4, yy, w - 2 * PAD + 8, name, sub=sub, face_key=fk, value=f'<span class="{vc}">{hp}/{mx}</span>')
        b += hp_bar(w - PAD - 84 - 120, yy + 25, 120, hp, mx, 'ally')
        yy += 56
    # what came off the field
    b += section_head('Taken from the field', y=yy + 16, w=w - 2 * PAD, note='brigands carry little')
    yy += 48
    b += T(PAD, yy + 6, 'Nothing worth carrying', 's15 lt it dim')   # FieldReport.tsx's empty row
    yy += 40
    # verbs: Menu (Esc) at the left, the one brass act at the right; the foot (where and when, what it cost) sits on them
    vy = h - PAD - 34 - 4
    b += groove(PAD, vy - 46, w - 2 * PAD)
    b += T(PAD, vy - 32, f'{REPORT["place"]} · the {REPORT["day"]}nd day', 's14 dim')
    b += T(w - PAD, vy - 32, f'Spent: {icon_inline("potion", "margin:-5px 4px 0 0")}Healing Potion', 's14 bone', style='transform:translateX(-100%)')
    b += command(f'Menu {key("Esc")}', x=PAD - 16, y=vy + 6)
    b += f'<div class="abs" style="left:{w - PAD}px;top:{vy}px;transform:translateX(-100%)">{button("Close the ledger", "primary", "hover")}</div>'
    return window(x, y, w, h, b, title='Field Report', big=True, note='the company ledger')


body = field() + tokens()
body += plate('The field as it stood', x=BX, y=BY + 10 * TS + 14)
body += report_window(714, EDGE, 552, 692)
write('F64Report', board_html('Field Report · the brigands on the road south, won, day 2', body, 1280, 720))
print('ok')
