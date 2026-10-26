"""F64Lost, round 3: the run lost, the Ledger's Final Entry as a window over a Thornwood clearing by day, redrawn as a
1x pixel scene (lost.py) at the board sprites' own scale: a fresh grave with the Foundling's sword planted at its head
and the company's standard beside it, Oak's spade still in the earth, the wagon left by the cold ring of the last camp's
fire, and Oak, a little way on along the road east, alone.

A copy of dirs/f64-pages/gen_lost.py: the window, the numbers and every string are unchanged; the painted 2x world
gives way to one pixel PNG at 1:1; the grave's plate is the kit's own, under the grave.

The death log is the engine's own shape (run/party.ts#removeFallen: unitId, name, classId, cause, day; the page words the
cause with Ledger.tsx's CAUSE table). The MC falling ends the run (rules.knobs.mcDeathIsDefeat), so Oak can be left
standing. This run is the Field Report's run carried on: the brigands on the road south on day 2, the end on the 13th day.
  hops 12 -> the 13th day.  foes down 13: the south road brigands 4 x 31 (F64Report), road bandits 4 x 23, wolves 3 x 31,
  brigands 2 x 31 = 371 kill gold, plus the carter's purse 25 -> 396 gold earned. Captured 0. Gear found 1.
  Battles won 4; the fifth was lost.

Usage: python gen_lost.py"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import pxs                      # noqa: E402  (first: the palette's Vault ramp)
sys.path.insert(0, ROOT + '/src/kit64')
from kit import *               # noqa: E402,F401,F403
import lost as LS               # noqa: E402

CAUSE = {'battle': 'fell in battle', 'starvation': 'starved on the road', 'event': 'lost on the road'}   # Ledger.tsx
DEATH_LOG = [  # in the order the log records them
    dict(name='Lilina', face='face_lilina', cls='Mage', cause='starvation', day=9),
    dict(name='The Foundling', face='face_roy', cls='Lord', cause='battle', day=13),
]
LEFT_STANDING = [('Bagrat "Oak"', 'Shield Knight')]
DAYS = 13
STATS = [('battles won', 4), ('foes down', 13), ('captured', 0), ('gold earned', 396), ('gear found', 1), ('hops walked', 12)]
assert DAYS == 1 + dict(STATS)['hops walked']


def nth(n):
    """1st 2nd 3rd 4th ... as Ledger.tsx#ordinal."""
    return f'{n}{"th" if 11 <= n % 100 <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")}'


def painting():
    st, info = LS.compose()
    im = st.render().convert('RGB')
    os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
    im.save(os.path.join(HERE, 't', 'lost_world.png'))
    return pxs.world_img(pxs.to_png_uri(im))


def faded_face(key_, x, y):
    """A face of the fallen: the whole niche drained of colour."""
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:106px;height:106px;filter:grayscale(1) brightness(.86) contrast(.92)">'
            f'{face(key_, 0, 0, 96)}</div>')


def entry_window(x, y, w, h):
    """The final entry: the sentence, the roll of the fallen (faces first), who is left, the count muted, the verbs."""
    b = T(PAD, 16, 'the company ledger', 's13 dim')
    b += T(PAD, 34, 'Final Entry', 'tt')
    b += T(PAD, 88, f'Under The Foundling, The Company ended on the road on the {nth(DAYS)} day.', 's18 lt bone', w=w - 2 * PAD, style='line-height:24px')
    b += T(PAD, 142, 'Oak dug the grave and kept the standard. Someone had to.', 's15 lt it dim', w=w - 2 * PAD)
    b += rule(PAD, 180, w - 2 * PAD)
    b += section_head('The roll of the fallen', y=198, w=w - 2 * PAD, note='two names')
    fx = PAD
    for d in DEATH_LOG:
        b += faded_face(d['face'], fx, 234)
        tx = fx + 104 + 16
        b += T(tx, 250, f'<span style="text-decoration:line-through;text-decoration-thickness:2px;text-decoration-color:{C["x3"]}">{d["name"]}</span>', 's16 dim')
        b += T(tx, 272, d['cls'], 's13 faint')
        b += T(tx, 296, f'{CAUSE[d["cause"]]}', 's14 rust')
        b += T(tx, 316, f'the {nth(d["day"])} day', 's13 dim')
        fx += (w - 2 * PAD) // 2
    b += section_head('Left standing', y=356, w=w - 2 * PAD)
    yy = 386
    for name, cls in LEFT_STANDING:
        b += row(PAD - 4, yy, w - 2 * PAD + 8, name, sub=f'{cls} · walks on alone', face_key='face_marcus')
        yy += 56
    b += groove(PAD, yy + 14, w - 2 * PAD)
    sy = yy + 30
    cw = (w - 2 * PAD - 32) // 3
    for i, (lab, val) in enumerate(STATS):
        cx = PAD + (i % 3) * (cw + 16)
        ry = sy + (i // 3) * 26
        b += T(cx, ry, lab, 's13 faint') + T(cx + cw, ry - 1, f'{val:,}', 's14 dim', style='transform:translateX(-100%)')
    vy = h - PAD - 34
    b += button('Close the ledger', 'secondary', x=PAD, y=vy + 1)
    b += f'<div class="abs" style="left:{w - PAD}px;top:{vy}px;transform:translateX(-100%)">{button("The same road again", "primary", "hover")}</div>'
    return window(x, y, w, h, b)


body = painting()
gx, gy = LS.GRAVE
body += plate('The Foundling', small=True, x=gx, y=gy + 10, center=True)
body += entry_window(EDGE, 64, 560, 592)
write('F64Lost', board_html('Final Entry · the Foundling fell on the 13th day, Oak walks on alone', body, 1280, 720))
print('ok')
