"""Candidate F2: the camp inside the river's bend (east and south), Broken Bridge just off the left edge."""
from lay_r1 import NAMES   # noqa
P = {'frontier_camp': (630, 281), 'traders_rest': (747, 189), 'riverside_market': (704, 370), 'south_road_ambush': (418, 256), 'old_mill_crossing': (853, 225), 'bandit_hideout': (531, 300), 'south_junction': (254, 262), 'north_ridge_path': (905, -27), 'watchtower_ridge': (977, 184), 'pine_crossing': (801, 435), 'smugglers_cave': (263, 417), 'broken_bridge': (-39, 312), 'border_fortress': (1085, 428), 'rodericks_camp': (533, 538), 'borderland_shrine': (1323, 380), 'thornwood_gate': (1327, 460), 'southern_trail': (597, 762), 'darens_camp': (480, 270)}
RIVER = [(869, -591), (843, -68), (846, 43), (856, 210), (807, 316), (726, 432), (594, 483), (431, 448), (289, 359), (200, 300), (130, 256), (68, 240), (8, 257), (-41, 308)]
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
ON_RIVER = {'old_mill_crossing', 'broken_bridge'}
CROSS = {('riverside_market', 'old_mill_crossing'), ('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave')}
ROADS = [(a, b, 0) for a, b in __import__('opt').ROADS] + [('frontier_camp', 'darens_camp', 0), ('darens_camp', 'south_road_ambush', 0)]
