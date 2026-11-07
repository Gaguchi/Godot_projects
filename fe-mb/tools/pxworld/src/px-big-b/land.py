"""The big country's data (variant B at four times the area): every place, every road, the river and the brook,
the zones. Pure data and graph helpers; world_big.py draws it, the boards label it.

The frame is WORLD px at 1x. The heartland (the Borderlands) is [0, 2560] x [0, 1440] and Frontier Camp stands in
its middle at (1280, 720). The wild country (Thornwood north and east, Ashfall west and south) lies beyond the
heartland's edges in the same frame, out to about x -1300..3560 and y -880..2400.

Every one of the game's 47 places keeps its name, type and region. Its position is B's (dirs/px-open-b/world_b.py)
scaled x2 about the camp: world = (1280 + 2 (x - 600), 720 + 2 (y - 410)). Old Mill Crossing moves 8 px onto the
river (the mill's wheel turns in it). The new places sit between them (NEW, with their jobs).
"""
import math
import random
import zlib
from collections import defaultdict, deque

CAMP_B = (600, 410)
CAMP = (1280, 720)
HEART_WH = (2560, 1440)
VIEW = (640, 360)                       # the map screen's 1280 x 720 window, centred on the camp


def from_b(p):
    return (CAMP[0] + 2 * (p[0] - CAMP_B[0]), CAMP[1] + 2 * (p[1] - CAMP_B[1]))


