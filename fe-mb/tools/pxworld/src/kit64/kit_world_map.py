"""Filigree kit, world layer: the painted Borderlands map (copied from dirs/hyb-64/world_map.py). Use kit.world_map()."""
import math
import random
from kit_px import B
from kit_paint import f, catmull, sample_catmull, quad, quad_pts, dist_to_pts, scatter, forest, hill, rock, tuft, pip

rng = random.Random(11)

P = {
    'frontier_camp': (452, 410),
    'traders_rest': (530, 352),
    'riverside_market': (660, 400),
    'south_road_ambush': (640, 500),
    'old_mill_crossing': (812, 298),
    'bandit_hideout': (830, 430),
    'south_junction': (820, 540),
    'north_ridge_path': (990, 290),
    'watchtower_ridge': (1090, 330),
    'pine_crossing': (1076, 410),
    'smugglers_cave': (1060, 510),
    'broken_bridge': (960, 580),
    'border_fortress': (1222, 350),
    'rodericks_camp': (1222, 462),
}
NAMES = {
    'frontier_camp': 'Frontier Camp', 'traders_rest': "Trader's Rest", 'riverside_market': 'Riverside Market',
    'south_road_ambush': 'South Road Ambush', 'old_mill_crossing': 'Old Mill Crossing', 'bandit_hideout': 'Bandit Hideout',
    'south_junction': 'South Junction', 'north_ridge_path': 'North Ridge Path', 'watchtower_ridge': 'Watchtower Ridge',
    'pine_crossing': 'Pine Crossing', 'smugglers_cave': "Smuggler's Cave", 'broken_bridge': 'Broken Bridge',
    'border_fortress': 'Border Fortress', 'rodericks_camp': "Roderick's Camp",
}
ROADS = [
    ('frontier_camp', 'riverside_market', 16), ('frontier_camp', 'south_road_ambush', -12), ('frontier_camp', 'traders_rest', 10),
    ('riverside_market', 'old_mill_crossing', -10), ('riverside_market', 'bandit_hideout', 12),
    ('south_road_ambush', 'south_junction', 16),
    ('old_mill_crossing', 'watchtower_ridge', 26), ('old_mill_crossing', 'pine_crossing', 10), ('old_mill_crossing', 'north_ridge_path', -18),
    ('bandit_hideout', 'south_junction', 14), ('bandit_hideout', 'pine_crossing', -14),
    ('south_junction', 'smugglers_cave', -16), ('south_junction', 'broken_bridge', 10),
    ('watchtower_ridge', 'border_fortress', 10), ('watchtower_ridge', 'north_ridge_path', -8),
    ('pine_crossing', 'border_fortress', 10), ('pine_crossing', 'rodericks_camp', -8),
    ('smugglers_cave', 'rodericks_camp', 12), ('smugglers_cave', 'broken_bridge', 10),
]
OUT_ROADS = {('frontier_camp', 'riverside_market'), ('frontier_camp', 'south_road_ambush'), ('frontier_camp', 'traders_rest')}
HOVER = ('frontier_camp', 'riverside_market')

RIVER = [(846, -20), (834, 120), (824, 240), (822, 318), (846, 384), (893, 432), (922, 492), (946, 552), (960, 592), (976, 650), (990, 740)]
river_pts = sample_catmull(RIVER, 14)

road_geo = {}
for a, b, bend in ROADS:
    A, Bp = P[a], P[b]
    c = quad(A, Bp, bend)
    road_geo[(a, b)] = (A, Bp, c, quad_pts(A, Bp, c, 28))
EAST = [((1222, 350), (1300, 334), 6), ((1222, 462), (1300, 482), -6)]
for i, (A, Bp, bend) in enumerate(EAST):
    c = quad(A, Bp, bend)
    road_geo[('east', i)] = (A, Bp, c, quad_pts(A, Bp, c, 10))
all_road_pts = [p for g in road_geo.values() for p in g[3]]


