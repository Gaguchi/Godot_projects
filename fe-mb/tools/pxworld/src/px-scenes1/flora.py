"""Trees, bushes, hedgerows and reeds for the deep view, each built at the size its depth gives it.

Near and mid trees are PxCamp's bigtree (leaf-cell crowns, fissured trunks) with the crown's clump spacing scaled to
the crown, so a tree at the bridge has as many clumps as one at the camp; far ones are pxworld clumps and pines, and
the farthest woods a band of tiny crowns. Hedgerows are chains of bushes along a line in metres. Reeds near the
viewer are drawn blade by blade at true height (about a metre), with cattails; farther off pxworld's small reeds."""
import math
import random

import numpy as np

import bigtree as BT
import cpx
import persp as P
from cpx import pal, ix, CLEAR, nb
from pxworld import trees as TS
from pxworld import terrain as TR
from pxworld.canvas import Sprite

_CACHE = {}


def tree_at(Z, height_m=11.0, crown_m=4.4, seed=0, lift=0, squash=.86, trunk_m=.55):
    """A broadleaf height_m tall with a crown crown_m in radius, at depth Z. Returns a Sprite anchored at the
    trunk's foot."""
    s = P.F / Z
    rx = crown_m * s
    if rx >= 26:
        ry = rx * squash
        clear_m = max(1.5, height_m - 2 * crown_m * squash)      # bare trunk under the crown
        trunk_h = clear_m * s + .65 * ry
        w = max(5, int(trunk_m * s))
        dens = max(1.0, 100.0 / rx)
        sp, off = _bigtree(rx, ry, trunk_h, w, seed, lift, dens)
        return sp
    r = max(2, int(round(rx)))
    sp = TS.tree(r, seed, 'l', trunk=max(1, int(round((height_m - crown_m * 1.8) * s))), lift=lift)
    return sp


