"""Variant A layout: the Borderlands laid round Frontier Camp. The graph is world.json's, unchanged; only positions.

Stage px (the 1280 x 720 view). Places off the view sit just past their edge: Broken Bridge west, North Ridge
Path north, Borderland Shrine and Thornwood Gate east, Southern Trail south. Daren's Camp is hidden on day 1
(world.json `hidden`), so neither it nor its two roads are drawn.

The river comes down from the north, runs under the mill bridge at Old Mill Crossing (flowing north-south, as the
kit's east-west timber deck needs), curls round the camp's meadow to the east and south, and leaves west for
Broken Bridge. Every road that meets it crosses at the mill, at a ford, or (off the view) at Broken Bridge.
"""
NAMES = {
    'frontier_camp': 'Frontier Camp', 'traders_rest': "Trader's Rest", 'riverside_market': 'Riverside Market',
    'south_road_ambush': 'South Road Ambush', 'old_mill_crossing': 'Old Mill Crossing', 'bandit_hideout': 'Bandit Hideout',
    'south_junction': 'South Junction', 'north_ridge_path': 'North Ridge Path', 'watchtower_ridge': 'Watchtower Ridge',
    'pine_crossing': 'Pine Crossing', 'smugglers_cave': "Smuggler's Cave", 'broken_bridge': 'Broken Bridge',
    'border_fortress': 'Border Fortress', 'rodericks_camp': "Roderick's Camp", 'borderland_shrine': 'Borderland Shrine',
    'thornwood_gate': 'Thornwood Gate', 'southern_trail': 'Southern Trail', 'darens_camp': "Daren's Camp",
}

P = {
    'frontier_camp': (660, 330),
    'traders_rest': (700, 160),
    'south_road_ambush': (500, 415),
    'riverside_market': (745, 470),
    'darens_camp': (500, 240),            # hidden until discovered: not drawn on day 1
    'old_mill_crossing': (885, 285),
    'bandit_hideout': (600, 455),
    'south_junction': (290, 392),
    'smugglers_cave': (150, 468),
    'broken_bridge': (-45, 418),          # off the view, west
    'rodericks_camp': (480, 615),
    'pine_crossing': (820, 600),
    'border_fortress': (1060, 480),
    'watchtower_ridge': (1010, 210),
    'north_ridge_path': (905, -40),       # off the view, north
    'borderland_shrine': (1320, 380),     # off the view, east
    'thornwood_gate': (1320, 510),        # off the view, east (Thornwood)
    'southern_trail': (500, 780),         # off the view, south (Thornwood)
}
OFF = {'broken_bridge', 'north_ridge_path', 'borderland_shrine', 'thornwood_gate', 'southern_trail'}
HIDDEN = {'darens_camp'}

# the river, north end first (terrain.river shades the right-hand bank as the shadowed one: heading south, then west)
RIVER = [(735, -40), (782, 50), (845, 128), (872, 190), (893, 291), (890, 385), (858, 465), (790, 530), (690, 560),
         (600, 550), (530, 522), (470, 486), (400, 456), (320, 436), (220, 426), (110, 420), (-45, 418)]

# the mill bridge's deck ends, from the kit's mill (places.mill lays the deck at (801, 306) for a mill at (812, 298))
def mill_heads(p):
    return (p[0] - 12, p[1] + 6), (p[0] + 29, p[1] + 6)


MILL_W, MILL_E = mill_heads(P['old_mill_crossing'])

