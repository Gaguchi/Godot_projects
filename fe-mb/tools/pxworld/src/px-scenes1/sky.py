"""The title's far distance: a daylight sky with cumulus, two ranges of hills under it, a belt of woods along the
horizon. All in pal ramps; aerial perspective is done by ramp choice (the farthest ridge in Slate, the nearer hills
in Pine, the woods in Leaf), never by blending."""
import math
import random

import numpy as np
from scipy import ndimage

import cpx
import persp as P
from cpx import pal, ix, CLEAR, nb, poisson
from pxworld import trees as TS
from pxworld.terrain import majority

LIGHT = np.array([-.55, -.7, .55])
LIGHT /= np.linalg.norm(LIGHT)


def sky(a, seed=1):
    """Two hard bands of sky (s4 above, s5 toward the horizon) with a stepped, wavering seam."""
    Hh, Ww = a.shape
    rng = random.Random(seed)
    xs = np.arange(Ww)
    seam = 150 + 12 * np.sin(xs / 170 + 1.3) + 5 * np.sin(xs / 53 + .4)
    seam = np.round(seam / 2) * 2                      # steps of 2 px: a run-length seam, never a single-px jag
    for x in range(Ww):
        a[:int(seam[x]), x] = ix('s4')
        a[int(seam[x]):P.YH + 1, x] = ix('s5')
    return seam


