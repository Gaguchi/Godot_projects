"""Painted-terrain helpers shared by the map and combat boards (SVG strings)."""
import math
import random


def f(v):
    """Format a float for SVG."""
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def pip(pt, poly):
    """Point-in-polygon test."""
    x, y = pt
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            inside = not inside
        j = i
    return inside


def catmull(points, closed=False):
    """Smooth path through points (Catmull-Rom -> cubic Bezier)."""
    pts = list(points)
    if closed:
        pts = [pts[-1]] + pts + [pts[0], pts[1]]
    else:
        pts = [pts[0]] + pts + [pts[-1]]
    d = f'M{f(pts[1][0])} {f(pts[1][1])}'
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f' C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}'
    if closed:
        d += 'Z'
    return d


def sample_catmull(points, n=12):
    """Sample points along a Catmull-Rom curve."""
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(points[-1])
    return out


def quad(a, b, bend):
    """The control point that bends a road between two places."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1
    px, py = -dy / L, dx / L
    c = ((a[0] + b[0]) / 2 + px * bend, (a[1] + b[1]) / 2 + py * bend)
    return c


def quad_pts(a, b, c, n=24):
    """Points along a quadratic road."""
    out = []
    for k in range(n + 1):
        t = k / n
        x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0]
        y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]
        out.append((x, y))
    return out


def dist_to_pts(p, pts):
    """Distance from a point to the nearest of a set."""
    return min(math.hypot(p[0] - q[0], p[1] - q[1]) for q in pts)


def scatter(poly, mind, rng, tries=4000, reject=None):
    """Poisson-ish scatter of points in a polygon."""
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    out = []
    for _ in range(tries):
        p = (rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys)))
        if not pip(p, poly):
            continue
        if reject and reject(p):
            continue
        if any((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < mind * mind for q in out):
            continue
        out.append(p)
    return out


# ---- trees -------------------------------------------------------------
LEAF = [  # (base, mid, lit, top)
    ('#2c4518', '#43632a', '#638638', '#9fb85e'),
    ('#31491a', '#4a6a2b', '#6c8f3e', '#a9c066'),
    ('#2a4117', '#3d5b25', '#5a7c32', '#93ad52'),
    ('#384c1c', '#536c2b', '#789342', '#b3c46c'),
    ('#2f4719', '#46672c', '#5f8a3a', '#98b65a'),
]
PINE = [('#1d3324', '#2b4a33', '#3f6444', '#5d8357'), ('#1b3022', '#284530', '#3a5e40', '#557b50')]


def tree_shadow(x, y, r):
    """A tree's cast shadow."""
    return f'<ellipse cx="{f(x + r * 0.55)}" cy="{f(y + r * 0.55)}" rx="{f(r * 1.1)}" ry="{f(r * 0.85)}" fill="#14240b" opacity=".42"/>'


def tree(x, y, r, rng):
    """A painted broadleaf crown."""
    b, m, l, t = LEAF[rng.randrange(len(LEAF))]
    jx, jy = rng.uniform(-.08, .08) * r, rng.uniform(-.08, .08) * r
    s = f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{b}"/>'
    s += f'<circle cx="{f(x - r * .14 + jx)}" cy="{f(y - r * .16 + jy)}" r="{f(r * .84)}" fill="{m}"/>'
    s += f'<circle cx="{f(x - r * .3 + jx)}" cy="{f(y - r * .34 + jy)}" r="{f(r * .55)}" fill="{l}"/>'
    s += f'<circle cx="{f(x - r * .42 + jx)}" cy="{f(y - r * .48 + jy)}" r="{f(r * .26)}" fill="{t}" opacity=".55"/>'
    return s


def pine(x, y, r, rng):
    """A painted pine."""
    b, m, l, t = PINE[rng.randrange(len(PINE))]
    n = 8
    pts = []
    for i in range(n * 2):
        a = math.pi * i / n + rng.uniform(-.12, .12)
        rr = r if i % 2 == 0 else r * 0.62
        pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
    P = ' '.join(f'{f(px)},{f(py)}' for px, py in pts)
    s = f'<polygon points="{P}" fill="{b}"/>'
    s += f'<circle cx="{f(x - r * .15)}" cy="{f(y - r * .15)}" r="{f(r * .62)}" fill="{m}"/>'
    s += f'<circle cx="{f(x - r * .3)}" cy="{f(y - r * .32)}" r="{f(r * .36)}" fill="{l}"/>'
    s += f'<circle cx="{f(x - r * .38)}" cy="{f(y - r * .42)}" r="{f(r * .15)}" fill="{t}"/>'
    return s


