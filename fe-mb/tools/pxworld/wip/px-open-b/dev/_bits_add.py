

# ---------------------------------------------------------------- Watchtower Ridge, gated on every road
def watchtower(sc, x, y, gaps):
    """pxworld.places.watchtower with a gate in the stake ring wherever a road comes in (gaps from gate_angles
    round (x, y + 5), rx 26, ry 15)."""
    back = stake_arc_gaps(26, 15, 8, False, gaps)
    front = stake_arc_gaps(26, 15, 8, True, gaps)
    sc.add(back, x, y + 5, z=-16)
    sc.add(front, x, y + 5, z=16)
    sc.cv.shift(ellipse(x + 2, y + 7, 28, 16.5), -1, GROUND, where=lambda a: ~np.isin(a, pal.RAMP['d']))
    t = BD.stone_tower(14, 28, seed=2)
    tx, ty = x - 3, y + 3
    sc.add(t, tx, ty, shadow='house')
    fl = BD.R(sc, PR.flag(1, ('m3', 'b4'), h=12))
    sc.add(fl, tx - 1, ty - t.h + 3, z=t.h + 1)
    sc.add(BD.cottage(9, 'ns', 'shingle', 'boards', d=6, h=5, seed=3), x + 15, y + 10, shadow='house')
    sc.add(BD.woodpile(), x + 6, y + 13, shadow='house')


# ---------------------------------------------------------------- Broken Bridge, on its piers
def broken_bridge(sc, x, y):
    """Broken Bridge: pxworld's stone bridge across the flow on the road's axis (rising 1 px in 3 to the east),
    its middle span fallen. Each stump ends over a coursed stone pier standing in the water (a wet foot, foam
    where the current breaks on it); the fallen span lies as three irregular chunks of different sizes just
    downstream of the gap and off the deck line, half under the water, the middle of the gap left as open water.
    x is the river's centre at row y. Same frame as pxworld.places.broken_bridge."""
    ox = 0 if abs(x - 956) < 4 else int(round(x - 956))
    oy = int(round(y - 580))
    cv = sc.cv
    water = getattr(sc, 'water', None)
    L = 52
    b0, b1 = 22, 33                                       # the fallen span's columns
    br = BD.stone_bridge(L, 3, deck=4, face=6, arches=[(9, 17, 3), (38, 46, 3)], abut=(8, 6),
                         broken=(b0 + 3, b1 - 2), seed=4)
    bx, by = 927 + ox, 581 + oy

    def yc(c):                                            # the south coping row of column c
        return by - c // 3
    if water is not None:
        for c in range(L):
            if b0 - 1 <= c < b1 + 1:
                continue
            yw = by + 7 - c // 3
            for j in range(2):
                X, Y = bx + c + 1, yw + j
                if 0 <= Y < cv.h and 0 <= X < cv.w and water[Y, X]:
                    cv.ix[Y, X] = pal.shift_index(cv.get(X, Y), -1)
    sc.add(br, bx, by, z=-3)
    piers = [(17, 22), (b1 - 1, b1 + 4)]

    def wet(X, Y):
        return water is None or (0 <= Y < cv.h and 0 <= X < cv.w and water[Y, X])

    def pier(cv):
        for (c0, c1) in piers:
            for c in range(c0, c1):
                X = bx + 1 + c
                top = yc(c) + 3
                for yy in range(top, yc(c) + 10):
                    f = yy - top
                    if yy >= yc(c) + 8:
                        k = 't2' if (c + f) % 2 else 't1'                 # the wet foot
                    elif f % 2 == 1:
                        k = 't2'                                          # mortar course
                    else:
                        u = (c + (f // 2) * 2) % 4
                        k = 't2' if u == 0 else ('t4' if u == 1 else 't3')
                    if c == c0:
                        k = 't5' if yy < yc(c) + 8 else 't3'              # the pier's lit west arris
                    elif c == c1 - 1:
                        k = 't1'
                    cv.put(X, yy, k)
                for dy in (10,):                                          # foam where the current breaks
                    if wet(X, yc(c) + dy):
                        cv.put(X, yc(c) + dy, 'a7' if c % 3 else 'a6')
            for (dx, dy) in ((-1, 9), (c1 - c0, 9), (-2, 11), (c1 - c0 + 1, 11)):
                X, Y = bx + 1 + c0 + dx, yc(c0) + dy
                if wet(X, Y):
                    cv.put(X, Y, 'a6')
    # the fallen span: three chunks of different sizes, half drowned, downstream of the gap, off the deck line
    chunks = [(bx + 1 + b0 + 2, yc(b0) + 13, ['.5554.', '544433', '433222']),
              (bx + 1 + b1 - 4, yc(b1 - 4) + 11, ['.65.', '5432']),
              (bx + 1 + b0 + 6, yc(b0 + 6) + 17, ['.54', '432'])]

    def rubble(cv):
        for (X0, Y0, rows) in chunks:
            h_, w_ = len(rows), len(rows[0])
            for j, row in enumerate(rows):
                for i, ch in enumerate(row):
                    if ch != '.':
                        cv.put(X0 + i, Y0 + j, 't' + ch)
            # selout in the stone's own darkest step round the part above the water
            for j, row in enumerate(rows):
                for i, ch in enumerate(row):
                    if ch == '.':
                        continue
                    for (dx, dy) in ((-1, 0), (1, 0), (0, -1)):
                        ii, jj = i + dx, j + dy
                        inside = 0 <= ii < w_ and 0 <= jj < h_ and rows[jj][ii] != '.'
                        if not inside and pal.RAMP_OF[cv.get(X0 + ii, Y0 + jj)] == 'a':
                            cv.put(X0 + ii, Y0 + jj, 't1')
            # the water closes over its foot: a foam line where it goes under, a short wake downstream
            for i in range(-1, w_ + 1):
                if wet(X0 + i, Y0 + h_):
                    cv.put(X0 + i, Y0 + h_, 'a7' if i % 2 else 'a6')
            for k_ in (1, 2):
                for XX in (X0 - 1 - k_ // 2, X0 + w_ + k_ // 2):
                    YY = Y0 + h_ + k_
                    if wet(XX, YY):
                        cv.put(XX, YY, 'a5')
    sc.later(pier)
    sc.later(rubble)


def ember(cv, x, y):
    """A coal still alight in the ash: 2 x 2, lit corner, a 1 px charred rim."""
    for (dx, dy) in ((-1, 0), (2, 0), (-1, 1), (2, 1), (0, -1), (1, -1), (0, 2), (1, 2)):
        cv.put(x + dx, y + dy, 'w1')
    cv.put(x, y, 'o5'); cv.put(x + 1, y, 'x4'); cv.put(x, y + 1, 'x4'); cv.put(x + 1, y + 1, 'x3')
