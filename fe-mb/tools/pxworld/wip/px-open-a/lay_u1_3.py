"""Candidate U1: the river comes down past the mill, curls under the camp and leaves west by Broken Bridge."""
from lay_r1 import NAMES   # noqa
P = {'frontier_camp': (627, 288), 'traders_rest': (412, 334), 'riverside_market': (679, 453), 'south_road_ambush': (467, 243), 'old_mill_crossing': (768, 233), 'bandit_hideout': (512, 441), 'south_junction': (271, 305), 'north_ridge_path': (837, -30), 'watchtower_ridge': (896, 167), 'pine_crossing': (797, 509), 'smugglers_cave': (270, 444), 'broken_bridge': (-24, 352), 'border_fortress': (1020, 338), 'rodericks_camp': (540, 556), 'borderland_shrine': (1310, 350), 'thornwood_gate': (1306, 295), 'southern_trail': (457, 750), 'darens_camp': (500, 250)}
RIVER = [(758, -30), (760, 60), (764, 150), (766, 205), (772, 260), (800, 330), (815, 400), (780, 465), (690, 505),
         (570, 515), (460, 490), (360, 440), (250, 390), (120, 360), (-60, 350)]
INSIDE = {'frontier_camp', 'traders_rest', 'riverside_market', 'south_road_ambush', 'bandit_hideout', 'south_junction', 'darens_camp'}
ON_RIVER = {'old_mill_crossing', 'broken_bridge'}
CROSS = {('bandit_hideout', 'pine_crossing'), ('south_junction', 'smugglers_cave')}
ROADS = [(a, b, 0) for a, b in __import__('opt').ROADS] + [('frontier_camp', 'darens_camp', 0), ('darens_camp', 'south_road_ambush', 0)]
