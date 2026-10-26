"""Filigree kit, world layer: the painted combat field (copied from dirs/hyb-64/world_combat.py). Use kit.world_field()."""
import math
import random
from kit_px import B
from kit_paint import f, rock, tuft, forest, scatter

rng = random.Random(5)
T, OX, OY, COLS, ROWS = 48, 303, 18, 14, 10
DIRT = [(2, 1), (3, 1), (1, 2), (2, 2), (3, 2), (4, 2), (5, 2), (2, 3), (3, 3), (4, 3), (5, 3), (6, 3), (3, 4), (4, 4), (5, 4), (6, 4), (7, 4),
        (6, 5), (7, 5), (8, 5), (10, 8), (11, 8), (11, 9)]
WALLS = [(6, 2), (10, 6)]
UNITS = [  # key, name, side, tile, hp
    ('lilina', 'Lilina', 'ally', (1, 4), 62, 62),
    ('roy', 'The Foundling', 'ally', (2, 4), 73, 73),
    ('marcus', 'Bagrat “Oak”', 'ally', (2, 5), 84, 84),
    ('bandit', 'Obsidian Fighter 1', 'foe', (6, 3), 103, 103),
    ('bandit', 'Obsidian Fighter 2', 'foe', (6, 5), 103, 103),
    ('ember_mage', 'Ember Mage', 'foe', (6, 7), 90, 90),
]


def C(c, r):
    """Centre of tile (c, r) in stage px."""
    return OX + T * c + T / 2, OY + T * r + T / 2


svg = []
A = svg.append
dirt_rects = ''.join(f'<rect x="{OX + T * c + 1}" y="{OY + T * r + 1}" width="{T - 2}" height="{T - 2}" rx="10"/>' for c, r in DIRT)
dirt_rects += ''.join(f'<rect x="{OX + T * c - 1}" y="{OY + T * r - 1}" width="{T + 2}" height="{T + 2}"/>' for c, r in DIRT
                      if False)
# bridge adjacent dirt tiles so the path reads as one worn track
for c, r in DIRT:
    for dc, dr in ((1, 0), (0, 1)):
        if (c + dc, r + dr) in DIRT:
            x0 = OX + T * c + (T / 2 if dc else 6)
            y0 = OY + T * r + (6 if dc else T / 2)
            w = T if dc else T - 12
            h = T - 12 if dc else T
            dirt_rects += f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}"/>'

A(f'''<defs>
<pattern id="f64w-cgrass" patternUnits="userSpaceOnUse" width="128" height="128"><image href="{B('tex_grass')}" width="128" height="128"/></pattern>
<pattern id="f64w-cdirt" patternUnits="userSpaceOnUse" width="96" height="96"><image href="{B('tex_dirt')}" width="96" height="96"/></pattern>
<filter id="f64w-csun" x="0" y="0" width="100%" height="100%"><feColorMatrix values="1.46 0 0 0 .02  0 1.38 0 0 .02  0 0 1.05 0 0  0 0 0 1 0"/></filter>
<filter id="f64w-cdsun" x="0" y="0" width="100%" height="100%"><feColorMatrix values="1.62 0 0 0 .05  0 1.52 0 0 .04  0 0 1.38 0 .02  0 0 0 1 0"/></filter>
<filter id="f64w-cmeadow" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 .86  0 0 0 0 .86  0 0 0 0 .45  2.6 0 0 0 -1.3"/></filter>
<filter id="f64w-cdark" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="3" seed="31"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .2  0 0 0 0 .05  2.8 0 0 0 -1.5"/></filter>
<filter id="f64w-cblur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="f64w-cblur3" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1"/></filter>
<filter id="f64w-cblur2" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>
<mask id="f64w-pathMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720"><rect width="1280" height="720" fill="#000"/><g fill="#fff" filter="url(#f64w-cblur)">{dirt_rects}</g></mask>
<mask id="f64w-pathEdge" maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720"><rect width="1280" height="720" fill="#000"/><g fill="#fff" filter="url(#f64w-cblur2)">{dirt_rects}</g></mask>
<clipPath id="f64w-tsh"><path d="M0 0 H38 V19 C38 31 28 39 19 44 C10 39 0 31 0 19 Z"/></clipPath>
<clipPath id="f64w-tshL"><path d="M0 0 H46 V23 C46 37 34 47 23 53 C12 47 0 37 0 23 Z"/></clipPath>
<clipPath id="f64w-tjag"><polygon points="JAGPTS"/></clipPath>
<clipPath id="f64w-tjagL"><polygon points="JAGPTSL"/></clipPath>
<clipPath id="f64w-boardClip"><rect x="{OX}" y="{OY}" width="{T * COLS}" height="{T * ROWS}"/></clipPath>
</defs>''')


