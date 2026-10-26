"""Candidate G3 (hand: G1 spread, G2 lengths): the camp's three roads run N, W and S; the mill east of the
camp; the river curls round the camp's east and south and leaves west by Broken Bridge, just off the left edge."""
from lay_r1 import NAMES   # noqa
P = {'frontier_camp': (660, 330), 'traders_rest': (700, 160), 'south_road_ambush': (475, 365), 'riverside_market': (715, 470), 'darens_camp': (510, 235), 'old_mill_crossing': (885, 285), 'bandit_hideout': (505, 470), 'south_junction': (245, 295), 'smugglers_cave': (240, 455), 'broken_bridge': (-45, 375), 'rodericks_camp': (520, 620), 'pine_crossing': (790, 605), 'border_fortress': (1060, 470), 'watchtower_ridge': (1010, 200), 'north_ridge_path': (910, -40), 'borderland_shrine': (1320, 360), 'thornwood_gate': (1320, 500), 'southern_trail': (540, 780)}
ROADS = [
    ('frontier_camp', 'riverside_market', 0), ('frontier_camp', 'south_road_ambush', 0), ('frontier_camp', 'traders_rest', 0),
    ('frontier_camp', 'darens_camp', 0), ('darens_camp', 'south_road_ambush', 0),
    ('riverside_market', 'old_mill_crossing', 20), ('riverside_market', 'bandit_hideout', 0),
    ('south_road_ambush', 'south_junction', 0),
    ('old_mill_crossing', 'watchtower_ridge', 0), ('old_mill_crossing', 'pine_crossing', [(930, 430)]), ('old_mill_crossing', 'north_ridge_path', 0),
    ('bandit_hideout', 'south_junction', 0), ('bandit_hideout', 'pine_crossing', 0),
    ('south_junction', 'smugglers_cave', 0), ('south_junction', 'broken_bridge', 0),
    ('watchtower_ridge', 'border_fortress', 0), ('watchtower_ridge', 'north_ridge_path', 0),
    ('pine_crossing', 'border_fortress', 0), ('pine_crossing', 'rodericks_camp', 0),
    ('smugglers_cave', 'rodericks_camp', [(425, 482)]), ('smugglers_cave', 'broken_bridge', 0),
    ('border_fortress', 'borderland_shrine', 0), ('border_fortress', 'thornwood_gate', 0),
    ('rodericks_camp', 'southern_trail', 0),
]
RIVER = [(878, -40), (882, 80), (888, 190), (893, 291), (890, 380), (860, 460), (790, 528), (690, 562), (585, 556), (485, 522), (395, 468), (305, 415), (190, 385), (60, 375), (-45, 377)]
CROSS = {('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave'), ('riverside_market', 'old_mill_crossing'),
         ('old_mill_crossing', 'watchtower_ridge'), ('old_mill_crossing', 'pine_crossing'), ('old_mill_crossing', 'north_ridge_path')}
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
