"""The heartland's new places and every road inside it (planned by hand; see NOTES.md for the sketches).

HEART[id] = (name, type, sigil or None, (x, y) world px, job). All in the Borderlands. The job picks the art
in world_big.py. HEART_ROADS = [(a, b)] in the heartland, all borderlands_road.
"""
HEART = {
    # north-west: Ashfall's edge on the left, Thornwood's pines along the top, the brook coming down out of them
    'charcoal_burners_camp': ("Charcoal Burners' Camp", 'CAMP', None, (170, 210), 'charcoal'),
    'beacon_hill': ('Beacon Hill', 'CAMP', 'fortress', (470, 190), 'beacon'),
    'hunters_lodge': ("Hunter's Lodge", 'CAMP', None, (780, 130), 'lodge'),
    'woodcutters_camp': ("Woodcutters' Camp", 'CAMP', None, (1160, 180), 'woodcamp'),
    'old_sawpit': ('Old Sawpit', 'TRAIL', 'waypoint', (1500, 90), 'sawpit'),
    'cairn_hill': ('Cairn Hill', 'TRAIL', 'waypoint', (1380, 250), 'cairn'),
    'heath_croft': ('Heath Croft', 'CAMP', None, (330, 330), 'croft'),
    'burnt_farm': ('Burnt Farm', 'DISCOVERY', 'battle', (160, 460), 'burnt'),
    'standing_stones': ('Standing Stones', 'DISCOVERY', 'shrine', (520, 420), 'stones'),
    'barley_hill_farm': ('Barley Hill Farm', 'CAMP', None, (740, 330), 'farm'),
    'plank_bridge': ('Plank Bridge', 'TRAIL', 'bridge', (1042, 330), 'bridge'),
    'beekeepers_croft': ("Beekeeper's Croft", 'CAMP', None, (1130, 590), 'bees'),
    # north-east: the fortress road, the river, Thornwood down the right-hand side
    'upland_farm': ('Upland Farm', 'CAMP', None, (1500, 480), 'farm'),
    'old_orchard': ('Old Orchard', 'CAMP', None, (1790, 350), 'orchard'),
    'coopers_yard': ("Cooper's Yard", 'CAMP', None, (1830, 560), 'cooper'),
    'stony_ford': ('Stony Ford', 'TRAIL', 'waypoint', (2005, 290), 'ford'),
    'foresters_hut': ("Forester's Hut", 'CAMP', None, (2160, 100), 'lodge'),
    'trappers_camp': ("Trappers' Camp", 'CAMP', None, (2320, 260), 'trappers'),
    'forest_shrine': ('Forest Shrine', 'DISCOVERY', 'shrine', (2470, 110), 'shrine'),
    'eastbank_farm': ('Eastbank Farm', 'CAMP', None, (2260, 440), 'farm'),
    'ruined_keep': ('Ruined Keep', 'DISCOVERY', 'battle', (2470, 470), 'ruin'),
    'hay_meadow': ('Hay Meadow', 'CAMP', None, (1880, 760), 'hay'),
    # round the camp
    'crossroads_well': ('Crossroads Well', 'TRAIL', 'waypoint', (1480, 860), 'well'),
    'kiln_yard': ('Kiln Yard', 'CAMP', None, (1760, 980), 'kilns'),
    'toll_bridge': ('Toll Bridge', 'TRAIL', 'bridge', (2107, 900), 'bridge'),
    'shepherds_fold': ("Shepherd's Fold", 'CAMP', None, (800, 820), 'fold'),
    # south-west: the brook turns west into Ashfall
    'old_barrow': ('Old Barrow', 'DISCOVERY', 'shrine', (130, 720), 'barrow'),
    'boundary_stone': ('Boundary Stone', 'DISCOVERY', 'shrine', (310, 770), 'marker'),
    'gallows_hill': ('Gallows Hill', 'DISCOVERY', 'battle', (170, 990), 'gallows'),
    'drovers_camp': ("Drovers' Camp", 'CAMP', None, (430, 930), 'drovers'),
    'wayside_shrine': ('Wayside Shrine', 'DISCOVERY', 'shrine', (610, 990), 'shrine'),
    'brook_mill': ('Brook Mill', 'TRAIL', 'waypoint', (700, 1140), 'mill'),
    'sheep_ford': ('Sheep Ford', 'TRAIL', 'waypoint', (420, 1205), 'ford'),
    'ash_ford': ('Ash Ford', 'TRAIL', 'waypoint', (130, 1185), 'ford'),
    'lowfield': ('Lowfield', 'TOWN', None, (770, 1290), 'hamlet'),
    'old_quarry': ('Old Quarry', 'TRAIL', 'waypoint', (1000, 1330), 'quarry'),
    'ploughmans_rest': ("Ploughman's Rest", 'CAMP', None, (1100, 1140), 'farm'),
    'charred_barn': ('Charred Barn', 'DISCOVERY', 'battle', (1230, 1350), 'burnt'),
    # south-east: the river runs on south past the broken bridge
    'lower_farm': ('Lower Farm', 'CAMP', None, (1560, 1060), 'farm'),
    'willowbank': ('Willowbank', 'TOWN', None, (2010, 1090), 'hamlet'),
    'goose_green': ('Goose Green', 'TOWN', None, (1660, 1290), 'hamlet'),
    'smoke_hill': ('Smoke Hill', 'TRAIL', 'waypoint', (1470, 1360), 'signal'),
    'south_watch': ('South Watch', 'CAMP', 'fortress', (1920, 1330), 'tower'),
    'fishers_huts': ("Fishers' Huts", 'CAMP', None, (2260, 1360), 'fishers'),
    'reed_marsh': ('Reed Marsh', 'TRAIL', 'waypoint', (2470, 1250), 'marsh'),
}

