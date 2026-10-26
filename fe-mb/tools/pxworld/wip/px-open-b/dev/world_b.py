"""Variant B's world: the camp at the hub, the wilds all round. One importable module (variant C builds on it).

    import sys; sys.path.insert(0, '<scratchpad>/dirs/px-open-b')
    import world_b as WB
    cv, info = WB.render(company=True)        # True: in the camp yard; False: nobody; (x, y): the middle figure's
                                              # foot on that stage point (y-sorted with everything else)
    uri = cv.data_uri()                       # 1280 x 720, show at 1:1 with image-rendering:pixelated

Layout data, all in STAGE px (the view is [0, 1280] x [0, 720]; the wild country lies beyond its edges in the
same frame, so a route can be measured across the whole country):
    P[id]                 every one of the game's 47 places; drawn(id) for the 15 drawn on this screen on day 1
    NODE[id], NAMES[id]   type, region, hidden / locked / sigil flags (world.json, read 2026-10-24)
    b_roads()             B's 68 roads as (a, b, encounterTableId); REMOVED / ADDED list the changes from the game
    hops(), tier(h)       BFS distance from Frontier Camp over visible places, and the tier band it implies
    road_paths()          {(a, b): fine polyline} for every road; the ones that cross the river end on the
                          bridge heads (BRIDGES) or wade at the fords; the four edge roads run on off the screen;
                          a road to a place in DOOR ends at its door (the cave mouths), not at P
    RIVER, river_pts, RIVER_HW, river_x(y)   the river's course (north to south), half-width of open water
    BRIDGES               {'old_mill_crossing': deck ends, 'broken_bridge': abutment ends} in stage px
    FORD_ROADS            the roads that wade the river; render() returns info['fords'] = [(road, point)]
    ZONES, WOODS, FIELDS, HILLS   'thornwood' (pine forest along the top and right edges) and 'ashfall' (dry
                          grass, then burnt ash ground along the left edge and the foot) polygons, and the rest
    EXITS                 the four roads off the screen: edge, road, the place it leads to, its region, the sign
                          (sign = the board's top-left on the stage, tip 'e' | 'w' | None, w = board width, post =
                          the post's x inside the board, ph = post height, cap = where the caption goes 'below' |
                          'above', align 'c' | 'r'); render() adds board_box = (x, y, w, h). The board names the
                          region; the caption under (or over) it names the place and its days
    sign_words(e)         an EXITS entry's words: (the board's text = its region, the caption = 'Place · N days')
    DOOR[k]               where the roads to k end when that is not P[k] (the two cave mouths face south: the
                          roads come round the rock to the apron in front); arrive at DOOR.get(k, P[k])
    terrain_at(x, y)      'water' | 'road' | 'forest' | 'wood' | 'ash' | 'dry' | 'field' | 'open' at a stage point
                          ('road' includes the farms' narrow tracks; render() also returns info['tracks'])
    terrain_along(pts)    {kind: stage px of the route over that ground}, sampled every 2 px along a polyline
"""
import math
import os
import random
import sys
import zlib
from collections import deque, defaultdict

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(os.path.abspath(__file__))
while not os.path.isdir(os.path.join(DIRS, 'pxworld')):      # the scratchpad's dirs/ folder
    DIRS = os.path.dirname(DIRS)
for _p in (HERE, DIRS):
    if _p not in sys.path:
        sys.path.insert(0, _p)
import geo                                                                   # noqa: E402
import bits                                                                  # noqa: E402
import ashland as AL                                                         # noqa: E402
from pxworld import terrain as TR, trees as TS, places as PL, folk as FK, build as BD, props as PR   # noqa: E402
from pxworld.canvas import Canvas                                            # noqa: E402

