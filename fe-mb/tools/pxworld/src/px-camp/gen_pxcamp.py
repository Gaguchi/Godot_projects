"""PxCamp: the camp screen with the world redrawn as 1x pixel art (px-camp + pxworld). State: day 2, the company
has made camp at Trader's Rest after the wolves on the road, the pointer is on Rest and its heal shows on the HP
gauges. The UI layer is F64Camp's, copied unchanged from dirs/f64-places/gen_camp.py; only the world changes.

Every number is the shipped reducer's (dirs/f64-places/probe_camp.mts, run seed 36): Frontier Camp -> Trader's
Rest is one hop (day 2, 8 -> 7 food); the hop rolled the wolf pack, won for +93 gold (80 -> 173), nobody fell;
The Foundling 73/73, Bagrat "Oak" 79/84, Lilina 25/62. Rest = floor(max x 0.35) each, capped: Oak +5 -> 84,
Lilina +21 -> 46. Scout sees 6 roads within 3 hops. Strings follow game/src/ui/screens/Camp.tsx.

Usage: python gen_pxcamp.py"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, ROOT + '/src/kit64')
sys.path.insert(0, HERE)
from kit import *            # noqa: E402,F401
import scene as SC           # noqa: E402

HEAL = 0.35
PARTY = [  # (name, face, role, hp, max)
    ('The Foundling', 'face_roy', 'Lord · Iron Sword', 73, 73),
    ('Bagrat "Oak"', 'face_marcus', 'Shield Knight · Iron Lance, Iron Buckler', 79, 84),
    ('Lilina', 'face_lilina', 'Mage · Fire Tome', 25, 62),
]
WOUNDED = sum(1 for p in PARTY if p[3] < p[4])
FOOD, GOLD, DAY, ROADS, DEPTH = 7, 173, 2, 6, 3


def R(w, y, html, cls='s14 bone'):
    """Right-aligned text inside a window of width w."""
    return T(w - PAD, y, html, cls, style='transform:translateX(-100%)')


# ------------------------------------------------------------------ the world: one pixel PNG at 1:1
st = SC.compose()
im = st.render().convert('RGB')
os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
im.save(os.path.join(HERE, 't', 'world.png'))
import base64, io     # noqa: E401,E402
buf = io.BytesIO()
im.save(buf, 'PNG', optimize=True)
uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
body = (f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
        f'width="1280" height="720" src="{uri}">')

# ------------------------------------------------------------------ the place: name, day, the purse (the map's region window)
HW, HH = 470, 134
hd = T(PAD, 9, "Trader's Rest", 'tt')
hd += R(HW, 20, f'{icon_inline("day", "margin:-5px 8px 0 0")}Day {DAY}', 's20 bone')
hd += T(PAD, 60, 'Camp · the Borderlands · one hop from Frontier Camp', 's15 dim')
hd += rule(PAD, 92, HW - 2 * PAD)
hd += T(PAD, 102, f'{icon_inline("gold")}<span class="straw">{GOLD}</span> gold', 's15 bone')
hd += T(130, 102, f'{icon_inline("food")}<span class="straw">{FOOD}</span> food', 's15 bone')
hd += food_pips(222, 108, rations=(4, 4), used=(1, 0))
hd += R(HW, 102, f'{icon_inline("potion")}Healing Potion ×1', 's15 bone')
body += window(EDGE, EDGE, HW, HH, hd)

# ------------------------------------------------------------------ the night's one thing
CX, CW = 846, 420
CH = 308
ch = section_head('One night', w=CW - 2 * PAD, note='one thing tonight')
ch += T(PAD, 44, f'Either way the fire eats 1 food. {FOOD} food in the satchel.', 's15 lt bone', w=CW - 2 * PAD)
ch += groove(PAD, 72, CW - 2 * PAD)


def act(y, btn, line, lit=False):
    """One camp verb: its button, its price under it, what it buys to the right."""
    out = f'<div class="abs" style="left:{PAD}px;top:{y + 8}px">{btn}</div>'
    out += T(PAD + 2, y + 50, f'{icon_inline("food", "margin:-4px 5px 0 0")}costs 1 food', f's14 {"straw" if lit else "dim"}')
    out += T(PAD + 136, y + 8, line, 's15 lt bone', w=CW - 2 * PAD - 136, style='line-height:21px')
    return out


ch += act(80, button('Rest', 'primary', 'hover', w=116),
          f'{WOUNDED} wounded heal {round(HEAL * 100)}% of their strength.', lit=True)
ch += groove(PAD, 158, CW - 2 * PAD)
ch += act(166, button('Scout', 'secondary', 'idle', w=116),
          f'{ROADS} roads within {DEPTH} hops: see what waits before you walk it.')
ch += groove(PAD, 244, CW - 2 * PAD)
ch += f'<div class="abs" style="left:{PAD}px;top:258px">{button("Break camp", "secondary", "idle", w=116)}</div>'
ch += T(PAD + 136, 264, 'back on the road, nothing spent', 's15 lt dim')
body += window(CX, EDGE, CW, CH, ch)

# ------------------------------------------------------------------ the company, with Rest's heal laid on their gauges
KY = EDGE + CH + GAP
KH = 292
k = section_head('The Company', w=CW - 2 * PAD, note='if they rest tonight')
for i, (nm, fk, role, hp, mx) in enumerate(PARTY):
    y = 44 + i * 70
    gain = min(mx - hp, int(mx * HEAL))
    k += face(fk, PAD, y + 4, 48)
    k += T(80, y + 3, nm, 's16 bone')
    k += T(80, y + 24, role, 's13 dim')
    hp_cls = 'rust' if hp * 2 < mx else 'bone'
    k += R(CW, y + 3, f'<span class="{hp_cls}">{hp}</span>/{mx}', 's15 bone')
    k += R(CW, y + 24, f'+{gain} → {hp + gain}' if gain else 'whole', f's13 {"meadow" if gain else "faint"}')
    k += hp_bar(80, y + 44, CW - PAD - 80, hp, mx, 'ally', gain=gain, h=11)
    if i < 2:
        k += groove(PAD, y + 64, CW - 2 * PAD)
k += T(PAD, 262, 'Lilina took the worst of the wolves. Oak says it was a scratch.', 's13 it dim')
body += window(CX, KY, CW, KH, k)

# a line laid on the ground, in the map's manner
body += T(EDGE + 6, 692, 'One thing tonight: rest or scout. Then the road.', 's14 bone ol1d')

write('PxCamp', board_html("Camp · Trader's Rest after the wolves, pointing at Rest, day 2", body))
print('ok', len(uri) // 1024, 'KB')
