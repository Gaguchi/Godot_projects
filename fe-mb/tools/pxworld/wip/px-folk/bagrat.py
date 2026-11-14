"""Bagrat "Oak", drawn as pixel art by hand and code: no image model.

An old vine-grower who went to war to find his son: heavyset, bald on top with grey at the sides, a big drooping
moustache, a soldier's slate greatcoat with a fleece collar belted over his belly, a red neckerchief, a wineskin at
his hip, a round oak shield bound in iron on his left arm and a spear in his right hand. Light from the top-left.

Three pieces, one drawing:
    the figure   104 x 152   the size the camp and the town stand people at
    the token     52 x 76    the size the combat field shows them at: the figure reduced, its face placed again by hand
    the face      96 x 96    the head for a niche: the figure's own pixels at 3x

    python bagrat.py     ->  out/bagrat.png, out/bagrat_small.png, out/bagrat_face.png, and enlarged sheets to look at
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pxfig import Fig, moved, reduced, sheet   # noqa: E402

PAL = {
    'ink': '#1b1510',
    # skin, old and sun-browned: cool red in the shade, warm in the light
    'sk0': '#5e3524', 'sk1': '#8e5539', 'sk2': '#b87c52', 'sk3': '#d7a174', 'sk4': '#ecc79c',
    # grey hair and moustache
    'hr0': '#4b4a50', 'hr1': '#7a7b82', 'hr2': '#adb0b4', 'hr3': '#dadbd6',
    # the greatcoat: slate wool, cold in the shade, warmer in the light
    'ct0': '#1f232c', 'ct1': '#333a48', 'ct2': '#4a5464', 'ct3': '#657080', 'ct4': '#8a949c',
    # leather
    'lt0': '#2b1a12', 'lt1': '#4c2e1c', 'lt2': '#73482a', 'lt3': '#9a683e',
    # oak
    'ok0': '#3d2816', 'ok1': '#5c3f22', 'ok2': '#825c31', 'ok3': '#a67d47', 'ok4': '#c59f63',
    # iron
    'ir0': '#22262d', 'ir1': '#434a55', 'ir2': '#6d7783', 'ir3': '#a1abb4', 'ir4': '#d5dce0',
    # trousers
    'tr0': '#26241d', 'tr1': '#3e3b2e', 'tr2': '#57533f',
    # the fleece of his collar
    'fl0': '#7a6a52', 'fl1': '#a8997b', 'fl2': '#d3c7a6', 'fl3': '#efe6cc',
    # the red neckerchief
    'rd0': '#4b1916', 'rd1': '#772922', 'rd2': '#a23a2d', 'rd3': '#cd624a',
    'ew': '#e9e3d1',       # the white of an eye
    'rd': '#c9805c',       # a weathered cheek
}
COAT = ['ct0', 'ct1', 'ct2', 'ct3', 'ct4']
LEATHER = ['lt0', 'lt1', 'lt2', 'lt3']
FLEECE = ['fl0', 'fl1', 'fl2', 'fl3']

# the head, pixel by pixel: 24 x 28. Bald on top and lit from the left, grey at the temples, brows that fall away
# outward (a kind face, not a stern one), small dark eyes with the bags of sixty years under them, a big nose, and
# a moustache that covers his mouth and hangs past its corners.
HEAD = [
    "........LLLLLLLL........",
    "......LTTTTTTLLLLS......",
    ".....LTTTTTTTLLLLLSS....",
    "....LTTTTTTTLLLLLLSSS...",
    "...LTTTTTTLLLLLLLSSSSs..",
    "...LTTTTLLLLLLLLSSSSSs..",
    "..GLLLLLLLLLLLLSSSSSSsH.",
    ".GGLLLssssLLLLssssSSSsHh",
    ".GGLLLLLLLLLLSSSSSSSSsHh",
    "WGHLLGGGGLLLLSSGGGGSSsHh",
    "WGHLHHSSSLLLLSSsssHHSsHh",
    "WGLLLdddLLLLLSSdddSSssHh",
    "sGLLLwewLLLTLSSwewSSsshh",
    "sSLLLSSSLLLTLsSsssSsssdh",
    "sSLrrLLLLLTTLsSSSSrrssd.",
    ".SLrrrLLLLTTLssSSrrrssd.",
    ".SLLrLLLSTTTLLssSSrSsdd.",
    "..SLLLGGWssddsssWGGSssd.",
    "..SLGGWWWWWGHHGWWWWGGHd.",
    "..SGGWWWWGGHhhHGGWWWGGHd",
    "..GGWWGGHHSssssSHHGWWGHd",
    "..GWWGHHSSSdddSSSSHHGWHd",
    "..GWGHSSSLLLLLSSSSsHHGHd",
    "...GHhSSLLLLLSSSSSssHhd.",
    "....hsSSSLLLSSSSSsssdd..",
    ".....sSSSSSSSSSSssssd...",
    "......ssSSSSSSSssssd....",
    "........sssSSsssdd......",
]
HEAD_KEY = {'h': 'hr0', 'H': 'hr1', 'G': 'hr2', 'W': 'hr3', 'd': 'sk0', 's': 'sk1', 'S': 'sk2', 'L': 'sk3', 'T': 'sk4',
            'e': 'ink', 'w': 'ew', 'r': 'rd'}
assert all(len(r) == 24 for r in HEAD), [len(r) for r in HEAD]

# the same head at the token's size: 12 x 14. One dark pixel is an eye; the moustache is the face.
HEAD_S = [
    "....LLLL....",
    "..LTTTLLSS..",
    ".LTTTLLLSSs.",
    ".LTLLLLLSSs.",
    "GLLLLLLSSSsH",
    "GLHHHLLHHHsH",
    "GLLeLLLSeSsh",
    "sLLLLTLSSSsh",
    "sLrLTTLSSrs.",
    ".SGWWHHWWGs.",
    ".GWGHssHGWH.",
    ".GHSSLLSSHd.",
    "..sSSSSSsd..",
    "....sSSs....",
]
assert all(len(r) == 12 for r in HEAD_S), [len(r) for r in HEAD_S]

# his right fist round the spear: the back of the hand, then three fingers, each a lit band over a dark crease
FIST = [
    "..sLLLs..",
    ".LLLLLSs.",
    "LLLLSSSs.",
    "sssssssd.",
    "LLLSSSSs.",
    "sssssssd.",
    "LLSSSSss.",
    ".sssssd..",
    ".LSSSss..",
    "..sssd...",
]
FIST_KEY = {'L': 'sk3', 'S': 'sk2', 's': 'sk1', 'd': 'sk0'}
assert all(len(r) == 9 for r in FIST), [len(r) for r in FIST]


def draw(outline=True):
    f = Fig(104, 152, PAL)
    SX = 16                                    # the spear's shaft: two pixels, lit side and shade side

    def shaft(y0, y1):
        f.fill(f.rect(SX, y0, 1, y1 - y0), 'ok3')
        f.fill(f.rect(SX + 1, y0, 1, y1 - y0), 'ok1')

    # ---- the spear: an ash shaft, a leaf blade
    shaft(17, 149)
    blade = f.poly([(SX + .5, 2), (SX - 3, 11), (SX - 2, 17), (SX + 3, 17), (SX + 4, 11)])
    f.fill(blade, 'ir3')
    f.fill(blade & f.rect(SX + 1, 0, 6, 18), 'ir1')
    f.fill(f.rect(SX - 1, 5, 1, 10), 'ir4')
    f.fill(f.rect(SX - 1, 17, 4, 3), 'ir2')
    f.fill(f.rect(SX + 2, 17, 1, 3), 'ir0')
    f.fill(f.rect(SX - 1, 17, 4, 1), 'ir4')

    # ---- trousers and boots: feet apart, toes turned out, each boot narrow at the ankle and wide at the toe
    for x0 in (36, 56):
        f.form(f.rect(x0, 118, 13, 14), ['tr0', 'tr1', 'tr2'], hi=1, sh=3)
    lb = f.blob([(36, 128), (48, 128), (48, 136), (47, 141), (49, 145), (48, 148), (31, 148), (28, 146), (30, 142),
                 (36, 140), (37, 135)])
    rb = f.blob([(56, 128), (68, 128), (67, 135), (68, 140), (74, 142), (77, 146), (74, 148), (57, 148), (55, 145),
                 (57, 141), (56, 136)])
    for b in (lb, rb):
        f.form(b, LEATHER, hi=1, sh=3)
        f.fill(b & ~moved(b, 0, -1), 'lt0')                       # the sole
    for x0 in (36, 56):
        f.fill(f.rect(x0, 130, 13, 1), 'lt3')                      # the boot-top's turned edge
        f.fill(f.rect(x0, 131, 13, 1), 'lt0')
    f.line([(31, 144), (36, 142)], 'lt3')                          # light along the top of each toe
    f.line([(69, 143), (74, 144)], 'lt3')
    f.line([(38, 139), (46, 140)], 'lt0')                          # the ankle's crease
    f.line([(58, 140), (66, 139)], 'lt0')

    # ---- his left sleeve (our right): it goes behind the shield, in the body's shade
    ls = f.blob([(67, 38), (74, 40), (80, 48), (82, 62), (76, 68), (70, 56), (67, 46)])
    f.form(ls, COAT, hi=1, sh=3, base=1)

    # ---- the greatcoat: a stout man's, belted over the belly, the skirt falling to the shin in three heavy folds
    coat = f.blob([(44, 36), (36, 37), (31, 40), (29, 48), (29, 60), (28, 74), (29, 90), (27, 108), (25, 121),
                   (31, 125), (38, 123), (45, 126), (52, 124), (59, 126), (66, 123), (73, 125), (79, 121),
                   (77, 108), (75, 90), (76, 74), (75, 60), (75, 48), (73, 40), (68, 37), (60, 36)], n=8)
    f.fill(coat, 'ct2')
    upper = coat & f.rect(0, 0, 104, 74)
    skirt = coat & f.rect(0, 80, 104, 60)
    # planes of light: the left breast catches it, the right side turns away, the top of the shoulders is brightest
    f.fill(upper & f.poly([(30, 40), (50, 44), (51, 73), (28, 73)]), 'ct3')
    f.fill(upper & f.rect(61, 36, 40, 40), 'ct1')
    f.fill(coat & ~moved(coat, 2, 2) & f.rect(0, 36, 60, 30), 'ct4')
    f.fill(skirt & f.rect(62, 80, 40, 60), 'ct1')
    # the folds: each a wedge of shadow that opens toward the hem, with a thin lit crest on its light side
    for (ax, ay, bx, w, dark, lit) in ((37, 84, 36, 5, 'ct1', True), (53, 97, 51, 4, 'ct1', True),
                                       (66, 84, 64, 5, 'ct0', False)):
        f.fill(f.poly([(ax, ay), (ax + 1, ay), (bx + w, 128), (bx, 128)]) & skirt, dark)
        if lit:
            f.line([(ax - 2, ay + 3), (bx - 3, 126)], 'ct3', only=skirt)
    f.fill(coat & ~moved(coat, -4, -4), 'ct1')                     # the side that turns from the light
    f.fill(coat & ~moved(coat, -1, -1), 'ct0')
    f.fill(skirt & f.rect(26, 80, 60, 3), 'ct1')                   # the belt's shadow on the skirt
    f.fill(coat & ~moved(coat, 0, -2) & f.rect(0, 112, 104, 20), 'ct1')   # the hem, turned under
    f.fill(coat & ~moved(coat, 0, -1) & f.rect(0, 112, 104, 20), 'ct0')
    # the front closing and its buttons
    f.line([(53, 46), (54, 73)], 'ct0')
    for by in (50, 58, 66):
        f.put(51, by, 'ok4')
        f.put(51, by + 1, 'ok2')
        f.put(50, by, 'ok3')
        f.put(50, by + 1, 'ok1')

    # ---- the strap across his chest, from the left shoulder down to the wineskin
    strap = f.poly([(64, 37), (67, 39), (35, 77), (32, 75)]) & coat
    f.fill(strap, 'lt2')
    f.fill(strap & ~moved(strap, 1, 1), 'lt3')
    f.fill(strap & ~moved(strap, -1, -1), 'lt0')

    # ---- the belt and its buckle
    belt = f.poly([(27, 73), (52, 75), (77, 73), (77, 79), (52, 81), (27, 79)]) & coat
    f.fill(belt, 'lt1')
    f.fill(belt & ~moved(belt, 0, 1), 'lt3')
    f.fill(belt & ~moved(belt, 0, -1), 'lt0')
    f.fill(f.rect(49, 73, 9, 9), 'ir3')
    f.fill(f.rect(51, 75, 5, 5), 'lt0')
    f.fill(f.rect(49, 81, 9, 1), 'ir1')
    f.fill(f.rect(57, 73, 1, 9), 'ir1')
    f.fill(f.rect(49, 73, 8, 1), 'ir4')
    f.fill(f.rect(53, 76, 1, 3), 'ir3')                            # the buckle's tongue

    # ---- the wineskin at his hip
    skin = f.blob([(31, 82), (36, 80), (41, 85), (42, 94), (38, 100), (31, 99), (28, 92)])
    f.form(skin, LEATHER, hi=2, sh=3, base=2)
    f.fill(f.rect(33, 77, 3, 4), 'lt3')
    f.fill(f.rect(35, 77, 1, 4), 'lt1')
    f.fill(f.rect(33, 76, 3, 1), 'ok4')
    f.line([(32, 88), (39, 87)], 'lt1')                            # its seam

    # ---- his right arm (our left), held out to the spear
    rs = f.blob([(36, 38), (29, 40), (23, 50), (18, 62), (13, 74), (22, 80), (27, 67), (31, 56), (37, 46)])
    f.fill(rs, 'ct2')
    f.fill(rs & ~moved(rs, 3, 1), 'ct3')
    f.fill(rs & ~moved(rs, 1, 1), 'ct4')
    f.fill(rs & ~moved(rs, -3, -2), 'ct1')
    f.fill(rs & ~moved(rs, -1, -1), 'ct0')
    f.line([(36, 39), (37, 47), (32, 57), (28, 67)], 'ct0')        # where the arm lies against the body
    f.line([(24, 58), (27, 60)], 'ct1')                            # the elbow's crease
    cuff = f.poly([(12, 72), (23, 78), (22, 82), (11, 76)])
    f.fill(cuff, 'ct1')
    f.fill(cuff & ~moved(cuff, 0, 1), 'ct3')
    f.fill(cuff & ~moved(cuff, 0, -1), 'ct0')
    f.pixels(11, 77, FIST, FIST_KEY)
    shaft(87, 149)

    # ---- the collar: fleece, and the red neckerchief knotted under it
    f.fill(f.poly([(46, 34), (58, 34), (56, 46), (52, 50), (48, 46)]), 'rd2')
    f.fill(f.poly([(52, 40), (56, 46), (52, 50)]), 'rd1')
    f.fill(f.poly([(47, 35), (51, 35), (50, 41), (48, 44)]), 'rd3')
    cl = f.blob([(42, 33), (48, 36), (51, 43), (47, 49), (40, 46), (35, 40), (37, 35)])
    cr = f.blob([(62, 33), (56, 36), (53, 43), (57, 49), (64, 46), (69, 40), (67, 35)])
    f.form(cl, FLEECE, hi=2, sh=2, base=2)
    f.form(cr, FLEECE, hi=1, sh=3, base=1)

    # ---- the head
    f.pixels(40, 7, HEAD, HEAD_KEY)

    # ---- the shield: oak planks bound in iron, a boss at its middle
    cx, cy, r = 78, 88, 22
    rim = f.ellipse(cx, cy, r, r)
    face = f.ellipse(cx, cy, r - 3, r - 3)
    f.fill(rim, 'ir2')
    f.fill(rim & ~moved(rim, 2, 2), 'ir4')
    f.fill(rim & ~moved(rim, -2, -2), 'ir0')
    f.fill(face, 'ok2')
    f.fill(face & ~moved(face, 6, 6), 'ok3')                       # the lit crescent
    f.fill(face & ~moved(face, 2, 2), 'ok4')
    shade = face & ~moved(face, -7, -7)                            # the shaded crescent
    f.fill(shade, 'ok1')
    for px in range(cx - 15, cx + 18, 6):                          # the plank seams
        f.fill(f.rect(px, 0, 1, 152) & face, 'ok0')
        f.fill(f.rect(px + 1, 0, 1, 152) & face & ~shade, 'ok3')
    f.fill(face & ~moved(face, 0, 1) & ~moved(face, 1, 0), 'ok0')  # the face sits under the rim's lip
    band = f.rect(cx - r, cy - 1, 2 * r, 3) & face                 # an iron band across the planks
    f.fill(band, 'ir2')
    f.fill(band & ~moved(band, 0, 1), 'ir4')
    f.fill(band & ~moved(band, 0, -1), 'ir0')
    f.fill(f.ellipse(cx, cy, 7, 7) & face, 'ok0')
    boss = f.ellipse(cx, cy, 5, 5)
    f.fill(boss, 'ir2')
    f.fill(boss & ~moved(boss, 2, 2), 'ir4')
    f.fill(boss & ~moved(boss, -2, -2), 'ir0')
    for k in range(8):                                             # rivets round the rim
        ang = 0.4 + k * 0.785
        f.put(int(round(cx + np.cos(ang) * (r - 1.5))), int(round(cy + np.sin(ang) * (r - 1.5))), 'ir4')

    if outline:
        f.outline('ink')
    return f


def small():
    """The token: the figure at half size, then what a reduction cannot keep is placed again by hand."""
    s = reduced(draw(outline=False), 2)
    s.pixels(20, 3, HEAD_S, HEAD_KEY)
    # the shield's planks and boss, which are one pixel wide here
    cx, cy = 39, 44
    face = s.ellipse(cx, cy, 9, 9)
    for px in (cx - 6, cx - 3, cx + 3, cx + 6):
        s.fill(s.rect(px, 0, 1, 76) & face, 'ok0')
    s.fill(s.rect(cx - 10, cy, 21, 1) & face, 'ir3')
    boss = s.ellipse(cx, cy, 2, 2)
    s.fill(boss, 'ir2')
    s.put(cx - 1, cy - 1, 'ir4')
    s.put(cx + 1, cy + 1, 'ir0')
    s.outline('ink')
    return s


SKIN = ['sk0', 'sk1', 'sk2', 'sk3', 'sk4']
EYE = [
    ".dddd.",
    "dwbewd",
    ".ssss.",
]
EYE_KEY = {'d': 'sk0', 'w': 'ew', 'b': 'lt1', 'e': 'ink', 's': 'sk2'}


def portrait():
    """His face for a niche, drawn at the niche's own size: 44 x 44, the window a 52 px niche shows."""
    p = Fig(44, 44, PAL)

    # ---- the coat's shoulders, the neckerchief, the fleece collar
    sh = p.poly([(0, 44), (0, 39), (7, 35), (37, 35), (44, 39), (44, 44)])
    p.fill(sh, 'ct2')
    p.fill(sh & p.rect(24, 0, 20, 44), 'ct1')
    p.fill(sh & ~moved(sh, 0, 1) & p.rect(0, 0, 22, 44), 'ct4')
    p.fill(p.poly([(16, 36), (28, 36), (26, 44), (18, 44)]), 'rd2')
    p.fill(p.poly([(17, 37), (21, 37), (20, 44), (18, 44)]), 'rd3')
    p.fill(p.poly([(24, 38), (27, 37), (26, 44), (24, 44)]), 'rd1')
    cl = p.blob([(2, 45), (2, 38), (7, 33), (14, 34), (19, 39), (19, 45)])
    cr = p.blob([(42, 45), (42, 38), (37, 33), (30, 34), (25, 39), (25, 45)])
    p.form(cl, FLEECE, hi=2, sh=2, base=2)
    p.form(cr, FLEECE, hi=1, sh=2, base=1)

    # ---- the ears, behind the head
    p.fill(p.ellipse(7, 21, 2, 4), 'sk2')
    p.fill(p.rect(7, 19, 1, 4), 'sk1')
    p.fill(p.ellipse(37, 21, 2, 4), 'sk1')
    p.fill(p.rect(37, 19, 1, 4), 'sk0')

    # ---- the head: broad, heavy in the jaw, bald on top
    head = p.blob([(22, 2), (15, 3), (10, 7), (8, 13), (8, 22), (9, 29), (12, 34), (17, 38), (22, 39), (27, 38),
                   (32, 34), (35, 29), (36, 22), (36, 13), (34, 7), (29, 3)])
    p.fill(head, 'sk3')
    p.fill(head & ~moved(head, 0, -2) & p.rect(0, 30, 44, 14), 'sk2')        # under the jaw
    p.fill(head & ~moved(head, -8, -2), 'sk2')                               # the side that turns from the light
    p.fill(head & ~moved(head, -3, -1), 'sk1')
    p.fill(head & ~moved(head, 0, -1) & p.rect(0, 30, 44, 14), 'sk0')        # the jaw's line against the collar
    p.fill(p.ellipse(17, 8, 6, 3) & head, 'sk4')                             # the light on his bald crown
    p.fill(head & ~moved(head, 1, 1) & p.rect(0, 0, 24, 20), 'sk4')

    # ---- grey at the temples
    tl = p.blob([(8, 11), (10, 9), (12, 12), (11, 18), (9, 20), (7, 17)])
    tr = p.blob([(36, 11), (34, 9), (32, 12), (33, 18), (35, 20), (37, 17)])
    p.fill(tl, 'hr2')
    p.fill(tl & ~moved(tl, 1, 1), 'hr3')
    p.fill(tl & ~moved(tl, -1, -1), 'hr1')
    p.fill(tr, 'hr1')
    p.fill(tr & ~moved(tr, -1, -1), 'hr0')

    # ---- the lines of his forehead, and from the nose down past the mouth
    for pts in ([(14, 12), (20, 12)], [(24, 12), (30, 12)], [(15, 14), (19, 14)], [(25, 14), (29, 14)],
                [(17, 28), (15, 31)], [(27, 28), (29, 31)]):
        p.step(p.stroke(pts), SKIN, -1)

    # ---- brows that fall away outward, and the eyes under them
    bl = p.poly([(10, 19), (14, 16), (20, 16), (20, 18), (14, 18), (11, 21)])
    br = p.poly([(34, 19), (30, 16), (24, 16), (24, 18), (30, 18), (33, 21)])
    p.fill(bl, 'hr2')
    p.fill(bl & ~moved(bl, 0, 1), 'hr3')
    p.fill(bl & ~moved(bl, 0, -1), 'hr1')
    p.fill(br, 'hr1')
    p.fill(br & ~moved(br, 0, 1), 'hr2')
    p.fill(br & ~moved(br, 0, -1), 'hr0')
    p.pixels(12, 21, EYE, EYE_KEY)
    p.pixels(26, 21, EYE, dict(EYE_KEY, s='sk1'))
    p.fill(p.ellipse(13, 27, 3, 2) & head, 'rd')                             # a weathered cheek

    # ---- the nose's bridge
    p.fill(p.rect(21, 19, 1, 7), 'sk4')
    p.fill(p.rect(23, 19, 2, 7), 'sk2')

    # ---- the moustache: it covers his mouth and hangs past its corners
    mo = p.blob([(22, 30), (18, 29), (13, 31), (10, 35), (10, 39), (13, 39), (16, 36), (22, 35), (28, 36),
                 (31, 39), (34, 39), (34, 35), (31, 31), (26, 29)], n=8)
    right = p.rect(22, 0, 22, 44)
    p.fill(mo, 'hr2')
    p.fill(mo & right, 'hr1')
    p.fill(mo & ~moved(mo, 1, 1), 'hr3')
    p.fill(mo & ~moved(mo, 1, 1) & right, 'hr2')
    p.fill(mo & ~moved(mo, 0, -1), 'hr1')
    p.fill(mo & ~moved(mo, 0, -1) & right, 'hr0')
    p.line([(19, 31), (14, 34), (12, 37)], 'hr3', only=mo)
    p.line([(21, 32), (17, 34)], 'hr3', only=mo)
    p.line([(25, 31), (30, 34), (32, 37)], 'hr2', only=mo)
    p.line([(22, 31), (22, 34)], 'hr0', only=mo)
    # the mouth in its shadow, the lower lip, the chin
    p.fill(p.rect(18, 36, 9, 1) & head & ~mo, 'sk0')
    p.fill(p.rect(19, 37, 7, 1) & head & ~mo, 'rd')

    # ---- the nose's tip, over the moustache
    tip = p.ellipse(22, 27, 4, 3)
    p.fill(tip, 'sk3')
    p.fill(tip & ~moved(tip, -2, -1), 'sk2')
    p.fill(tip & ~moved(tip, 0, -1), 'sk1')
    p.fill(p.rect(20, 25, 2, 3), 'sk4')
    p.put(19, 29, 'sk0')
    p.put(25, 29, 'sk0')
    p.step(p.rect(17, 25, 1, 4), SKIN, -1)                                   # the wings' shadows on the cheeks
    p.step(p.rect(27, 24, 1, 6), SKIN, -1)
    p.fill(p.rect(20, 30, 5, 1), 'sk0')                                      # and the tip's, on the moustache
    p.line([(20, 33), (15, 36)], 'hr1', only=mo)                             # strands
    p.line([(24, 33), (29, 36)], 'hr0', only=mo)
    p.line([(27, 31), (32, 35)], 'hr2', only=mo)

    p.outline('ink')
    return p


