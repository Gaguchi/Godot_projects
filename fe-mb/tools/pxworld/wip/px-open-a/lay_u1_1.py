"""Candidate U1: the river comes down past the mill, curls under the camp and leaves west by Broken Bridge."""
from lay_r1 import NAMES   # noqa
P = {'frontier_camp': (591, 314), 'traders_rest': (425, 374), 'riverside_market': (604, 186), 'south_road_ambush': (414, 250), 'old_mill_crossing': (763, 135), 'bandit_hideout': (585, 422), 'south_junction': (301, 358), 'north_ridge_path': (875, -42), 'watchtower_ridge': (945, 200), 'pine_crossing': (856, 353), 'smugglers_cave': (456, 526), 'broken_bridge': (0, 356), 'border_fortress': (1104, 377), 'rodericks_camp': (732, 567), 'borderland_shrine': (1308, 515), 'thornwood_gate': (1309, 505), 'southern_trail': (771, 753), 'darens_camp': (500, 250)}
RIVER = [(758, -30), (760, 60), (764, 150), (766, 205), (772, 260), (800, 330), (815, 400), (780, 465), (690, 505),
         (570, 515), (460, 490), (360, 440), (250, 390), (120, 360), (-60, 350)]
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
ON_RIVER = {'old_mill_crossing', 'broken_bridge'}
CROSS = {('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave')}
ROADS = [(a, b, 0) for a, b in __import__('opt').ROADS] + [('frontier_camp', 'darens_camp', 0), ('darens_camp', 'south_road_ambush', 0)]