# ================================================================ the game's 47 places (world.json, read 2026-10-24)
GAME = {
    'frontier_camp': dict(name='Frontier Camp', type='CAMP', region='borderlands'),
    'darens_camp': dict(name="Daren's Camp", type='DISCOVERY', region='borderlands', hidden=True, sigil='battle'),
    'riverside_market': dict(name='Riverside Market', type='TOWN', region='borderlands'),
    'south_road_ambush': dict(name='South Road Ambush', type='DISCOVERY', region='borderlands', sigil='battle'),
    'old_mill_crossing': dict(name='Old Mill Crossing', type='TRAIL', region='borderlands', sigil='waypoint'),
    'bandit_hideout': dict(name='Bandit Hideout', type='DISCOVERY', region='borderlands', sigil='battle'),
    'south_junction': dict(name='South Junction', type='TOWN', region='borderlands'),
    'watchtower_ridge': dict(name='Watchtower Ridge', type='CAMP', region='borderlands', sigil='fortress'),
    'pine_crossing': dict(name='Pine Crossing', type='TOWN', region='borderlands'),
    'smugglers_cave': dict(name="Smuggler's Cave", type='DUNGEON', region='borderlands', locked=True, sigil='dungeon'),
    'border_fortress': dict(name='Border Fortress', type='CAMP', region='borderlands', sigil='fortress'),
    'rodericks_camp': dict(name="Roderick's Camp", type='CAMP', region='borderlands'),
    'traders_rest': dict(name="Trader's Rest", type='CAMP', region='borderlands'),
    'north_ridge_path': dict(name='North Ridge Path', type='TRAIL', region='borderlands', sigil='waypoint'),
    'broken_bridge': dict(name='Broken Bridge', type='TRAIL', region='borderlands', sigil='bridge'),
    'borderland_shrine': dict(name='Borderland Shrine', type='DISCOVERY', region='borderlands', sigil='shrine'),
    'thornwood_gate': dict(name='Thornwood Gate', type='CAMP', region='thornwood', sigil='fortress'),
    'southern_trail': dict(name='Southern Trail', type='TRAIL', region='thornwood', sigil='waypoint'),
    'thornwood_chapel': dict(name='Thornwood Chapel', type='TOWN', region='thornwood'),
    'dark_hollow': dict(name='Dark Hollow', type='CAMP', region='thornwood'),
    'cursed_clearing': dict(name='Cursed Clearing', type='CAMP', region='thornwood'),
    'hermits_tower': dict(name="Hermit's Tower", type='CAMP', region='thornwood', sigil='fortress'),
    'wolf_den': dict(name='Wolf Den', type='CAMP', region='thornwood', sigil='dungeon'),
    'witchs_hut': dict(name="Witch's Hut", type='CAMP', region='thornwood'),
    'ancient_ruins': dict(name='Ancient Ruins', type='DUNGEON', region='thornwood'),
    'morganas_grove': dict(name="Morgana's Grove", type='CAMP', region='thornwood'),
    'foggy_marsh': dict(name='Foggy Marsh', type='TRAIL', region='thornwood', sigil='waypoint'),
    'spiders_nest': dict(name="Spider's Nest", type='CAMP', region='thornwood'),
    'druids_circle': dict(name="Druid's Circle", type='CAMP', region='thornwood'),
    'moonlit_glade': dict(name='Moonlit Glade', type='CAMP', region='thornwood'),
    'thornwood_depths': dict(name='Thornwood Depths', type='DUNGEON', region='thornwood'),
    'mountain_pass': dict(name='Mountain Pass', type='TRAIL', region='ashfall', sigil='waypoint'),
    'ashfall_trail': dict(name='Ashfall Trail', type='TRAIL', region='ashfall', sigil='waypoint'),
    'ashfall_outpost': dict(name='Ashfall Outpost', type='TOWN', region='ashfall'),
    'lava_fields': dict(name='Lava Fields', type='CAMP', region='ashfall'),
    'scorched_village': dict(name='Scorched Village', type='CAMP', region='ashfall'),
    'dragons_lookout': dict(name="Dragon's Lookout", type='CAMP', region='ashfall', sigil='fortress'),
    'iron_mine': dict(name='Iron Mine', type='DUNGEON', region='ashfall', sigil='dungeon'),
    'sulfur_springs': dict(name='Sulfur Springs', type='CAMP', region='ashfall'),
    'cragmaw_fortress': dict(name='Cragmaw Fortress', type='CAMP', region='ashfall', sigil='fortress'),
    'final_approach': dict(name='Final Approach', type='TRAIL', region='ashfall', sigil='waypoint'),
    'the_iron_throne': dict(name='The Iron Throne', type='BOSS', region='ashfall', sigil='boss'),
    'ember_creek': dict(name='Ember Creek', type='TRAIL', region='ashfall', sigil='waypoint'),
    'ruined_chapel': dict(name='Ruined Chapel', type='DISCOVERY', region='ashfall', sigil='shrine'),
    'obsidian_cavern': dict(name='Obsidian Cavern', type='DUNGEON', region='ashfall', sigil='dungeon'),
    'warlords_camp': dict(name="Warlord's Camp", type='DISCOVERY', region='ashfall', sigil='battle'),
    'ashen_gate': dict(name='Ashen Gate', type='CAMP', region='ashfall', sigil='fortress'),
}
# B's positions (stage px of the PxOpenB view; dirs/px-open-b/world_b.P, copied 2026-10-25)
B_POS = {
    'frontier_camp': (600, 410), 'north_ridge_path': (590, 275), 'riverside_market': (805, 395),
    'south_road_ambush': (588, 552), 'traders_rest': (420, 360), 'darens_camp': (500, 468),
    'watchtower_ridge': (750, 190), 'old_mill_crossing': (965, 330), 'south_junction': (650, 640),
    'bandit_hideout': (250, 410), 'border_fortress': (886, 124), 'pine_crossing': (1100, 375),
    'broken_bridge': (1046, 658), 'smugglers_cave': (1140, 582), 'borderland_shrine': (138, 330),
    'rodericks_camp': (1172, 460),
    'thornwood_gate': (880, -210), 'thornwood_chapel': (740, -320), 'druids_circle': (670, -150),
    'hermits_tower': (450, -160), 'moonlit_glade': (270, -220), 'ancient_ruins': (90, -150),
    'foggy_marsh': (1160, -160), 'dark_hollow': (1040, -300), 'wolf_den': (540, -350),
    'southern_trail': (1480, 540), 'cursed_clearing': (1430, 100), 'spiders_nest': (1430, 310),
    'witchs_hut': (1600, 420), 'thornwood_depths': (1710, 660), 'morganas_grove': (1430, 750),
    'ashfall_trail': (1010, 930), 'ruined_chapel': (730, 950), 'scorched_village': (430, 880),
    'sulfur_springs': (150, 970), 'warlords_camp': (20, 1190), 'final_approach': (-120, 990),
    'ashen_gate': (-400, 1030), 'the_iron_throne': (-560, 1210), 'cragmaw_fortress': (-460, 730),
    'obsidian_cavern': (-670, 610), 'iron_mine': (-290, 870), 'dragons_lookout': (-520, 430),
    'lava_fields': (-150, 700), 'ember_creek': (-330, 510), 'ashfall_outpost': (-530, 150),
    'mountain_pass': (-250, 290),
}
# B's 68 roads (world_b.b_roads(): the game's, less 5 removed, plus 5 added)
B_ROADS = [
    ('frontier_camp', 'riverside_market'), ('frontier_camp', 'south_road_ambush'), ('frontier_camp', 'traders_rest'),
    ('riverside_market', 'old_mill_crossing'), ('south_road_ambush', 'south_junction'),
    ('old_mill_crossing', 'watchtower_ridge'), ('old_mill_crossing', 'pine_crossing'),
    ('old_mill_crossing', 'north_ridge_path'), ('south_junction', 'smugglers_cave'), ('south_junction', 'broken_bridge'),
    ('watchtower_ridge', 'border_fortress'), ('watchtower_ridge', 'north_ridge_path'), ('pine_crossing', 'border_fortress'),
    ('pine_crossing', 'rodericks_camp'), ('smugglers_cave', 'rodericks_camp'), ('smugglers_cave', 'broken_bridge'),
    ('thornwood_gate', 'thornwood_chapel'), ('thornwood_gate', 'dark_hollow'), ('thornwood_gate', 'foggy_marsh'),
    ('southern_trail', 'cursed_clearing'), ('southern_trail', 'spiders_nest'), ('thornwood_chapel', 'hermits_tower'),
    ('thornwood_chapel', 'druids_circle'), ('dark_hollow', 'cursed_clearing'), ('dark_hollow', 'wolf_den'),
    ('dark_hollow', 'foggy_marsh'), ('cursed_clearing', 'witchs_hut'), ('cursed_clearing', 'spiders_nest'),
    ('hermits_tower', 'ancient_ruins'), ('hermits_tower', 'moonlit_glade'), ('wolf_den', 'ancient_ruins'),
    ('witchs_hut', 'morganas_grove'), ('witchs_hut', 'thornwood_depths'), ('ancient_ruins', 'moonlit_glade'),
    ('morganas_grove', 'thornwood_depths'), ('mountain_pass', 'ashfall_outpost'), ('mountain_pass', 'lava_fields'),
    ('mountain_pass', 'ember_creek'), ('ashfall_trail', 'scorched_village'), ('ashfall_trail', 'ruined_chapel'),
    ('ashfall_outpost', 'dragons_lookout'), ('lava_fields', 'scorched_village'), ('lava_fields', 'iron_mine'),
    ('lava_fields', 'ember_creek'), ('scorched_village', 'sulfur_springs'), ('scorched_village', 'ruined_chapel'),
    ('dragons_lookout', 'cragmaw_fortress'), ('dragons_lookout', 'obsidian_cavern'), ('iron_mine', 'cragmaw_fortress'),
    ('iron_mine', 'final_approach'), ('sulfur_springs', 'final_approach'), ('sulfur_springs', 'warlords_camp'),
    ('cragmaw_fortress', 'obsidian_cavern'), ('cragmaw_fortress', 'ashen_gate'), ('final_approach', 'warlords_camp'),
    ('final_approach', 'ashen_gate'), ('the_iron_throne', 'ashen_gate'), ('border_fortress', 'thornwood_gate'),
    ('rodericks_camp', 'southern_trail'), ('ancient_ruins', 'mountain_pass'), ('morganas_grove', 'ashfall_trail'),
    ('frontier_camp', 'darens_camp'), ('darens_camp', 'south_road_ambush'), ('frontier_camp', 'north_ridge_path'),
    ('traders_rest', 'bandit_hideout'), ('bandit_hideout', 'borderland_shrine'), ('borderland_shrine', 'mountain_pass'),
    ('broken_bridge', 'ashfall_trail'),
]

