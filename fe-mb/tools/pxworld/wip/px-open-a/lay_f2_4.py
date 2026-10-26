"""Candidate F2: the camp inside the river's bend (east and south), Broken Bridge just off the left edge."""
from lay_r1 import NAMES   # noqa
P = {'frontier_camp': (700, 279), 'traders_rest': (724, 77), 'riverside_market': (680, 399), 'south_road_ambush': (469, 246), 'old_mill_crossing': (859, 279), 'bandit_hideout': (517, 359), 'south_junction': (236, 277), 'north_ridge_path': (884, -25), 'watchtower_ridge': (920, 149), 'pine_crossing': (785, 479), 'smugglers_cave': (230, 416), 'broken_bridge': (-42, 359), 'border_fortress': (1052, 367), 'rodericks_camp': (506, 520), 'borderland_shrine': (1308, 459), 'thornwood_gate': (1309, 437), 'southern_trail': (525, 752), 'darens_camp': (480, 270)}
RIVER = [(549, -905), (917, -301), (913, -128), (858, -20), (819, 116), (858, 279), (833, 361), (709, 461), (617, 486), (496, 449), (374, 400), (263, 361), (122, 323), (-41, 357)]
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
ON_RIVER = {'old_mill_crossing', 'broken_bridge'}
CROSS = {('riverside_market', 'old_mill_crossing'), ('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave')}
ROADS = [(a, b, 0) for a, b in __import__('opt').ROADS] + [('frontier_camp', 'darens_camp', 0), ('darens_camp', 'south_road_ambush', 0)]
