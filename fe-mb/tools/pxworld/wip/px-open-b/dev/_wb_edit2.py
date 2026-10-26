f = 'world_b.py'
s = open(f, encoding='utf-8').read()


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a, s.count(a))
    s = s.replace(a, b)


rep('''    out = {}
    for a, b, *_ in b_roads():
        A, B = DOOR.get(a, P[a]), DOOR.get(b, P[b])
        key = (a, b)''',
    '''    out = {}
    for a0, b0, *_ in b_roads():
        flip = (a0, b0) not in HEADS and (b0, a0) in HEADS       # a bridge road written the other way round
        a, b = (b0, a0) if flip else (a0, b0)
        out[(a0, b0)] = _path(a, b)[::-1] if flip else _path(a, b)
    for key, (base, at) in SHARE.items():                   # fork off the shared stretch
        if key not in out or base not in out:
            continue
        bp = out[base]
        i = next((j for j, p in enumerate(bp) if p[0] >= at), len(bp) - 1)
        via = VIA.get(key, [])
        out[key] = bp[:i] + _spline([bp[i]] + [v for v in via if v[0] > at] + [out[key][-1]])
    return out


def _path(a, b):
    """One road's polyline from a to b (see road_paths)."""
    if True:
        A, B = DOOR.get(a, P[a]), DOOR.get(b, P[b])
        key = (a, b)''')
rep('''        if head is None:
            out[key] = _spline([A] + via + [B]) if via else geo.quad_pts(A, B, geo.quad(A, B, BEND.get(key, 0)), 60)
            continue''',
    '''        if head is None:
            return _spline([A] + via + [B]) if via else geo.quad_pts(A, B, geo.quad(A, B, BEND.get(key, 0)), 60)''')
rep('''            out[key] = core + [head, onto]
        else:''', '''            return core + [head, onto]
        else:''')
rep('''            out[key] = [onto, head] + core
    for key, (base, at) in SHARE.items():                   # fork off the shared stretch
        if key not in out or base not in out:
            continue
        bp = out[base]
        i = next((j for j, p in enumerate(bp) if p[0] >= at), len(bp) - 1)
        rest = out[key]
        k = min(range(len(rest)), key=lambda j: math.dist(rest[j], (at + 70, bp[i][1])))
        via = VIA.get(key, [])
        out[key] = bp[:i] + _spline([bp[i]] + [v for v in via if v[0] > at] + [rest[-1]])
    return out''', '''            return [onto, head] + core''')
# ---- render: farm tracks, ash marks in clusters, the footnote band, the new pieces
rep('''    TR.ripples(cv, rd, river_pts, 1)''', '''    # farm tracks: a narrow dirt track from each farmstead's yard to the nearest road
    tracks = []
    for (x, y, i) in FARMS:
        hx, hy = FARM_HOME[i]
        dx_, dy_ = FARM_TRACK.get(i, (0, 10))
        f0 = (x + dx_, y + dy_)
        best = min(((math.dist(f0, p), p) for v in vis_paths.values() for p in v), key=lambda t: t[0])
        if best[0] < 120:
            q = best[1]
            tr = geo.quad_pts(f0, q, geo.quad(f0, q, 6), 40)
            m = TR.road(cv, tr, 2.2, 1, pebbles=0, seed=i, not_on=water)
            if m is not None:
                road_any |= m
            tracks.append(tr)
    info['tracks'] = tracks
    TR.ripples(cv, rd, river_pts, 1)''')
rep('''    AL.scars(cv, rng, ash_core & ~road_any & ~water, n=80)
    AL.cracks(cv, rng, ash_core & ~road_any & ~water, n=110)
    AL.drifts(cv, rng, ash_core & ~road_any & ~water, n=120)
    # ashen stubble: tufts coloured from the ash under them, in clumps
    def ash_free(p, pad=2):
        x, y = int(p[0]), int(p[1])
        return free(p, pad) and ash_zone[y, x]''', '''    # the burnt crust's marks come in clusters (round the snag stands and on the ridges); open ash is left open
    marks_at = AL.cluster_mask(ash_core & ~road_any & ~water, rng, n=26, r=16)
    AL.scars(cv, rng, marks_at, n=60, cinders=False)
    AL.cracks(cv, rng, marks_at, n=90)
    AL.drifts(cv, rng, marks_at, n=80)
    # dry stubble: tufts coloured from the ground under them, in clumps, on the dry grass and scorched earth
    def ash_free(p, pad=2):
        x, y = int(p[0]), int(p[1])
        return free(p, pad) and ash_zone[y, x] and not ash_core[y, x]''')
rep('''        return 0 <= x < W and 0 <= y < H and ash_zone[y, x] and not reject(p, 12, 40, 20)
    stands = TR.poisson(rng, 0, 0, W, H, 70, 3000, ashy)[:26]          # where a wood burned: snags in clumps''',
    '''        return (0 <= x < W and 0 <= y < H and ash_zone[y, x] and not reject(p, 12, 40, 20)
                and not (FOOTNOTE[0] <= x <= FOOTNOTE[2] and FOOTNOTE[1] - 24 <= y <= FOOTNOTE[3] + 4))
    stands = [p for p in marks_at_centres if ashy(p)] + TR.poisson(rng, 0, 0, W, H, 70, 3000, ashy)[:14]''')
rep('''    marks_at = AL.cluster_mask(ash_core & ~road_any & ~water, rng, n=26, r=16)''',
    '''    marks_at, marks_at_centres = AL.cluster_mask(ash_core & ~road_any & ~water, rng, n=26, r=16)''')
rep('''            for (dx, dy, k) in ((0, 0, 'x4'), (1, 0, 'o4'), (0, 1, 'x2'), (-1, 1, 't1'), (2, 1, 't1')):
                cv.put(x + dx, y + dy, k)''', '''            bits.ember(cv, x, y)''')
rep('''        elif k == 'watchtower_ridge':
            PL.watchtower(sc, X, Y)''', '''        elif k == 'watchtower_ridge':
            wg = bits.gate_angles((X, Y + 5), 26, 15, [v if kk[0] == k else v[::-1] for kk, v in road_px.items() if k in kk],
                                  hw=.28)
            bits.watchtower(sc, X, Y, wg)''')
rep('''            PL.broken_bridge(sc, river_x(Y), Y)''', '''            bits.broken_bridge(sc, river_x(Y), Y)''')
rep('''# places that bring their own ground''', '''# where each farm's track leaves its yard (relative to the farm's point), toward the nearest road
FARM_TRACK = {0: (-4, 8), 1: (16, 14), 2: (10, 12), 3: (2, 14), 4: (6, 12), 5: (0, 10)}
# the board's one-line footnote (x0, y0, x1, y1): nothing tall stands in it
FOOTNOTE = (410, 690, 790, 714)
# places that bring their own ground''')
open(f, 'w', encoding='utf-8').write(s)
print('ok')
