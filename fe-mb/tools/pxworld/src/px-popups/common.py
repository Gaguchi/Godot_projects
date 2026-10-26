"""px-popups: the map screen as it stands under a pop-up (company, contracts, pause), over the 1x pixel world.

A copy of dirs/f64-company/common.py (round 3, "go pixel everywhere"). Only the world under the pop-up changed:
  - world_map() is the pixel Borderlands (kit_px_map, found by the kit), the same world as PxMap1x;
  - company_at() stamps the pixel company (pxworld/folk.py's three minis and the standard), y-sorted into the world,
    at the stop's standing point (kit_px_map.stand) instead of moving the painted group;
  - beads() follows the roads as the pixel map draws them, so the roads that end on a bridge head keep their beads on the road.
F64_PAINTED=1 still gives the painted world and the painted group. Everything else is f64-company/common.py, unchanged:
  map_screen(...)   the whole map screen at rest (world, place labels, roads out, the three HUD windows)
                    for any stop and day, so a modal can dim it. Labels and HUD copy follow dirs/hyb-64/gen_map.py.
  slot_valid(...)   the dashed brass outline of a legal hand WITHOUT the bracket cursor (the kit's 'target'
                    state always adds brackets, which mean "pointed at"; only one hand is pointed at).
  vgroove(...)      a vertical carved groove (the kit's groove() is horizontal only).
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import math
import os
import sys

sys.path.insert(0, ROOT + '/src/kit64')
from kit import *            # noqa: E402,F401
import kit_icons as KI       # noqa: E402
import kit_px as KP          # noqa: E402
import kit_world_map as WM   # noqa: E402
PX = not os.environ.get('F64_PAINTED')
if PX:
    import kit_px_map as KPM  # noqa: E402  (the pixel world: the company stamp, standing points, road lines)

NAMES = WM.NAMES
PT = WM.P

# where each place's name sits on the painted map (x, top, anchor) - the Hyb64Map table
LBL = {
    'frontier_camp': (446, 438, 'c'), 'traders_rest': (566, 306, 'c'), 'riverside_market': (660, 438, 'c'),
    'south_road_ambush': (638, 516, 'c'), 'old_mill_crossing': (852, 290, 'l'), 'bandit_hideout': (830, 452, 'c'),
    'south_junction': (820, 566, 'c'), 'north_ridge_path': (984, 262, 'r'), 'watchtower_ridge': (1092, 266, 'c'),
    'pine_crossing': (1076, 436, 'c'), 'smugglers_cave': (1066, 526, 'c'), 'broken_bridge': (954, 592, 'c'),
    'border_fortress': (1262, 376, 'r'), 'rodericks_camp': (1262, 486, 'r'),
}
NEIGH = {}
for a, b, _ in WM.ROADS:
    NEIGH.setdefault(a, []).append(b)
    NEIGH.setdefault(b, []).append(a)


def _pos(key):
    x, top, al = LBL[key]
    if al == 'c':
        return f'left:{x - 160}px;width:320px;text-align:center'
    if al == 'l':
        return f'left:{x}px'
    return f'right:{1280 - x}px;text-align:right'


def labels(here, subs):
    """Place names on the world: the stop the company stands at (rill, s18), the roads out as plates, the rest quiet."""
    out = ''
    outs = set(NEIGH[here])
    for key in LBL:
        x, top, al = LBL[key]
        name = NAMES[key]
        pos = _pos(key)
        if key in outs:
            if al == 'c':
                out += plate(name, x=x, y=top, center=True)
            elif al == 'l':
                out += plate(name, x=x, y=top)
            else:
                out += f'<div class="abs" style="right:{1280 - x}px;top:{top}px">{plate(name)}</div>'
            sub_top = top + 30
        elif key == here:
            out += f'<div class="abs nowrap s18 rill ol1d" style="{pos};top:{top}px">{name}</div>'
            sub_top = top + 24
        else:
            out += f'<div class="abs nowrap s14 bone ol1d" style="{pos};top:{top}px">{name}</div>'
            sub_top = top + 18
        if key in subs:
            t, c = subs[key]
            out += f'<div class="abs nowrap s13 {c} ol1d" style="{pos};top:{sub_top}px">{t}</div>'
    out += '<div class="abs s14 bone nowrap" style="left:1176px;top:600px;width:78px;text-align:center;font-weight:700">Thornwood</div>'
    out += '<div class="abs s13 bone ol1d nowrap" style="right:16px;top:646px;text-align:right">the land runs on east</div>'
    return out


BEAD = ["..kkkkk..", ".k66655k.", "k6665544k", "k6655443k", "k6554433k", "k5544332k", "k4443322k", ".k33322k.", "..kkkkk.."]
BEAD_B = {'6': 'b5', '5': 'b4', '4': 'b3', '3': 'b2', '2': 'b0'}


def _resample(pts, n=600):
    """A polyline as n + 1 evenly spaced points."""
    acc = [0.0]
    for i in range(1, len(pts)):
        acc.append(acc[-1] + math.dist(pts[i - 1], pts[i]))
    out, j = [], 0
    for k in range(n + 1):
        s_ = acc[-1] * k / n
        while j < len(pts) - 2 and acc[j + 1] < s_:
            j += 1
        seg = acc[j + 1] - acc[j] or 1e-9
        t = (s_ - acc[j]) / seg
        out.append((pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t))
    return out


def beads(here, avoid=None):
    """Bone beads along every road out of `here`: the only actionable things on the map at rest.
    On the pixel map a road that ends on a bridge head (the mill, Broken Bridge) follows the drawn road, not the painted curve.
    avoid = (left, top, w, h): no bead lands there (the company standing on a road out; beads are laid over the world)."""
    R = Raster(1280, 720)

    def clear(bx, by):
        if not avoid:
            return True
        l, t, w, h = avoid
        return bx + 9 <= l - 2 or bx >= l + w + 2 or by + 9 <= t - 2 or by >= t + h + 2
    px_roads = KPM.road_paths() if PX else {}
    for (a, b), geo in WM.road_geo.items():
        if a == 'east' or here not in (a, b):
            continue
        A_, B_, c, _ = geo
        fine = [((1 - t) ** 2 * A_[0] + 2 * (1 - t) * t * c[0] + t * t * B_[0], (1 - t) ** 2 * A_[1] + 2 * (1 - t) * t * c[1] + t * t * B_[1])
                for t in [i / 600 for i in range(601)]]
        drawn = px_roads.get((a, b))
        if drawn and (tuple(drawn[0]) != tuple(A_) or tuple(drawn[-1]) != tuple(B_)):
            fine = _resample(drawn)
        if b == here:
            fine = fine[::-1]
        L = sum(math.dist(fine[i], fine[i + 1]) for i in range(600))
        run, acc = 0.0, 0.0
        for i in range(1, 601):
            d = math.dist(fine[i - 1], fine[i])
            run += d
            acc += d
            if acc >= 15 and 50 < run < L - 26:
                acc = 0
                bx, by = int(fine[i][0]) - 4, int(fine[i][1]) - 4
                if clear(bx, by):
                    R.stamp(BEAD, bx, by, keymap=BEAD_B)
    return R.svg(0, 0)


def company_at(key, dx=0, dy=0):
    """The company standing at a stop: pxworld's three minis under the standard, stamped into the pixel world at the stop's
    standing point (kit_px_map.stand, nudged by dx, dy), with their ground shadows and anything that stands in front of them.
    Lay it over world_map(company=False). With F64_PAINTED=1, the painted group moved from Frontier Camp, as before."""
    if PX:
        fx, fy = KPM.stand(key)
        return KPM.company_img(fx + dx, fy + dy)
    fx, fy = PT['frontier_camp']
    tx, ty = PT[key]
    return (f'<svg class="abs" style="left:0;top:0" width="1280" height="720" viewBox="0 0 1280 720">'
            f'<g transform="translate({tx - fx + dx} {ty - fy + dy})">{WM.company}</g></svg>')


# ------------------------------------------------------------------ the HUD windows of the map screen
SEGS = [('Borderlands', ('m2', 'm3', 'm4', 'm5')), ('Thornwood', ('m0', 'm1', 'm2', 'm3')),
        ('Ashfall', ('b0', 'b0', 'b1', 'b2')), ('Iron Throne', ('x1', 'x1', 'x2', 'x3'))]


def region_window(day, gold, rations_used):
    RW, RH = 472, 176
    SX0, SY, SEGW, SEGH = 20, 92, 106, 12
    strip = Raster(SEGW * 4 + 4, SEGH + 2)
    for i, (n, ramp) in enumerate(SEGS):
        x0 = i * (SEGW + 1)
        for xx in range(x0, x0 + SEGW):
            for yy in range(SEGH + 2):
                if yy in (0, SEGH + 1) or xx in (x0, x0 + SEGW - 1):
                    strip.set(xx, yy, 'k0')
                elif yy == 1:
                    strip.set(xx, yy, ramp[3])
                elif yy == SEGH:
                    strip.set(xx, yy, ramp[0])
                else:
                    strip.set(xx, yy, ramp[2] if yy < 6 else ramp[1])
    body = strip.svg(SX0, SY)
    for i, (n, _) in enumerate(SEGS):
        body += T(SX0 + i * (SEGW + 1), SY + 17, n, f's13 {"bone" if i == 0 else "faint"} c', w=SEGW)
    body += KP.frame(SEGW + 6, SEGH + 8, 'plate', shadow=1).svg(SX0 - 3, SY - 3)
    body += pin(SX0 + 49, SY - 8)
    food = sum(4 - u for u in rations_used)
    body += T(RW - PAD, 20, f'{icon_inline("day", "margin:-5px 6px 0 0")}Day {day}', 's20 bone', style='transform:translateX(-100%)')
    body += T(PAD, 62, 'Roads here: an encounter on <span class="rust">4 hops in 10</span>', 's15 dim')
    body += rule(PAD, 136, RW - 2 * PAD)
    body += T(PAD, 144, f'{icon_inline("gold")}<span class="straw">{gold}</span> gold', 's15 bone')
    body += T(116, 144, f'{icon_inline("food")}<span class="straw">{food}</span> food', 's15 bone')
    body += food_pips(206, 148, (4, 4), tuple(rations_used))
    body += T(RW - PAD, 144, f'{icon_inline("potion")}Healing Potion ×1', 's15 bone', style='transform:translateX(-100%)')
    return window(EDGE, EDGE, RW, RH, body, title='The Borderlands', big=True)


def commands_window(contracts_sub='none yet'):
    body = (T(PAD, 16, 'The Company', 's18 bone') + T(162, 19, 'roster and gear', 's13 dim') + groove(PAD, 43, 244)
            + T(PAD, 50, 'Contracts', 's18 bone') + T(162, 53, contracts_sub, 's13 dim') + groove(PAD, 77, 244)
            + T(PAD, 84, 'Menu', 's18 bone') + T(160, 86, key('Esc'), 's14'))
    return window(982, EDGE, 284, 122, body)


def company_window(roles=None):
    roles = roles or {}
    rows = ''
    for i, u in enumerate(COMPANY):
        y = 44 + i * 52
        rows += face(u['face'], 18, y, 48)
        rows += T(82, y + 4, u['name'], 's16 bone')
        rows += T(82, y + 27, roles.get(u['id'], u['role']), 's13 dim')
        rows += hp_bar(250, y + 10, 64, u['hp'], u['max'])
        rows += T(392 - PAD, y + 4, f'{u["hp"]}/{u["max"]}', 's14 bone', style='transform:translateX(-100%)')
    return window(EDGE, 496, 392, 214, rows, title='The Company', note='three of us')


def map_screen(here='frontier_camp', day=1, gold=80, rations_used=(0, 0), contracts_sub='none yet', subs=None, hint=None,
               roles=None, company_dxy=(0, 0)):
    """The whole map screen at rest, ready to be dimmed."""
    # South Road Ambush and Bandit Hideout are DISCOVERY nodes: 'landmark' (run/overworld.ts#typeLabel), each a check event
    subs = subs if subs is not None else {'smugglers_cave': ('locked for now', 'rust'), 'south_road_ambush': ('a landmark', 'bone'),
                                          'bandit_hideout': ('a landmark', 'dim')}
    subs = dict(subs)
    subs[here] = ('the company is here', 'rill')
    avoid = None
    if here == 'frontier_camp':
        out = world_map()
        if PX:
            avoid = KPM.company_box(*KPM.CAMP_FOOT)
    else:
        out = world_map(company=False) + company_at(here, *company_dxy)
        if PX:
            fx, fy = KPM.stand(here)
            avoid = KPM.company_box(fx + company_dxy[0], fy + company_dxy[1])
    out += beads(here, avoid) + labels(here, subs)
    if hint:
        out += T(424, 692, hint, 's14 bone ol1d')
    out += region_window(day, gold, rations_used) + commands_window(contracts_sub) + company_window(roles)
    return out


# ------------------------------------------------------------------ local pieces over the kit's primitives
def slot_valid(x, y, w=64, h=108):
    """A legal hand that is not pointed at: the kit's dashed brass outline around the slot well, no brackets.
    (x, y) is the slot's label top, as for equip_slot()."""
    sy = y + 38
    R = Raster(w + 6, h + 6)
    for i in range(w + 6):
        for j in range(h + 6):
            if (i in (0, w + 5) or j in (0, h + 5)) and (i + j) % 4 < 2:
                R.set(i, j, 'o4')
    return R.svg(x - 3, sy - 3)


def vgroove(x, y, h):
    """A vertical carved groove: 1 px dark, 1 px light."""
    R = Raster(2, h)
    for j in range(h):
        R.set(0, j, 'k0')
        R.set(1, j, 'w3')
    return R.svg(x, y)


def rtext(x, y, text, cls='s13 dim'):
    """Right-aligned text ending at x."""
    return T(x, y, text, cls, style='transform:translateX(-100%)')