def jag(cx, cy, ro, ri, n=12, sq=1.0, rot=0):
    """Points of a jagged ring (a bush or rock outline)."""
    pts = []
    for i in range(n * 2):
        a = math.pi * i / n + rot
        rr = ro if i % 2 == 0 else ri
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * sq))
    return ' '.join(f'{f(x)},{f(y)}' for x, y in pts)


svg[0] = svg[0].replace('JAGPTSL', jag(26, 26, 27, 22, 14, 1, .1)).replace('JAGPTS', jag(21, 21, 22, 18, 12, 1, .13))

# ground: the whole stage is the field; the board is the cleared part of it
A('<rect width="1280" height="720" fill="url(#f64w-cgrass)" filter="url(#f64w-csun)"/>')
A('<rect width="1280" height="720" filter="url(#f64w-cmeadow)" opacity=".32"/>')
A('<rect width="1280" height="720" filter="url(#f64w-cdark)" opacity=".38"/>')
A('<rect width="1280" height="720" fill="#3a2a14" mask="url(#f64w-pathEdge)" opacity=".4"/>')
A('<rect width="1280" height="720" fill="url(#f64w-cdirt)" filter="url(#f64w-cdsun)" mask="url(#f64w-pathMask)"/>')
# wheel ruts and pebbles on the path
for c, r in DIRT:
    x, y = C(c, r)
    for _ in range(3):
        px, py = x + rng.uniform(-16, 16), y + rng.uniform(-16, 16)
        A(f'<ellipse cx="{f(px)}" cy="{f(py)}" rx="{f(rng.uniform(1.2, 2.4))}" ry="{f(rng.uniform(1, 1.8))}" fill="#e2cfa4" opacity=".45"/>')
        A(f'<ellipse cx="{f(px + 1)}" cy="{f(py + 1)}" rx="1.4" ry="1" fill="#3d2c18" opacity=".35"/>')
RUTS = [[(2, 1), (3, 2), (4, 3), (5, 4), (6, 4), (7, 5), (8, 5)], [(1, 2), (2, 3), (3, 4), (4, 4), (5, 4), (6, 5), (7, 5)], [(10, 8), (11, 8), (11, 9)]]
for rut in RUTS:
    pts = [C(c, r) for c, r in rut]
    for off in (-5, 5):
        d = 'M' + ' L'.join(f'{f(x + off * .7)} {f(y + off)}' for x, y in pts)
        A(f'<path d="{d}" fill="none" stroke="#4a3620" stroke-width="2.2" opacity=".28" stroke-linejoin="round" stroke-linecap="round" filter="url(#f64w-cblur3)"/>')
        A(f'<path d="{d}" fill="none" stroke="#f3e2b8" stroke-width="1" opacity=".18" stroke-linejoin="round" transform="translate(1 1.5)"/>')
