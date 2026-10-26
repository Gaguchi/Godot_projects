"""Variant A's settlement plans (places.lay format, stage px) and the camp's gates, for layout_a's streets.

The kit's MARKET, JUNCTION and PINE plans front the roads of the old layout; here the roads arrive from new sides,
so each place is re-laid with the same builders: houses front the street that is now there.
"""
# ---------------------------------------------------------------- Frontier Camp (660, 330): three gates, one per road
CAMP_GATES = [(664, 303), (625, 346), (662, 358)]       # where the roads to Trader's Rest, the ambush and the market leave
CAMP_GATE_HW = .27
CAMP_TENTS = [(-17, -3, 22, 13, 'canvas'), (19, -6, 18, 11, 'canvas'), (-3, 11, 16, 10, 'tan')]   # (dx, dy, w, h, cloth)
CAMP_FIRE = (17, 13)
COMPANY_AT = (672, 384)                                  # the middle figure's foot: on the road outside the south gate

# ---------------------------------------------------------------- Riverside Market (745, 470)
# the camp road comes in from the north-west, the mill road leaves north-east, the hideout road leaves west
MARKET_AT = (745, 470)
MARKET = [
    ('square', [(724, 448), (768, 448), (773, 453), (774, 474), (769, 479), (726, 479), (720, 474), (720, 452)]),
    # north side, between the camp road and the mill road: the inn (L, its wing on the square) and a gable house
    ('L', 741, 446, dict(w=22, wing_w=11, side='e', proj=3, roof='tile', chimney='w', seed=21)),
    ('yard', 730, 446, 26, 3),
    # north-west, along the camp road as it comes down to the square
    ('ns', 694, 442, dict(w=11, roof='tile2', seed=22, chimney='e')),
    ('ew', 680, 418, dict(w=13, roof='thatch', d=8, h=5, windows=2, seed=23)),
    ('yard', 688, 443, 13, 3), ('yard', 674, 419, 14, 3),
    # east side, past the mill road
    ('ns', 790, 463, dict(w=11, roof='tile', seed=24)),
    ('ew', 806, 448, dict(w=14, roof='slate', seed=25, chimney='e')),
    ('yard', 784, 464, 14, 3),
    # south side, their backs to the square and their fronts to the river
    ('ew', 731, 501, dict(w=15, roof='tile2', back=True, seed=28)),
    ('ns', 751, 503, dict(w=11, roof='tile', back=True, seed=29)),
    ('ew', 772, 499, dict(w=14, roof='tile', back=True, seed=30, chimney='w')),
    # south-west, below the hideout road: a cottage with its kitchen garden
    ('ew', 703, 497, dict(w=12, roof='thatch', back=True, seed=31)),
    ('garden', 680, 480, 11, 8, 'greens'), ('ring', 679, 479, 691, 489, [('n', 683, 686)]),
    # the market: three stalls on the square's south half, the well in its middle
    ('well', 746, 462),
    ('stall', 734, 476, 'red', 'apples'), ('stall', 748, 477, 'blue', 'cloth'), ('stall', 762, 476, 'ochre', 'bread'),
    ('prop', 727, 462, 'barrel'), ('prop', 768, 459, 'crate'), ('prop', 757, 463, 'sack'),
]

# ---------------------------------------------------------------- South Junction (255, 300): four roads cross
# the ambush road comes in from the east, the hideout road from the south-east; the cave road leaves south across
# the ford, the bridge road west along the north bank
JUNCTION_AT = (290, 392)
JUNCTION = [
    # the north row fronts the street (the bridge road west, the hideout road east), doors on its north verge
    ('ew', 210, 384, dict(w=13, roof='tile', seed=41, chimney='w')),
    ('ns', 231, 383, dict(w=11, roof='tile2', seed=42)),
    ('ew', 252, 384, dict(w=14, roof='thatch', seed=44, chimney='e')),
    ('ns', 274, 382, dict(w=9, roof='tile2', d=7, seed=45)),
    # in the fork between the ambush road and the hideout road
    ('ns', 334, 392, dict(w=9, roof='tile', d=7, seed=47)),
    # the ambush road's north side
    ('ew', 356, 360, dict(w=14, roof='tile2', seed=46, chimney='e')),
    ('yard', 203, 385, 78, 2),
    ('garden', 196, 362, 11, 8, 'cabbage'), ('fence', 195, 371, 207, 371), ('fence', 195, 362, 195, 371),
    ('prop', 304, 406, 'sign'),
]

# ---------------------------------------------------------------- Pine Crossing (820, 600): the street runs west to
# north-east; the mill road and the fortress road leave north-east, the hideout road and Roderick's road west
PINE_AT = (820, 600)
PINE = [
    ('ns', 812, 594, dict(w=11, roof='shingle', wall='timber', seed=61)),
    ('ew', 834, 586, dict(w=15, roof='shingle', seed=62, chimney='e')),
    ('ew', 806, 630, dict(w=14, roof='tile2', back=True, seed=65)),
    ('ns', 828, 632, dict(w=11, roof='shingle', back=True, seed=64)),
    ('barn', 788, 592, dict(w=15, ridge='ew', roof='shingle', d=8, h=6, seed=66)),
    ('yard', 796, 594, 26, 3),
    ('prop', 778, 596, 'woodpile'),
]

GROUND_YARDS = []

# Watchtower Ridge (1010, 210): its ring gated south (the mill road, the fortress road) and north-west (North Ridge Path)
WATCH_GATES = [(1.62, .42), (-2.36, .36)]

# ---------------------------------------------------------------- finger-posts where the roads leave the view
EDGE_POSTS = [   # (foot x, foot y, which way the board points: n | s carry a plaque, e | w an arm)
    (911, 40, 'n'),        # North Ridge Path: both roads leave the top edge together
    (1250, 403, 'e'),      # Borderland Shrine
    (1250, 503, 'e'),      # Thornwood Gate
    (507, 692, 's'),       # Southern Trail
    (28, 377, 'w'),        # Broken Bridge, the north bank road
    (28, 459, 'w'),        # Broken Bridge, the south bank road
]