P = {k: from_b(v) for k, v in B_POS.items()}
P['old_mill_crossing'] = (2018, 560)          # onto the river: the wheel turns in it (river_x(555) - 9)

# ================================================================ the new places of the heartland (proposals)
from heart_data import HEART, HEART_ROADS   # noqa: E402

# ================================================================ water
# the river: B's course scaled x2 about the camp (north to south), carried on into Thornwood and Ashfall
RIVER = [from_b(p) for p in [(925, -20), (950, 120), (970, 250), (974, 338), (982, 400), (1006, 470), (1022, 540),
                             (1030, 600), (1040, 640), (1052, 676), (1064, 740)]]
RIVER_FAR = [(1890, -900), (1900, -520)] + RIVER + [(2236, 1640), (2300, 2000), (2380, 2420)]
RIVER_HW = 10.0
# the brook: out of Thornwood's pines at the top, south past the camp's west road, then west into Ashfall
BROOK = [(1010, -20), (1004, 110), (1030, 240), (1046, 380), (1040, 520), (1050, 640), (1036, 760), (1004, 880),
         (960, 990), (880, 1080), (770, 1140), (640, 1180), (500, 1200), (360, 1210), (230, 1200), (100, 1180),
         (-30, 1170)]
BROOK_FAR = [(980, -500), (1000, -200)] + BROOK + [(-300, 1100), (-580, 940), (-860, 860)]
BROOK_HW = 6.0


