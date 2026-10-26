"""Candidate G1 (hand, from the joint search's best): the camp's three roads run N, W and S; the mill east of the
camp; the river curls round the camp's east and south and leaves west by Broken Bridge, just off the left edge."""
from lay_r1 import NAMES   # noqa
P = {
    'frontier_camp': (680, 320), 'traders_rest': (700, 150), 'riverside_market': (680, 460),
    'south_road_ambush': (470, 300), 'darens_camp': (520, 215), 'old_mill_crossing': (880, 300),
    'bandit_hideout': (500, 420), 'south_junction': (240, 310), 'north_ridge_path': (900, -60),
    'watchtower_ridge': (980, 160), 'pine_crossing': (830, 590), 'smugglers_cave': (240, 448),
    'broken_bridge': (-50, 385), 'border_fortress': (1090, 420), 'rodericks_camp': (540, 610),
    'borderland_shrine': (1340, 330), 'thornwood_gate': (1340, 450), 'southern_trail': (560, 800),
}
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
RIVER = [(888, -30), (880, 90), (878, 200), (880, 300), (872, 400), (820, 490), (720, 530), (610, 525), (500, 490),
         (390, 440), (250, 385), (120, 375), (-50, 385)]
CROSS = {('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave'), ('riverside_market', 'old_mill_crossing'),
         ('old_mill_crossing', 'watchtower_ridge'), ('old_mill_crossing', 'pine_crossing'), ('old_mill_crossing', 'north_ridge_path')}
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
