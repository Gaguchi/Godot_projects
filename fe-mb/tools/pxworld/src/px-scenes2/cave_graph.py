"""Smuggler's Cave from above, painted in the map's family: flagged floors cut into living rock, lit from the
north-west like the Borderlands, daylight coming down the stair at the mouth. Rooms are chambers, edges are passages.
The graph is the real one (seed 36, probe_dungeon.mts). SVG ids are prefixed f64d-."""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import math
import random
import sys

sys.path.insert(0, ROOT + '/src/kit64')
from kit_px import B
from kit_paint import f, catmull, sample_catmull, rock

INK = '#17120e'

# ------------------------------------------------------------------ the graph (engine output, run seed 36)
ROOMS = {
    'r0c0': 'combat', 'r0c1': 'combat', 'r0c2': 'combat', 'r0c3': 'combat',
    'r1c1': 'rest', 'r1c3': 'event',
    'r2c1': 'combat', 'r2c2': 'elite',
    'r3c1': 'treasure', 'r3c2': 'combat', 'r3c3': 'rest',
    'r4c0': 'elite', 'r4c1': 'treasure', 'r4c2': 'combat', 'r4c3': 'combat',
    'r5c1': 'rest', 'r5c2': 'rest', 'r5c3': 'rest',
    'r6c0': 'boss',
}
EDGES = {'r0c0': ['r1c1'], 'r0c1': ['r1c1'], 'r0c2': ['r1c1', 'r1c3'], 'r0c3': ['r1c3'], 'r1c1': ['r2c1', 'r2c2'], 'r1c3': ['r2c2'],
         'r2c1': ['r3c1'], 'r2c2': ['r3c1', 'r3c2', 'r3c3'], 'r3c1': ['r4c0', 'r4c1', 'r4c2'], 'r3c2': ['r4c3'], 'r3c3': ['r4c3'],
         'r4c0': ['r5c1'], 'r4c1': ['r5c1'], 'r4c2': ['r5c1', 'r5c2'], 'r4c3': ['r5c2', 'r5c3'], 'r5c1': ['r6c0'], 'r5c2': ['r6c0'],
         'r5c3': ['r6c0'], 'r6c0': []}
WALKED = ['mouth', 'r0c2', 'r1c1', 'r2c2']
CLEARED = {'r0c2', 'r1c1', 'r2c2'}
HERE = 'r2c2'
REACH = ['r3c1', 'r3c2', 'r3c3']
HOVER = 'r3c2'

COLX = {0: 415, 1: 565, 2: 715, 3: 865}
ROW_Y0, ROW_DY = 132, 86
MOUTH = (640, 46)


def rc(rid):
    """(row, col) of a room id."""
    return int(rid[1]), int(rid[3])


def pos(rid):
    """Stage centre of a room."""
    if rid == 'mouth':
        return MOUTH
    r, c = rc(rid)
    if ROOMS[rid] == 'boss':
        return (640, ROW_Y0 + ROW_DY * r + 4)
    return (COLX[c], ROW_Y0 + ROW_DY * r)


def past(rid):
    """A room above the company's row that it did not walk through: passed by, out of reach for good."""
    return rid != 'mouth' and rc(rid)[0] <= rc(HERE)[0] and rid not in WALKED


def edge_d(a, b):
    """A passage between two rooms, the game's own bend (0.55 of a row)."""
    (x1, y1), (x2, y2) = pos(a), pos(b)
    bend = ROW_DY * .55
    return f'M{x1} {y1} C{x1} {f(y1 + bend)} {x2} {f(y2 - bend)} {x2} {y2}'


def edge_pts(a, b, n=40):
    """Points along a passage (cubic)."""
    (x1, y1), (x2, y2) = pos(a), pos(b)
    bend = ROW_DY * .55
    c1, c2 = (x1, y1 + bend), (x2, y2 - bend)
    out = []
    for k in range(n + 1):
        t = k / n
        u = 1 - t
        out.append((u ** 3 * x1 + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * x2,
                    u ** 3 * y1 + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * y2))
    return out


ALL_EDGES = [('mouth', r) for r in ROOMS if r.startswith('r0')] + [(a, b) for a, bs in EDGES.items() for b in bs]


