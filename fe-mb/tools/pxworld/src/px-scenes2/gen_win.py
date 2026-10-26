"""F64Win, round 3: the run won, the Ledger's last page as windows over the Iron Throne redrawn as a 1x pixel scene.

A copy of dirs/f64-pages/gen_win.py. The windows, the numbers and every string are unchanged; only the world is new
(castle.py): the inner bailey at the board sprites' own scale, the three standing at 1:1 on the gate road with the
company's standard planted by them and Mercer Kaine's black banner thrown down on the flags, the gatehouse behind them
with its portcullis raised.

The run's statistics are the Ledger's six real fields, set to one consistent run (see STATS) and the trophy is the final
boss's real drop row (finalBoss: 100% legendary from the unowned hand-slot pool) -> Shadowfang, the one the seed-7 fixture
rolls. The fight itself is real: the Ashford Company is Mercer Kaine (L7) and an Ashford Marksman (L7), so it pays
2 x (15 + 8 x 7) = 142 gold. hops 21 -> the 22nd day (days = 1 + hops; daysPerHop 1).
  kill gold: the south road brigands 4 x 31 (the Field Report's fight, F64Report), road bandits 4 x 31, Daren's gang
  3 x 31, wolves 3 x 39, ruins 3 x 39, ruins boss 2 x 47, Ashfall raiders 3 x 47, the Throne 142 = 952 over 24 dead;
  one bounty 40 (Daren went to his brother, not the desk); the carter's purse 25; a treasure room 50; the caravan
  30 + 40 -> 1137 gold earned. Captured 2. Gear found 5 (four pieces of kit and the trophy).
  Kael joined when Daren was taken alive (blood ties), and fell in battle on day 17.

Usage: python gen_win.py"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import pxs                      # noqa: E402  (first: the palette's Vault ramp)
sys.path.insert(0, ROOT + '/src/kit64')
from kit import *               # noqa: E402,F401,F403
import trophy                   # noqa: E402
import castle as CS             # noqa: E402

DAYS = 22
STATS = [('battles won', 8), ('foes down', 24), ('captured', 2), ('gold earned', 1137), ('gear found', 5), ('hops walked', 21)]
assert DAYS == 1 + dict(STATS)['hops walked']
STANDING = [('face_roy', 'The Foundling', 'Lord'), ('face_marcus', 'Bagrat "Oak"', 'Shield Knight'), ('face_lilina', 'Lilina', 'Mage')]
BOUGHT = [('Kael', 'Bandit Archer', 'fell in battle', 17)]
SF = item('shadowfang')


def painting():
    """The Iron Throne by day, as one pixel PNG at 1:1."""
    st, info = CS.compose()
    im = st.render().convert('RGB')
    os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
    im.save(os.path.join(HERE, 't', 'win_world.png'))
    return pxs.world_img(pxs.to_png_uri(im))


def ledger_window(x, y, w, h):
    """The last page: the verdict, who is still standing, what it cost, the run counted, the two verbs."""
    b = T(PAD, 16, 'the company ledger · last page', 's13 dim')
    b += T(PAD, 34, 'The Iron Throne', 'tt')
    b += T(PAD, 88, f'Under The Foundling, The Company took the throne on the {DAYS}nd day.', 's18 lt bone', w=w - 2 * PAD, style='line-height:24px')
    b += T(PAD, 142, 'Mercer Kaine is dead. Oak tried his chair and says the wagon is softer.', 's15 lt it dim', w=w - 2 * PAD)
    b += rule(PAD, 180, w - 2 * PAD)
    b += section_head('Still standing', y=198, w=w - 2 * PAD, note='three of us')
    fx = PAD
    pitch = (w - 2 * PAD - 104) // 2
    for fk, name, cls in STANDING:
        b += face(fk, fx, 234, 96, lit=True)
        b += T(fx - 20, 346, name, 's16 bone c', w=144)
        b += T(fx - 20, 366, cls, 's13 dim c', w=144)
        fx += pitch
    b += section_head('Bought with', y=404, w=w - 2 * PAD)
    yy = 438
    for name, cls, cause, day in BOUGHT:
        b += T(PAD, yy, f'<span style="text-decoration:line-through;text-decoration-color:{C["x4"]}">{name}</span>', 's16 dim')
        b += T(PAD + 64, yy + 2, cls, 's14 faint')
        b += T(w - PAD, yy + 2, f'{cause} · the {day}th day', 's14 rust', style='transform:translateX(-100%)')
        b += T(PAD, yy + 24, 'He came for his brother and stayed for the rest of us.', 's14 lt it dim')
        yy += 50
    b += section_head('The run, counted', y=yy + 14, w=w - 2 * PAD)
    sy = yy + 50
    cw = (w - 2 * PAD - 32) // 3
    for i, (lab, val) in enumerate(STATS):
        cx = PAD + (i % 3) * (cw + 16)
        ry = sy + (i // 3) * 30
        b += T(cx, ry, lab, 's14 dim') + T(cx + cw, ry - 1, f'{val:,}', 's16 bone', style='transform:translateX(-100%)')
        if i // 3 == 0:
            b += groove(cx, ry + 24, cw)
    vy = h - PAD - 34
    b += button('Close the ledger', 'secondary', 'hover', x=PAD, y=vy + 1)
    b += f'<div class="abs" style="left:{w - PAD}px;top:{vy}px;transform:translateX(-100%)">{button("Walk it again", "primary")}</div>'
    return window(x, y, w, h, b)


def trophy_window(x, y, w):
    """The thing the run was for, taken from the throne: the blade in a well, its name, what it is."""
    b = trophy.trophy_well(PAD, PAD)
    tx = PAD + 104 + 18
    b += T(tx, 28, 'taken from the throne', 's13 dim')
    b += person(tx, 46, SF['name'], 'straw')          # an item, so Source Serif 4 bold 20: Jacquard is for places and titles
    b += T(tx, 76, 'legendary · dagger', 's15 straw')
    b += T(tx, 98, f'It would fetch {SF["sell"]} gold. Nobody is selling.', 's13 dim')
    return window(x, y, w, 144, b)


body = painting()
body += ledger_window(EDGE, EDGE, 560, 692)
body += trophy_window(822, 562, 444)
write('F64Win', board_html('Last Page · the throne taken on the 22nd day, Shadowfang carried off', body, 1280, 720))
print('ok')