def face():
    """The 96 px file a niche reads: the portrait seated where the niche's window falls (26, 10)."""
    im = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    im.alpha_composite(portrait().image(), (26, 10))
    return im


if __name__ == '__main__':
    os.makedirs(HERE + '/out', exist_ok=True)
    GRASS = (98, 126, 47, 255)
    f, s = draw(), small()
    f.save(HERE + '/out/bagrat.png')
    f.save(HERE + '/out/bagrat@4.png', zoom=4, bg=GRASS)
    s.save(HERE + '/out/bagrat_small.png')
    s.save(HERE + '/out/bagrat_small@8.png', zoom=8, bg=GRASS)
    face().save(HERE + '/out/bagrat_face.png')
    portrait().save(HERE + '/out/bagrat_portrait@8.png', zoom=8, bg=(43, 33, 27, 255))
    board = os.path.abspath(HERE + '/../../../../game/public/sprites/units/board')
    names = ('roy', 'marcus', 'lilina')
    others = [Image.open(f'{board}/{n}.png').convert('RGBA').resize((312, 456), Image.NEAREST) for n in names]
    sheet([f], zoom=3, extra=others).save(HERE + '/out/bagrat_sheet.png')
    # the tokens as the field shows them (the current ones are the bakes shrunk by the browser), at 1x and at 4x
    toks = [Image.open(f'{board}/{n}.png').convert('RGBA').resize((52, 76), Image.BILINEAR) for n in names]
    row = sheet([s], zoom=1, gap=6, extra=toks)
    row.save(HERE + '/out/tokens.png')
    row.resize((row.width * 4, row.height * 4), Image.NEAREST).save(HERE + '/out/tokens@4.png')
    print('colours used:', f.count(), '(figure)', s.count(), '(token)')
