"""Candidate U1: the river comes down past the mill, curls under the camp and leaves west by Broken Bridge."""
from lay_r1 import NAMES   # noqa
P = {
    'frontier_camp': (620, 330), 'traders_rest': (560, 170), 'riverside_market': (700, 300),
    'south_road_ambush': (470, 340), 'darens_camp': (500, 250), 'old_mill_crossing': (766, 205),
    'bandit_hideout': (560, 430), 'south_junction': (300, 330), 'north_ridge_path': (800, -60),
    'watchtower_ridge': (920, 160), 'pine_crossing': (930, 450), 'smugglers_cave': (430, 560),
    'broken_bridge': (-60, 350), 'border_fortress': (1150, 320), 'rodericks_camp': (680, 630),
    'borderland_shrine': (1350, 230), 'thornwood_gate': (1350, 330), 'southern_trail': (700, 800),
}
RIVER = [(758, -30), (760, 60), (764, 150), (766, 205), (772, 260), (800, 330), (815, 400), (780, 465), (690, 505),
         (570, 515), (460, 490), (360, 440), (250, 390), (120, 360), (-60, 350)]
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
ON_RIVER = {'old_mill_crossing', 'broken_bridge'}
CROSS = {('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave')}
ROADS = [(a, b, 0) for a, b in __import__('opt').ROADS] + [('frontier_camp', 'darens_camp', 0), ('darens_camp', 'south_road_ambush', 0)]
