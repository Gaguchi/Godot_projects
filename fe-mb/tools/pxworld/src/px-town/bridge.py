"""px-town: the stone bridge that carries the east road over the river, square to the flow.

The river runs north-south, so the bridge runs east-west and we see it broadside from above the street:
the north parapet's coping and face, the deck, the south parapet's coping and face, and, only where there is water
under it, the bridge's south face: two segmental arches either side of a pier with its cutwater, springing from the
water, and an abutment at each bank. The parapets run on past the water onto the approaches and end in squat posts.
"""
import random

import numpy as np

from pxt import Sprite, kk, pal, IX, selout, stone_face, seg_arch_mask


def bridge(x0, x1, fw0, fw1, top, deck0, deck1, water, seed=8):
    """x0..x1: parapets and deck incl. the approaches; fw0..fw1: the south face (the water's width plus the
    abutments). Rows: north parapet from `top`, deck deck0..deck1, south parapet under it, the face down to `water`.
    The sprite's anchor is stage (x0, water + 3). Returns (sprite, info)."""
    R = random.Random(seed)
    W = x1 - x0 + 1
    TP = 5                               # headroom for the end posts' caps
    H = water - top + 3 + TP
    S = Sprite(W + 2, H + 2, 1, H)

    def X(x):
        return x - x0 + 1

    def Y(y):
        return y - top + TP
    # ---- the south face first (the parapets and posts draw over its top)
    sp = deck1 + 1                       # south parapet coping row
    sc = sp + 9                          # string course row
    f0 = sc + 3
    FW = fw1 - fw0 + 1
    stone_face(S, X(fw0), Y(f0), FW, water - f0 + 1, seed=seed + 2, ch=6, bw=(9, 15), chips=.08, vary=.1)
    for x in range(fw0, fw1 + 1):        # the string course: a moulded band under the parapet
        S.put(X(x), Y(sc), 't5'); S.put(X(x), Y(sc) + 1, 't4'); S.put(X(x), Y(sc) + 2, 't2')
    # the abutments: dressed quoins at both ends of the face
    for (qx, side) in ((fw0, 1), (fw1 - 5, -1)):
        y = f0
        k = 0
        while y + 4 <= water:
            ln = 6 if k % 2 == 0 else 3
            xa = qx if side > 0 else qx + 6 - ln
            for j in range(4):
                for i in range(ln):
                    lv = 5 if j == 0 else (3 if j == 3 or i == ln - 1 else 4)
                    S.put(X(xa + i), Y(y + j), kk('t', lv))
            S.hline(X(xa), X(xa + ln - 1), Y(y + 4), 't2')
            y += 5
            k += 1
    # two segmental arches either side of a central pier
    inner0, inner1 = fw0 + 8, fw1 - 8
    pier_w = 14
    aw = (inner1 - inner0 + 1 - pier_w) // 2
    a1 = inner0
    a2 = a1 + aw + pier_w
    arch_h = water - f0 - 2
    rise = 8
    arches = []
    for ax in (a1, a2):
        ring = seg_arch_mask(aw + 6, arch_h + 3, rise + 2)
        for j in range(ring.shape[0]):
            for i in range(ring.shape[1]):
                if ring[j, i]:
                    S.put(X(ax - 3 + i), Y(f0 + 1) + j, 't4')
        # voussoirs: a ring of wedges, lit on the west haunch, joints radiating
        hole = seg_arch_mask(aw, arch_h, rise)
        for i in range(aw + 6):
            col = ring[:, i]
            if not col.any():
                continue
            t = int(np.argmax(col))
            ii = i - 3
            ht = int(np.argmax(hole[:, ii])) + 2 if 0 <= ii < aw and hole[:, ii].any() else t + 3
            for j in range(t, min(ht, ring.shape[0])):
                k = 't5' if i < (aw + 6) * .45 else 't4'
                if (i % 5) == 0:
                    k = 't2'
                S.put(X(ax - 3 + i), Y(f0 + 1) + j, k)
            S.put(X(ax - 3 + i), Y(f0 + 1) + t, 't6' if i < (aw + 6) * .45 else 't5')
        for j in range(hole.shape[0]):
            for i in range(hole.shape[1]):
                if hole[j, i]:
                    # the water seen through the arch, in the bridge's shade; daylight beyond at its foot
                    rel = j / max(1, hole.shape[0] - 1)
                    k = 'a0' if rel < .3 else ('a1' if rel < .78 else 'a2')
                    if i < 2:
                        k = 'a0'
                    S.put(X(ax + i), Y(f0 + 4) + j, k)
        arches.append((ax, ax + aw - 1))
    # the pier's cutwater: a wedge standing out of the water to the springing, capped with a sloped stone
    px0 = a1 + aw
    pc = px0 + pier_w // 2
    ct = water - 10
    for y in range(ct, water + 1):
        for x in range(pc - 5, pc + 5):
            k = 't5' if x < pc - 1 else ('t4' if x < pc + 1 else 't3')
            if (y - ct) % 5 == 4:
                k = pal.KEYS[pal.shift_index(IX(k), -1)]
            S.put(X(x), Y(y), k)
        S.put(X(pc - 6), Y(y), 't2'); S.put(X(pc + 5), Y(y), 't1')
    for j, (a, b) in enumerate(((pc - 1, pc), (pc - 3, pc + 2), (pc - 5, pc + 4), (pc - 6, pc + 5))):
        for x in range(a, b + 1):
            S.put(X(x), Y(ct - 4 + j), 't6' if x < pc else 't4')
    # the waterline: a dark wet course, weed in tufts
    for x in range(fw0, fw1 + 1):
        if S.get(X(x), Y(water)) in pal.RAMP['t']:
            S.put(X(x), Y(water), 't1')
            S.put(X(x), Y(water) - 1, pal.KEYS[pal.shift_index(S.get(X(x), Y(water) - 1), -1)])
    for x in range(fw0 + 3, fw1 - 3, 9):
        if R.random() < .7 and S.get(X(x), Y(water) - 2) in pal.RAMP['t']:
            for i, k in enumerate(('m3', 'm4', 'm4', 'm2')):
                S.put(X(x + i), Y(water) - 1, k)
            S.put(X(x + 1), Y(water) - 2, 'm4')
    # ---- the north parapet: coping in the light over a short coursed face that looks at us
    for x in range(x0, x1 + 1):
        S.put(X(x), Y(top), 't6' if x < x1 - 1 else 't4')
        S.put(X(x), Y(top) + 1, 't5')
        S.put(X(x), Y(top) + 2, 't3')
    stone_face(S, X(x0), Y(top) + 3, W, deck0 - top - 3, seed=seed, ch=4, bw=(7, 12), chips=0, vary=.08)
    # ---- the deck: big worn setts, two wheel ruts
    for y in range(deck0, deck1 + 1):
        for x in range(x0, x1 + 1):
            S.put(X(x), Y(y), 'd2')
    yy = deck0
    while yy <= deck1 - 1:
        x = x0 - R.randint(0, 7)
        while x <= x1:
            w = R.choice((6, 7, 8, 9))
            ramp, base = ('d', 5) if R.random() < .55 else ('t', 4)
            for j in range(3):
                for i in range(w - 1):
                    xx = x + i
                    if x0 <= xx <= x1 and yy + j <= deck1:
                        if (i in (0, w - 2)) and j in (0, 2):
                            continue
                        lv = base + 1 if (j == 0 and i < w - 2) else (base - 1 if (j == 2 or i == w - 2) else base)
                        S.put(X(xx), Y(yy + j), kk(ramp, lv))
            x += w
        yy += 4
    for y in range(deck0 + 6, deck1 - 4):      # packed earth over the setts where the wheels run
        for x in range(x0, x1 + 1):
            if (y - deck0 - 6) in (0, 1, 2) or (deck1 - 5 - y) in (0, 1):
                if (x * 7 + y * 3) % 11 > 2:
                    S.put(X(x), Y(y), 'd4' if (x + y) % 5 else 'd3')
    for y in range(deck0, deck0 + 2):          # the north parapet's shadow along the deck
        for x in range(x0, x1 + 1):
            S.put(X(x), Y(y), pal.KEYS[pal.shift_index(S.get(X(x), Y(y)), -1)])
    # ---- the south parapet: coping then its face
    for x in range(x0, x1 + 1):
        S.put(X(x), Y(sp), 't6' if x < x1 - 1 else 't4')
        S.put(X(x), Y(sp) + 1, 't5')
        S.put(X(x), Y(sp) + 2, 't3')
    stone_face(S, X(x0), Y(sp) + 3, W, 6, seed=seed + 1, ch=6, bw=(7, 12), chips=0, vary=.08)
    # ---- the end posts: squat square piers capping each parapet end
    for (ex, rows) in ((x0, (top, sp)), (x1 - 7, (top, sp))):
        for r0 in rows:
            for j in range(-4, 9):
                for i in range(8):
                    lv = 5 if i < 3 else (4 if i < 6 else 3)
                    if j < -1:
                        lv = 6 if i < 6 else 4
                    if j == -1:
                        lv = 3
                    if (j + 4) % 5 == 4 and j > 0:
                        lv -= 1
                    S.put(X(ex + i), Y(r0) + j, kk('t', lv))
    selout(S)
    return S, {'arches': arches, 'pier': (px0, px0 + pier_w), 'cut': pc, 'face': (fw0, fw1)}