def forest(points, kind, rng, rmin=7, rmax=12):
    """Layer by pass, not by tree, so crowns merge into one canopy with lit tops and a dark shadowed rim."""
    trees = []
    for (x, y) in sorted(points, key=lambda p: p[1]):
        r = rng.uniform(rmin, rmax)
        pal = (PINE if kind == 'pine' else LEAF)[rng.randrange(len(PINE if kind == 'pine' else LEAF))]
        jx, jy = rng.uniform(-.1, .1) * r, rng.uniform(-.1, .1) * r
        trees.append((x, y, r, pal, jx, jy))
    sh = ''.join(tree_shadow(x, y, r) for x, y, r, *_ in trees)
    out = []
    if kind == 'pine':
        for x, y, r, pal, jx, jy in trees:
            n = 8
            pts = []
            for i in range(n * 2):
                a = math.pi * i / n + rng.uniform(-.12, .12)
                rr = r * 1.08 if i % 2 == 0 else r * 0.66
                pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
            out.append('<polygon points="' + ' '.join(f'{f(px)},{f(py)}' for px, py in pts) + f'" fill="{pal[0]}"/>')
    else:
        out += [f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * 1.08)}" fill="{pal[0]}"/>' for x, y, r, pal, jx, jy in trees]
    out += [f'<circle cx="{f(x - r * .14 + jx)}" cy="{f(y - r * .16 + jy)}" r="{f(r * .8)}" fill="{pal[1]}"/>' for x, y, r, pal, jx, jy in trees]
    out += [f'<circle cx="{f(x - r * .3 + jx)}" cy="{f(y - r * .34 + jy)}" r="{f(r * .52)}" fill="{pal[2]}"/>' for x, y, r, pal, jx, jy in trees]
    out += [f'<circle cx="{f(x - r * .42 + jx)}" cy="{f(y - r * .48 + jy)}" r="{f(r * .24)}" fill="{pal[3]}" opacity=".6"/>' for x, y, r, pal, jx, jy in trees if rng.random() < .8]
    return sh, ''.join(out)


_hid = [0]


def hill(cx, cy, rx, ry, lit=.72, shade=.62, fid='f64w-blurHill', rot=0):
    """A rolling mound: one ellipse filled with a NW-lit / SE-shaded gradient, edges softened."""
    _hid[0] += 1
    gid = f'f64w-hg{_hid[0]}'
    s = (f'<linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1">'
         f'<stop offset=".08" stop-color="#f4f0b2" stop-opacity="{lit}"/>'
         f'<stop offset=".36" stop-color="#dcdc8c" stop-opacity="{lit * .4}"/>'
         f'<stop offset=".5" stop-color="#2a4417" stop-opacity="0"/>'
         f'<stop offset=".72" stop-color="#1c3110" stop-opacity="{shade}"/>'
         f'<stop offset="1" stop-color="#16280c" stop-opacity="{shade}"/></linearGradient>')
    s += f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="url(#{gid})" filter="url(#{fid})" transform="rotate({rot} {f(cx)} {f(cy)})"/>'
    return s


def rock(cx, cy, s, rng, tone=('#a39d90', '#7a756b', '#555048', '#38342e')):
    """A painted boulder: lit top-left facet, dark lower-right."""
    n = 9
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-.2, .2)
        rr = s * rng.uniform(.78, 1.0)
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * .82))
    P = ' '.join(f'{f(x)},{f(y)}' for x, y in pts)
    lit, mid, dk, edge = tone
    out = f'<ellipse cx="{f(cx + s * .3)}" cy="{f(cy + s * .45)}" rx="{f(s * 1.05)}" ry="{f(s * .62)}" fill="#14200b" opacity=".38"/>'
    out += f'<polygon points="{P}" fill="{dk}" stroke="{edge}" stroke-width="1.2" stroke-linejoin="round"/>'
    # mid facet
    pts2 = [(cx + (x - cx) * .86 - s * .08, cy + (y - cy) * .82 - s * .1) for x, y in pts]
    out += '<polygon points="' + ' '.join(f'{f(x)},{f(y)}' for x, y in pts2) + f'" fill="{mid}"/>'
    pts3 = [(cx + (x - cx) * .55 - s * .25, cy + (y - cy) * .5 - s * .28) for x, y in pts]
    out += '<polygon points="' + ' '.join(f'{f(x)},{f(y)}' for x, y in pts3) + f'" fill="{lit}"/>'
    # a crack
    out += f'<path d="M{f(cx - s * .1)} {f(cy - s * .2)} L{f(cx + s * .15)} {f(cy + s * .15)} L{f(cx + s * .05)} {f(cy + s * .45)}" stroke="{edge}" stroke-width="1" fill="none" opacity=".6"/>'
    return out


def tuft(x, y, rng, c='#3d5a20', c2='#a9c264'):
    """A grass tuft."""
    s = ''
    for k in range(4):
        a = -math.pi / 2 + rng.uniform(-.7, .7)
        L = rng.uniform(4, 7)
        s += f'<path d="M{f(x)} {f(y)} l{f(math.cos(a) * L)} {f(math.sin(a) * L)}" stroke="{c if k % 2 else c2}" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>'
    return s
