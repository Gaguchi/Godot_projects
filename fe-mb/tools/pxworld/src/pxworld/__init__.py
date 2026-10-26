"""pxworld: Embermarch's sunlit country as genuine pixel art (Python + PIL + numpy), for the Filigree UI.

Draw at ART resolution into an indexed Canvas, save a PNG, embed it in a board as a data URI, and show it
with image-rendering:pixelated at an integer scale. Every builder takes g, the grain:
    g = 1   1 screen px per art px (HD pixel art: Sea of Stars, Eastward, Chained Echoes)
    g = 2   2 screen px per art px (16-bit: FF6, Chrono Trigger, Tactics Ogre); art canvas = stage / 2
Sizes passed to builders are in ART px. A scene laid out in stage px divides by g on the way in.

    import sys; sys.path.insert(0, 'tools/pxworld/src')
    from pxworld import Canvas, Scene, pal, terrain as TR, trees as TS, props as PR, places as PL, folk as FK
    g = 2
    cv = Canvas(1280 // g, 720 // g)
    TR.grass(cv, seed=4, g=g)                          # meadow
    sc = Scene(cv, g)                                  # everything that stands up, y-sorted
    PL.camp(sc, 300 // g, 200 // g, 'traders')         # tents, wagon, fire, smoke
    sc.tree(500 // g, 220 // g, 9 / g)
    for spr, dx, dy in FK.company_items(g):            # the three under the standard
        sc.add(spr, 400 // g + dx, 260 // g + dy, shadow=('ell', 1, 1, 5 / g, 2 / g))
    sc.draw()
    uri = cv.data_uri()                                # -> <img src=uri style="width:1280px;image-rendering:pixelated">

Modules
  pal        the palette: the Filigree kit's 7 ramps + Grass Leaf Pine Water Dirt Stone Wheat Roof Skin,
             each dark -> light. Shadow = a move down the pixel's own ramp: pal.shift_index(i, n).
             Grass has half-steps (STEP['g'] = 2); fine=True moves single places.
  canvas     Canvas (uint8 palette indices, 255 = clear) and Sprite (a Canvas with a foot anchor ax, ay).
             fill / shift(mask, n, ramps) / stamp(sprite, foot_x, foot_y) / line_px / poly_fill / ell_fill /
             ell_shade (a lit dome) / outline / despeckle / image / save(zoom=) / data_uri.
             Masks are (bool array, x0, y0): poly(), ellipse(), disc(), rect(), line().
  terrain    whole-canvas ground painters: grass, hills (mound | ridge), patch (trampled dirt), road, river,
             ripples, field (wheat | wheat2 | crop | crop2 | plough), tufts, flowers, stones, reeds,
             poisson / clustered (point scatter).
  trees      clumps(r) broadleaf crown, pine(h), tree(r) crown + trunk, bush(r), forest(...) a dense mass,
             hedge(a, b) + stamp_bushes() hedgerows.
  props      house(w, d, h, roof, wall), rock(r), outcrop(W, H, pts), tower(w, h), tent(cloth, big, stripe),
             fire, smoke, stake, wagon, stall(cloth), barrel, sack, haystack, flag(cloth), signpost, ox.
             roof: tile | tile2 | thatch | slate | shingle; wall: plaster | stone | timber;
             cloth: canvas | tan | red | blue.
  places     Scene (y-sorted sprites with ground shadows) and the map's places: camp_palisade (Frontier
             Camp), camp('traders' | 'roderick'), market, town, watchtower, fortress, cave, hideout, wreck,
             mill, broken_bridge, cairn, farm, thornwood_sign; palisade(...) for any stake ring.
             Grain 1 adds south_junction, pine_crossing and lay(sc, plan): a settlement plan of houses,
             yards, gardens, fences, paths, a cobbled square, stalls and props in stage px. Scene.ground
             (default g d h) names the ramps shadows fall on; Scene.reink=True re-outlines rocks in selout.
             Every place keeps its grain-2 look; the grain-1 versions are drawn with build (below).
  build      grain-1 structures in the map's 3/4 view, all outlined selout-style (no Ink):
             selout(s) / reink(s)  outline in each part's own darkest step, lighter on lit edges
             cottage(w, 'ew'|'ns', roof, wall)  long-side or gable-end house: two-tone slopes, ridge, eaves
               and their shadow line, door, windows, plinth, chimney; roof tile|tile2|thatch|slate|blue|
               shingle, wall plaster|stone|timber|boards; lhouse (L with a street-facing wing); barn
             awning_stall, well2, waterwheel, timber_bridge, stone_bridge(L, run, arches, broken=),
             stone_tower, stake_arc, board_sign, fingerpost, fallen_oak, cart_on_side, dead_ox, masonry,
             woodpile, crate, handcart, trough, flour_sacks
             ground painters: cobbles, yard, garden, fence, fence_ring, ford, water_shade
  folk       figure('roy' | 'marcus' | 'lilina', g), standard(g), company(cv, x, y, g), company_items(g).
  borderlands  the overworld: render(g, skip=(), company=True|False|(x, y)) -> (Canvas, info). Same places, roads, river, fields,
             forests and hills as the painted world (dirs/hyb-64/world_map.py), so labels and markers line
             up. At grain 1 the roads run onto the bridge heads, two roads wade the river at fords, and the
             towns stand on their own streets and yards instead of a trampled blob.
  gen_map    the PxMap1x / PxMap2x boards: python gen_map.py grain=1|2
  qa         crops.py (before/after NEAREST crops of every structure), plan.py + fast.py (layout loop)

Light comes from the north-west everywhere: lit NW faces, shaded SE faces, ground shadows thrown SE.
"""
from .canvas import Canvas, Sprite, compose, poly, ellipse, disc, rect, line   # noqa: F401
from . import pal                                                                # noqa: F401
from .places import Scene                                                        # noqa: F401
