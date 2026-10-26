"""Candidate R1: the river bends round the camp's east and south; the bend's open side is north-west."""
NAMES = {
    'frontier_camp': 'Frontier Camp', 'traders_rest': "Trader's Rest", 'riverside_market': 'Riverside Market',
    'south_road_ambush': 'South Road Ambush', 'old_mill_crossing': 'Old Mill Crossing', 'bandit_hideout': 'Bandit Hideout',
    'south_junction': 'South Junction', 'north_ridge_path': 'North Ridge Path', 'watchtower_ridge': 'Watchtower Ridge',
    'pine_crossing': 'Pine Crossing', 'smugglers_cave': "Smuggler's Cave", 'broken_bridge': 'Broken Bridge',
    'border_fortress': 'Border Fortress', 'rodericks_camp': "Roderick's Camp", 'borderland_shrine': 'Borderland Shrine',
    'thornwood_gate': 'Thornwood Gate', 'southern_trail': 'Southern Trail', 'darens_camp': "Daren's Camp",
}
P = {
    'frontier_camp': (600, 380),
    'traders_rest': (575, 228),
    'riverside_market': (770, 318),
    'south_road_ambush': (488, 440),
    'darens_camp': (450, 330),
    'old_mill_crossing': (884, 214),
    'bandit_hideout': (730, 486),
    'south_junction': (350, 420),
    'north_ridge_path': (930, -40),
    'watchtower_ridge': (1050, 196),
    'pine_crossing': (1066, 410),
    'smugglers_cave': (560, 640),
    'broken_bridge': (-40, 405),
    'border_fortress': (1196, 292),
    'rodericks_camp': (900, 630),
    'borderland_shrine': (1330, 210),
    'thornwood_gate': (1340, 330),
    'southern_trail': (960, 780),
}
ROADS = [
    ('frontier_camp', 'riverside_market', 10), ('frontier_camp', 'south_road_ambush', -8), ('frontier_camp', 'traders_rest', 8),
    ('frontier_camp', 'darens_camp', 6), ('darens_camp', 'south_road_ambush', 6),
    ('riverside_market', 'old_mill_crossing', -10), ('riverside_market', 'bandit_hideout', 12),
    ('south_road_ambush', 'south_junction', 10),
    ('old_mill_crossing', 'watchtower_ridge', 10), ('old_mill_crossing', 'pine_crossing', 16), ('old_mill_crossing', 'north_ridge_path', -10),
    ('bandit_hideout', 'south_junction', -40), ('bandit_hideout', 'pine_crossing', -14),
    ('south_junction', 'smugglers_cave', -10), ('south_junction', 'broken_bridge', 8),
    ('watchtower_ridge', 'border_fortress', 10), ('watchtower_ridge', 'north_ridge_path', -8),
    ('pine_crossing', 'border_fortress', 10), ('pine_crossing', 'rodericks_camp', -10),
    ('smugglers_cave', 'rodericks_camp', 12), ('smugglers_cave', 'broken_bridge', [(430, 520), (300, 470), (150, 450)]),
    ('border_fortress', 'borderland_shrine', 8), ('border_fortress', 'thornwood_gate', 6),
    ('rodericks_camp', 'southern_trail', 6),
]
CROSS = {('riverside_market', 'old_mill_crossing'), ('old_mill_crossing', 'pine_crossing'), ('old_mill_crossing', 'watchtower_ridge'),
         ('old_mill_crossing', 'north_ridge_path'), ('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave'),
         ('south_junction', 'broken_bridge'), ('smugglers_cave', 'broken_bridge')}
RIVER = [(872, -20), (878, 120), (886, 230), (896, 330), (888, 430), (840, 510), (760, 556), (640, 568), (520, 548), (430, 500),
         (330, 450), (200, 420), (80, 405), (-30, 400)]