def passage_pts(a, b, rng, w=15):
    """A passage as a closed outline: the cubic centre line, wobbled sideways, with a width that swells and pinches."""
    pts = edge_pts(a, b, 18)
    ph, ph2 = rng.uniform(0, 6.3), rng.uniform(0, 6.3)
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        j0, j1 = max(i - 1, 0), min(i + 1, len(pts) - 1)
        dx, dy = pts[j1][0] - pts[j0][0], pts[j1][1] - pts[j0][1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        t = i / (len(pts) - 1)
        wob = 2.0 * math.sin(t * 7.5 + ph) * math.sin(t * math.pi)
        hw = w / 2 * (1 + .22 * math.sin(t * 9 + ph2))
        cx, cy = x + nx * wob, y + ny * wob
        left.append((cx + nx * hw, cy + ny * hw))
        right.append((cx - nx * hw, cy - ny * hw))
    return left + right[::-1]


def chamber_pts(rid, rng):
    """The outline of a chamber: an irregular cut blob."""
    x, y = pos(rid)
    rx, ry = (76, 38) if ROOMS.get(rid) == 'boss' else (44, 27)
    if rid == 'mouth':
        rx, ry = 40, 22
    n = 13
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-.14, .14)
        k = rng.uniform(.82, 1.08)
        pts.append((x + math.cos(a) * rx * k, y + math.sin(a) * ry * k))
    return pts


