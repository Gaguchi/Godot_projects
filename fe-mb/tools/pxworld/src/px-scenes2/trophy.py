"""Local kit gap: the trophy art. Shadowfang (legendary dagger) drawn at 1x as an 88 x 88 pixel piece on the kit's own
Icon primitive (supersampled shapes, dome shading in palette ramps, ink outline), plus a well to seat it in."""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import sys
sys.path.insert(0, ROOT + '/src/kit64')
import numpy as np  # noqa: E402
import kit_px as KP  # noqa: E402
from kit_px import Icon, poly, seg, circle, union, minus, frame, C  # noqa: E402

SLATE = ['k1', 's0', 's1', 's2', 's3', 's4']            # obsidian-dark steel
EDGE = ['s2', 's3', 's4', 's5', 'b5']                   # the honed edge
BRASS = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6']
GRIP = ['w1', 'w2', 'w3', 'w4', 'w5']
BONE = ['b0', 'b1', 'b2', 'b3', 'b4', 'b5']


def shadowfang(n=88):
    """The dagger on a diagonal: a fang-curved black blade to the north-east, brass guard, wrapped grip, a bone fang pommel."""
    I = Icon(n, n)
    # blade: a broad curved fang from the guard root to a hooked tip; the back bows out, the belly is honed
    back = [(31, 49), (38, 38), (47, 28), (57, 19), (68, 12), (78, 8), (84, 6)]
    belly = [(84, 6), (79, 13), (72, 22), (63, 32), (54, 42), (46, 51), (40, 57)]
    blade = I.m(poly(back + belly))
    I.layer(blade, ['k0', 'k1', 's0', 's1', 's2', 's3'], R=3.4, bias=-.08)
    # the honed edge: a bright line along the belly, two pixels in from the outline
    yy, xx = np.indices(blade.shape)
    shrunk = I.m(poly([(33, 49), (40, 38), (49, 28), (59, 20), (70, 13), (80, 8), (84, 6), (77, 13), (70, 21), (61, 31), (52, 41), (44, 50), (39, 55)]))
    edge = blade & ~shrunk & ((xx + yy) > 88)
    for j, i in zip(*np.nonzero(edge)):
        I.keys[j, i] = 's4' if (i + j) % 7 else 's5'
    # a short dark fuller near the root
    I.flat(seg(42, 44, 58, 28, .6), 'k0')
    # guard: a brass bar across the blade root with knobbed quillons
    I.layer(union(seg(26, 45, 44, 63, 3.0), circle(25, 44, 3.6), circle(45, 64, 3.6)), BRASS, R=2.4, inner_line='k0')
    # grip: wrapped leather with three wraps
    I.layer(seg(32, 58, 18, 72, 3.6), GRIP, R=2.6, inner_line='k0')
    for t in (.2, .45, .7):
        x, y = 32 - 14 * t, 58 + 14 * t
        I.flat(seg(x - 3, y - 3, x + 3, y + 3, .55), 'w1')
    # pommel: a fang of bone
    I.layer(union(circle(15, 75, 5.2), poly([(10, 78), (5, 87), (14, 80)])), BONE, R=2.6, inner_line='k0')
    return I.raster('k0')


def trophy_well(x, y, n=104):
    """The trophy seated in a recessed well (the kit's own well frame), dark dithered floor, the dagger at 1x."""
    art = shadowfang(88)
    floor = (f'<div class="abs" style="left:{x + 4}px;top:{y + 4}px;width:{n - 8}px;height:{n - 8}px;background-color:{C["k1"]};'
             f'background-image:repeating-conic-gradient({C["w1"]} 0 25%,transparent 0 50%);background-size:2px 2px"></div>')
    return floor + frame(n, n, 'well', shadow=0).svg(x, y) + art.svg(x + (n - 88) // 2, y + (n - 88) // 2)