# every road of world.json among the Borderlands' places (Daren's two are hidden), each as a polyline of waypoints
# from the first place to the second (stage px; the ends are where the road meets the place's ground)
# each place's apron, where its roads meet it
CAMP_N, CAMP_SW, CAMP_S = (664, 303), (625, 346), (662, 358)
JN = (290, 392)                                   # South Junction's crossroads
BH_A = (604, 484)                                 # in front of Bandit Hideout's fire pit
CAVE_A = (150, 485)                               # in front of Smuggler's Cave's barred mouth
MILL_STUB = [(MILL_E[0] - 2, MILL_E[1]), (MILL_E[0] + 10, MILL_E[1]), (MILL_E[0] + 22, MILL_E[1])]   # level off the deck
FORT_G = (1058, 502)                              # before Border Fortress's gate
ROADS = [
    ('frontier_camp', 'riverside_market', [CAMP_S, (672, 376), (690, 400), (714, 434), (728, 453)]),
    ('frontier_camp', 'south_road_ambush', [CAMP_SW, (592, 364), (552, 388), (524, 404)]),
    ('frontier_camp', 'traders_rest', [CAMP_N, (676, 240), (698, 178)]),
    ('riverside_market', 'old_mill_crossing', [(772, 450), (802, 404), (830, 340), (846, 304), (858, 294),
                                               (MILL_W[0] + 2, MILL_W[1])]),
    ('riverside_market', 'bandit_hideout', [(720, 468), (690, 470), (650, 476), (620, 483), BH_A]),
    ('south_road_ambush', 'south_junction', [(478, 412), (440, 392), (382, 368), (330, 372), (304, 386), JN]),
    ('old_mill_crossing', 'watchtower_ridge', MILL_STUB + [(960, 276), (990, 248), (1008, 234)]),
    ('old_mill_crossing', 'pine_crossing', MILL_STUB + [(950, 320), (958, 420), (930, 500), (866, 578), (826, 601)]),
    ('old_mill_crossing', 'north_ridge_path', MILL_STUB + [(942, 262), (932, 200), (924, 130), (921, 72), (920, 30), (920, -10)]),
    ('bandit_hideout', 'south_junction', [BH_A, (566, 478), (520, 462), (470, 444), (420, 424), (360, 404), (318, 396), JN]),
    ('bandit_hideout', 'pine_crossing', [BH_A, (630, 512), (664, 556), (712, 580), (770, 594), (800, 600), (820, 602)]),
    ('south_junction', 'smugglers_cave', [JN, (266, 406), (238, 426), (216, 448), (206, 468), (186, 483), CAVE_A]),
    ('south_junction', 'broken_bridge', [JN, (240, 391), (150, 389), (60, 384), (-10, 382)]),
    ('watchtower_ridge', 'border_fortress', [(1012, 234), (1030, 262), (1042, 330), (1020, 420), (1005, 472), (1020, 500), FORT_G]),
    ('watchtower_ridge', 'north_ridge_path', [(992, 205), (970, 174), (946, 124), (928, 90), (921, 56), (920, 30), (920, -10)]),
    ('pine_crossing', 'border_fortress', [(826, 601), (850, 590), (940, 548), (1022, 512), FORT_G]),
    ('pine_crossing', 'rodericks_camp', [(806, 607), (776, 622), (700, 640), (610, 640), (510, 624)]),
    ('smugglers_cave', 'rodericks_camp', [CAVE_A, (190, 487), (250, 485), (330, 483), (396, 487), (430, 504), (452, 540), (470, 598)]),
    ('smugglers_cave', 'broken_bridge', [CAVE_A, (110, 486), (70, 474), (30, 452), (-10, 446)]),
    ('border_fortress', 'borderland_shrine', [FORT_G, (1100, 492), (1150, 456), (1210, 420), (1290, 398)]),
    ('border_fortress', 'thornwood_gate', [FORT_G, (1110, 506), (1200, 508), (1290, 512)]),
    ('rodericks_camp', 'southern_trail', [(486, 640), (494, 690), (498, 730)]),
]
HIDDEN_ROADS = [('frontier_camp', 'darens_camp'), ('darens_camp', 'south_road_ambush')]
OUT_ROADS = {('frontier_camp', 'riverside_market'), ('frontier_camp', 'south_road_ambush'), ('frontier_camp', 'traders_rest')}
HOVER = ('frontier_camp', 'riverside_market')

# where a road wades the river: road key -> the current's direction at the ford (downstream)
FORDS = {('bandit_hideout', 'pine_crossing'): (-.98, .2), ('south_junction', 'smugglers_cave'): (-.99, -.1)}
CROSS = set(FORDS) | {('riverside_market', 'old_mill_crossing'), ('old_mill_crossing', 'watchtower_ridge'),
                      ('old_mill_crossing', 'pine_crossing'), ('old_mill_crossing', 'north_ridge_path')}   # for plan.py
