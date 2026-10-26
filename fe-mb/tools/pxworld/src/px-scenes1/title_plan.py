"""The title's world plan in metres (X right of the camera, Z ahead of it). Shared by the render and the checks."""
import numpy as np

import persp as P

# the river's centreline (Z, X): it comes out of the far hills a little left of centre, winds toward us, runs under
# the bridge and swings off the right edge of the stage
RIVER = [(6, 21.0), (10, 17.6), (14, 15.2), (20, 13.2), (28, 11.8), (36, 11.0), (48, 11.5), (65, 14.0), (90, 17.0),
         (130, 18.0), (190, 14.0), (280, 6.0), (420, -6.0), (800, -30.0), (3000, -120.0)]
RIVER_W = 8.4


def river_x(Z):
    return np.interp(Z, [p[0] for p in RIVER], [p[1] for p in RIVER])


def river_w(Z):
    Z = np.where(np.isfinite(Z), Z, 0)
    return RIVER_W * (1 + .05 * np.sin(Z * .11))


# the bridge: square across the river; its south (near) face at BZ, its deck BD deep, parapets and approaches from
# BX0 to BX1
BZ = 36.0
BD = 4.6
BX0, BX1 = 4.6, 17.6
DECK_Z = BZ + BD / 2

# the road (X, Z): from under the company's feet up to the bridge's west head, over it, and away north-east
ROAD = [(-1.7, 8.0), (-1.3, 12.9), (-.6, 17.0), (.3, 22.0), (1.2, 27.0), (1.8, 31.5), (2.2, 35.0), (2.8, 37.4),
        (4.2, DECK_Z), (BX1 - 1.0, DECK_Z), (BX1 + 1.4, DECK_Z + .6), (21.8, DECK_Z + 3.0), (25.5, DECK_Z + 7.0),
        (30.5, DECK_Z + 12.5), (37.0, DECK_Z + 19.0), (46.0, DECK_Z + 26.0)]
ROAD_W = 4.0

# fields west of the road: (X0, X1, Z0, Z1, kind, rows, skew)
FIELDS = [
    (-30, -5.0, 19.5, 31, 'wheat', 'x', .05), (-60, -32, 20, 33, 'plough', 'z', .05),
    (-26, -4.6, 33.5, 47, 'crop', 'z', .03), (-62, -29, 35, 50, 'wheat2', 'x', .03),
    (-32, -6.5, 50, 72, 'plough', 'z', 0), (-74, -35, 53, 76, 'crop2', 'z', 0),
    (-38, -9, 76, 110, 'wheat', 'x', -.05), (-84, -41, 79, 115, 'crop', 'z', -.05),
    (-50, -12, 114, 165, 'crop2', 'z', -.06), (-110, -54, 118, 170, 'wheat2', 'x', -.06),
    (-60, -10, 170, 240, 'wheat', 'x', -.08),
    # on the far bank, round the village
    (52, 80, 52, 78, 'wheat', 'x', .1), (56, 96, 84, 120, 'crop', 'z', .1), (22, 40, 140, 190, 'plough', 'z', 0),
    (26, 60, 120, 140, 'wheat2', 'x', 0),
]

# the village on the far bank, east of the bridge: (X, Z, roof, wall, ridge, width m, seed)
VILLAGE = [
    (27.0, 60, 'tile', 'plaster', 'ew', 8.5, 1), (35.5, 66, 'thatch', 'timber', 'ns', 6.5, 2),
    (44.0, 71, 'tile2', 'plaster', 'ew', 9.0, 3), (31.0, 82, 'thatch', 'plaster', 'ew', 7.5, 4),
    (50.0, 86, 'slate', 'stone', 'ns', 7.0, 5), (39.0, 96, 'tile', 'timber', 'ew', 8.0, 6),
    (24.0, 98, 'tile2', 'stone', 'ns', 6.0, 7), (56.0, 104, 'thatch', 'plaster', 'ew', 8.0, 8),
]


def road_pts(n=24):
    out = []
    for i in range(len(ROAD) - 1):
        (x0, z0), (x1, z1) = ROAD[i], ROAD[i + 1]
        for k in range(n):
            t = k / n
            out.append((x0 + (x1 - x0) * t, z0 + (z1 - z0) * t))
    out.append(ROAD[-1])
    return out
