f = 'overview.py'
s = open(f, encoding='utf-8').read()


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a, s.count(a))
    s = s.replace(a, b)


rep('''    # texture, hand-placed on a jittered lattice like a map's symbols: pines in Thornwood, burnt hills in Ashfall
    PINE = [(1, 0, 'm3'), (0, 1, 'm3'), (1, 1, 'm2'), (2, 1, 'm0'), (1, 2, 'm0')]
    HILL = [(1, 0, 'b2'), (2, 0, 'b2'), (0, 1, 'b2'), (3, 0, 'w3'), (4, 1, 'w3'), (3, 1, 'w2')]
    for j in range(3, h - 3, 5):
        for i in range(2 + (j // 5) % 2 * 3, w - 4, 6):
            jx, jy = (i * 7 + j * 13) % 3 - 1, (i * 5 + j * 11) % 3 - 1
            X, Y = i + jx, j + jy
            r = reg[Y, X]
            ok = all(0 <= X + dx < w and 0 <= Y + dy < h and reg[Y + dy, X + dx] == r for dx in (-1, 5) for dy in (-1, 3))
            if not ok:
                continue
            if r == 1:
                for (dx, dy, k) in PINE:
                    cv.put(X + dx, Y + dy, k)
            elif r == 2 and (i // 6 + j // 5) % 2 == 0:
                for (dx, dy, k) in HILL:
                    cv.put(X + dx, Y + dy, k)''',
    """    # texture, placed like a map's symbols: pines in Thornwood in clumps with clearings between them, burnt
    # ridges in Ashfall as short diagonal strokes lit on their north-west side
    PINE = [(1, 0, 'm3'), (0, 1, 'm3'), (1, 1, 'm2'), (2, 1, 'm0'), (1, 2, 'm0')]
    RIDGE = [(0, 2, 'b3'), (1, 1, 'b3'), (2, 0, 'b2'), (1, 2, 'w2'), (2, 1, 'w2')]
    rng = random.Random(zlib.crc32(b'overview'))
    clumps = [(rng.uniform(0, w), rng.uniform(0, h)) for _ in range(22)]
    taken = np.zeros((h, w), bool)

    def fits(X, Y, r, dx0=-1, dx1=4, dy0=-1, dy1=3):
        return (all(0 <= X + dx < w and 0 <= Y + dy < h and reg[Y + dy, X + dx] == r for dx in (dx0, dx1) for dy in (dy0, dy1))
                and not taken[max(0, Y - 1):Y + 4, max(0, X - 1):X + 4].any())
    for _ in range(2600):
        X, Y = rng.randrange(1, w - 4), rng.randrange(1, h - 4)
        r = reg[Y, X]
        if r == 1:
            if min(math.hypot(X - cx_, (Y - cy_) * 1.3) for cx_, cy_ in clumps) > 9 or not fits(X, Y, 1):
                continue
            for (dx, dy, k) in PINE:
                cv.put(X + dx, Y + dy, k)
            taken[Y:Y + 3, X:X + 3] = True
        elif r == 2 and rng.random() < .25 and fits(X, Y, 2, -2, 5, -2, 4):
            for (dx, dy, k) in RIDGE:
                cv.put(X + dx, Y + dy, k)
            taken[Y - 1:Y + 5, X - 2:X + 6] = True""")
rep('''    # field squares in the Borderlands (a few)
    for (px, py) in ((420, 330), (690, 470), (760, 560), (300, 340), (1180, 420), (640, 190)):
        X, Y = T((px, py))
        X, Y = int(X), int(Y)
        if reg[Y, X] == 0:
            cv.put(X, Y, 'o3'); cv.put(X + 1, Y, 'o3'); cv.put(X, Y + 1, 'o2'); cv.put(X + 1, Y + 1, 'o2')''',
    """    # field squares in the Borderlands: the main view's own fields, 2 x 2 in ochre (wheat) and moss (crops)
    for pts, kind in WB.FIELDS:
        px = sum(p[0] for p in pts) / len(pts)
        py = sum(p[1] for p in pts) / len(pts)
        X, Y = T((px, py))
        X, Y = int(X), int(Y)
        if 0 <= X < w - 1 and 0 <= Y < h - 1 and reg[Y, X] == 0:
            lit, dk = (('o4', 'o3') if 'wheat' in kind else (('w4', 'w3') if kind == 'plough' else ('m5', 'm4')))
            cv.put(X, Y, lit); cv.put(X + 1, Y, lit); cv.put(X, Y + 1, dk); cv.put(X + 1, Y + 1, dk)""")
rep("""            cv.put(X, Y, 'b4' if WB.NODE[k]['type'] == 'TOWN' else 'w1')""", """            cv.put(X, Y, 'w1')""")
rep("""    marks = {'camp': T(WB.P['frontier_camp']), 'throne': (tx, ty), 'scale': s,
             'labels': {'Thornwood': T((1180, -250)), 'Ashfall': T((-420, 640)), 'Iron Throne': T((-560, 1210))}}""",
    """    # north: a small N over an up-tick in the top-right corner
    NM = ["k...k", "kk..k", "k.k.k", "k..kk", "k...k", ".....", "..k..", ".kkk."]
    for j, row in enumerate(NM):
        for i, ch in enumerate(row):
            if ch == 'k':
                for (dx, dy) in ((1, 0), (0, 1), (1, 1)):
                    if cv.get(w - 9 + i + dx, 3 + j + dy) not in (ix('b5'),):
                        cv.put(w - 9 + i + dx, 3 + j + dy, 'k0')
    for j, row in enumerate(NM):
        for i, ch in enumerate(row):
            if ch == 'k':
                cv.put(w - 9 + i, 3 + j, 'b5')
    cxm, cym = T(WB.P['frontier_camp'])
    marks = {'camp': (cxm, cym), 'throne': (tx, ty), 'scale': s,
             'labels': {'Thornwood': T((330, -330)), 'Ashfall': T((-470, 700)), 'Iron Throne': T((-560, 1210)),
                        'Borderlands': (cxm - 6, cym + 17)}}""")
rep('''import math
import os
import sys
''', '''import math
import os
import random
import sys
import zlib
''')
rep('''Thornwood is stippled with tiny pines, Ashfall with burnt ridge strokes, the Borderlands with field squares.''',
    '''Thornwood is stippled with tiny pines in clumps, Ashfall with burnt ridge strokes, the Borderlands with the main
view's own field squares; a small N marks north. marks['labels'] also holds 'Borderlands' (under the pin).''')
open(f, 'w', encoding='utf-8').write(s)
print('ok')