def scene():
    rng = random.Random(36)
    shapes = {rid: chamber_pts(rid, rng) for rid in list(ROOMS) + ['mouth']}
    tunnels = [passage_pts(a, b, rng, 11 if a == 'mouth' else 9) for a, b in ALL_EDGES]
    paths = [catmull(p, closed=True) for p in tunnels] + [catmull(p, closed=True) for p in shapes.values()]

    def floor_shapes(fill, stroke, grow=0):
        sw = f'stroke="{stroke}" stroke-width="{grow}" stroke-linejoin="round"' if grow else 'stroke="none"'
        s = ''.join(f'<path d="{d}" fill="{fill}" {sw}/>' for d in paths)
        # the stair up to daylight
        s += f'<path d="M640 46 L640 -10" stroke="{fill}" stroke-width="{34 + grow}" fill="none"/>'
        return s

    out = []
    A = out.append
    A(f'''<defs>
<pattern id="f64d-flags" patternUnits="userSpaceOnUse" width="64" height="64"><image href="{B('tex_stone')}" width="64" height="64"/></pattern>
<pattern id="f64d-rockt" patternUnits="userSpaceOnUse" width="128" height="128"><image href="{B('tex_stone')}" width="128" height="128"/></pattern>
<pattern id="f64d-grass" patternUnits="userSpaceOnUse" width="128" height="128"><image href="{B('tex_grass')}" width="128" height="128"/></pattern>
<pattern id="f64d-water" patternUnits="userSpaceOnUse" width="128" height="128"><image href="{B('tex_water')}" width="128" height="128"/></pattern>
<filter id="f64d-floor" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix values="1.3 0 0 0 .1  0 1.2 0 0 .08  0 0 1.0 0 .05  0 0 0 1 0"/></filter>
<filter id="f64d-rockTint" x="0" y="0" width="100%" height="100%"><feColorMatrix values=".22 .22 .1 0 .2  .2 .22 .1 0 .17  .18 .18 .1 0 .13  0 0 0 1 0"/></filter>
<filter id="f64d-lump" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="7"/>
<feColorMatrix values="0 0 0 0 .78  0 0 0 0 .73  0 0 0 0 .64  2.4 0 0 0 -1.15"/></filter>
<filter id="f64d-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3"/>
<feColorMatrix values="0 0 0 0 .2  0 0 0 0 .17  0 0 0 0 .14  2.2 0 0 0 -1.0"/></filter>
<filter id="f64d-dark" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="3" seed="19"/>
<feColorMatrix values="0 0 0 0 .1  0 0 0 0 .08  0 0 0 0 .07  2.6 0 0 0 -1.25"/></filter>
<filter id="f64d-wTint" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feColorMatrix values=".2 0 0 0 .04  0 .27 0 0 .06  0 0 .3 0 .07  0 0 0 1 0"/></filter>
<filter id="f64d-sun" x="0" y="0" width="100%" height="100%"><feColorMatrix values="1.46 0 0 0 .02  0 1.38 0 0 .02  0 0 1.05 0 0  0 0 0 1 0"/></filter>
<filter id="f64d-b2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter>
<filter id="f64d-b5" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="f64d-b12" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
<mask id="f64d-nwShade" maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720"><rect width="1280" height="720" fill="#000"/>
<g>{floor_shapes('#fff', '#fff')}</g><g transform="translate(9 11)">{floor_shapes('#000', '#000')}</g></mask>
<mask id="f64d-seLip" maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720"><rect width="1280" height="720" fill="#000"/>
<g transform="translate(3 4)">{floor_shapes('#fff', '#fff', 4)}</g><g>{floor_shapes('#000', '#000', 2)}</g></mask>
<mask id="f64d-floorM" maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720"><rect width="1280" height="720" fill="#000"/><g>{floor_shapes('#fff', '#fff')}</g></mask>
<filter id="f64d-moss" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="21"/>
<feColorMatrix values="0 0 0 0 .32  0 0 0 0 .42  0 0 0 0 .16  3 0 0 0 -1.5"/></filter>
<radialGradient id="f64d-mossG" cx="640" cy="0" r="330" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
<mask id="f64d-mossM" maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720"><rect width="1280" height="260" fill="url(#f64d-mossG)"/></mask>
<linearGradient id="f64d-day" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d8" stop-opacity=".5"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></linearGradient>
<linearGradient id="f64d-deep" x1="0" y1="0" x2="0" y2="1"><stop offset=".25" stop-color="#0e0b09" stop-opacity="0"/><stop offset="1" stop-color="#0e0b09" stop-opacity=".26"/></linearGradient>
</defs>''')

    # ---- living rock: the stone texture knocked back to a warm grey, lumped and cracked
    A('<rect width="1280" height="720" fill="#5d564d"/>')
    A('<rect width="1280" height="720" filter="url(#f64d-lump)" opacity=".3"/>')
    A('<rect width="1280" height="720" filter="url(#f64d-grain)" opacity=".5"/>')
    A('<rect width="1280" height="720" filter="url(#f64d-dark)" opacity=".26"/>')
    # rock swells: NW-lit, SE-shaded, crisp enough to read as stone and not as cloud
    for _ in range(46):
        x, y, r = rng.uniform(-20, 1300), rng.uniform(-20, 740), rng.uniform(22, 44)
        pts = [(x + math.cos(a) * r * rng.uniform(.75, 1.05), y + math.sin(a) * r * .72 * rng.uniform(.75, 1.05)) for a in [i * math.pi / 4 for i in range(8)]]
        d = catmull(pts, closed=True)
        A(f'<path d="{d}" fill="#2b2520" opacity=".2" transform="translate({f(r * .2)} {f(r * .24)})" filter="url(#f64d-b5)"/>')
        A(f'<path d="{d}" fill="#665e54" opacity=".4"/>')
        A(f'<path d="{d}" fill="#9a907f" opacity=".16" transform="translate({f(x * .18 - r * .14)} {f(y * .18 - r * .16)}) scale(.82)"/>')
    # cracks
    for _ in range(46):
        x, y = rng.uniform(0, 1280), rng.uniform(0, 720)
        d = f'M{f(x)} {f(y)}'
        a = rng.uniform(0, math.pi * 2)
        for _ in range(rng.randint(3, 6)):
            a += rng.uniform(-.8, .8)
            x, y = x + math.cos(a) * rng.uniform(6, 14), y + math.sin(a) * rng.uniform(6, 14)
            d += f' L{f(x)} {f(y)}'
        A(f'<path d="{d}" fill="none" stroke="#2a241f" stroke-width="1.2" opacity=".55"/><path d="{d}" fill="none" stroke="#a69d8d" stroke-width=".8" opacity=".3" transform="translate(1 1)"/>')
    for _ in range(22):
        A(rock(rng.uniform(0, 1280), rng.uniform(0, 720), rng.uniform(4, 9), rng, tone=('#a59c8c', '#7c7366', '#5a5249', '#2e2823')))

    # ---- the surface at the top: sunlit grass where the stair comes out
    A('<path d="M520 -4 C560 14 600 20 640 18 C690 16 730 12 768 -4 Z" fill="url(#f64d-grass)" filter="url(#f64d-sun)"/>')
    A('<path d="M520 -4 C560 14 600 20 640 18 C690 16 730 12 768 -4" fill="none" stroke="#2b3a17" stroke-width="2"/>')

    # ---- the cut floor: ink edge, flags, the NW wall's shadow on the floor, the SE wall face catching light
    A(f'<g>{floor_shapes(INK, INK, 4)}</g>')
    A(f'<g filter="url(#f64d-floor)">{floor_shapes("url(#f64d-flags)", "url(#f64d-flags)")}</g>')
    A('<rect width="1280" height="720" fill="#b09a78" mask="url(#f64d-floorM)" opacity=".16"/>')
    A('<rect width="1280" height="720" fill="#1a1410" mask="url(#f64d-nwShade)" opacity=".42" filter="url(#f64d-b2)"/>')
    A('<rect width="1280" height="720" fill="#b7ad9a" mask="url(#f64d-seLip)" opacity=".75"/>')
    # rubble heaped against the walls, outside each chamber (on the rock), lit from the north-west
    for rid, pts in shapes.items():
        if rid == 'mouth':
            continue
        x0, y0 = pos(rid)
        for _ in range(4):
            px, py = rng.choice(pts)
            dx, dy = px - x0, py - y0
            L = math.hypot(dx, dy) or 1
            A(rock(px + dx / L * 7, py + dy / L * 6, rng.uniform(3.5, 6.5), rng, tone=('#b1a795', '#857b6c', '#5d554b', '#2a241f')))
    A('<rect width="1280" height="260" filter="url(#f64d-moss)" opacity=".55" mask="url(#f64d-mossM)"/>')
    # daylight falling down the stair and into the entry hall
    A('<rect x="560" y="0" width="160" height="150" fill="url(#f64d-day)" mask="url(#f64d-floorM)"/>')
    for k in range(5):
        y = 4 + k * 8
        A(f'<path d="M{626 - k} {y} H{654 + k}" stroke="#2a221b" stroke-width="1.6" opacity=".55"/><path d="M{626 - k} {y + 1.6} H{654 + k}" stroke="#efe6d0" stroke-width="1" opacity=".45"/>')

    # ---- a black pool where the seep collects, between the rest and the passages
    pool = [(812, 288), (842, 276), (880, 280), (902, 296), (892, 316), (858, 322), (824, 314)]
    A(f'<path d="{catmull(pool, closed=True)}" fill="#2b2622" transform="translate(2 3)" opacity=".6"/>')
    A(f'<path d="{catmull(pool, closed=True)}" fill="url(#f64d-water)" filter="url(#f64d-wTint)" stroke="{INK}" stroke-width="1.6"/>')
    A(f'<path d="M830 292 q10 -4 20 0 M856 304 q8 -3 16 0" stroke="#d9ecea" stroke-width="1" fill="none" opacity=".4"/>')

    # deeper is a little darker, never a void
    A('<rect width="1280" height="720" fill="url(#f64d-deep)"/>')
    return '<svg class="abs" style="left:0;top:0" width="1280" height="720" viewBox="0 0 1280 720" aria-hidden="true">' + ''.join(out) + '</svg>'