# ================================================================ the game's places and roads (world.json, read 2026-10-24)
NODE = {
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
NAMES = {k: v['name'] for k, v in NODE.items()}
GAME_ROADS = [
    ('frontier_camp', 'riverside_market', 'borderlands_road'), ('frontier_camp', 'south_road_ambush', 'borderlands_road'),
    ('frontier_camp', 'traders_rest', 'borderlands_road'), ('riverside_market', 'old_mill_crossing', 'borderlands_road'),
    ('riverside_market', 'bandit_hideout', 'borderlands_road'), ('south_road_ambush', 'south_junction', 'borderlands_road'),
    ('old_mill_crossing', 'watchtower_ridge', 'borderlands_road'), ('old_mill_crossing', 'pine_crossing', 'borderlands_road'),
    ('old_mill_crossing', 'north_ridge_path', 'borderlands_road'), ('bandit_hideout', 'south_junction', 'borderlands_road'),
    ('bandit_hideout', 'pine_crossing', 'borderlands_road'), ('south_junction', 'smugglers_cave', 'borderlands_road'),
    ('south_junction', 'broken_bridge', 'borderlands_road'), ('watchtower_ridge', 'border_fortress', 'borderlands_road'),
    ('watchtower_ridge', 'north_ridge_path', 'borderlands_road'), ('pine_crossing', 'border_fortress', 'borderlands_road'),
    ('pine_crossing', 'rodericks_camp', 'borderlands_road'), ('smugglers_cave', 'rodericks_camp', 'borderlands_road'),
    ('smugglers_cave', 'broken_bridge', 'borderlands_road'), ('border_fortress', 'borderland_shrine', 'borderlands_road'),
    ('thornwood_gate', 'thornwood_chapel', 'thornwood_road'), ('thornwood_gate', 'dark_hollow', 'thornwood_road'),
    ('thornwood_gate', 'foggy_marsh', 'thornwood_road'), ('southern_trail', 'cursed_clearing', 'thornwood_road'),
    ('southern_trail', 'spiders_nest', 'thornwood_road'), ('thornwood_chapel', 'hermits_tower', 'thornwood_road'),
    ('thornwood_chapel', 'druids_circle', 'thornwood_road'), ('dark_hollow', 'cursed_clearing', 'thornwood_road'),
    ('dark_hollow', 'wolf_den', 'thornwood_road'), ('dark_hollow', 'foggy_marsh', 'thornwood_road'),
    ('cursed_clearing', 'witchs_hut', 'thornwood_road'), ('cursed_clearing', 'spiders_nest', 'thornwood_road'),
    ('hermits_tower', 'ancient_ruins', 'thornwood_road'), ('hermits_tower', 'moonlit_glade', 'thornwood_road'),
    ('wolf_den', 'ancient_ruins', 'thornwood_road'), ('wolf_den', 'morganas_grove', 'thornwood_road'),
    ('witchs_hut', 'morganas_grove', 'thornwood_road'), ('witchs_hut', 'thornwood_depths', 'thornwood_road'),
    ('ancient_ruins', 'moonlit_glade', 'thornwood_road'), ('morganas_grove', 'thornwood_depths', 'thornwood_road'),
    ('mountain_pass', 'ashfall_outpost', 'ashfall_road'), ('mountain_pass', 'lava_fields', 'ashfall_road'),
    ('mountain_pass', 'ember_creek', 'ashfall_road'), ('ashfall_trail', 'scorched_village', 'ashfall_road'),
    ('ashfall_trail', 'ruined_chapel', 'ashfall_road'), ('ashfall_outpost', 'dragons_lookout', 'ashfall_road'),
    ('lava_fields', 'scorched_village', 'ashfall_road'), ('lava_fields', 'iron_mine', 'ashfall_road'),
    ('lava_fields', 'ember_creek', 'ashfall_road'), ('scorched_village', 'sulfur_springs', 'ashfall_road'),
    ('scorched_village', 'ruined_chapel', 'ashfall_road'), ('dragons_lookout', 'cragmaw_fortress', 'ashfall_road'),
    ('dragons_lookout', 'obsidian_cavern', 'ashfall_road'), ('iron_mine', 'cragmaw_fortress', 'ashfall_road'),
    ('iron_mine', 'final_approach', 'ashfall_road'), ('sulfur_springs', 'final_approach', 'ashfall_road'),
    ('sulfur_springs', 'warlords_camp', 'ashfall_road'), ('cragmaw_fortress', 'obsidian_cavern', 'ashfall_road'),
    ('cragmaw_fortress', 'ashen_gate', 'ashfall_road'), ('final_approach', 'warlords_camp', 'ashfall_road'),
    ('final_approach', 'ashen_gate', 'ashfall_road'), ('the_iron_throne', 'ashen_gate', 'ashfall_road'),
    ('border_fortress', 'thornwood_gate', 'thornwood_road'), ('rodericks_camp', 'southern_trail', 'thornwood_road'),
    ('ancient_ruins', 'mountain_pass', 'ashfall_road'), ('morganas_grove', 'ashfall_trail', 'ashfall_road'),
    ('frontier_camp', 'darens_camp', 'borderlands_road'), ('darens_camp', 'south_road_ambush', 'borderlands_road'),
]

# ---------------------------------------------------------------- B's changes to the roads (world.json edges)
REMOVED = [
    ('riverside_market', 'bandit_hideout'),     # the hideout moved west; this road would cross the camp
    ('bandit_hideout', 'pine_crossing'),        # the same: west to east across the whole country
    ('border_fortress', 'borderland_shrine'),   # the shrine moved west, onto the road out to the Mountain Pass
    ('wolf_den', 'morganas_grove'),             # laid round the north and east, Thornwood's two far ends are a
                                                # half-circle apart; this road would cut across the forest's roads
    ('bandit_hideout', 'south_junction'),       # with the hideout in the west, this road would run diagonally across
                                                # the south road's approach to the camp; the west road reaches the
                                                # hideout from Trader's Rest in the same two hops
]
ADDED = [
    ('frontier_camp', 'north_ridge_path', 'borderlands_road'),   # the camp's north road
    ('traders_rest', 'bandit_hideout', 'borderlands_road'),      # the west road goes on past Trader's Rest
    ('bandit_hideout', 'borderland_shrine', 'borderlands_road'),
    ('borderland_shrine', 'mountain_pass', 'ashfall_road'),      # west: out into Ashfall
    ('broken_bridge', 'ashfall_trail', 'ashfall_road'),          # south: the old road on past the broken bridge
]


def b_roads():
    rem = {frozenset(r) for r in REMOVED}
    return [r for r in GAME_ROADS if frozenset(r[:2]) not in rem] + list(ADDED)


def hops(roads=None, start='frontier_camp'):
    """BFS hop distance from the camp over visible places (engine/content.ts#nodeDistances skips hidden ones)."""
    roads = b_roads() if roads is None else roads
    hidden = {k for k, n in NODE.items() if n.get('hidden')}
    adj = defaultdict(list)
    for a, b, *_ in roads:
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


def tier(h):
    """rules.ts travel.tierByDistance: 2 hops or fewer tier 1, 5 or fewer tier 2, beyond that tier 3."""
    return 1 if h <= 2 else (2 if h <= 5 else 3)


# ================================================================ where everything is, in stage px
P = {
    'frontier_camp': (600, 410),
    'north_ridge_path': (590, 275),
    'riverside_market': (805, 395),
    'south_road_ambush': (588, 552),
    'traders_rest': (420, 360),
    'darens_camp': (500, 468),          # hidden until found: not drawn on day 1
    'watchtower_ridge': (750, 190),
    'old_mill_crossing': (965, 330),
    'south_junction': (650, 640),
    'bandit_hideout': (250, 410),
    'border_fortress': (886, 124),
    'pine_crossing': (1100, 375),
    'broken_bridge': (1046, 658),
    'smugglers_cave': (1140, 582),
    'borderland_shrine': (138, 330),
    'rodericks_camp': (1172, 460),
    # the wild country beyond the view (country.py, seed 5, 30000 steps; the four exit places pinned):
    # Thornwood north and east, Ashfall south and west
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


def in_view(k):
    x, y = P[k]
    return 0 <= x < 1280 and 0 <= y < 720


def drawn(k):
    """On this screen and visible on day 1."""
    return in_view(k) and not NODE[k].get('hidden')


# ================================================================ the river and its crossings
RIVER = [(925, -20), (950, 120), (970, 250), (974, 338), (982, 400), (1006, 470), (1022, 540), (1030, 600),
         (1040, 640), (1052, 676), (1064, 740)]
river_pts = geo.sample_catmull(RIVER, 14)
RIVER_HW = 10.0


def river_x(y):
    """The river's centre x at stage row y."""
    return min(river_pts, key=lambda q: abs(q[1] - y))[0]


# the mill bridge: pxworld.places.mill draws its deck from x - 11 to x + 27 at y + 6
_OM = P['old_mill_crossing']
MILL_W, MILL_E = (_OM[0] - 12, _OM[1] + 6), (_OM[0] + 29, _OM[1] + 6)
MILL_J = (_OM[0] - 42, _OM[1] + 16)        # where the three west-bank roads meet before the deck
# the broken bridge: pxworld.places.broken_bridge, a 52 px stone bridge rising 1 px in 3 eastward, across the flow
_BBX = river_x(P['broken_bridge'][1])
_bbo = (0 if abs(_BBX - 956) < 4 else int(round(_BBX - 956)), int(round(P['broken_bridge'][1] - 580)))
BB_W, BB_E = (927 + _bbo[0], 578.5 + _bbo[1]), (978 + _bbo[0], 561.5 + _bbo[1])
BRIDGES = {'old_mill_crossing': {'west': MILL_W, 'east': MILL_E},
           'broken_bridge': {'west': BB_W, 'east': BB_E, 'broken': True}}

# ================================================================ road geometry
BEND = {
    ('frontier_camp', 'riverside_market'): 6, ('frontier_camp', 'traders_rest'): -6,
    ('frontier_camp', 'north_ridge_path'): 4, ('frontier_camp', 'south_road_ambush'): -4,
    ('south_road_ambush', 'south_junction'): 8, ('north_ridge_path', 'watchtower_ridge'): -10,
    ('watchtower_ridge', 'border_fortress'): 8, ('traders_rest', 'bandit_hideout'): 10,
    ('bandit_hideout', 'borderland_shrine'): -8, ('south_junction', 'broken_bridge'): -10,
    
}
# roads that run through waypoints (stage px): a Catmull-Rom spline from a through the points to b
VIA = {
    ('riverside_market', 'old_mill_crossing'): [(846, 356)],
    ('north_ridge_path', 'old_mill_crossing'): [(760, 292), (880, 330)],
    ('watchtower_ridge', 'old_mill_crossing'): [(860, 262), (900, 326)],
    ('pine_crossing', 'border_fortress'): [(1150, 352), (1112, 250), (1010, 176), (954, 150)],
    ('pine_crossing', 'rodericks_camp'): [(1150, 398)],
    ('south_junction', 'smugglers_cave'): [(1000, 632), (1014, 625), (1048, 615), (1084, 608)],
    # round the rock to the caves' mouths
    ('traders_rest', 'bandit_hideout'): [(318, 396), (296, 426), (276, 442)],
    ('bandit_hideout', 'borderland_shrine'): [(226, 442), (204, 424), (184, 386)],
    ('smugglers_cave', 'rodericks_camp'): [(1176, 610), (1204, 588), (1210, 530)],
    # Pine Crossing: the west road runs along the fronts of the barn and the cabin, not through them
    ('old_mill_crossing', 'pine_crossing'): [(1036, 350), (1066, 372)],
}
# the edge roads: waypoints out to the edge of the screen (the road then runs on toward its wild place)
EXIT_VIA = {
    ('border_fortress', 'thornwood_gate'): [(886, 150), (846, 151), (834, 120), (840, 76), (856, 30), (868, -20)],
    ('rodericks_camp', 'southern_trail'): [(1236, 470), (1270, 474)],
    ('broken_bridge', 'ashfall_trail'): [(1010, 690)],
    ('borderland_shrine', 'mountain_pass'): [(70, 318), (20, 306)],
}
# roads whose end sits on a bridge head: the road meets the deck along the bridge's axis
HEADS = {
    ('riverside_market', 'old_mill_crossing'): MILL_W, ('north_ridge_path', 'old_mill_crossing'): MILL_W,
    ('watchtower_ridge', 'old_mill_crossing'): MILL_W, ('old_mill_crossing', 'pine_crossing'): MILL_E,
    ('south_junction', 'broken_bridge'): BB_W, ('smugglers_cave', 'broken_bridge'): BB_E,
    ('broken_bridge', 'ashfall_trail'): BB_W,
}
BRIDGE_PLACES = ('old_mill_crossing', 'broken_bridge')
# places whose roads end at a door, not at the place's point: the two cave mouths face south, so every road comes
# round the rock to the apron in front of the mouth
DOOR = {'bandit_hideout': (252, 441), 'smugglers_cave': (1141, 603)}
# roads that share their first stretch with another road and fork from it where it first reaches x = at
SHARE = {('south_junction', 'smugglers_cave'): (('south_junction', 'broken_bridge'), 940)}
_MILL_WEST_ROADS = {('riverside_market', 'old_mill_crossing'), ('north_ridge_path', 'old_mill_crossing'),
                    ('watchtower_ridge', 'old_mill_crossing')}


def _spline(pts):
    return geo.sample_catmull(pts, 24)


def road_paths():
    """{(a, b): polyline in stage px} for every B road. A road to a bridge ends on its deck or abutment with a short
    straight approach along the bridge's axis (the mill's three west-bank roads first meet at MILL_J); the four
    edge roads run on past the screen toward their place."""
    out = {}
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
    A, B = DOOR.get(a, P[a]), DOOR.get(b, P[b])
    key = (a, b)
    via = VIA.get(key) or (VIA[(b, a)][::-1] if (b, a) in VIA else None)
    via = via or EXIT_VIA.get(key) or (EXIT_VIA[(b, a)][::-1] if (b, a) in EXIT_VIA else None)
    head = HEADS.get(key)
    if head is None:
        return _spline([A] + via + [B]) if via else geo.quad_pts(A, B, geo.quad(A, B, BEND.get(key, 0)), 60)
    ax = (1.0, 0.0) if head in (MILL_W, MILL_E) else (3 / math.hypot(3, 1), -1 / math.hypot(3, 1))
    sgn = -1 if head in (MILL_W, BB_W) else 1           # a west head is approached from the west
    near = (head[0] + sgn * ax[0] * 9, head[1] + sgn * ax[1] * 9)
    onto = (head[0] - sgn * ax[0] * 4, head[1] - sgn * ax[1] * 4)
    if b in BRIDGE_PLACES:                              # the road runs from a out to the bridge at b
        mid = (via or []) + ([MILL_J] if key in _MILL_WEST_ROADS else [])
        core = _spline([A] + mid + [near]) if mid else geo.quad_pts(A, near, geo.quad(A, near, BEND.get(key, 0)), 60)
        return core + [head, onto]
    else:                                               # the road leaves the bridge at a for b
        if key == ('broken_bridge', 'ashfall_trail'):
            near, onto = (head[0] - 3, head[1] + 9), (head[0] + 3, head[1] - 1)   # turns south off the abutment
        core = _spline([near] + (via or []) + [B]) if via else geo.quad_pts(near, B, geo.quad(near, B, BEND.get(key, 0)), 60)
        return [onto, head] + core


def crossings(paths=None):
    """Pairs of roads that cross away from a shared place (a crossing with no junction)."""
    paths = road_paths() if paths is None else paths
    keys = list(paths)
    out = []
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            a, b = keys[i], keys[j]
            if set(a) & set(b):
                continue
            pa, pb = paths[a][::2], paths[b][::2]
            if any(geo.seg_x(pa[u], pa[u + 1], pb[v], pb[v + 1]) for u in range(len(pa) - 1) for v in range(len(pb) - 1)):
                out.append((a, b))
    return out


# the roads that wade the river, and the flow there (for the stepping stones' wakes)
FORD_ROADS = {('south_junction', 'smugglers_cave'): (.16, .99), ('pine_crossing', 'border_fortress'): (.2, .98)}

# ================================================================ the ground
ZONES = {
    # Thornwood's pines along the top and down the right-hand side
    'thornwood': [(470, -12), (1292, -12), (1292, 612), (1262, 600), (1246, 540), (1258, 470), (1232, 404),
                  (1244, 330), (1208, 262), (1226, 200), (1176, 168), (1150, 138), (1092, 132), (1060, 112),
                  (990, 114), (940, 96), (900, 66), (840, 80), (800, 104), (770, 84), (720, 76), (690, 112),
                  (650, 120), (628, 92), (590, 84), (556, 116), (520, 124), (490, 96)],
    # Ashfall's dry grass, scorched earth and ash along the left-hand side and the foot
    # (a tongue of it reaches in along the Mountain Pass road toward the shrine, another up the Ashfall Trail road
    # toward the broken bridge; the meadow runs out to the left edge below the shrine and to the foot under the card)
    'ashfall': [(-12, 150), (60, 172), (110, 214), (124, 262), (132, 290), (172, 304), (186, 324), (160, 346),
                (118, 356), (100, 392), (70, 424), (30, 444), (-12, 450), (-40, 476), (-12, 516), (60, 516),
                (140, 520), (300, 540), (420, 556), (470, 590), (520, 612), (580, 644), (650, 668), (720, 664),
                (780, 680), (800, 744), (846, 744), (864, 682), (920, 668), (970, 644), (992, 624), (1012, 640),
                (1030, 664), (1070, 660), (1110, 646), (1200, 626), (1292, 616), (1292, 732), (-12, 732)],
}
WOODS = [
    [(286, 210), (392, 204), (438, 238), (410, 280), (330, 286), (284, 254)],           # the copse below the region window
    [(150, 448), (232, 452), (262, 486), (170, 494)],                                    # west, above the company window
    [(690, 240), (720, 228), (736, 262), (700, 270)],                                    # a stand at Watchtower Ridge's foot
    [(866, 420), (928, 410), (946, 452), (884, 466)],                                    # the river bend below the mill
    [(470, 440), (518, 432), (536, 470), (480, 486)],                                    # the gully round Daren's camp
]
FIELDS = [
    ([(468, 296), (534, 286), (548, 338), (480, 350)], 'wheat'),                         # north-west of the camp
    ([(640, 300), (712, 292), (726, 346), (652, 356)], 'crop'),                          # north-east of the camp
    ([(352, 400), (408, 392), (418, 438), (360, 446)], 'plough'),                        # west, by the traders
    ([(676, 460), (760, 448), (774, 500), (690, 512)], 'wheat2'),                        # under the market
    ([(780, 520), (850, 506), (864, 560), (794, 574)], 'crop2'),
    ([(686, 560), (770, 548), (780, 600), (700, 610)], 'plough'),
    ([(724, 610), (800, 600), (808, 632), (730, 640)], 'wheat'),                         # beside South Junction
    ([(300, 316), (360, 306), (372, 350), (310, 360)], 'crop'),
    ([(640, 180), (700, 170), (708, 214), (646, 222)], 'crop2'),                         # under Watchtower Ridge
    ([(1120, 190), (1176, 182), (1186, 226), (1128, 234)], 'crop'),                      # the north-east meadow
]
FIELD_KIND = {'wheat': ('wheat', (1, 3)), 'wheat2': ('wheat2', (3, -1)), 'crop': ('crop', (0, 1)),
              'crop2': ('crop2', (1, 0)), 'plough': ('plough', (-1, 3))}
# the meadow's rises: (x, y, rx, ry, rot, 'ridge' | 'mound') in stage px
HILLS = [
    (596, 236, 92, 30, -4, 'ridge'),       # the north ridge the path climbs
    (760, 200, 76, 34, 6, 'ridge'),        # Watchtower Ridge
    (246, 396, 70, 34, -8, 'ridge'),       # the hideout's hill
    (1150, 578, 84, 46, -6, 'ridge'),      # the cave hill
    (430, 330, 70, 30, 0, 'mound'), (700, 470, 80, 34, 0, 'mound'), (830, 600, 70, 30, 0, 'mound'),
    (1080, 260, 70, 34, 0, 'mound'), (300, 520, 80, 30, 0, 'mound'), (520, 600, 70, 28, 0, 'mound'),
    (1200, 330, 50, 26, 0, 'mound'), (150, 260, 60, 28, 0, 'mound'),
]
CREST_ROCKS = [(560, 226, 6), (574, 222, 4), (628, 230, 5), (742, 186, 6), (782, 192, 5), (226, 384, 6),
               (268, 380, 5), (1126, 554, 7), (1176, 548, 5)]
# burnt ridges inside Ashfall's ash
ASH_RIDGES = [(24, 262, 50, 34, 0, 'mound'), (30, 420, 54, 40, 0, 'mound'), (610, 712, 110, 26, 0, 'mound'),
              (956, 714, 56, 20, 0, 'mound'), (1190, 700, 90, 30, 0, 'mound'), (250, 640, 120, 50, 0, 'mound')]
# still smouldering in the ash: an ember and a thin smoke (stage px)
SMOULDER = [(46, 404)]
# farmsteads: (x, y, plan) with pxworld.places.FARM_PLANS laid relative to each plan's own home position
FARM_HOME = [(586, 432), (318, 322), (872, 650), (716, 452), (270, 448), (196, 330)]
FARMS = [(536, 156, 1), (690, 362, 0), (352, 470, 4), (1174, 300, 2), (812, 646, 5), (230, 330, 3)]
# the board's one-line footnote (x0, y0, x1, y1): nothing tall stands in it
FOOTNOTE = (410, 690, 790, 714)
# places that bring their own ground (streets, yards, squares) instead of a trampled patch
OWN_GROUND = {'riverside_market', 'south_junction', 'pine_crossing', 'old_mill_crossing', 'broken_bridge'}

# ================================================================ the four ways off the screen
EXITS = [
    dict(edge='north', road=('border_fortress', 'thornwood_gate'), to='thornwood_gate', region='Thornwood',
         sign=(758, 26), tip=None, w=84, post=76, ph=40, cap='above', align='r'),
    dict(edge='east', road=('rodericks_camp', 'southern_trail'), to='southern_trail', region='Thornwood',
         sign=(1188, 428), tip='e', w=90, post=66, ph=40, cap='above', align='r'),
    dict(edge='south', road=('broken_bridge', 'ashfall_trail'), to='ashfall_trail', region='Ashfall',
         sign=(916, 670), tip=None, w=84, post=76, ph=40, cap='below', align='r'),
    dict(edge='west', road=('borderland_shrine', 'mountain_pass'), to='mountain_pass', region='Ashfall',
         sign=(10, 252), tip='w', w=88, post=80, ph=44, cap='below', align='c'),
]



def sign_words(e):
    """The words of an edge sign: (on the board, the caption) = (its region, 'Place · N days')."""
    return e['region'], f"{NAMES[e['to']]} · {hops()[e['to']]} days"


# ================================================================ the render
_LAST = {}


def _seed(name):
    return zlib.crc32(name.encode()) % 1000


def _near_any(p, pts, d):
    d2 = d * d
    return any((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < d2 for q in pts)


def render(company=True, skip=(), seed=11):
    """The view as one 1280 x 720 grain-1 pixel canvas. Returns (Canvas, info); info holds the masks a route can
    be tested against (water, roads, forest, wood, ash, dry, fields, bank), road_px, fords and the company's foot."""
    W, H = 1280, 720
    rng = random.Random(seed)
    cv = Canvas(W, H)
    info = {}
    paths = road_paths()
    hidden = {k for k, n in NODE.items() if n.get('hidden')}
    vis_paths = {k: v for k, v in paths.items() if not (set(k) & hidden) and (in_view(k[0]) or in_view(k[1]))}
    road_pts = [p for v in vis_paths.values() for p in v[::3]]
    place_pts = [P[k] for k in P if drawn(k)]
    sign_pts = [(e['sign'][0] + e['w'] / 2, e['sign'][1] - 20) for e in EXITS]

    def reject(p, rd=13, pd=44, wd=24):
        return (_near_any(p, road_pts, rd) or _near_any(p, place_pts, pd) or _near_any(p, river_pts, wd)
                or _near_any(p, sign_pts, 40))

    # ---- ground: meadow, its rises, the fields
    TR.grass(cv, seed=4, g=1)
    TR.hills(cv, [(x, y, rx * 1.05, ry * 1.1, rot, kd) for (x, y, rx, ry, rot, kd) in HILLS], 1)
    fields_any = np.zeros((H, W), bool)
    for pts, kind in FIELDS:
        k, vec = FIELD_KIND[kind]
        fm = TR.field(cv, pts, k, vec, width=4, g=1)
        if fm is not None:
            fields_any |= fm
    # ---- Ashfall's edge: dry grass, then ash and burnt ridges
    ash_zone, ash_core, ash_dry = AL.ground(cv, ZONES['ashfall'], seed=21)
    AL.ridges(cv, ASH_RIDGES)
    # ---- trampled ground under the places
    for k in P:
        if not drawn(k) or k in OWN_GROUND or k in skip:
            continue
        x, y = P[k]
        big = k in ('frontier_camp', 'border_fortress')
        rx, ry = (40, 26) if big else ((17, 11) if k == 'borderland_shrine' else (28, 19))
        TR.patch(cv, x, y - 4, rx, ry, seed=_seed(k), g=1)
    # ---- the river
    rd = TR.river(cv, river_pts, RIVER_HW, 1)
    water = rd['water']
    # ---- roads (never over open water; fords and bridges carry them across)
    road_any = np.zeros((H, W), bool)
    road_px = {}
    for key, fine in vis_paths.items():
        road_px[key] = fine
        m = TR.road(cv, fine, 3.1, 1, pebbles=.02, seed=len(fine), not_on=water)
        if m is not None:
            road_any |= m
    # farm tracks: a narrow dirt track from each farmstead's yard to the nearest road
    tracks = []
    for (x, y, i) in FARMS:
        hx, hy = FARM_HOME[i]
        yd = next(e for e in PL.FARM_PLANS[i] if e[0] == 'yard')     # the track leaves the yard's south side
        f0 = (yd[1] + yd[3] / 2 + x - hx, yd[2] + yd[4] + 2 + y - hy)
        best = min(((math.dist(f0, p), p) for v in vis_paths.values() for p in v), key=lambda t: t[0])
        if best[0] < 120:
            q = best[1]
            tr = geo.quad_pts(f0, q, geo.quad(f0, q, 6), 40)
            m = TR.road(cv, tr, 2.2, 1, pebbles=0, seed=i, not_on=water)
            if m is not None:
                road_any |= m
            tracks.append(tr)
    info['tracks'] = tracks
    TR.ripples(cv, rd, river_pts, 1)
    for (sy, off) in ((470, 4), (560, -2)):
        TR.river_rock(cv, river_x(sy) + off - 2, sy, 1)
    fords = []
    for key, flow in FORD_ROADS.items():
        k2 = key if key in road_px else (key[1], key[0])
        if k2 in road_px:
            BD.ford(cv, water, road_px[k2], width=7, flow=flow, seed=len(key[0]))
            wet = [p for p in road_px[k2] if 0 <= int(p[1]) < H and 0 <= int(p[0]) < W and water[int(p[1]), int(p[0])]]
            if wet:
                fords.append((k2, wet[len(wet) // 2]))
    info['fords'] = fords

    # ---- ground detail: tufts, flowers, stones in the meadow, dry tufts in the dry band, scars on the ash
    blocked = water | road_any | fields_any | rd['bank']

    def free(p, pad=2):
        x, y = int(p[0]), int(p[1])
        return 0 <= x < W and 0 <= y < H and not blocked[max(0, y - pad):y + pad + 1, max(0, x - pad):x + pad + 1].any()
    centres = TR.poisson(rng, 0, 0, W, H, 46, 3000, free)
    tpts = TR.clustered(rng, centres, (3, 8), 8, free) + TR.poisson(rng, 0, 0, W, H, 34, 2000, free)
    TR.tufts(cv, rng, tpts, 1, only=('g', 'h'))
    TR.flowers(cv, rng, TR.poisson(rng, 0, 0, W, H, 70, 900, lambda p: free(p) and not ash_zone[int(p[1]), int(p[0])]), g=1)
    TR.stones(cv, rng, TR.poisson(rng, 0, 0, W, H, 90, 500, free), g=1)
    # the burnt crust's marks come in clusters (round the snag stands and on the ridges); open ash is left open
    marks_at, marks_at_centres = AL.cluster_mask(ash_core & ~road_any & ~water, rng, n=26, r=16)
    AL.scars(cv, rng, marks_at, n=60, cinders=False)
    AL.cracks(cv, rng, marks_at, n=90)
    AL.drifts(cv, rng, marks_at, n=80)
    # dry stubble: tufts coloured from the ground under them, in clumps, on the dry grass and scorched earth
    def ash_free(p, pad=2):
        x, y = int(p[0]), int(p[1])
        return free(p, pad) and ash_zone[y, x] and not ash_core[y, x]
    ac = TR.poisson(rng, 0, 0, W, H, 30, 3000, ash_free)
    TR.tufts(cv, rng, TR.clustered(rng, ac, (3, 7), 7, ash_free), 1, only=('t', 'd', 'h'))
    # reeds along both banks, clear of the crossings
    crossings_at = [MILL_W, MILL_E, BB_W, BB_E] + [f[1] for f in fords]
    reed_pts = []
    L = TR.poly_len(river_pts)
    s_ = 0.0
    while s_ < L:
        if rng.random() < .45:
            p, tan = TR.point_at(river_pts, s_)
            side = rng.choice((-1, 1))
            nx, ny = tan[1] * side, -tan[0] * side
            for kk in range(rng.randint(2, 4)):
                off = RIVER_HW + rng.uniform(-1.2, 1.5)
                q = (p[0] + nx * off + tan[0] * kk * 4, p[1] + ny * off + tan[1] * kk * 4 + 1)
                if min(math.dist(q, c) for c in crossings_at) > 26:
                    reed_pts.append(q)
        s_ += rng.uniform(18, 34)
    TR.reeds(cv, rng, reed_pts, 1)
    # hedgerows on two of every three field edges
    hedge_pts = []
    for poly_pts, kind in FIELDS:
        n = len(poly_pts)
        for i in range(n):
            if (i + n) % 3 == 1:
                continue
            hedge_pts += TS.hedge(cv, poly_pts[i], poly_pts[(i + 1) % n], rng, 1)
    TS.stamp_bushes(cv, hedge_pts)

    # ---- everything that stands up, sorted north to south
    sc = PL.Scene(cv, 1, seed=seed)
    sc.roads, sc.water, sc.road_px, sc.fields = road_any, water, road_px, fields_any
    sc.ground = ('g', 'd', 'h', 't')
    sc.reink = True
    forest_m = np.zeros((H, W), bool)
    wood_m = np.zeros((H, W), bool)
    # Thornwood: pines along the top and the right-hand side
    pine_pts = geo.scatter(ZONES['thornwood'], 8.5, rng, 9000, lambda p: reject(p, 13, 40, 24))
    pine_pts = [p for p in pine_pts if -6 <= p[0] <= W + 6 and -6 <= p[1] <= H + 6]
    TS.forest(cv, pine_pts, rng, 8, 11, 'pine', g=1, scene=sc)
    for (x, y) in pine_pts:
        forest_m[max(0, int(y) - 8):max(0, int(y) + 9), max(0, int(x) - 8):max(0, int(x) + 9)] = True
    # the heartland's broadleaf woods
    for poly_pts in WOODS:
        pts = geo.scatter(poly_pts, 9, rng, 2500, lambda p: reject(p, 13, 46, 24))
        TS.forest(cv, pts, rng, 8, 13, 'leaf', g=1, scene=sc)
        for (x, y) in pts:
            wood_m[max(0, int(y) - 9):int(y) + 10, max(0, int(x) - 9):int(x) + 10] = True
    # lone trees and bushes in the meadow (not in Ashfall's ash, not in Thornwood)
    lone = []
    for _ in range(90):
        p = (rng.uniform(80, 1200), rng.uniform(60, 690))
        if (not reject(p, 14, 50, 26) and not any(geo.pip(p, f) for f, _ in FIELDS)
                and not ash_zone[int(p[1]), int(p[0])] and not geo.pip(p, ZONES['thornwood'])):
            lone.append(p)
    for (x, y) in lone[:30]:
        sc.tree(x, y, rng.uniform(7, 10))

    def meadow(p):
        x, y = int(p[0]), int(p[1])
        return (free(p, 3) and not reject(p, 14, 46, 26) and not ash_zone[y, x]
                and not geo.pip(p, ZONES['thornwood']) and not any(geo.pip(p, w) for w in WOODS))
    for (x, y) in TR.poisson(rng, 0, 0, W, H, 70, 2500, meadow)[:46]:
        r = rng.uniform(2.8, 4.4)
        sp = TS.bush(r, rng.randint(0, 9), lift=rng.choice((0, 1)))
        sc.add(sp, x, y + (sp.h - 1) // 2, shadow=('ell', r * .7, 1, r * 1.1, r * .6))
    # Ashfall: snags and stumps where the fire went through, grey boulders on the ridges

    def ashy(p):
        x, y = int(p[0]), int(p[1])
        return (0 <= x < W and 0 <= y < H and ash_zone[y, x] and not reject(p, 12, 40, 20)
                and not (FOOTNOTE[0] <= x <= FOOTNOTE[2] and FOOTNOTE[1] - 24 <= y <= FOOTNOTE[3] + 4))
    stands = [p for p in marks_at_centres if ashy(p)] + TR.poisson(rng, 0, 0, W, H, 70, 3000, ashy)[:14]
    snag_pts = TR.clustered(rng, stands, (3, 6), 9, ashy) + TR.poisson(rng, 0, 0, W, H, 34, 3000, ashy)[:30]
    for i, (x, y) in enumerate(snag_pts):
        if not (0 <= int(y) < H and 0 <= int(x) < W):
            continue
        if ash_core[int(y), int(x)] or rng.random() < .35:
            r_ = rng.random()
            if r_ < .66:
                sp = bits.snag(rng.randint(9, 17), seed=i, lean=rng.choice((-1, 0, 0, 1)))
                sc.add(sp, x, y, shadow=('ell', 3, 1, 4, 1.6))
            elif r_ < .86:
                sc.add(bits.stump(i), x, y, shadow='house')
            else:
                sc.add(bits.charred(BD.reink(BD.fallen_oak(rng.randint(16, 24), 4))), x, y, shadow='house')
    for (x, y) in SMOULDER:                                          # still smouldering: an ember, a thin smoke
        if 0 <= x < W and 0 <= y < H:
            bits.ember(cv, x, y)
            sc.later(lambda cv, x=x, y=y: PR.smoke(cv, int(x), int(y) - 1, 1, n=9))
    for (x, y) in TR.poisson(rng, 0, 0, W, H, 60, 1200, ashy)[:18]:
        sc.rock(x, y, rng.uniform(3.5, 6.5))
    # the places
    _fc = P['frontier_camp']
    gaps = bits.gate_angles((_fc[0], _fc[1] + 3), 40, 25, [v for k, v in road_px.items() if 'frontier_camp' in k])
    for k in P:
        if not drawn(k) or k in skip:
            continue
        X, Y = P[k]
        if k == 'frontier_camp':
            bits.camp4(sc, X, Y, gaps)
        elif k == 'traders_rest':
            PL.camp(sc, X, Y, 'traders')
        elif k == 'rodericks_camp':
            PL.camp(sc, X, Y, 'roderick')
        elif k == 'riverside_market':
            PL.market(sc, X, Y)
        elif k == 'south_junction':
            PL.south_junction(sc, X, Y)
        elif k == 'pine_crossing':
            PL.pine_crossing(sc, X, Y)
        elif k == 'watchtower_ridge':
            wg = bits.gate_angles((X, Y + 5), 26, 15, [v if kk[0] == k else v[::-1] for kk, v in road_px.items() if k in kk],
                                  hw=.28)
            bits.watchtower(sc, X, Y, wg)
        elif k == 'border_fortress':
            PL.fortress(sc, X, Y)
        elif k == 'smugglers_cave':
            PL.cave(sc, X, Y)
        elif k == 'bandit_hideout':
            PL.hideout(sc, X, Y)
        elif k == 'south_road_ambush':
            PL.wreck(sc, X, Y)
        elif k == 'old_mill_crossing':
            PL.mill(sc, X, Y, river_x(Y - 5))
        elif k == 'broken_bridge':
            bits.broken_bridge(sc, river_x(Y), Y)
        elif k == 'north_ridge_path':
            PL.cairn(sc, X, Y)
        elif k == 'borderland_shrine':
            sc.add(bits.shrine(), X, Y, shadow='house')
            sc.tree(X + 16, Y - 4, 9.5)
    if 'farms' not in skip:
        for (x, y, i) in FARMS:
            hx, hy = FARM_HOME[i]
            PL.lay(sc, PL.FARM_PLANS[i], x - hx, y - hy)
    for (x, y, r) in CREST_ROCKS:
        sc.rock(x, y, r * .75)
    # the edge signs (the board's words are HTML: gen_open_b.py)
    for e in EXITS:
        s = bits.edge_sign(e['w'], 23, e.get('ph', 44), e['tip'], post=e.get('post'))
        sx, sy = e['sign']                       # the board's top-left corner on the stage
        fx, fy = sx - s.board[0] + s.ax, sy - s.board[1] + s.ay
        sc.add(s, fx, fy, shadow='house')
        e['board_box'] = (sx, sy, s.board[2], s.board[3])
    # the company: in the camp yard under the standard (or wherever company=(x, y) puts them; none if False)
    if company:
        cx, cy = P['frontier_camp']
        fx, fy = (cx + 2, cy + 8) if company is True else company
        for spr, dx, dy in FK.company_items(1):
            sc.add(spr, fx + dx, fy + dy, shadow=('ell', 1, 1, 5, 2))
        info['company'] = (fx, fy)
    sc.draw()
    info.update(water=water, roads=road_any, fields=fields_any, forest=forest_m & ~road_any, wood=wood_m & ~road_any,
                ash=ash_core, dry=ash_dry & ~ash_core, bank=rd['bank'], road_px=road_px)
    _LAST.clear()
    _LAST.update(info)
    return cv, info


# ================================================================ terrain lookups for routes (variant C)
def terrain_at(x, y, info=None):
    info = info or _LAST or render(company=False)[1]
    X, Y = int(x), int(y)
    if not (0 <= X < 1280 and 0 <= Y < 720):
        return 'off'
    for kind, key in (('water', 'water'), ('road', 'roads'), ('forest', 'forest'), ('wood', 'wood'),
                      ('ash', 'ash'), ('dry', 'dry'), ('field', 'fields')):
        if info[key][Y, X]:
            return kind
    return 'open'


def terrain_along(pts, info=None, step=2.0):
    """{kind: stage px of the route over that ground}, sampled every `step` px along the polyline."""
    out = defaultdict(float)
    for p in geo.resample(pts, step):
        out[terrain_at(p[0], p[1], info)] += step
    return dict(out)


if __name__ == '__main__':
    cv, info = render()
    os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
    cv.save(os.path.join(HERE, 't', 'world_b.png'))
    print('ok', len(b_roads()), 'roads, throne', hops()['the_iron_throne'], 'hops')