def spline(points, n=12):
    """A Catmull-Rom spline through points, n samples per span."""
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(points[-1])
    return out


river_pts = spline(RIVER, 24)
brook_pts = spline(BROOK, 24)


def course_x(pts, y):
    """A north-south course's centre x at row y (the nearest sample)."""
    return min(pts, key=lambda q: abs(q[1] - y))[0]


# ================================================================ the zones of the heartland (world px)
ZONES = {
    # Thornwood's pines: a band along the whole top (thin in the west, where it meets Ashfall) and down the
    # right-hand side to the south-east corner's marsh; the river and the brook come down out of it
    'thornwood': [(-12, -12), (2572, -12), (2572, 1180), (2540, 1160), (2512, 1110), (2486, 1040), (2508, 970),
                  (2490, 900), (2512, 840), (2470, 760), (2440, 690), (2452, 610), (2420, 540), (2432, 470),
                  (2400, 400), (2412, 330), (2380, 262), (2392, 210), (2340, 186), (2290, 200), (2240, 168),
                  (2196, 176), (2130, 150), (2080, 158), (2040, 128), (1990, 112), (1940, 86), (1880, 74), (1820, 60),
                  (1760, 82), (1700, 112), (1640, 150), (1586, 160), (1540, 142), (1470, 160), (1420, 176),
                  (1360, 150), (1300, 132), (1240, 112), (1190, 92), (1130, 108), (1070, 116), (1030, 84),
                  (980, 92), (920, 70), (860, 58), (820, 76), (760, 70), (710, 48), (640, 40), (560, 52), (480, 38),
                  (400, 50), (320, 40), (240, 56), (160, 44), (80, 60), (-12, 52)],
    # Ashfall's dry grass, scorched earth and ash: a band down the whole left side and along the whole foot
    # (tongues reach in along the roads out to Mountain Pass, the Grey Dunes and Ashfall Trail)
    'ashfall': [(-12, 90), (50, 96), (96, 130), (120, 176), (110, 230), (150, 280), (214, 300), (236, 340),
                (206, 384), (220, 424), (262, 470), (300, 500), (292, 546), (250, 590), (190, 628), (110, 652), (66, 700),
                (64, 760), (120, 806), (176, 860), (226, 916), (270, 960), (262, 1020), (230, 1070), (270, 1120),
                (330, 1150), (372, 1180), (420, 1250), (500, 1284), (590, 1290), (660, 1336), (770, 1372),
                (870, 1330), (930, 1340), (1000, 1386), (1080, 1350), (1150, 1290), (1220, 1270), (1300, 1250),
                (1380, 1262), (1430, 1300), (1520, 1322), (1580, 1352), (1640, 1350), (1720, 1366), (1800, 1330),
                (1860, 1300), (1940, 1290), (2010, 1300), (2080, 1276), (2130, 1290), (2196, 1300), (2250, 1322),
                (2330, 1300), (2400, 1318), (2470, 1330), (2530, 1300), (2572, 1290), (2572, 1452), (-12, 1452)],
}
# the map screen's windows (PxBigMap), in world px: nothing that needs reading should stand under them
_UI_VIEW = [(14, 14, 488, 192), (982, 14, 1268, 138), (14, 496, 408, 712)]
UI_WORLD = [(VIEW[0] + a, VIEW[1] + b, VIEW[0] + c, VIEW[1] + d) for (a, b, c, d) in _UI_VIEW]