# ------------------------------------------------------------------ props on the floors (smuggled cargo, a cold bedroll)
def crate(x, y, w=16, h=11, d=6):
    """A small crate seen from above at an angle."""
    s = f'<polygon points="{f(x + 3)},{f(y + 2)} {f(x + w + d + 3)},{f(y - d + 4)} {f(x + w + d + 6)},{f(y + 4)} {f(x + w + 3)},{f(y + 5)}" fill="#14100c" opacity=".45"/>'
    s += f'<polygon points="{f(x)},{f(y - h)} {f(x + d)},{f(y - h - d * .7)} {f(x + w + d)},{f(y - h - d * .7)} {f(x + w)},{f(y - h)}" fill="#a07a52" stroke="{INK}" stroke-width=".9"/>'
    s += f'<polygon points="{f(x + w)},{f(y - h)} {f(x + w + d)},{f(y - h - d * .7)} {f(x + w + d)},{f(y - d * .7)} {f(x + w)},{f(y)}" fill="#5e4530" stroke="{INK}" stroke-width=".9"/>'
    s += f'<rect x="{f(x)}" y="{f(y - h)}" width="{w}" height="{h}" fill="#7b5b3c" stroke="{INK}" stroke-width=".9"/>'
    s += f'<path d="M{f(x + 2)} {f(y - 2)} L{f(x + w - 2)} {f(y - h + 2)}" stroke="#5e4530" stroke-width="1.4"/>'
    return s


def barrel(x, y, r=6):
    """A small barrel from above: a lit top disc."""
    s = f'<ellipse cx="{f(x + 2)}" cy="{f(y + 3)}" rx="{r + 1}" ry="{f(r * .7)}" fill="#14100c" opacity=".45"/>'
    s += f'<rect x="{f(x - r)}" y="{f(y - r * 1.2)}" width="{2 * r}" height="{f(r * 1.4)}" fill="#5e4530" stroke="{INK}" stroke-width=".9"/>'
    s += f'<ellipse cx="{f(x)}" cy="{f(y - r * 1.2)}" rx="{r}" ry="{f(r * .45)}" fill="#9a7650" stroke="{INK}" stroke-width=".9"/>'
    return s


