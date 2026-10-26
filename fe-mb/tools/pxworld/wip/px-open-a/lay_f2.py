"""Candidate F2: the camp inside the river's bend (east and south), Broken Bridge just off the left edge."""
from lay_r1 import NAMES   # noqa
P = {
    'frontier_camp': (640, 340), 'traders_rest': (590, 185), 'riverside_market': (800, 290),
    'south_road_ambush': (500, 360), 'darens_camp': (480, 270), 'old_mill_crossing': (872, 215),
    'bandit_hideout': (690, 455), 'south_junction': (260, 315), 'north_ridge_path': (920, -50),
    'watchtower_ridge': (1050, 180), 'pine_crossing': (980, 500), 'smugglers_cave': (300, 450),
    'broken_bridge': (-50, 368), 'border_fortress': (1170, 360), 'rodericks_camp': (680, 640),
    'borderland_shrine': (1350, 250), 'thornwood_gate': (1350, 380), 'southern_trail': (700, 800),
}
RIVER = [(865, -30), (868, 90), (872, 215), (885, 310), (878, 400), (835, 470), (760, 520), (660, 540), (580, 520),
         (490, 450), (380, 400), (240, 378), (100, 370), (-50, 368)]
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
ON_RIVER = {'old_mill_crossing', 'broken_bridge'}
CROSS = {('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave')}
ROADS = [(a, b, 0) for a, b in __import__('opt').ROADS] + [('frontier_camp', 'darens_camp', 0), ('darens_camp', 'south_road_ambush', 0)]
