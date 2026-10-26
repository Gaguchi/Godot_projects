"""Candidate G2 (G1 after the anchored polish) (hand, from the joint search's best): the camp's three roads run N, W and S; the mill east of the
camp; the river curls round the camp's east and south and leaves west by Broken Bridge, just off the left edge."""
from lay_r1 import NAMES   # noqa
P = {'frontier_camp': (660, 309), 'traders_rest': (707, 140), 'riverside_market': (703, 436), 'south_road_ambush': (460, 287), 'old_mill_crossing': (880, 300), 'bandit_hideout': (522, 393), 'south_junction': (245, 261), 'north_ridge_path': (897, -23), 'watchtower_ridge': (987, 183), 'pine_crossing': (797, 537), 'smugglers_cave': (240, 440), 'broken_bridge': (-42, 349), 'border_fortress': (1067, 420), 'rodericks_camp': (523, 518), 'borderland_shrine': (1310, 335), 'thornwood_gate': (1311, 469), 'southern_trail': (548, 760), 'darens_camp': (520, 215)}
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
    ('smugglers_cave', 'rodericks_camp', [(425, 478)]), ('smugglers_cave', 'broken_bridge', 0),
    ('border_fortress', 'borderland_shrine', 0), ('border_fortress', 'thornwood_gate', 0),
    ('rodericks_camp', 'southern_trail', 0),
]
RIVER = [(861, -56), (853, 84), (868, 192), (880, 300), (853, 396), (781, 459), (708, 498), (648, 500), (501, 449), (383, 433), (266, 375), (110, 361), (-40, 349)]
CROSS = {('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave'), ('riverside_market', 'old_mill_crossing'),
         ('old_mill_crossing', 'watchtower_ridge'), ('old_mill_crossing', 'pine_crossing'), ('old_mill_crossing', 'north_ridge_path')}
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