def _bigtree(rx, ry, h, w, seed, lift, dens):
    """bigtree.tree with the crown's clump spacing scaled to the crown size."""
    tr, tm = BT.trunk(int(h + ry * .5), w, seed)
    cr, cm = BT.crown(rx, ry, seed, lift, density=dens)
    W = max(cr.w, tr.w)
    H = int(h + ry * 1.0 + cr.h // 2 + 12)
    s = cpx.new(W, H, W // 2, H - 4)
    ccx, ccy = s.ax, int(s.ay - h - ry * .35)
    s.blit(tr, s.ax - tr.ax, s.ay - tr.ay)
    for (dx, k) in ((-1, .6), (1, .8)):
        for j in range(int(ry * .7)):
            px = s.ax + dx * j * k * .9
            py = s.ay - h + 6 - j
            for i in range(-max(1, w // 3), max(1, w // 3) + 1):
                cpx.put(s, px + i, py, 'w0' if abs(i) == max(1, w // 3) else ('w5' if i < 0 else 'w3'))
    s.blit(cr, int(ccx - cr.ax), int(ccy - cr.ay))
    return s, (ccx - s.ax, ccy - s.ay)


def bush_at(Z, w_m=2.0, h_m=1.3, seed=0, lift=1):
    s = P.F / Z
    rx, ry = w_m / 2 * s, h_m / 2 * s
    if rx >= 14:
        return BT.bush(rx, ry, seed, lift)
    r = max(1.5, rx * .9)
    key = (round(r * 2) / 2, seed % 7, lift)
    if key not in _CACHE:
        _CACHE[key] = TS.clumps(key[0], seed % 7 + 300, 'l', lift=lift)
    sp = _CACHE[key]
    return sp


def foot_of(sp):
    """pxworld clumps have their anchor at the crown's middle: the foot is its bottom row."""
    return sp.h - 1 - sp.ay


def hedgerow(st, a, b, rng, gap_m=1.15, h_m=1.25, every_tree=0, tree_seed=0, ground=None):
    """A hedgerow from world point a to b ((X, Z) metres): bushes every gap_m, a few hedgerow trees."""
    (xa, za), (xb, zb) = a, b
    L = math.hypot(xb - xa, zb - za)
    n = max(1, int(L / gap_m))
    for k in range(n + 1):
        t = k / n
        X = xa + (xb - xa) * t + rng.uniform(-.15, .15)
        Z = za + (zb - za) * t + rng.uniform(-.2, .2)
        if Z <= 1:
            continue
        x, y = P.proj(X, Z)
        if not (-40 < x < P.W + 40):
            continue
        if ground is not None and not (0 <= int(y) < P.H and 0 <= int(x) < P.W and ground[int(y), int(x)]):
            continue
        s = P.F / Z
        if every_tree and rng.random() < every_tree:
            sp = tree_at(Z, rng.uniform(8, 12), rng.uniform(3.0, 4.2), seed=tree_seed + k, lift=rng.choice((0, 0, 1)))
            st.add(sp, x, y)
            st.throw_sprite(sp, x, y, squash=.6, contact=False, dapple=tree_seed + k + 500 if s > 8 else 0)
            continue
        sp = bush_at(Z, rng.uniform(1.5, 2.3), h_m * rng.uniform(.85, 1.15), seed=rng.randint(0, 99))
        fy = y + (foot_of(sp) if sp.ay < sp.h - 2 else 0)
        st.add(sp, x, y, z=y)
        if s > 6:
            st.throw_ell(x + s * .6, y + 1, s * 1.1, max(1.0, s * .28))
    return n


def stamp_pts(st, sp, x, y):
    st.add(sp, x, y)


# ---------------------------------------------------------------- reeds
def reed_clump(s, seed=0, n=None):
    """A clump of reeds about a metre tall at s px per metre: blades from a common root, bending with their own
    weight, lit on the west, a cattail head or two. Leaf ramp, w ramp heads, outlined l1."""
    rng = random.Random(seed)
    Hh = int(1.25 * s) + 6
    Wd = int(1.0 * s) + 10
    sp = cpx.new(Wd, Hh, Wd // 2, Hh - 3)
    n = n or max(5, int(s * .22))
    for i in range(n):
        f = i / max(1, n - 1) - .5
        L = (.65 + rng.uniform(0, .5)) * s * (1.1 - abs(f) * .5)
        lean = f * 1.2 + rng.uniform(-.25, .25)
        x = sp.ax + f * .35 * s
        y = sp.ay
        lit = f < .1
        for k in range(int(L)):
            t = k / max(1, L)
            px = x + lean * (t * t) * s * .35
            py = y - k
            key = ('l5' if t > .7 else 'l4') if lit else ('l3' if t > .6 else 'l2')
            if k < 2:
                key = 'l1'
            cpx.put(sp, px, py, key)
            if s > 40 and t < .5:
                cpx.put(sp, px + 1, py, 'l3' if lit else 'l2')
        if rng.random() < .35 and L > 8:
            # a cattail: a dark brown head a little under the tip
            hx = x + lean * .45 * s * .35
            hy = y - int(L * .78)
            hl = max(3, int(.14 * s))
            for j in range(hl):
                cpx.put(sp, hx, hy + j, 'w2' if j else 'w4')
                cpx.put(sp, hx + 1, hy + j, 'w1')
    rg = cpx.ring(np.pad(sp.ix != CLEAR, 1), 4)[1:-1, 1:-1]
    rg &= ~nb(sp.ix != CLEAR, 0, -1, False) | True
    sp.ix[rg & (np.arange(sp.h)[:, None] < sp.ay - 1)] = ix('l1')
    return sp


def hedge_band(a_shape, a_line, rng, h_m=1.0, gap_m=.7, seed=0):
    """A hedgerow as one mass: bushes laid closely along the line (no ink between them), the union outlined in l0
    and lit l1 on its upper-left edge. Returns (Sprite in stage coords, foot y)."""
    Hh, Ww = a_shape
    (xa, za), (xb, zb) = a_line
    L = math.hypot(xb - xa, zb - za)
    n = max(1, int(L / gap_m))
    buf = np.full((Hh, Ww), CLEAR, np.uint8)
    feet = []
    for k in range(n + 1):
        t = k / n
        X = xa + (xb - xa) * t + rng.uniform(-.1, .1)
        Z = za + (zb - za) * t
        x, y = P.proj(X, Z)
        if not (-20 < x < Ww + 20):
            continue
        s = P.F / Z
        r = max(1.5, h_m * .62 * s * rng.uniform(.85, 1.2))
        key = ('ni', round(r * 2) / 2, rng.randint(0, 5))
        if key not in _CACHE:
            _CACHE[key] = TS.clumps(key[1], key[2] + 500, 'l', lift=1, ink=False)
        sp = _CACHE[key]
        x0, y0 = int(round(x)) - sp.ax, int(round(y)) - sp.ay
        m = sp.ix != CLEAR
        ys, xs = np.nonzero(m)
        X_, Y_ = xs + x0, ys + y0
        ok = (X_ >= 0) & (X_ < Ww) & (Y_ >= 0) & (Y_ < Hh)
        buf[Y_[ok], X_[ok]] = sp.ix[ys[ok], xs[ok]]
        feet.append(y)
    m = buf != CLEAR
    if not m.any():
        return None, (0, 0)
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    upl = rg & (nb(m, 1, 0) | nb(m, 0, 1)) & ~nb(m, -1, 0) & ~nb(m, 0, -1)
    buf[rg] = ix('l0')
    buf[upl] = ix('l1')
    ys, xs = np.nonzero(buf != CLEAR)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    S = Sprite(x1 - x0, y1 - y0, 0, 0)
    S.ix[:] = buf[y0:y1, x0:x1]
    fy = int(round(max(feet)))
    S.ax, S.ay = 0, fy - y0
    return S, (int(x0), fy)
