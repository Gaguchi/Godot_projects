"""Candidate R1d: R1 with the camp nudged NE and the river's west reach lifted clear of the company window."""
from lay_r1 import NAMES, CROSS   # noqa
P = {
    'frontier_camp': (660, 360), 'traders_rest': (540, 250), 'riverside_market': (830, 310),
    'south_road_ambush': (560, 450), 'darens_camp': (520, 350), 'old_mill_crossing': (930, 200),
    'bandit_hideout': (800, 480), 'south_junction': (420, 410), 'north_ridge_path': (960, -50),
    'watchtower_ridge': (1080, 180), 'pine_crossing': (1100, 400), 'smugglers_cave': (600, 640),
    'broken_bridge': (-40, 380), 'border_fortress': (1215, 290), 'rodericks_camp': (950, 630),
    'borderland_shrine': (1340, 200), 'thornwood_gate': (1340, 320), 'southern_trail': (1000, 790),
}
ROADS = [
    ('frontier_camp', 'riverside_market', 10), ('frontier_camp', 'south_road_ambush', -8), ('frontier_camp', 'traders_rest', 8),
    ('frontier_camp', 'darens_camp', 6), ('darens_camp', 'south_road_ambush', 6),
    ('riverside_market', 'old_mill_crossing', -10), ('riverside_market', 'bandit_hideout', 12),
    ('south_road_ambush', 'south_junction', 10),
    ('old_mill_crossing', 'watchtower_ridge', 10), ('old_mill_crossing', 'pine_crossing', 16), ('old_mill_crossing', 'north_ridge_path', -10),
    ('bandit_hideout', 'south_junction', -50), ('bandit_hideout', 'pine_crossing', -14),
    ('south_junction', 'smugglers_cave', -10), ('south_junction', 'broken_bridge', [(300, 385), (150, 370)]),
    ('watchtower_ridge', 'border_fortress', 10), ('watchtower_ridge', 'north_ridge_path', -8),
    ('pine_crossing', 'border_fortress', 10), ('pine_crossing', 'rodericks_camp', -10),
    ('smugglers_cave', 'rodericks_camp', 12), ('smugglers_cave', 'broken_bridge', [(500, 580), (430, 530), (370, 490), (250, 455), (100, 430)]),
    ('border_fortress', 'borderland_shrine', 8), ('border_fortress', 'thornwood_gate', 6),
    ('rodericks_camp', 'southern_trail', 6),
]
RIVER = [(915, -20), (920, 100), (930, 200), (942, 310), (930, 420), (880, 505), (790, 555), (670, 572), (560, 555), (470, 505),
         (380, 460), (250, 420), (100, 395), (-30, 385)]