def bedroll(x, y):
    """A cold bedroll and a ring of dead embers: a rest room."""
    s = f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="7" ry="3.4" fill="#2a221b" stroke="#7c7366" stroke-width="1.6"/>'
    s += f'<rect x="{f(x + 10)}" y="{f(y - 6)}" width="22" height="9" rx="4.5" fill="#6d7a3a" stroke="{INK}" stroke-width=".9"/>'
    return s


def chest(x, y):
    """A strongbox: a treasure room."""
    s = f'<rect x="{f(x + 2)}" y="{f(y - 6)}" width="22" height="10" fill="#14100c" opacity=".4"/>'
    s += f'<rect x="{f(x)}" y="{f(y - 12)}" width="20" height="12" fill="#7b5b3c" stroke="{INK}" stroke-width="1"/>'
    s += f'<path d="M{f(x)} {f(y - 12)} q10 -7 20 0" fill="#9a7650" stroke="{INK}" stroke-width="1"/>'
    s += f'<path d="M{f(x + 5)} {f(y - 15)} V{f(y)} M{f(x + 15)} {f(y - 15)} V{f(y)}" stroke="#bf8c38" stroke-width="1.6"/>'
    return s


def rag_flag(x, y, h=30):
    """The crew's ragged black flag on a pole; foot at (x, y)."""
    s = f'<ellipse cx="{x + 2}" cy="{y + 1}" rx="3" ry="1.4" fill="#14100c" opacity=".5"/>'
    s += f'<path d="M{x} {y} V{y - h}" stroke="#24170c" stroke-width="2.8"/><path d="M{x - .5} {y} V{y - h}" stroke="#8a6545" stroke-width="1"/>'
    t = y - h + 2
    s += (f'<path d="M{x + 1} {t} H{x + 19} L{x + 15} {t + 4} L{x + 19} {t + 8} L{x + 14} {t + 11} L{x + 18} {t + 15} H{x + 1} Z" '
          f'fill="#1b1714" stroke="#0e0a08" stroke-width=".8"/>')
    s += f'<path d="M{x + 4} {t + 4} L{x + 11} {t + 11} M{x + 11} {t + 4} L{x + 4} {t + 11}" stroke="#d9ccab" stroke-width="1.6"/>'
    return s


PROPS = {
    'r0c0': lambda x, y: crate(x - 40, y + 10) + barrel(x + 34, y - 6),
    'r0c1': lambda x, y: barrel(x - 32, y + 8) + barrel(x - 22, y + 12, 5),
    'r0c3': lambda x, y: crate(x + 22, y + 14) + crate(x + 26, y + 2, 14, 9, 5),
    'r1c1': lambda x, y: bedroll(x - 38, y + 10),
    'r2c1': lambda x, y: crate(x - 38, y + 12),
    'r3c1': lambda x, y: chest(x + 20, y + 16),
    'r3c2': lambda x, y: crate(x - 40, y + 14) + barrel(x + 32, y - 8),
    'r3c3': lambda x, y: bedroll(x - 40, y + 10),
    'r4c0': lambda x, y: crate(x - 38, y + 12) + crate(x + 22, y + 14),
    'r4c1': lambda x, y: chest(x + 20, y + 16),
    'r4c2': lambda x, y: barrel(x + 32, y + 8),
    'r4c3': lambda x, y: crate(x - 40, y + 10),
    'r5c1': lambda x, y: bedroll(x - 40, y + 8),
    'r5c2': lambda x, y: bedroll(x + 8, y + 14),
    'r5c3': lambda x, y: bedroll(x - 40, y + 10),
    'r6c0': lambda x, y: rag_flag(x + 22, y - 2) + crate(x - 64, y + 16) + crate(x - 60, y + 4, 14, 9, 5) + barrel(x + 56, y + 10) + barrel(x + 64, y - 2, 5) + crate(x + 40, y + 22),
}


def props():
    """Cargo and kit on the chamber floors, as one SVG layer."""
    out = ''.join(fn(*pos(rid)) for rid, fn in PROPS.items())
    return '<svg class="abs" style="left:0;top:0" width="1280" height="720" viewBox="0 0 1280 720" aria-hidden="true">' + out + '</svg>'