CROSSINGS = [(MILL_W[0] + 20, MILL_W[1]), (664, 556), (238, 426)]      # the mill and the two fords (kept clear of reeds)

# the edges the roads leave by: (stage point at the edge, label anchor, what lies that way)
EXITS = [
    ('north_ridge_path', (918, -2), 'North Ridge Path'),
    ('borderland_shrine', (1280, 399), 'Borderland Shrine'),
    ('thornwood_gate', (1280, 509), 'Thornwood Gate'),
    ('southern_trail', (498, 720), 'Southern Trail'),
    ('broken_bridge', (0, 382), 'Broken Bridge'),
    ('broken_bridge', (0, 446), 'Broken Bridge'),
]

# ---------------------------------------------------------------- the country between the places
FIELDS = [
    # the camp's meadow, inside the river's bend
    ([(724, 368), (790, 358), (796, 398), (736, 410)], 'h64-wheat'),
    ([(748, 226), (826, 212), (840, 268), (760, 282)], 'h64-crop'),
    ([(560, 262), (628, 252), (640, 300), (572, 310)], 'h64-wheat2'),
    ([(468, 306), (530, 298), (536, 338), (474, 346)], 'plough'),
    ([(372, 300), (440, 292), (448, 340), (380, 348)], 'h64-crop2'),
    ([(590, 150), (650, 140), (660, 190), (600, 198)], 'h64-crop'),
    # beyond the river
    ([(580, 640), (676, 628), (690, 684), (594, 696)], 'plough'),
    ([(880, 648), (958, 634), (972, 690), (892, 702)], 'h64-wheat'),
    ([(1104, 236), (1182, 222), (1196, 282), (1116, 296)], 'h64-wheat2'),
    ([(960, 352), (1028, 342), (1036, 392), (968, 402)], 'h64-crop'),
    ([(36, 262), (122, 252), (132, 304), (46, 314)], 'h64-wheat'),
    ([(310, 212), (384, 204), (392, 248), (318, 258)], 'plough'),
]
HILLS = [   # (x, y, rx, ry, rot) in stage px
    (702, 146, 74, 34, 0), (1012, 196, 84, 40, 6), (1078, 466, 96, 46, -4), (140, 456, 84, 34, 0), (1160, 170, 80, 38, 0),
    (650, 662, 96, 38, 0), (330, 232, 84, 34, 0), (990, 640, 84, 38, 0), (560, 196, 70, 30, 0), (420, 300, 60, 26, 0),
    (1210, 330, 70, 34, 0), (90, 300, 70, 30, 0),
]
RIDGES = {(1012, 196), (1078, 466), (140, 456), (1160, 170)}
CREST = [(986, 172, 6), (1004, 166, 5), (1036, 176, 7), (1050, 186, 5), (1060, 438, 7), (1082, 434, 6), (1102, 440, 5),
         (1140, 150, 6), (1162, 146, 5)]
FORESTS = [
    ([(986, -10), (1300, -10), (1300, 178), (1214, 150), (1110, 118), (1020, 96)], 'leaf'),
    ([(966, 566), (1300, 540), (1300, 686), (970, 686), (930, 670), (960, 620)], 'pine'),
    ([(556, 708), (636, 702), (646, 740), (548, 740)], 'leaf'),
    ([(-10, 186), (220, 186), (236, 226), (140, 252), (-10, 246)], 'leaf'),
    ([(486, -10), (650, -10), (660, 58), (580, 96), (486, 88)], 'leaf'),
    ([(1150, 280), (1300, 270), (1300, 360), (1170, 362)], 'pine'),
    ([(370, 186), (486, 186), (486, 200), (420, 214), (372, 204)], 'leaf'),
]
FARMS = [(612, 220, 0), (680, 650, 2), (110, 290, 3), (1150, 250, 4), (360, 262, 5)]   # (x, y, plan i of places.FARM_PLANS)
RIVER_ROCKS = [(886, 140, -3), (870, 430, 4), (420, 462, -2), (130, 420, 3)]