def cloud(w, h, seed=0, flat=.72):
    """A cumulus: puffs along a flat base, bigger toward the middle; lit as domes from the upper left in three
    tones (b5 lit, b4 body, s5 the cool underside), leaf-like scallops on the tone borders; no outline (like the
    camp's smoke). Returns a Sprite anchored at the middle of its base."""
    rng = random.Random(seed)
    W, H = w + 16, h + 12
    s = cpx.new(W, H, W // 2, H - 4)
    base = H - 4
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    best = np.full((H, W), -1e9)
    nrm = np.zeros((H, W, 3))
    n = max(4, int(w / (h * .55)))
    puffs = []
    for k in range(n):
        f = k / (n - 1) - .5
        r = h * (.52 - abs(f) * .5) * rng.uniform(.8, 1.15) + 3
        cx = W / 2 + f * (w - r * 1.3)
        cy = base - r * rng.uniform(.65, .95)
        puffs.append((cx, cy, r))
    for _ in range(n // 2):        # a few higher puffs on the crown
        cx = W / 2 + rng.uniform(-w * .25, w * .25)
        r = h * rng.uniform(.25, .38)
        cy = base - h * rng.uniform(.55, .75)
        puffs.append((cx, cy, r))
    for (cx, cy, r) in puffs:
        d2 = (xx - cx) ** 2 + (yy - cy) ** 2
        inside = d2 < r * r
        hgt = np.sqrt(np.maximum(0, r * r - d2)) - (cy - base) * .15
        mm = inside & (hgt > best)
        best[mm] = hgt[mm]
        nz = np.sqrt(np.maximum(0, r * r - d2)) / r
        nrm[mm, 0] = ((xx - cx) / r)[mm]
        nrm[mm, 1] = ((yy - cy) / r)[mm]
        nrm[mm, 2] = nz[mm]
    m = (best > -1e8) & (yy < base)
    m = cpx.clean(m, 3)
    b = nrm @ LIGHT - .45 * ((yy - (base - h)) / h)
    vals = b[m]
    t1, t2 = np.quantile(vals, [.32, .62])
    tone = np.full((H, W), ix('b4'), np.uint8)
    tone[b > t2] = ix('b5')
    tone[b < t1] = ix('s5')
    under = m & (yy > base - 3.5)
    tone[under] = ix('s5')
    majority(tone, [ix('b5'), ix('b4'), ix('s5')], passes=2, size=5)
    s.ix[m] = tone[m]
    return s


def ridge_line(x0, x1, base, amp, seed, bumps=()):
    rng = random.Random(seed)
    terms = [(amp * rng.uniform(.5, 1) / (k + 1), rng.uniform(140, 260) / (k + 1), rng.uniform(0, 6.3)) for k in range(4)]
    xs = np.arange(x0, x1)
    y = np.full(len(xs), float(base))
    for (am, lam, ph) in terms:
        y -= am * (1 + np.sin(xs / lam + ph)) / 2
    for (bx, bw, bh) in bumps:
        y -= bh * np.clip(1 - ((xs - bx) / bw) ** 2, 0, 1) ** 1.5
    return xs, y


def hills(a, layers):
    """layers: [(ramp, (shade, base, lit), xs, ytop)], far first. Each range is filled from its ridge down to the
    horizon; a slope facing west (the line climbing to the right) takes the lit step, one facing east the shade,
    in runs at least 3 px wide; a 1 px darker line marks the ridge where a nearer range overlaps a farther one."""
    for (ramp, (sh, bs, lt), xs, ytop) in layers:
        yt = np.round(ytop).astype(int)
        slope = np.gradient(ytop)
        sm = ndimage.uniform_filter1d(slope, 9)
        tone = np.where(sm < -.18, lt, np.where(sm > .18, sh, bs))
        # runs shorter than 4 px join their neighbour
        for i in range(1, len(tone) - 1):
            if tone[i] != tone[i - 1] and tone[i] != tone[i + 1]:
                tone[i] = tone[i - 1]
        for i, x in enumerate(xs):
            if not (0 <= x < a.shape[1]):
                continue
            y0 = max(0, yt[i])
            a[y0:P.YH + 1, x] = ix(tone[i])
            # the face falls into shade lower down (the foot of each slope)
            depth = P.YH + 1 - y0
            if tone[i] == lt and depth > 10:
                a[y0 + int(depth * .55):P.YH + 1, x] = ix(bs)
            a[y0, x] = ix(lt if tone[i] != sh else bs)     # the skyline catches the light
    return a


def woods_belt(rng, x0, x1, y_foot0, y_foot1, rmin, rmax, seed=0):
    """Crowns along the horizon, back to front: [(sprite, x, foot_y)]. Leaf and Pine mixed, pxworld clumps."""
    out = []
    pts = poisson(rng, x0, y_foot0, x1, y_foot1, rmin * 1.3, 4000)
    pts.sort(key=lambda p: p[1])
    for (x, y) in pts:
        t = (y - y_foot0) / max(1, (y_foot1 - y_foot0))
        r = rmin + (rmax - rmin) * t * rng.uniform(.7, 1.1)
        kind = 'p' if rng.random() < .3 else 'l'
        if kind == 'p':
            sp = TS.pine_small(int(r * 2.6), seed=rng.randint(0, 9999)) if r < 6 else TS.pine(int(r * 2.6), seed=rng.randint(0, 9999))
        else:
            sp = TS.clumps(max(3, int(r)), seed=rng.randint(0, 9999), ramp='l', lift=0)
        out.append((sp, int(x), int(y)))
    return out


def domes(a, mounds, ramp_tones, seed=0, base_y=None, lit_cut=.62, shade_cut=.3):
    """A range of hills as overlapping domes standing on the horizon, drawn far to near (the list order). Each dome
    is lit as half an ellipsoid from the upper left in three steps (shade, base, lit) of its own ramp; its skyline
    takes the lit step on its west shoulder; a nearer dome's edge over a farther one is the base step one darker,
    so the ranges read as separate swells. Tone borders are smoothed so every run is at least 3 px."""
    Hh, Ww = a.shape
    by = P.YH + 2 if base_y is None else base_y
    yy, xx = np.mgrid[0:Hh, 0:Ww].astype(float) + .5
    sh, bs, lt = (ix(k) for k in ramp_tones)
    region = np.zeros((Hh, Ww), bool)
    tone = np.zeros((Hh, Ww), np.uint8)
    owner = np.full((Hh, Ww), -1)
    for i, (cx, w, h) in enumerate(mounds):
        gx = (xx - cx) / w
        gy = (yy - by) / h
        inside = (gx * gx + gy * gy < 1) & (yy <= by)
        gz = np.sqrt(np.clip(1 - gx * gx - gy * gy, 0, 1))
        b = gx * LIGHT[0] + gy * LIGHT[1] + gz * LIGHT[2]
        t = np.where(b > lit_cut, lt, np.where(b < shade_cut, sh, bs)).astype(np.uint8)
        tone[inside] = t[inside]
        owner[inside] = i
        region |= inside
    majority(tone, [sh, bs, lt], passes=2, size=5)
    # where one dome's edge crosses another (a nearer swell in front), a darker line
    edge = region & (owner != nb(owner, 0, -1, -1)) & (nb(owner, 0, -1, -1) >= 0)
    edge |= region & (owner != nb(owner, -1, 0, -1)) & (nb(owner, -1, 0, -1) >= 0) & (owner > nb(owner, -1, 0, -1))
    edge |= region & (owner != nb(owner, 1, 0, -1)) & (nb(owner, 1, 0, -1) >= 0) & (owner > nb(owner, 1, 0, -1))
    sky_line = region & ~nb(region, 0, -1, False)
    tone[sky_line & (tone != sh)] = lt
    a[region] = tone[region]
    return region
