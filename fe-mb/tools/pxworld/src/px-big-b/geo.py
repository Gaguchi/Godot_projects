"""Plane geometry for the open map: copied from dirs/hyb-64/paint.py (pip, sample_catmull, quad, quad_pts,
scatter) plus polyline helpers, so this folder never imports hyb-64 at render time."""
import math


def pip(pt, poly):
    """Point in polygon (even-odd)."""
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


def sample_catmull(points, n=12):
    """A Catmull-Rom spline through points, n samples per span (the river's course)."""
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                       + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                       + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(points[-1])
    return out


def quad(a, b, bend):
    """The control point of a road from a to b bowed `bend` px to its left (screen y down)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1
    px, py = -dy / L, dx / L
    return ((a[0] + b[0]) / 2 + px * bend, (a[1] + b[1]) / 2 + py * bend)


def quad_pts(a, b, c, n=24):
    out = []
    for k in range(n + 1):
        t = k / n
        out.append(((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
                    (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]))
    return out


def scatter(poly, mind, rng, tries=4000, reject=None):
    """Poisson-ish points inside poly, at least mind apart."""
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


def poly_len(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def resample(pts, step=2.0):
    """The polyline at an even spacing (for beads, crossings and terrain sampling)."""
    out = [pts[0]]
    acc = 0.0
    for i in range(1, len(pts)):
        a, b = pts[i - 1], pts[i]
        L = math.dist(a, b)
        t = step - acc
        while t <= L:
            out.append((a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L))
            t += step
        acc = (acc + L) % step
    if out[-1] != pts[-1]:
        out.append(pts[-1])
    return out


def seg_x(p1, p2, p3, p4):
    """Do segments p1p2 and p3p4 properly cross?"""
    def o(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    d1, d2, d3, d4 = o(p3, p4, p1), o(p3, p4, p2), o(p1, p2, p3), o(p1, p2, p4)
    return (d1 > 0) != (d2 > 0) and (d3 > 0) != (d4 > 0)


def dist_pt_poly(p, pts):
    best = 1e9
    for i in range(len(pts) - 1):
        ax, ay = pts[i]; bx, by = pts[i + 1]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy or 1e-9
        t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L2))
        best = min(best, math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy))
    return best
