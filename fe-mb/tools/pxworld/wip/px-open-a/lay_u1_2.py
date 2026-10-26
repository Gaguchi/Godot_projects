"""Candidate U1: the river comes down past the mill, curls under the camp and leaves west by Broken Bridge."""
from lay_r1 import NAMES   # noqa
P = {'frontier_camp': (483, 318), 'traders_rest': (544, 120), 'riverside_market': (686, 261), 'south_road_ambush': (396, 235), 'old_mill_crossing': (762, 127), 'bandit_hideout': (573, 380), 'south_junction': (291, 343), 'north_ridge_path': (883, -27), 'watchtower_ridge': (906, 234), 'pine_crossing': (864, 377), 'smugglers_cave': (456, 528), 'broken_bridge': (-1, 355), 'border_fortress': (1101, 377), 'rodericks_camp': (694, 563), 'borderland_shrine': (1309, 467), 'thornwood_gate': (1372, 406), 'southern_trail': (678, 748), 'darens_camp': (500, 250)}
RIVER = [(758, -30), (760, 60), (764, 150), (766, 205), (772, 260), (800, 330), (815, 400), (780, 465), (690, 505),
         (570, 515), (460, 490), (360, 440), (250, 390), (120, 360), (-60, 350)]
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
ON_RIVER = {'old_mill_crossing', 'broken_bridge'}
CROSS = {('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave')}
ROADS = [(a, b, 0) for a, b in __import__('opt').ROADS] + [('frontier_camp', 'darens_camp', 0), ('darens_camp', 'south_road_ambush', 0)]
