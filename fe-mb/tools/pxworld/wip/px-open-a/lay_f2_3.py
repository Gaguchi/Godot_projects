"""Candidate F2: the camp inside the river's bend (east and south), Broken Bridge just off the left edge."""
from lay_r1 import NAMES   # noqa
P = {'frontier_camp': (621, 299), 'traders_rest': (679, 143), 'riverside_market': (765, 366), 'south_road_ambush': (401, 248), 'old_mill_crossing': (940, 280), 'bandit_hideout': (524, 356), 'south_junction': (252, 254), 'north_ridge_path': (872, -18), 'watchtower_ridge': (1041, 245), 'pine_crossing': (760, 527), 'smugglers_cave': (206, 426), 'broken_bridge': (-44, 296), 'border_fortress': (1045, 485), 'rodericks_camp': (481, 495), 'borderland_shrine': (1310, 539), 'thornwood_gate': (1311, 468), 'southern_trail': (448, 753), 'darens_camp': (480, 270)}
RIVER = [(686, -441), (927, 133), (940, 275), (937, 423), (902, 479), (851, 501), (757, 471), (660, 487), (557, 447), (392, 417), (253, 341), (193, 290), (125, 281), (-42, 297)]
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
ON_RIVER = {'old_mill_crossing', 'broken_bridge'}
CROSS = {('riverside_market', 'old_mill_crossing'), ('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave')}
ROADS = [(a, b, 0) for a, b in __import__('opt').ROADS] + [('frontier_camp', 'darens_camp', 0), ('darens_camp', 'south_road_ambush', 0)]