# tufts and flowers on the grass
for _ in range(260):
    x, y = rng.uniform(0, 1280), rng.uniform(0, 720)
    c, r = int((x - OX) // T), int((y - OY) // T)
    if (c, r) in DIRT:
        continue
    A(tuft(x, y, rng))
for _ in range(70):
    x, y = rng.uniform(OX, OX + T * COLS), rng.uniform(OY, OY + T * ROWS)
    c, r = int((x - OX) // T), int((y - OY) // T)
    if (c, r) in DIRT or (c, r) in WALLS:
        continue
    col = rng.choice(['#efe6d0', '#f0d27a', '#d9a3c0', '#efe6d0'])
    A(f'<circle cx="{f(x)}" cy="{f(y)}" r="1.5" fill="{col}" opacity=".85"/>')

# trees outside the cleared board (visible in the margins)
pts = scatter([(972, 0), (1280, 0), (1280, 720), (972, 720)], 15, rng, 800, lambda p: False)
pts += scatter([(0, 0), (306, 0), (306, 720), (0, 720)], 15, rng, 800, lambda p: False)
pts += [p for p in scatter([(300, 500), (990, 500), (990, 720), (300, 720)], 16, rng, 600, lambda p: False)]
sh, cr = forest(pts, 'leaf', rng, 12, 18)
A(sh + cr)
# re-paint grass over the board so trees stay outside it
A(f'<g clip-path="url(#f64w-boardClip)"><rect width="1280" height="720" fill="url(#f64w-cgrass)" filter="url(#f64w-csun)"/>'
  f'<rect width="1280" height="720" filter="url(#f64w-cmeadow)" opacity=".32"/><rect width="1280" height="720" filter="url(#f64w-cdark)" opacity=".38"/>'
  f'<rect width="1280" height="720" fill="#3a2a14" mask="url(#f64w-pathEdge)" opacity=".4"/>'
  f'<rect width="1280" height="720" fill="url(#f64w-cdirt)" filter="url(#f64w-cdsun)" mask="url(#f64w-pathMask)"/></g>')
for rut in RUTS:
    pts = [C(c, r) for c, r in rut]
    for off in (-5, 5):
        d = 'M' + ' L'.join(f'{f(x + off * .7)} {f(y + off)}' for x, y in pts)
        A(f'<path d="{d}" fill="none" stroke="#4a3620" stroke-width="2.2" opacity=".3" stroke-linejoin="round" stroke-linecap="round" filter="url(#f64w-cblur3)"/>')
for c, r in DIRT:
    x, y = C(c, r)
    for _ in range(4):
        px, py = x + rng.uniform(-20, 20), y + rng.uniform(-20, 20)
        A(f'<ellipse cx="{f(px)}" cy="{f(py)}" rx="{f(rng.uniform(1.2, 2.6))}" ry="{f(rng.uniform(1, 1.8))}" fill="#efe0b8" opacity=".5"/><ellipse cx="{f(px + 1)}" cy="{f(py + 1.2)}" rx="1.5" ry="1" fill="#3d2c18" opacity=".35"/>')
# soft shadow cast by the treeline onto the board edge
A(f'<rect x="{OX}" y="{OY}" width="{T * COLS}" height="{T * ROWS}" fill="none" stroke="#142109" stroke-width="10" opacity=".22" filter="url(#f64w-cblur)"/>')
for _ in range(120):
    x, y = rng.uniform(OX, OX + T * COLS), rng.uniform(OY, OY + T * ROWS)
    c, r = int((x - OX) // T), int((y - OY) // T)
    if (c, r) in DIRT or (c, r) in WALLS:
        continue
    A(tuft(x, y, rng))

# grid
g = ''
for c in range(COLS + 1):
    g += f'<path d="M{OX + T * c} {OY} V{OY + T * ROWS}"/>'
for r in range(ROWS + 1):
    g += f'<path d="M{OX} {OY + T * r} H{OX + T * COLS}"/>'
A(f'<g stroke="#1b2a0c" stroke-width="1" opacity=".34">{g}</g>')
A(f'<g stroke="#f4f0c8" stroke-width="1" opacity=".08" transform="translate(1 1)">{g}</g>')
A(f'<rect x="{OX}" y="{OY}" width="{T * COLS}" height="{T * ROWS}" fill="none" stroke="#1b2a0c" stroke-width="2" opacity=".55"/>')

# impassable boulders
for c, r in WALLS:
    x, y = C(c, r)
    A(rock(x + 2, y - 1, 21, rng))
    A(rock(x - 14, y + 13, 7, rng))
    A(rock(x + 16, y + 14, 6, rng))