def near_road(p, d):
    """Is p within d of any road?"""
    return any((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < d * d for q in all_road_pts)


def near_place(p, d):
    """Is p within d of any place?"""
    return any((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < d * d for q in P.values())


def near_river(p, d):
    """Is p within d of the river?"""
    return any((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < d * d for q in river_pts)


def reject(p, rd=13, pd=44, wd=24):
    """Keep scatter off roads, places and the river."""
    return near_road(p, rd) or near_place(p, pd) or near_river(p, wd)


svg = []
A = svg.append

# ------------------------------------------------------------------ defs
A(f'''<defs>
<pattern id="f64w-grass" patternUnits="userSpaceOnUse" width="160" height="160"><image href="{B('tex_grass')}" width="160" height="160"/></pattern>
<pattern id="f64w-dirt" patternUnits="userSpaceOnUse" width="128" height="128"><image href="{B('tex_dirt')}" width="128" height="128"/></pattern>
<pattern id="f64w-stone" patternUnits="userSpaceOnUse" width="64" height="64"><image href="{B('tex_stone')}" width="64" height="64"/></pattern>
<pattern id="f64w-water" patternUnits="userSpaceOnUse" width="128" height="128"><image href="{B('tex_water')}" width="128" height="128"/></pattern>
<filter id="f64w-sun" x="0" y="0" width="100%" height="100%"><feColorMatrix values="1.42 0 0 0 .02  0 1.36 0 0 .02  0 0 1.05 0 0  0 0 0 1 0"/></filter>
<filter id="f64w-dirtSun" x="-5%" y="-5%" width="110%" height="110%"><feColorMatrix values="1.36 0 0 0 .02  0 1.3 0 0 .01  0 0 1.2 0 0  0 0 0 1 0"/></filter>
<filter id="f64w-waterTint" x="-5%" y="-5%" width="110%" height="110%"><feColorMatrix values=".36 0 0 0 .02  0 .52 0 0 .03  0 0 .48 0 .02  0 0 0 1 0"/></filter>
<filter id="f64w-meadow" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0045" numOctaves="3" seed="5"/><feColorMatrix values="0 0 0 0 .86  0 0 0 0 .86  0 0 0 0 .45  2.6 0 0 0 -1.25"/></filter>
<filter id="f64w-dark" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.007" numOctaves="3" seed="23"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .2  0 0 0 0 .05  2.8 0 0 0 -1.45"/></filter>
<filter id="f64w-blurH" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
<filter id="f64w-blurHill" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="f64w-blurM" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
<filter id="f64w-blurS" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
<filter id="f64w-blurXS" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1"/></filter>
<pattern id="f64w-wheat" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(-18)"><rect width="7" height="7" fill="#c8ad5e"/><rect width="7" height="2.2" fill="#a88d42"/><rect y="3.6" width="7" height="1" fill="#dcc47a"/></pattern>
<pattern id="f64w-wheat2" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(68)"><rect width="7" height="7" fill="#bfa356"/><rect width="7" height="2.2" fill="#9f843c"/><rect y="3.6" width="7" height="1" fill="#d6bd72"/></pattern>
<pattern id="f64w-crop" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-10)"><rect width="6" height="6" fill="#8daa48"/><rect width="6" height="2" fill="#6f8f35"/></pattern>
<pattern id="f64w-crop2" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(80)"><rect width="6" height="6" fill="#98b24f"/><rect width="6" height="2" fill="#78963b"/></pattern>
<pattern id="f64w-furrow" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(20)"><rect width="6" height="2.2" fill="#4a3620" opacity=".55"/><rect y="3" width="6" height="1" fill="#c9a874" opacity=".35"/></pattern>
<mask id="f64w-dirtMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720"><rect width="1280" height="720" fill="#000"/><g filter="url(#f64w-blurM)" fill="#fff">GROUNDPATCHES</g></mask>
<clipPath id="f64w-shieldClip"><path d="M0 0 H44 V22 C44 36 32 45 22 50 C12 45 0 36 0 22 Z"/></clipPath>
</defs>''')

# ------------------------------------------------------------------ ground
A('<rect width="1280" height="720" fill="url(#f64w-grass)" filter="url(#f64w-sun)"/>')
A('<rect width="1280" height="720" filter="url(#f64w-meadow)" opacity=".3"/>')
A('<rect width="1280" height="720" filter="url(#f64w-dark)" opacity=".35"/>')

# fields (patchwork) with hedgerows
FIELDS = [
    ([(478, 470), (560, 452), (585, 520), (500, 540)], 'f64w-wheat'),
    ([(500, 545), (588, 525), (606, 590), (520, 604)], 'f64w-crop'),
    ([(400, 500), (472, 478), (494, 548), (420, 566)], 'plough'),
    ([(596, 330), (640, 318), (668, 368), (620, 378)], 'f64w-crop2'),
    ([(690, 430), (760, 412), (780, 470), (712, 488)], 'f64w-wheat2'),
    ([(740, 520), (790, 506), (800, 570), (752, 584)], 'plough'),
    ([(842, 580), (900, 568), (912, 628), (856, 640)], 'f64w-wheat'),
    ([(300, 400), (370, 380), (392, 446), (320, 466)], 'f64w-crop'),
    ([(250, 300), (330, 282), (346, 340), (268, 360)], 'f64w-wheat2'),
    ([(680, 600), (744, 590), (756, 640), (690, 652)], 'f64w-crop2'),
    ([(150, 430), (230, 414), (246, 470), (162, 488)], 'plough'),
    ([(236, 196), (300, 186), (312, 236), (246, 248)], 'f64w-crop'),
    ([(24, 438), (100, 426), (110, 474), (32, 484)], 'f64w-wheat'),
]
for poly, kind in FIELDS:
    pts = ' '.join(f'{x},{y}' for x, y in poly)
    if kind == 'plough':
        A(f'<polygon points="{pts}" fill="url(#f64w-dirt)" filter="url(#f64w-dirtSun)" opacity=".95"/>')
        A(f'<polygon points="{pts}" fill="url(#f64w-furrow)"/>')
    else:
        A(f'<polygon points="{pts}" fill="url(#{kind})" opacity=".92"/>')
    A(f'<polygon points="{pts}" fill="none" stroke="#3b3418" stroke-width="1" opacity=".35"/>')
hedges_sh, hedges = [], []
for poly, kind in FIELDS:
    for i in range(len(poly)):
        if (i + len(poly)) % 3 == 1:
            continue
        a, b = poly[i], poly[(i + 1) % len(poly)]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        n = int(L / 6)
        for k in range(n):
            t = k / max(n, 1)
            x = a[0] + (b[0] - a[0]) * t + rng.uniform(-1, 1)
            y = a[1] + (b[1] - a[1]) * t + rng.uniform(-1, 1)
            r = rng.uniform(2.4, 3.6)
            hedges_sh.append(f'<circle cx="{f(x + 2)}" cy="{f(y + 2)}" r="{f(r)}" fill="#1b2a0e" opacity=".35"/>')
            hedges.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="#3e5a22"/><circle cx="{f(x - .8)}" cy="{f(y - .9)}" r="{f(r * .55)}" fill="#6c8b3a"/>')

# ground patches under places (trampled dirt) -> mask
patches = ''
for k, (x, y) in P.items():
    rx, ry = (40, 28) if k in ('frontier_camp', 'riverside_market', 'south_junction', 'pine_crossing', 'border_fortress') else (30, 21)
    patches += f'<ellipse cx="{x}" cy="{y - 4}" rx="{rx}" ry="{ry}"/>'
svg[0] = svg[0].replace('GROUNDPATCHES', patches)

# hills (shading only, lit from the north-west)
HILLS = [
    (940, 262, 72, 36, -8), (1010, 296, 56, 28, 0), (1092, 318, 80, 40, 6), (1172, 300, 70, 36, 0),
    (1104, 516, 92, 56, -10), (1166, 568, 60, 38, 0),
    (170, 380, 110, 48, -6), (300, 300, 80, 36, 8), (90, 236, 80, 40, 0),
    (520, 660, 80, 34, 0), (664, 150, 90, 44, -6), (410, 232, 80, 36, 0), (734, 280, 56, 24, 0), (250, 560, 90, 40, 0), (612, 322, 46, 22, 0),
    (980, 150, 70, 34, 0), (120, 660, 90, 40, 0),
]
for (hx, hy, hrx, hry, hr) in HILLS:
    A(hill(hx, hy, hrx, hry, rot=hr))
# rocky crest along the ridge
for (x, y, s) in [(948, 236, 7), (962, 230, 5), (1030, 262, 6), (1046, 258, 8), (1126, 292, 6), (1150, 298, 5), (1112, 488, 9), (1130, 498, 7), (1094, 482, 6), (1140, 530, 5)]:
    A(rock(x, y, s, rng))

A(f'<rect width="1280" height="720" fill="url(#f64w-dirt)" filter="url(#f64w-dirtSun)" mask="url(#f64w-dirtMask)" opacity=".9"/>')

# roads
for key, (Aa, Bb, c, pts) in road_geo.items():
    d = f'M{Aa[0]} {Aa[1]} Q{f(c[0])} {f(c[1])} {Bb[0]} {Bb[1]}'
    east = key[0] == 'east'
    A(f'<path d="{d}" stroke="#5b4a2e" stroke-width="10" fill="none" stroke-linecap="round" opacity="{.25 if east else .4}" filter="url(#f64w-blurXS)"/>')
    A(f'<path d="{d}" stroke="url(#f64w-dirt)" stroke-width="6.5" fill="none" stroke-linecap="round" filter="url(#f64w-dirtSun)" opacity="{.7 if east else 1}"/>')
    A(f'<path d="{d}" stroke="#d6bf8c" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".35"/>')

# river: banks, water, ripples (drawn over the roads; fords and bridges sit on top)
rd = catmull(RIVER)
A(f'<path d="{rd}" stroke="#a99868" stroke-width="34" fill="none" stroke-linecap="round" filter="url(#f64w-blurS)" opacity=".85"/>')
A(f'<path d="{rd}" stroke="#4e5e34" stroke-width="25" fill="none" stroke-linecap="round" opacity=".6"/>')
A(f'<path d="{rd}" stroke="url(#f64w-water)" stroke-width="20" fill="none" stroke-linecap="round" filter="url(#f64w-waterTint)"/>')
A(f'<path d="{rd}" stroke="#16323a" stroke-width="8" fill="none" stroke-linecap="round" opacity=".22" filter="url(#f64w-blurXS)"/>')
for i in range(6, len(river_pts) - 4, 5):
    p, q = river_pts[i], river_pts[i + 1]
    ang = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
    off = rng.choice((-4, -2, 3, 5))
    A(f'<path d="M-5 {off} Q0 {off - 1.6} 5 {off}" transform="translate({f(p[0])} {f(p[1])}) rotate({f(ang)})" stroke="#d9ecea" stroke-width="1.1" fill="none" opacity=".5" stroke-linecap="round"/>')
# reeds along the banks
for i in range(2, len(river_pts) - 2, 3):
    p, q = river_pts[i], river_pts[i + 1]
    dx, dy = q[0] - p[0], q[1] - p[1]
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    side = 1 if (i // 3) % 2 else -1
    bx, by = p[0] + nx * 12 * side, p[1] + ny * 12 * side
    if rng.random() < .55:
        for k in range(3):
            A(f'<path d="M{f(bx + k * 1.6)} {f(by)} l{f(rng.uniform(-1.5, 1.5))} -6" stroke="#3b5a22" stroke-width="1.1" stroke-linecap="round"/>')
# fords where a road crosses without a bridge
def crossing(road_pts):
    """The ford or bridge where a road meets the river."""
    best = None
    for p in road_pts:
        d = min(math.hypot(p[0] - q[0], p[1] - q[1]) for q in river_pts)
        if best is None or d < best[0]:
            best = (d, p)
    return best[1]
for key in [('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave')]:
    pts = road_geo[key][3]
    x, y = crossing(pts)
    i = min(range(len(pts)), key=lambda j: math.hypot(pts[j][0] - x, pts[j][1] - y))
    p, q = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
    ang = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
    A(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="17" ry="6" transform="rotate({f(ang)} {f(x)} {f(y)})" fill="#c4b585" opacity=".75" filter="url(#f64w-blurXS)"/>')
    for k in (-8, -3, 3, 8):
        A(f'<circle cx="{f(x + math.cos(math.radians(ang)) * k)}" cy="{f(y + math.sin(math.radians(ang)) * k + (2 if k % 2 else -2))}" r="1.6" fill="#8a847a" opacity=".8"/>')

# hedgerows over fields/roads edge
A(''.join(hedges_sh) + ''.join(hedges))

# forests
FORESTS = [
    ([(0, 104), (170, 98), (246, 150), (226, 236), (130, 272), (0, 262)], 'leaf'),
    ([(590, 84), (742, 76), (786, 132), (748, 196), (650, 206), (604, 170)], 'leaf'),
    ([(0, 300), (80, 296), (122, 360), (70, 420), (0, 410)], 'leaf'),
    ([(546, 470), (612, 458), (622, 532), (584, 560), (538, 528)], 'leaf'),
    ([(688, 498), (768, 490), (786, 552), (716, 590), (672, 550)], 'leaf'),
    ([(430, 636), (560, 628), (628, 684), (604, 740), (430, 740)], 'leaf'),
    ([(884, 56), (990, 66), (1034, 134), (968, 186), (892, 166)], 'leaf'),
    ([(1140, 30), (1300, 20), (1300, 740), (1150, 740), (1122, 650), (1166, 582), (1190, 520), (1164, 440), (1180, 384), (1150, 300), (1166, 190)], 'pine'),
    ([(1010, 376), (1066, 366), (1126, 398), (1116, 450), (1042, 454)], 'pine'),
    ([(1000, 620), (1110, 598), (1156, 652), (1110, 740), (1000, 740)], 'pine'),
    ([(726, 652), (822, 632), (884, 680), (864, 740), (726, 740)], 'leaf'),
    ([(404, 176), (468, 164), (492, 220), (436, 244)], 'leaf'),
]
sh_all, cr_all, mass_all = [], [], []
for poly, kind in FORESTS:
    def rj(p, kind=kind):
        """Random jitter."""
        return reject(p, 13, 46 if kind == 'leaf' else 40, 24)
    pts = scatter(poly, 9 if kind == 'leaf' else 8.5, rng, 6000, rj)
    sh, cr = forest(pts, kind, rng, 8, 13 if kind == 'leaf' else 11)
    sh_all.append(sh)
    cr_all.append(cr)
# lone trees and small clumps in the meadows
lone = []
for _ in range(80):
    p = (rng.uniform(200, 1120), rng.uniform(120, 700))
    if not reject(p, 14, 50, 26) and not any(pip(p, poly) for poly, _ in FIELDS):
        lone.append(p)
sh, cr = forest(lone[:30], 'leaf', rng, 7, 10)
sh_all.append(sh)
cr_all.append(cr)
A(''.join(sh_all))
A(''.join(cr_all))
# grass tufts
A(''.join(tuft(rng.uniform(0, 1280), rng.uniform(0, 720), rng) for _ in range(140)))


# ------------------------------------------------------------------ structures
def shadow_poly(pts, dx=5, dy=4, op=.35):
    """A flat cast shadow for a polygon."""
    return '<polygon points="' + ' '.join(f'{f(x + dx)},{f(y + dy)}' for x, y in pts) + f'" fill="#15200b" opacity="{op}"/>'


def house(x, y, w=16, d=10, h=6, roof=('#c56d43', '#8f4428'), wall=('#e0cfa6', '#b19c74')):
    """Oblique house: ridge east-west, north slope lit."""
    x0, y0 = x - w / 2, y - h - d
    s = shadow_poly([(x0, y - h), (x0 + w, y - h), (x0 + w + 4, y + 3), (x0 + 4, y + 3)], 2, 1, .4)
    s += f'<rect x="{f(x0)}" y="{f(y - h)}" width="{w}" height="{h}" fill="{wall[1]}" stroke="#2a1a10" stroke-width=".8"/>'
    s += f'<rect x="{f(x0 + w * .35)}" y="{f(y - h * .7)}" width="{f(w * .18)}" height="{f(h * .7)}" fill="#3a2616"/>'
    s += f'<polygon points="{f(x0 - 1)},{f(y - h)} {f(x0 + w + 1)},{f(y - h)} {f(x0 + w + 1)},{f(y - h - d / 2)} {f(x0 - 1)},{f(y - h - d / 2)}" fill="{roof[1]}" stroke="#2a1a10" stroke-width=".8"/>'
    s += f'<polygon points="{f(x0 - 1)},{f(y - h - d / 2)} {f(x0 + w + 1)},{f(y - h - d / 2)} {f(x0 + w + 1)},{f(y0)} {f(x0 - 1)},{f(y0)}" fill="{roof[0]}" stroke="#2a1a10" stroke-width=".8"/>'
    s += f'<path d="M{f(x0 - 1)} {f(y - h - d / 2)} H{f(x0 + w + 1)}" stroke="#5a2a18" stroke-width="1.2"/>'
    return s


def tent(x, y, s=9, col=('#e2d8bd', '#a99f86', '#5a5040'), stripe=None):
    """Ridge tent seen from above at an angle: two roof planes and a dark doorway."""
    pts_l = [(x - s, y), (x - s * .15, y - s * 1.1), (x - s * .15 + s * .5, y - s * 1.9), (x - s + s * .5, y - s * .8)]
    pts_r = [(x + s * .7, y), (x - s * .15, y - s * 1.1), (x - s * .15 + s * .5, y - s * 1.9), (x + s * .7 + s * .5, y - s * .8)]
    out = shadow_poly([(x - s, y), (x + s * .7, y), (x + s * 1.9, y - s * .7), (x, y - s * .9)], 3, 2, .38)
    out += '<polygon points="' + ' '.join(f'{f(a)},{f(b)}' for a, b in pts_r) + f'" fill="{col[1]}" stroke="#2a1a10" stroke-width=".8" stroke-linejoin="round"/>'
    out += '<polygon points="' + ' '.join(f'{f(a)},{f(b)}' for a, b in pts_l) + f'" fill="{col[0]}" stroke="#2a1a10" stroke-width=".8" stroke-linejoin="round"/>'
    if stripe:
        out += f'<path d="M{f(x - s * .58)} {f(y - s * .55)} L{f(x - s * .08)} {f(y - s * 1.35)}" stroke="{stripe}" stroke-width="2.2"/>'
    out += f'<polygon points="{f(x - s)},{f(y)} {f(x - s * .15)},{f(y - s * 1.1)} {f(x + s * .7)},{f(y)}" fill="{col[2]}" stroke="#2a1a10" stroke-width=".8" stroke-linejoin="round"/>'
    out += f'<polygon points="{f(x - s * .35)},{f(y)} {f(x - s * .15)},{f(y - s * .7)} {f(x + s * .05)},{f(y)}" fill="#1a120b"/>'
    return out


def stake_ring(x, y, rx, ry, gap=None, front=False):
    """A palisade ring of stakes."""
    out = ''
    n = 30
    for i in range(n):
        a = 2 * math.pi * i / n
        if gap and abs(((a - gap[0] + math.pi) % (2 * math.pi)) - math.pi) < gap[1]:
            continue
        is_front = math.sin(a) > 0
        if is_front != front:
            continue
        px, py = x + math.cos(a) * rx, y + math.sin(a) * ry
        lit = '#9a7650' if math.cos(a) < 0.3 else '#6e5234'
        out += f'<path d="M{f(px - 1.6)} {f(py)} V{f(py - 7)} L{f(px)} {f(py - 9.5)} L{f(px + 1.6)} {f(py - 7)} V{f(py)} Z" fill="{lit}" stroke="#24170c" stroke-width=".7"/>'
    return out


def fire(x, y):
    """A campfire."""
    s = f'<ellipse cx="{x}" cy="{y + 1}" rx="5" ry="2.4" fill="#2a1c12"/>'
    s += f'<path d="M{x - 3} {y} C{x - 4} {y - 4} {x - 1} {y - 5} {x} {y - 9} C{x + 1} {y - 5} {x + 4} {y - 4} {x + 3} {y} Z" fill="#e0762f" stroke="#5a2410" stroke-width=".6"/>'
    s += f'<path d="M{x - 1.4} {y} C{x - 2} {y - 2.5} {x} {y - 3} {x} {y - 5.5} C{x + .5} {y - 3} {x + 2} {y - 2.5} {x + 1.4} {y} Z" fill="#f3c25a"/>'
    s += f'<path d="M{x + 1} {y - 11} C{x + 5} {y - 16} {x - 1} {y - 20} {x + 4} {y - 26} C{x + 8} {y - 30} {x + 6} {y - 34} {x + 10} {y - 38}" stroke="#d8d4c8" stroke-width="3" fill="none" opacity=".35" stroke-linecap="round"/>'
    return s


def flag(x, y, h=26, cols=('#a9342a', '#2c4c78'), ragged=False, w=16):
    """A banner on a pole; foot at (x,y)."""
    s = f'<ellipse cx="{x + 2}" cy="{y + 1}" rx="3" ry="1.4" fill="#15200b" opacity=".5"/>'
    s += f'<path d="M{x} {y} V{y - h}" stroke="#2a1a10" stroke-width="2.6"/><path d="M{x - .5} {y} V{y - h}" stroke="#8a6545" stroke-width="1"/>'
    top = y - h + 2
    if ragged:
        s += f'<path d="M{x + 1} {top} H{x + w} L{x + w - 3} {top + 4} L{x + w} {top + 7} L{x + w - 4} {top + 10} L{x + w - 1} {top + 13} H{x + 1} Z" fill="{cols[0]}" stroke="#0e0a08" stroke-width=".8"/>'
        s += f'<path d="M{x + 3} {top + 4} L{x + 9} {top + 9} M{x + 9} {top + 4} L{x + 3} {top + 9}" stroke="{cols[1]}" stroke-width="1.6"/>'
    else:
        s += f'<path d="M{x + 1} {top} H{x + w} V{top + 14} L{x + w - 5} {top + 10} L{x + w - 10} {top + 14} L{x + 1} {top + 14} Z" fill="{cols[0]}" stroke="#1a0e0a" stroke-width=".8"/>'
        s += f'<path d="M{x + 1} {top} H{x + 8} V{top + 6} H{x + 1} Z" fill="{cols[1]}"/>'
    s += f'<circle cx="{x}" cy="{y - h}" r="1.8" fill="#8f8981" stroke="#141313" stroke-width=".6"/>'
    return s


def pennant(x, y):
    """Small madder marker pennant on a stake: 'you can march here'."""
    s = f'<ellipse cx="{x + 2}" cy="{y + 1}" rx="3" ry="1.3" fill="#15200b" opacity=".55"/>'
    s += f'<path d="M{x} {y} V{y - 22}" stroke="#24170c" stroke-width="2.4"/><path d="M{x - .4} {y} V{y - 22}" stroke="#a07a52" stroke-width=".9"/>'
    s += f'<path d="M{x + 1} {y - 22} L{x + 15} {y - 18} L{x + 1} {y - 13} Z" fill="#c8453a" stroke="#3a0f0a" stroke-width=".9" stroke-linejoin="round"/>'
    s += f'<path d="M{x + 1} {y - 20.5} L{x + 10} {y - 18}" stroke="#e7826f" stroke-width=".8" opacity=".8"/>'
    return s


def wagon(x, y):
    """A wagon."""
    s = shadow_poly([(x - 9, y), (x + 9, y), (x + 13, y + 3), (x - 5, y + 3)], 0, 0, .4)
    s += f'<rect x="{x - 9}" y="{y - 5}" width="18" height="5" fill="#6e5234" stroke="#24170c" stroke-width=".8"/>'
    s += f'<path d="M{x - 9} {y - 5} C{x - 9} {y - 14} {x + 9} {y - 14} {x + 9} {y - 5} Z" fill="#e2d8bd" stroke="#2a1a10" stroke-width=".8"/>'
    s += f'<path d="M{x - 3} {y - 12} V{y - 5} M{x + 3} {y - 12} V{y - 5}" stroke="#a99f86" stroke-width="1"/>'
    s += f'<circle cx="{x - 5}" cy="{y}" r="2.6" fill="#3a2616" stroke="#140c08" stroke-width=".7"/><circle cx="{x + 5}" cy="{y}" r="2.6" fill="#3a2616" stroke="#140c08" stroke-width=".7"/>'
    return s


def stone_tower(x, y, h=30, w=16):
    """A stone tower."""
    x0 = x - w / 2
    s = shadow_poly([(x0, y), (x0 + w, y), (x0 + w + h * .5, y - h * .25), (x0 + h * .5, y - h * .25)], 0, 2, .38)
    s += f'<rect x="{f(x0)}" y="{f(y - h)}" width="{w}" height="{h}" fill="#8e877b" stroke="#2a2620" stroke-width=".9"/>'
    s += f'<rect x="{f(x0 + w * .55)}" y="{f(y - h)}" width="{f(w * .45)}" height="{h}" fill="#6c665c"/>'
    for i in range(3):
        s += f'<path d="M{f(x0)} {f(y - h + 8 + i * 8)} H{f(x0 + w)}" stroke="#4e4940" stroke-width=".6" opacity=".7"/>'
    for i in range(4):
        cx = x0 + i * w / 3.5
        s += f'<rect x="{f(cx)}" y="{f(y - h - 4)}" width="{f(w / 7)}" height="4" fill="#a39c8f" stroke="#2a2620" stroke-width=".6"/>'
    s += f'<rect x="{f(x - 1.8)}" y="{f(y - h * .55)}" width="3.6" height="6" fill="#1d1a16"/>'
    return s


# >>> landmarks (dirs/consistency/landmarks.py)
def wreck(x, y):
    """South Road Ambush: a cart on its side, a dead ox, arrows standing in the boards, flour sacks spilled."""
    s = shadow_poly([(x - 16, y + 4), (x + 12, y + 4), (x + 18, y + 9), (x - 10, y + 9)], 0, 0, .42)
    # the dead ox, a dun hump beyond the cart
    s += f'<path d="M{x + 6} {y + 6} C{x + 6} {y - 1} {x + 14} {y - 4} {x + 21} {y - 1} C{x + 25} {y + 1} {x + 25} {y + 6} {x + 22} {y + 7} Z" fill="#8a6a46" stroke="#24170c" stroke-width=".8"/>'
    s += f'<path d="M{x + 9} {y + 1} C{x + 12} {y - 2} {x + 17} {y - 3} {x + 21} {y - 1}" stroke="#b08d62" stroke-width="1.2" fill="none"/>'
    s += f'<path d="M{x + 22} {y + 2} l4 -3 M{x + 23} {y + 4} l4 0" stroke="#e8dcc0" stroke-width="1" stroke-linecap="round"/>'
    # the cart on its side: the bed stood on edge, the near wheel face-on, the far wheel in the air
    s += f'<polygon points="{x - 15},{y + 5} {x + 5},{y + 5} {x + 7},{y - 6} {x - 13},{y - 6}" fill="#6e5234" stroke="#24170c" stroke-width=".9"/>'
    s += f'<path d="M{x - 13} {y - 2} H{x + 6} M{x - 14} {y + 1.5} H{x + 5.5}" stroke="#4e3a24" stroke-width=".7"/>'
    s += f'<path d="M{x - 13} {y - 6} H{x + 7}" stroke="#9a7650" stroke-width="1.1"/>'
    s += f'<circle cx="{x - 5}" cy="{y + 4}" r="4" fill="#3a2616" stroke="#140c08" stroke-width=".8"/>'
    s += f'<path d="M{x - 9} {y + 4} H{x - 1} M{x - 5} {y} V{y + 8}" stroke="#7a5a3a" stroke-width=".8"/>'
    s += f'<ellipse cx="{x - 3}" cy="{y - 9}" rx="2.2" ry="3.4" fill="none" stroke="#3a2616" stroke-width="1.4"/>'
    # the shaft, snapped, pointing at the sky
    s += f'<path d="M{x - 15} {y - 1} L{x - 22} {y - 9}" stroke="#24170c" stroke-width="2.4" stroke-linecap="round"/><path d="M{x - 15} {y - 1} L{x - 22} {y - 9}" stroke="#8a6545" stroke-width="1"/>'
    # arrows standing in the boards
    for ax, ay, dx in ((-9, -5, -3), (-1, -4, 2), (3, -6, 4)):
        s += f'<path d="M{x + ax} {y + ay} l{dx} -7" stroke="#2a1a10" stroke-width="1"/>'
        s += f'<path d="M{x + ax + dx} {y + ay - 7} l-1.6 -1.6 M{x + ax + dx} {y + ay - 7} l1.6 -1.4" stroke="#e8dcc0" stroke-width=".9"/>'
    # the flour they left: two sacks, one split
    s += f'<ellipse cx="{x - 19}" cy="{y + 6}" rx="3.6" ry="2.6" fill="#e2d8bd" stroke="#5a4a30" stroke-width=".7"/>'
    s += f'<ellipse cx="{x + 1}" cy="{y + 10}" rx="3.4" ry="2.3" fill="#d8ccab" stroke="#5a4a30" stroke-width=".7"/>'
    s += f'<ellipse cx="{x + 5}" cy="{y + 11}" rx="4" ry="1.4" fill="#f2ecdc" opacity=".85"/>'
    return s


def hideout(x, y):
    """Bandit Hideout: a cave mouth behind a fallen oak, a fire pit with the ash still warm, a tripline into the dark."""
    out = [(x - 24, y + 6), (x - 26, y - 4), (x - 16, y - 16), (x - 2, y - 22), (x + 12, y - 20), (x + 24, y - 10), (x + 26, y + 6)]
    s = shadow_poly(out, 5, 4, .38)
    s += '<polygon points="' + ' '.join(f'{f(a)},{f(b)}' for a, b in out) + '" fill="#5f5a50" stroke="#24211c" stroke-width="1" stroke-linejoin="round"/>'
    s += f'<polygon points="{x - 24},{y - 2} {x - 15},{y - 14} {x - 2},{y - 20} {x + 4},{y - 12} {x - 10},{y - 6} {x - 18},{y + 2}" fill="#a29c8f"/>'
    s += f'<polygon points="{x + 12},{y - 20} {x + 24},{y - 10} {x + 26},{y + 6} {x + 14},{y + 4} {x + 8},{y - 8}" fill="#46423b"/>'
    s += f'<path d="M{x - 12} {y - 15} q5 -4 11 -3 M{x + 6} {y - 20} q5 1 8 5" stroke="#5e7f33" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    # the mouth, and the tripline across it
    s += f'<path d="M{x - 9} {y + 6} L{x - 9} {y - 2} C{x - 9} {y - 11} {x + 9} {y - 11} {x + 9} {y - 2} L{x + 9} {y + 6} Z" fill="#0e0b09" stroke="#24211c" stroke-width="1.2"/>'
    s += f'<path d="M{x - 9} {y + 2} L{x + 9} {y + 1}" stroke="#c9b98f" stroke-width=".8" opacity=".9"/>'
    # the fallen oak across the front: trunk, a root plate on the west, a crown of leaves to the east
    s += f'<path d="M{x - 22} {y + 12} L{x + 20} {y + 8}" stroke="#24170c" stroke-width="7.4" stroke-linecap="round"/>'
    s += f'<path d="M{x - 22} {y + 12} L{x + 20} {y + 8}" stroke="#6e5234" stroke-width="5.2" stroke-linecap="round"/>'
    s += f'<path d="M{x - 21} {y + 10.4} L{x + 19} {y + 6.6}" stroke="#9a7650" stroke-width="1.3" stroke-linecap="round"/>'
    s += f'<ellipse cx="{x - 25}" cy="{y + 11}" rx="4" ry="6.4" fill="#4e3a24" stroke="#24170c" stroke-width=".9"/>'
    s += f'<path d="M{x - 27} {y + 6} l-3 -3 M{x - 28} {y + 12} l-4 1 M{x - 26} {y + 16} l-2 3" stroke="#3a2616" stroke-width="1.1"/>'
    for (dx, dy, r, c) in ((22, 4, 5, '#3f6a2a'), (27, 9, 4.4, '#4f7d32'), (21, 11, 4, '#2f5520'), (28, 3, 3.2, '#6a9a3e')):
        s += f'<circle cx="{x + dx}" cy="{y + dy}" r="{r}" fill="{c}" stroke="#17260c" stroke-width=".7"/>'
    # the fire pit in front, ash still warm: a ring of stones, grey ash, one thin wisp
    s += f'<ellipse cx="{x + 2}" cy="{y + 19}" rx="5.4" ry="2.6" fill="#7d776c" stroke="#2a2620" stroke-width=".8"/>'
    s += f'<ellipse cx="{x + 2}" cy="{y + 19}" rx="3.4" ry="1.4" fill="#4b4740"/>'
    s += f'<circle cx="{x + 3}" cy="{y + 19}" r=".9" fill="#d8662e"/>'
    s += f'<path d="M{x + 3} {y + 16} C{x + 6} {y + 11} {x + 1} {y + 8} {x + 5} {y + 2}" stroke="#d8d4c8" stroke-width="2.2" fill="none" opacity=".35" stroke-linecap="round"/>'
    return s
# <<< landmarks


def place_art(k):
    """The painted art for one place."""
    x, y = P[k]
    s = ''
    if k == 'frontier_camp':
        s += stake_ring(x, y + 2, 38, 24, gap=(0.15, .5), front=False)
        s += tent(x - 22, y - 4, 9, stripe='#a9342a') + tent(x + 2, y - 14, 10, stripe='#2c4c78') + tent(x - 4, y + 12, 8)
        s += fire(x + 14, y + 6)
        s += stake_ring(x, y + 2, 38, 24, gap=(0.15, .5), front=True)
    elif k == 'traders_rest':
        s += tent(x - 10, y + 2, 9) + wagon(x + 13, y + 6) + tent(x + 6, y - 8, 7, col=('#d8c79a', '#a8966a', '#5a4a30')) + fire(x - 2, y + 12)
    elif k == 'riverside_market':
        s += f'<rect x="{x - 14}" y="{y - 8}" width="28" height="15" fill="url(#f64w-stone)" opacity=".75" stroke="#3a342a" stroke-width=".6"/>'
        for (dx, dy, w, rf) in [(-30, -10, 18, 0), (-6, -20, 20, 1), (20, -12, 16, 0), (34, 4, 14, 1), (-28, 16, 16, 1), (10, 22, 18, 0), (-8, 4, 0, 0)]:
            if w:
                s += house(x + dx, y + dy, w, 10, 6, roof=(('#c56d43', '#8f4428'), ('#b35e3c', '#7f3a22'))[rf])
        for i, (dx, c) in enumerate([(-9, '#a9342a'), (0, '#2c4c78'), (9, '#c9a24a')]):
            s += f'<rect x="{x + dx - 3.5}" y="{y - 3}" width="7" height="5" fill="{c}" stroke="#24170c" stroke-width=".6"/>'
            s += f'<path d="M{x + dx - 3.5} {y - 1} h7" stroke="#efe6d0" stroke-width=".9" opacity=".7"/>'
    elif k == 'south_road_ambush':
        s += wreck(x, y)
    elif k == 'old_mill_crossing':
        s += house(x - 10, y + 4, 18, 12, 9, roof=('#7d6a50', '#5a4a36'), wall=('#d6c49a', '#a8946c'))
        s += f'<g><circle cx="{x + 4}" cy="{y + 2}" r="7.5" fill="none" stroke="#3a2616" stroke-width="2.2"/>'
        for a in range(0, 180, 30):
            s += f'<path d="M{f(x + 4 + 7.5 * math.cos(math.radians(a)))} {f(y + 2 + 7.5 * math.sin(math.radians(a)))} L{f(x + 4 - 7.5 * math.cos(math.radians(a)))} {f(y + 2 - 7.5 * math.sin(math.radians(a)))}" stroke="#5a4028" stroke-width="1.3"/>'
        s += '</g>'
        # plank bridge over the river
        s += f'<path d="M{x + 10} {y - 4} L{x + 38} {y - 6}" stroke="#24170c" stroke-width="9" stroke-linecap="round"/>'
        s += f'<path d="M{x + 10} {y - 4} L{x + 38} {y - 6}" stroke="#9a7650" stroke-width="6.5" stroke-dasharray="2 1.2"/>'
    elif k == 'bandit_hideout':
        s += hideout(x, y)
    elif k == 'south_junction':
        for (dx, dy, w) in [(-26, -6, 16), (-4, -16, 18), (20, -8, 16), (-18, 14, 16), (14, 16, 18)]:
            s += house(x + dx, y + dy, w, 10, 6)
        s += f'<path d="M{x - 2} {y + 4} v-12" stroke="#3a2616" stroke-width="1.6"/><path d="M{x - 2} {y - 6} h10 l2 2 l-2 2 h-10 z" fill="#9a7650" stroke="#24170c" stroke-width=".6"/>'
    elif k == 'north_ridge_path':
        for (dx, dy, r) in [(-4, 2, 5), (3, 1, 4.5), (0, -4, 4), (-1, -8, 3)]:
            s += rock(x + dx, y + dy, r, rng)
        s += f'<path d="M{x + 12} {y + 4} v-16" stroke="#3a2616" stroke-width="1.8"/><path d="M{x + 12} {y - 10} h11 l3 2.5 l-3 2.5 h-11 z" fill="#9a7650" stroke="#24170c" stroke-width=".7"/>'
    elif k == 'watchtower_ridge':
        s += stake_ring(x, y + 4, 26, 15, front=False)
        s += stone_tower(x - 2, y + 2, 32, 16)
        s += house(x + 16, y + 8, 12, 8, 5, roof=('#7d6a50', '#5a4a36'))
        s += flag(x - 2, y - 34, 18, ('#6d7a3a', '#d9ccab'), w=13)
        s += stake_ring(x, y + 4, 26, 15, front=True)
    elif k == 'pine_crossing':
        for (dx, dy, w) in [(-22, -8, 16), (2, -16, 16), (22, -2, 14), (-10, 12, 18), (16, 18, 14)]:
            s += house(x + dx, y + dy, w, 10, 6, roof=('#9e5a3a', '#6f3a22'))
    elif k == 'smugglers_cave':
        # a rocky outcrop on the hill's west flank; the cave mouth is barred with iron
        out = [(x - 34, y + 12), (x - 36, y - 2), (x - 26, y - 16), (x - 8, y - 28), (x + 12, y - 32), (x + 32, y - 24), (x + 46, y - 8), (x + 44, y + 12)]
        s += shadow_poly(out, 6, 5, .4)
        s += '<polygon points="' + ' '.join(f'{f(a)},{f(b)}' for a, b in out) + '" fill="#57534a" stroke="#24211c" stroke-width="1.1" stroke-linejoin="round"/>'
        s += f'<polygon points="{x - 32},{y} {x - 24},{y - 14} {x - 7},{y - 26} {x + 12},{y - 30} {x + 4},{y - 16} {x - 14},{y - 8} {x - 26},{y + 6}" fill="#a6a093"/>'
        s += f'<polygon points="{x + 12},{y - 30} {x + 31},{y - 22} {x + 44},{y - 7} {x + 24},{y - 10} {x + 4},{y - 16}" fill="#7f796e"/>'
        s += f'<polygon points="{x + 24},{y - 10} {x + 44},{y - 7} {x + 43},{y + 11} {x + 18},{y + 8}" fill="#46423b"/>'
        s += f'<path d="M{x - 6} {y - 24} q6 -5 14 -3 M{x + 14} {y - 30} q5 2 8 6" stroke="#5e7f33" stroke-width="3" fill="none" stroke-linecap="round"/>'
        s += rock(x - 36, y + 10, 6, rng) + rock(x + 40, y + 14, 6, rng)
        s += f'<path d="M{x - 11} {y + 12} L{x - 11} {y} C{x - 11} {y - 11} {x + 11} {y - 11} {x + 11} {y} L{x + 11} {y + 12} Z" fill="#0e0b09" stroke="#24211c" stroke-width="1.4"/>'
        for bx in (-7, -2.5, 2.5, 7):
            s += f'<path d="M{x + bx} {y - 7} V{y + 12}" stroke="#a39d93" stroke-width="1.7"/>'
        s += f'<path d="M{x - 10.5} {y + 3} H{x + 10.5}" stroke="#a39d93" stroke-width="1.7"/>'
        s += f'<g transform="translate({x - 3.4} {y + 4})"><rect x="0" y="0" width="6.8" height="5.6" rx=".8" fill="#e0d3b0" stroke="#140c08" stroke-width=".8"/><path d="M1.3 0 v-2 a2.1 2.1 0 0 1 4.2 0 v2" stroke="#e0d3b0" stroke-width="1.2" fill="none"/></g>'
    elif k == 'broken_bridge':
        # stone spans from each bank, the middle fallen in; planks in the water
        for (x1, y1, x2, y2) in [(x - 30, y + 3, x - 7, y - 1), (x + 8, y - 3, x + 30, y - 7)]:
            s += f'<path d="M{x1} {y1 + 5} L{x2} {y2 + 5}" stroke="#15200b" stroke-width="9" opacity=".35" stroke-linecap="round"/>'
            s += f'<path d="M{x1} {y1} L{x2} {y2}" stroke="#2a2620" stroke-width="11"/>'
            s += f'<path d="M{x1} {y1} L{x2} {y2}" stroke="#9a9386" stroke-width="8.4"/>'
            s += f'<path d="M{x1} {y1 - 2.6} L{x2} {y2 - 2.6}" stroke="#c4bdae" stroke-width="2"/>'
            s += f'<path d="M{x1} {y1 + 3} L{x2} {y2 + 3}" stroke="#6c665c" stroke-width="2"/>'
        s += f'<path d="M{x - 7} {y - 6} l-3 4 l4 1 l-2 4 l3 1" stroke="#2a2620" stroke-width="1.6" fill="#9a9386"/>'
        s += f'<path d="M{x + 8} {y - 8} l2 4 l-4 1 l3 3 l-2 2" stroke="#2a2620" stroke-width="1.6" fill="#9a9386"/>'
        s += f'<path d="M{x - 3} {y + 9} l7 2 M{x + 2} {y + 14} l6 -3" stroke="#6e5234" stroke-width="2.4" stroke-linecap="round"/>'
        s += f'<circle cx="{x - 1}" cy="{y + 4}" r="2.4" fill="#8a847a" stroke="#2a2620" stroke-width=".8"/>'
    elif k == 'border_fortress':
        s += f'<rect x="{x - 30}" y="{y - 18}" width="60" height="30" fill="url(#f64w-stone)" opacity=".9"/>'
        s += shadow_poly([(x - 34, y + 12), (x + 34, y + 12), (x + 40, y + 17), (x - 28, y + 17)], 0, 0, .4)
        s += f'<path d="M{x - 32} {y + 12} V{y - 16} H{x + 32} V{y + 12}" fill="none" stroke="#2a2620" stroke-width="6"/>'
        s += f'<path d="M{x - 32} {y + 12} V{y - 16} H{x + 32} V{y + 12}" fill="none" stroke="#9a9386" stroke-width="4"/>'
        s += f'<rect x="{x - 32}" y="{y + 6}" width="64" height="8" fill="#7a746a" stroke="#2a2620" stroke-width=".9"/>'
        s += f'<rect x="{x - 5}" y="{y + 7}" width="10" height="7" fill="#1d1a16"/>'
        s += stone_tower(x - 32, y + 14, 22, 12) + stone_tower(x + 32, y + 14, 22, 12) + stone_tower(x, y - 2, 30, 18)
        s += flag(x, y - 36, 16, ('#5a6b8a', '#d9ccab'), w=12)
    elif k == 'rodericks_camp':
        s += tent(x - 14, y + 2, 9, col=('#d8c79a', '#a8966a', '#5a4a30')) + tent(x + 8, y - 6, 9, col=('#d8c79a', '#a8966a', '#5a4a30')) + tent(x - 2, y + 14, 7)
        s += fire(x + 14, y + 10)
        s += flag(x - 26, y + 6, 26, ('#6d7a3a', '#c9a24a'))
    return s


def farm(x, y, flip=False):
    """A farmstead with its fields."""
    s = f'<ellipse cx="{x}" cy="{y}" rx="22" ry="13" fill="#8a7448" opacity=".45" filter="url(#f64w-blurS)"/>'
    s += house(x - 8, y + 2, 14, 9, 5)
    s += house(x + 9, y - 3, 18, 11, 8, roof=('#7d6a50', '#5a4a36'), wall=('#a8946c', '#8a7550'))
    s += f'<circle cx="{x + 4}" cy="{y + 9}" r="3.6" fill="#d8bb62" stroke="#6a5424" stroke-width=".8"/><circle cx="{x + 3}" cy="{y + 8}" r="1.6" fill="#ead07c"/>'
    s += f'<path d="M{x - 20} {y + 12} H{x + 22}" stroke="#6e5234" stroke-width="1.2" stroke-dasharray="3 2"/>'
    return s


FARMS = [(586, 432), (318, 322), (872, 650), (716, 452), (270, 448), (196, 330)]
farms_svg = ''.join(farm(x, y) for x, y in FARMS)
places_svg = farms_svg + ''.join(place_art(k) for k in sorted(P, key=lambda k: P[k][1]))

# signpost to Thornwood on the east road
sign = f'''<g transform="translate(1180 600)">
<ellipse cx="3" cy="40" rx="6" ry="2.4" fill="#15200b" opacity=".5"/>
<path d="M0 40 V-4" stroke="#24170c" stroke-width="5"/><path d="M-.8 40 V-4" stroke="#8a6545" stroke-width="2"/>
<path d="M-6 -2 H74 L84 9 L74 20 H-6 Z" fill="#5e412b" stroke="#170f0a" stroke-width="1.4"/>
<path d="M-6 -2 H74 L84 9" fill="none" stroke="#8a6545" stroke-width="1" opacity=".8"/>
<circle cx="-1" cy="9" r="1.8" fill="#8f8981" stroke="#141313" stroke-width=".6"/>
<text x="38" y="14" text-anchor="middle" font-family="Alegreya SC" font-weight="800" font-size="14" fill="#efe6d0" style="letter-spacing:.03em">Thornwood</text>
</g>'''

# company: three miniatures under the standard, in camp
cxp, cyp = P['frontier_camp']
company = f'''<g>
<ellipse cx="{cxp + 2}" cy="{cyp + 8}" rx="34" ry="9" fill="#15200b" opacity=".4"/>
<image href="{B('board_marcus')}" x="{cxp - 36}" y="{cyp - 38}" width="31" height="45"/>
<image href="{B('board_lilina')}" x="{cxp + 10}" y="{cyp - 38}" width="31" height="45"/>
<image href="{B('board_roy')}" x="{cxp - 13}" y="{cyp - 34}" width="31" height="45"/>
<g transform="translate({cxp + 3} {cyp - 30}) scale(1.22)">
 <path d="M0 0 V-46" stroke="#170f0a" stroke-width="3.6"/><path d="M-.6 0 V-46" stroke="#9a7650" stroke-width="1.4"/>
 <path d="M-3 -46 H3 L0 -53 Z" fill="#8f8981" stroke="#141313" stroke-width=".7"/>
 <path d="M1 -44 H30 V-16 L24 -21 L18 -14 L12 -21 L6 -14 L1 -18 Z" fill="#a9342a" stroke="#1a0e0a" stroke-width="1.1" stroke-linejoin="round"/>
 <path d="M1 -44 H30 V-38 H1 Z" fill="#2c4c78"/>
 <path d="M8 -26 L15.5 -35 L23 -26" fill="none" stroke="#efe6d0" stroke-width="2.6" stroke-linejoin="round"/>
 <path d="M1 -44 H30" stroke="#5b5752" stroke-width="2"/>
</g>
</g>'''

