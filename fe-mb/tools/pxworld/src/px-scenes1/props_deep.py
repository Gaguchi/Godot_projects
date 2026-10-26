"""Roadside props for the title, sized in metres at their depth: a milestone, field boulders (PxCamp's fieldstone)."""
import math
import random

import numpy as np

import cpx
import fire as FI
from cpx import pal, ix, CLEAR, nb, put


def milestone(s, seed=3):
    """A squat dressed stone at the verge, 0.7 m tall and 0.45 m wide with a rounded head, seen from the south-west:
    its south face toward us in the middle tones with a cut band and a worn mark, its west side lit, a hard dark
    east edge, moss and grass at its foot. Stone ramp, outlined t1 (t2 on the lit edges). Anchor = foot middle."""
    rng = random.Random(seed)
    fw = max(8, int(round(.45 * s)))         # the south face
    sw = max(3, int(round(.16 * s)))         # the west side, foreshortened
    hh = max(12, int(round(.72 * s)))
    hr = fw // 2                             # the rounded head
    W, H = fw + sw + 6, hh + 6
    sp = cpx.new(W, H, sw + 2 + fw // 2, H - 3)
    x0 = sw + 2
    base = H - 3
    for x in range(fw):
        u = (x + .5 - fw / 2) / (fw / 2)
        top = base - hh + int(round(hr * (1 - math.sqrt(max(0, 1 - u * u)))))
        for y in range(top, base + 1):
            k = 't4'
            if x >= fw - 2:
                k = 't3'
            if y <= top + 1:
                k = 't5' if x < fw - 2 else 't4'
            put(sp, x0 + x, y, k)
    # the west side: a narrow lit face receding to the left, its top following the head
    for i in range(sw):
        lean = int(round(i * .45))
        for y in range(base - hh + hr // 2 + lean, base + 1 - lean // 2):
            put(sp, x0 - 1 - i, y, 't5' if i < sw - 1 else 't4')
    # the cut band and the mark on the face
    by = base - int(hh * .58)
    for x in range(1, fw - 1):
        put(sp, x0 + x, by, 't2')
        put(sp, x0 + x, by + 1, 't5')
    mx, my = x0 + fw // 2 - 1, base - int(hh * .4)
    for (dx, dy) in ((1, 0), (1, 1), (0, 2), (1, 2), (2, 2), (1, 3), (1, 4)):     # an incised cross, nothing to read
        if hh > 30:
            put(sp, mx + dx, my + dy, 't2')
            put(sp, mx + dx + 1, my + dy + 1, 't5') if (dx, dy) in ((2, 2), (1, 4)) else None
    # moss and weathering at the foot
    for x in range(-sw, fw):
        if rng.random() < .7:
            put(sp, x0 + x, base, 'm2')
            if rng.random() < .5:
                put(sp, x0 + x, base - 1, 'm3')
    from pxworld import build as B
    sp = sp.padded(1)
    B.selout(sp, lit=True)
    return sp


def boulder(w, h, seed=0, moss=True):
    return FI.stone(w, h, seed, moss=moss)
