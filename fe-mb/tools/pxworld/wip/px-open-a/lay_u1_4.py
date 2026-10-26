"""Candidate U1: the river comes down past the mill, curls under the camp and leaves west by Broken Bridge."""
from lay_r1 import NAMES   # noqa
P = {'frontier_camp': (626, 279), 'traders_rest': (603, 71), 'riverside_market': (705, 444), 'south_road_ambush': (455, 347), 'old_mill_crossing': (767, 248), 'bandit_hideout': (529, 429), 'south_junction': (263, 306), 'north_ridge_path': (774, -28), 'watchtower_ridge': (901, 182), 'pine_crossing': (816, 495), 'smugglers_cave': (243, 433), 'broken_bridge': (-27, 350), 'border_fortress': (1071, 370), 'rodericks_camp': (522, 548), 'borderland_shrine': (1314, 301), 'thornwood_gate': (1313, 356), 'southern_trail': (461, 756), 'darens_camp': (500, 250)}
RIVER = [(758, -30), (760, 60), (764, 150), (766, 205), (772, 260), (800, 330), (815, 400), (780, 465), (690, 505),
         (570, 515), (460, 490), (360, 440), (250, 390), (120, 360), (-60, 350)]
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
ON_RIVER = {'old_mill_crossing', 'broken_bridge'}
CROSS = {('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave')}
ROADS = [(a, b, 0) for a, b in __import__('opt').ROADS] + [('frontier_camp', 'darens_camp', 0), ('darens_camp', 'south_road_ambush', 0)]