# ================================================================ the whole country, assembled
try:
    from wild_data import WILD, WILD_ROADS, EXIT_ROADS      # noqa: E402  (wild_gen.py writes it)
except ImportError:                                          # while wild_gen.py runs for the first time
    WILD, WILD_ROADS, EXIT_ROADS = {}, [], []
try:
    from wild_data import MOVED          # noqa: E402  game places wild_gen.py moved (the throne's approach)
except ImportError:
    MOVED = {}
P.update(MOVED)

NODE = {k: dict(v) for k, v in GAME.items()}
JOB = {}
for _k, (_n, _t, _s, _p, _j) in HEART.items():
    NODE[_k] = dict(name=_n, type=_t, region='borderlands', **({'sigil': _s} if _s else {}))
    P[_k] = _p
    JOB[_k] = _j
for _k, (_n, _t, _s, _p, _r, _j) in WILD.items():
    NODE[_k] = dict(name=_n, type=_t, region=_r, **({'sigil': _s} if _s else {}))
    P[_k] = _p
    JOB[_k] = _j
NEW = set(HEART) | set(WILD)
NAMES = {k: v['name'] for k, v in NODE.items()}


def table_of(a, b):
    """The road's encounterTableId: a road inside the heartland is a Borderlands road; a road that touches a wild
    place is that region's road (the rim roads take the wild end's)."""
    ra, rb = NODE[a]['region'], NODE[b]['region']
    if ra == rb == 'borderlands':
        return 'borderlands_road'
    r = rb if ra == 'borderlands' else (ra if rb == 'borderlands' else ra)
    if ra != rb and 'borderlands' not in (ra, rb):
        r = rb                                               # a road between the two wild regions: the far end's
    return f'{r}_road'


def roads():
    return [(a, b, table_of(a, b)) for a, b in HEART_ROADS + WILD_ROADS + EXIT_ROADS]


def hops(rs=None, start='frontier_camp'):
    """BFS hop distance from the camp over visible places (engine/content.ts#nodeDistances skips hidden ones)."""
    rs = roads() if rs is None else rs
    hidden = {k for k, n in NODE.items() if n.get('hidden')}
    adj = defaultdict(list)
    for a, b, *_ in rs:
        if a in hidden or b in hidden:
            continue
        adj[a].append(b)
        adj[b].append(a)
    d = {start: 0}
    q = deque([start])
    while q:
        u = q.popleft()
        for v in adj[u]:
            if v not in d:
                d[v] = d[u] + 1
                q.append(v)
    return d


def tier(h, bands=(2, 5)):
    """rules.ts travel.tierByDistance (today 2 / 5): tier 1 up to bands[0] hops, tier 2 up to bands[1], then 3."""
    return 1 if h <= bands[0] else (2 if h <= bands[1] else 3)


def in_heart(k):
    x, y = P[k]
    return 0 <= x < HEART_WH[0] and 0 <= y < HEART_WH[1]


def heart_places():
    """Every place drawn in the heartland on day 1 (Daren's Camp is hidden until found)."""
    return [k for k in P if NODE[k]['region'] == 'borderlands' and not NODE[k].get('hidden')]
