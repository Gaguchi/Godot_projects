"""Candidate F2: the camp inside the river's bend (east and south), Broken Bridge just off the left edge."""
from lay_r1 import NAMES   # noqa
P = {'frontier_camp': (567, 277), 'traders_rest': (623, 99), 'riverside_market': (708, 345), 'south_road_ambush': (389, 257), 'old_mill_crossing': (766, 172), 'bandit_hideout': (496, 356), 'south_junction': (226, 264), 'north_ridge_path': (888, -29), 'watchtower_ridge': (959, 191), 'pine_crossing': (777, 441), 'smugglers_cave': (239, 421), 'broken_bridge': (-43, 332), 'border_fortress': (1062, 382), 'rodericks_camp': (512, 493), 'borderland_shrine': (1308, 425), 'thornwood_gate': (1317, 416), 'southern_trail': (609, 753), 'darens_camp': (480, 270)}
RIVER = [(760, -81), (767, 95), (766, 151), (765, 217), (779, 286), (763, 366), (715, 418), (658, 433), (584, 414), (507, 422), (359, 405), (210, 326), (101, 312), (-41, 331)]
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
ON_RIVER = {'old_mill_crossing', 'broken_bridge'}
CROSS = {('riverside_market', 'old_mill_crossing'), ('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave')}
ROADS = [(a, b, 0) for a, b in __import__('opt').ROADS] + [('frontier_camp', 'darens_camp', 0), ('darens_camp', 'south_road_ambush', 0)]