HEART_ROADS = [
    # the camp is the hub
    ('frontier_camp', 'north_ridge_path'), ('frontier_camp', 'upland_farm'), ('frontier_camp', 'riverside_market'),
    ('frontier_camp', 'crossroads_well'), ('frontier_camp', 'south_road_ambush'), ('frontier_camp', 'traders_rest'),
    ('frontier_camp', 'darens_camp'), ('darens_camp', 'south_road_ambush'),
    # north and north-west
    ('north_ridge_path', 'cairn_hill'), ('north_ridge_path', 'plank_bridge'), ('north_ridge_path', 'watchtower_ridge'),
    ('north_ridge_path', 'beekeepers_croft'), ('beekeepers_croft', 'traders_rest'),
    ('cairn_hill', 'woodcutters_camp'), ('cairn_hill', 'old_sawpit'), ('woodcutters_camp', 'plank_bridge'),
    ('plank_bridge', 'barley_hill_farm'), ('barley_hill_farm', 'hunters_lodge'), ('barley_hill_farm', 'standing_stones'),
    ('hunters_lodge', 'beacon_hill'), ('beacon_hill', 'charcoal_burners_camp'), ('charcoal_burners_camp', 'heath_croft'),
    ('heath_croft', 'standing_stones'), ('heath_croft', 'burnt_farm'), ('standing_stones', 'borderland_shrine'),
    ('burnt_farm', 'borderland_shrine'),
    ('watchtower_ridge', 'border_fortress'), ('watchtower_ridge', 'upland_farm'), ('watchtower_ridge', 'old_orchard'),
    ('border_fortress', 'stony_ford'), ('stony_ford', 'foresters_hut'), ('stony_ford', 'trappers_camp'),
    ('old_orchard', 'coopers_yard'), ('upland_farm', 'riverside_market'),
    # east
    ('riverside_market', 'old_mill_crossing'), ('riverside_market', 'coopers_yard'), ('coopers_yard', 'old_mill_crossing'),
    ('riverside_market', 'hay_meadow'), ('riverside_market', 'kiln_yard'),
    ('old_mill_crossing', 'pine_crossing'), ('old_mill_crossing', 'eastbank_farm'), ('eastbank_farm', 'trappers_camp'),
    ('eastbank_farm', 'ruined_keep'), ('trappers_camp', 'forest_shrine'), ('pine_crossing', 'rodericks_camp'),
    ('pine_crossing', 'ruined_keep'), ('rodericks_camp', 'smugglers_cave'), ('hay_meadow', 'toll_bridge'),
    ('toll_bridge', 'rodericks_camp'),
    # south and south-east
    ('kiln_yard', 'crossroads_well'), ('kiln_yard', 'willowbank'), ('crossroads_well', 'lower_farm'),
    ('south_road_ambush', 'south_junction'), ('south_road_ambush', 'ploughmans_rest'), ('south_junction', 'lower_farm'),
    ('south_junction', 'goose_green'), ('south_junction', 'charred_barn'), ('goose_green', 'smoke_hill'),
    ('goose_green', 'south_watch'), ('willowbank', 'south_watch'), ('willowbank', 'toll_bridge'), ('south_watch', 'broken_bridge'),
    ('broken_bridge', 'smugglers_cave'), ('broken_bridge', 'fishers_huts'), ('fishers_huts', 'reed_marsh'),
    ('smugglers_cave', 'reed_marsh'),
    # west and south-west
    ('traders_rest', 'bandit_hideout'), ('traders_rest', 'shepherds_fold'), ('bandit_hideout', 'borderland_shrine'),
    ('bandit_hideout', 'boundary_stone'), ('bandit_hideout', 'drovers_camp'), ('old_barrow', 'burnt_farm'),
    ('old_barrow', 'boundary_stone'), ('old_barrow', 'gallows_hill'),
    ('shepherds_fold', 'wayside_shrine'), ('shepherds_fold', 'brook_mill'), ('drovers_camp', 'gallows_hill'),
    ('drovers_camp', 'wayside_shrine'), ('drovers_camp', 'sheep_ford'),
    ('sheep_ford', 'lowfield'), ('brook_mill', 'lowfield'), ('lowfield', 'old_quarry'), ('old_quarry', 'charred_barn'),
    ('ploughmans_rest', 'old_quarry'), ('gallows_hill', 'ash_ford'),
]
