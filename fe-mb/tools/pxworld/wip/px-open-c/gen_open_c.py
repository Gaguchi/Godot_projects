"""PxOpenC: variant C of the open map, march anywhere, under the Filigree UI. B's country unchanged (world_b), with
one rule changed: the company is not tied to roads. Day 1 at Frontier Camp, pointing at Scorched Village, which
lies past the south edge in Ashfall: the south road out of camp, then open country, three days quicker than the
road round by Broken Bridge.

Written by make_c.py from dirs/px-open-b/gen_open_b.py; what C changes is marked `# C:`. Everything about the
march (how far a day carries, the route, the days, the rolls) is computed by march.py from world_b's data at run
time, so this board follows B's country when B changes.

Usage: python gen_open_c.py [out=path]
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(os.path.abspath(__file__))
while not os.path.isdir(os.path.join(DIRS, 'pxworld')):      # the scratchpad's dirs/ folder
    DIRS = os.path.dirname(DIRS)
for _p in (os.path.join(DIRS, 'hyb-64'), DIRS, os.path.join(DIRS, 'px-open-b'), HERE):   # C: B's folder
    if _p not in sys.path:
        sys.path.insert(0, _p)
import icons64 as I                      # noqa: E402
import px64 as P                         # noqa: E402
from px64 import C, B, Raster, window, rule, groove, css_base, wrap, write   # noqa: E402
import world_b as WB                     # noqa: E402
import overview as OV                    # noqa: E402
import geo                               # noqa: E402
import march as M                        # noqa: E402   C: the travel rule
import bits                              # noqa: E402   C: B's edge sign, for the destination's sign
from pxworld import places as PL, pal as WP   # noqa: E402

ARGS = dict(a.split('=', 1) for a in sys.argv[1:])
PT, NAMES = WB.P, WB.NAMES
DEST = 'scorched_village'                # C: the destination, past the south edge
HOPS = WB.hops()

# ------------------------------------------------------------------ the pixel world, one PNG at 1:1
cv, info = WB.render(company=True)
os.makedirs(os.path.join(HERE, 't'), exist_ok=True)

# ------------------------------------------------------------------ C: the march (march.py), read from B's country at run time
GRID = M.grid(info)
DAYS = M.place_days(GRID, M.solve(GRID))                        # the quickest march to every place
BY_ROAD = M.place_days(GRID, M.solve(GRID, roads_only=True))     # the same, keeping to the roads
AVOID = [k for k in PT if not WB.NODE[k].get('hidden') and k not in ('frontier_camp', DEST)]
LEGS = M.route(GRID, M.solve(GRID, avoid=AVOID), DEST)          # walks round the places it passes
ROAD_LEGS = M.route(GRID, M.solve(GRID, roads_only=True), DEST)  # the long way round, by road alone
T_DAYS = M.cost_of(LEGS, GRID)
N_DAYS, ROAD_DAYS = M.whole(T_DAYS), M.whole(BY_ROAD[DEST])
ROLLS = M.day_rolls(LEGS, GRID, DEST)
ROAD_ROLLS = M.day_rolls(ROAD_LEGS, GRID, DEST)
KM = M.px_by_kind(LEGS, GRID)
assert abs(T_DAYS - DAYS[DEST]) < .25, (T_DAYS, DAYS[DEST])     # the drawn route is the quickest, within a step
assert N_DAYS < ROAD_DAYS, (N_DAYS, ROAD_DAYS)                  # and clearly quicker than the road


def one_day(k):
    """C: the places a single day's march away carry the tag B gives the places one hop away."""
    return k != 'frontier_camp' and M.whole(DAYS[k]) == 1


def sign_words_c(e):
    """C: an edge sign's words with the days of march (world_b.sign_words counts hops)."""
    region, _ = WB.sign_words(e)
    return region, f"{NAMES[e['to']]} · {M.whole(DAYS[e['to']])} days"


def chaikin(pts, n=2):
    for _ in range(n):
        out = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            out += [(a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25), (a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75)]
        out.append(pts[-1])
        pts = out
    return pts


road_legs = [lg for lg in LEGS if lg['kind'] == 'road']
open_legs = [lg for lg in LEGS if lg['kind'] != 'road']
ol = geo.resample(chaikin(open_legs[0]['pts']), 1.0)
ol_view = [p for p in ol if p[1] < 724]                          # the stitches run on to the bottom edge


def line_x(y):
    """Where the cross-country line is at stage row y."""
    return min(ol_view, key=lambda p: abs(p[1] - y))[0]


# C: the destination's sign, planted beside the line where it leaves the bottom edge, as B plants its edge signs
SIGN_W, SIGN_H, SIGN_PH = 84, 23, 34
SIGN_Y = 720 - 38
SIGN_X = int(max(line_x(y) for y in range(SIGN_Y - 20, SIGN_Y + SIGN_H)) + 14)
_ss = bits.edge_sign(SIGN_W, SIGN_H, SIGN_PH, None)
_sc = PL.Scene(cv, 1, seed=5)
_sc.ground = ('g', 'd', 'h', 't')
_sc.add(_ss, SIGN_X - _ss.board[0] + _ss.ax, SIGN_Y - _ss.board[1] + _ss.ay, shadow='house')
_sc.draw()
SIGN_CAP = f"{NAMES[DEST]} · {N_DAYS} days"
SIGN_CAP_BOX = (SIGN_X, SIGN_Y - 19, SIGN_X + int(len(SIGN_CAP) * 6.9), SIGN_Y - 3)
FOOT_X = SIGN_X + SIGN_W + 26                                    # C: the footnote, right of that sign
GHOST_CAP = (818, 604)                                             # C: 'by road N days', over the road to Broken Bridge
cv.save(os.path.join(HERE, 't', 'world_c.png'))
world = (f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
         f'width="1280" height="720" src="{cv.data_uri()}">')
parts = [world]
road_px = info['road_px']

# ------------------------------------------------------------------ C: the route, brass beads on the road, brass stitches across country
BEAD = ["..kkkkk..", ".k66655k.", "k6665544k", "k6655443k", "k6554433k", "k5544332k", "k4443322k", ".k33322k.", "..kkkkk.."]
BEAD_O = {'6': 'o6', '5': 'o5', '4': 'o4', '3': 'o3', '2': 'o1'}
GHOST = [".kk.", "k33k", "k22k", ".kk."]                         # the road-alone way: dim bone, unlit
GHOST_K = {'3': 'b3', '2': 'b2'}


def stitch(R, a, b):
    """One stitch of the cross-country line: a brass dash from a to b as heavy as a bead, lit on its upper-left
    side, in an ink outline (stepped by coverage of its own centre line, so every stitch at one angle steps the same)."""
    ax, ay = a
    bx, by = b
    L = math.dist(a, b) or 1
    ux, uy = (bx - ax) / L, (by - ay) / L
    nx, ny = -uy, ux
    if nx + ny > 0:
        nx, ny = -nx, -ny                               # n points to the lit (upper-left) side
    body = {}
    for y in range(int(min(ay, by)) - 4, int(max(ay, by)) + 5):
        for x in range(int(min(ax, bx)) - 4, int(max(ax, bx)) + 5):
            px, py = x + .5 - ax, y + .5 - ay
            t = px * ux + py * uy
            s = px * nx + py * ny
            r = 2.3 - max(0.0, -t, t - L) * 1.2          # rounded ends
            if -1.6 <= t <= L + 1.6 and abs(s) <= r:
                body[(x, y)] = s
    for (x, y) in body:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in body:
                R.set(x + dx, y + dy, 'k0')
    for (x, y), s in body.items():
        R.set(x, y, 'o6' if s > 1.3 else ('o5' if s > .3 else ('o4' if s > -.8 else 'o3')))


route = Raster(1280, 720)
# the road-alone way, dim, from where the march leaves the road round to the bottom edge (only on open road)
_leave = road_legs[0]['pts'][-1]
_gpts = [p for lg in ROAD_LEGS for p in geo.resample(lg['pts'], 1.0)]
_g0 = min(range(len(_gpts)), key=lambda i: math.dist(_gpts[i], _leave)) + 44   # past the wreck's clearing
_dirt = set(WP.RAMP['d'])
for i in range(_g0, len(_gpts), 14):
    gx, gy = int(_gpts[i][0]), int(_gpts[i][1])
    if not (2 <= gx < 1278 and 2 <= gy < 718):
        continue
    if all(int(cv.ix[gy + dy, gx + dx]) in _dirt for dy in range(-2, 3) for dx in range(-2, 3)):
        route.stamp(GHOST, gx - 2, gy - 2, keymap=GHOST_K)
# the leg out of camp: beads along the road from the palisade to where the march leaves it
first = geo.resample(road_legs[0]['pts'], 1.0)
for i in range(34, len(first) - 6, 14):
    route.stamp(BEAD, int(first[i][0]) - 4, int(first[i][1]) - 4, keymap=BEAD_O)
# the open country: stitches from where the road is left, on off the bottom edge past the destination's sign
s_ = 6.0
while s_ + 2 < len(ol_view):
    stitch(route, ol_view[int(s_)], ol_view[min(len(ol_view) - 1, int(s_ + 7))])
    s_ += 14
# the destination's sign is pointed at: brass trim round its board
_bx0, _by0, _bx1, _by1 = SIGN_X, SIGN_Y, SIGN_X + SIGN_W - 1, SIGN_Y + SIGN_H - 1
for x in range(_bx0 + 1, _bx1):
    route.set(x, _by0, 'o5'); route.set(x, _by1, 'o2')
for y in range(_by0 + 1, _by1):
    route.set(_bx0, y, 'o4'); route.set(_bx1, y, 'o2')
parts.append(route.svg(0, 0))
route_samples = [p for lg in LEGS for p in geo.resample(lg['pts'], 3.0) if p[1] < 724]


def text_w(s, px):
    return int(len(s) * px + .5)


# ------------------------------------------------------------------ UI boxes (windows, the card, the edge boards)
RW, RH = 472, 176
CARD = (628, 436, 362, 148)                                       # C: the forecast, beside the route
UI = [(14, 14, 14 + RW + 2, 14 + RH + 2), (982, 14, 1268, 138), (14, 496, 408, 712),
      (CARD[0], CARD[1], CARD[0] + CARD[2] + 2, CARD[1] + CARD[3] + 2),
      (SIGN_X - 2, SIGN_Y - 2, SIGN_X + SIGN_W + 2, 720), SIGN_CAP_BOX,          # C: the destination's sign
      (GHOST_CAP[0], GHOST_CAP[1], GHOST_CAP[0] + 100, GHOST_CAP[1] + 16), (FOOT_X, 692, FOOT_X + 220, 714)]
def caption_box(e):
    """The caption's box (x0, y0, x1, y1) and its text: the place the road leads to and its days."""
    sx, sy, bw, bh = e['board_box']
    cap = sign_words_c(e)[1]                  # C: days of march
    cw = text_w(cap, 7.1)
    tip = 10 if e['tip'] else 0
    bx0, bx1 = sx + (tip if e['tip'] == 'w' else 0), sx + bw - (tip if e['tip'] == 'e' else 0)
    if e.get('align') == 'r':
        cx0 = bx1 - cw
    else:
        cx0 = int((bx0 + bx1) / 2 - cw / 2)
    cx0 = max(8, min(1272 - cw, int(cx0)))
    cy0 = sy + bh + 3 if e.get('cap', 'below') == 'below' else sy - 18
    return (cx0, cy0, cx0 + cw, cy0 + 16), cap, (bx0, bx1)


for e in WB.EXITS:
    sx, sy, bw, bh = e['board_box']
    UI.append((sx - 2, sy - 2, sx + bw + 2, sy + bh + 2))
    UI.append(caption_box(e)[0])

# ------------------------------------------------------------------ place labels, placed clear of roads, sprites and windows
FOOT = {   # each place's sprite footprint around its stage point (x0, y0, x1, y1)
    'frontier_camp': (-44, -34, 44, 30), 'traders_rest': (-24, -22, 32, 18), 'rodericks_camp': (-34, -22, 24, 22),
    'riverside_market': (-62, -30, 66, 42), 'south_junction': (-26, -44, 58, 28), 'pine_crossing': (-34, -32, 46, 30),
    'watchtower_ridge': (-30, -38, 30, 22), 'border_fortress': (-36, -54, 36, 20), 'smugglers_cave': (-42, -40, 48, 18),
    'bandit_hideout': (-30, -26, 32, 28), 'south_road_ambush': (-26, -8, 30, 14), 'old_mill_crossing': (-26, -20, 32, 12),
    'broken_bridge': (-30, -16, 26, 10), 'north_ridge_path': (-10, -16, 18, 8), 'borderland_shrine': (-10, -24, 30, 4),
}
SUB = {'frontier_camp': ('the company is here', 'rill'), 'smugglers_cave': ('locked for now', 'rust'),
       'south_road_ambush': ('a landmark', 'bone'), 'bandit_hideout': ('a landmark', 'dim'),
       'borderland_shrine': ('a landmark', 'dim')}          # DISCOVERY = landmark (run/overworld.ts#typeLabel)


def tier_of(k):
    if k == 'frontier_camp':
        return 'here'
    return 'out' if one_day(k) else 'q'      # C: one day's march, not one hop


def label_size(k):
    t = tier_of(k)
    name = NAMES[k]
    if t == 'out':
        w, h = text_w(name, 8.9) + 22, 26
    elif t == 'here':
        w, h = text_w(name, 9.6), 22
    else:
        w, h = text_w(name, 7.6), 18
    if k in SUB:
        w = max(w, text_w(SUB[k][0], 7.0))
        h += 18
    return w, h


road_samples = [p for v in road_px.values() for p in geo.resample(v, 3.0)
                if -10 < p[0] < 1290 and -10 < p[1] < 730]
boxes_sprite = {k: (PT[k][0] + f[0], PT[k][1] + f[1], PT[k][0] + f[2], PT[k][1] + f[3]) for k, f in FOOT.items()}
river_samples = [p for p in geo.resample(WB.river_pts, 3.0) if -10 < p[1] < 730]


def overlap(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    return max(0, w) * max(0, h)


PREFER = {'frontier_camp': ['bl', 'b', 'l'], 'riverside_market': ['a', 'al', 'ar'], 'north_ridge_path': ['a', 'ar', 'r'],
          'border_fortress': ['bl', 'b', 'l'], 'rodericks_camp': ['l', 'a'], 'south_road_ambush': ['b', 'bl'],
          'borderland_shrine': ['b', 'bl', 'br']}


def place_labels():
    placed = {}
    order = sorted([k for k in PT if WB.drawn(k)], key=lambda k: (tier_of(k) != 'here', tier_of(k) != 'out', k))
    for k in order:
        w, h = label_size(k)
        x0, y0, x1, y1 = boxes_sprite[k]
        cx = (x0 + x1) / 2
        cands = {
            'b': (cx - w / 2, y1 + 4), 'a': (cx - w / 2, y0 - 4 - h), 'r': (x1 + 6, (y0 + y1) / 2 - h / 2),
            'l': (x0 - 6 - w, (y0 + y1) / 2 - h / 2), 'br': (x1 - 10, y1 + 2), 'bl': (x0 + 10 - w, y1 + 2),
            'ar': (x1 - 10, y0 - 2 - h), 'al': (x0 + 10 - w, y0 - 2 - h),
        }
        pref = PREFER.get(k, []) + [c for c in ('b', 'a', 'r', 'l', 'br', 'bl', 'ar', 'al') if c not in PREFER.get(k, [])]
        if k in FIXED:
            pref = [FIXED[k]]
        if k in AT:
            cands['at'] = AT[k]
            pref = ['at']
        best = None
        for rank, c in enumerate(pref):
            lx, ly = cands[c]
            box = (lx, ly, lx + w, ly + h)
            score = rank * 6
            if box[0] < 6 or box[1] < 4 or box[2] > 1274 or box[3] > 716:
                score += 4000
            g = (box[0] - 2, box[1] - 2, box[2] + 2, box[3] + 2)
            score += 3 * sum(1 for (px, py) in road_samples if g[0] <= px <= g[2] and g[1] <= py <= g[3])
            score += 5 * sum(1 for (px, py) in river_samples if g[0] - 12 <= px <= g[2] + 12 and g[1] <= py <= g[3])
            score += 8 * sum(1 for (px, py) in route_samples if g[0] - 4 <= px <= g[2] + 4 and g[1] - 4 <= py <= g[3] + 4)   # C
            score += sum(overlap(box, u) for u in UI) * 4
            score += sum(overlap(box, b) for kk, b in boxes_sprite.items() if kk != k) * 2
            score += sum(overlap(box, b) for b in placed.values()) * 6
            if best is None or score < best[0]:
                best = (score, box, c)
        placed[k] = best[1]
        LABEL_REPORT.append((k, best[2], round(best[0])))
    return placed


LABEL_REPORT = []
FIXED = {'riverside_market': 'a'}    # C: B's seat for the market's tag, right over the town
AT = {'south_road_ambush': (412, 490),   # C: west of the south road, over the wreck, clear of the march
      'frontier_camp': (419, 404),       # C: beside the palisade, clear of the beads
      'north_ridge_path': (394, 258)}     # west of the cairn's patch, clear of its edge
LBL = place_labels()


def place_label(k):
    x0, y0, x1, y1 = LBL[k]
    w = x1 - x0
    t = tier_of(k)
    name = NAMES[k]
    out = ''
    pos = f'left:{int(x0)}px;width:{int(w)}px;text-align:center'
    if t == 'out':
        hov = False                           # C: no road out of camp is pointed at
        tw = text_w(name, 8.9) + 22
        tx = int(x0 + (w - tw) / 2)
        out += window(tx, int(y0), tw, 26, f'<div class="abs s16 {"straw" if hov else "bone"} nowrap sh1" '
                      f'style="left:0;width:{tw}px;text-align:center;top:3px">{name}</div>',
                      kind='taglit' if hov else 'tag', corners=False, shadow=1)
        sub_top = y0 + 30
    elif t == 'here':
        out += f'<div class="abs nowrap s18 rill ol1d" style="{pos};top:{int(y0)}px">{name}</div>'
        sub_top = y0 + 22
    else:
        out += f'<div class="abs nowrap s14 bone ol1d" style="{pos};top:{int(y0)}px">{name}</div>'
        sub_top = y0 + 18
    if k in SUB:
        s, c = SUB[k]
        out += f'<div class="abs nowrap s13 {c} ol1d" style="{pos};top:{int(sub_top)}px">{s}</div>'
    return out


for k in LBL:
    parts.append(place_label(k))

# ------------------------------------------------------------------ the edge boards: the place on the board, the region and the days under it
for e in WB.EXITS:
    sx, sy, bw, bh = e['board_box']
    (cx0, cy0, cx1, _), cap, (bx0, bx1) = caption_box(e)
    parts.append(f'<div class="abs s14 bone nowrap sh1" style="left:{bx0}px;top:{sy + 2}px;width:{bx1 - bx0}px;'
                 f'text-align:center;font-weight:700">{sign_words_c(e)[0]}</div>')
    parts.append(f'<div class="abs s13 bone ol1d nowrap" style="left:{cx0}px;top:{cy0}px;width:{cx1 - cx0}px;'
                 f'text-align:{"right" if e.get("align") == "r" else "center"}">{cap}</div>')

# ------------------------------------------------------------------ C: the destination's sign: its region on the board, the place and the days above it
parts.append(f'<div class="abs s14 straw nowrap sh1" style="left:{SIGN_X}px;top:{SIGN_Y + 2}px;width:{SIGN_W}px;'
             f'text-align:center;font-weight:700">{WB.NODE[DEST]["region"].title()}</div>')
parts.append(f'<div class="abs s13 straw ol1d nowrap" style="left:{SIGN_CAP_BOX[0]}px;top:{SIGN_CAP_BOX[1]}px">{SIGN_CAP}</div>')
parts.append(f'<div class="abs s13 dim ol1d nowrap" style="left:{GHOST_CAP[0]}px;top:{GHOST_CAP[1]}px">by road {ROAD_DAYS} days</div>')

# ------------------------------------------------------------------ windows
sun, coin, sack, potion = I.sun(), I.coin(), I.ration(), I.potion()


def icon(r, style=''):
    return r.inline(f'margin:-4px 6px 0 0;{style}')


def pips(n_on, n, on=('o5', 'o4', 'o3', 'o1'), off=('w3', 'w2', 'w1', 'k0')):
    R = Raster(n * 8, 11)
    for i in range(n):
        x0 = i * 8
        lit, mid, mid2, dk = on if i < n_on else off
        for xx in range(x0, x0 + 7):
            for yy in range(11):
                if xx in (x0, x0 + 6) and yy in (0, 10):
                    continue
                edge = xx in (x0, x0 + 6) or yy in (0, 10)
                R.set(xx, yy, 'k0' if edge else (lit if (yy == 1 or xx == x0 + 1) else (dk if yy == 9 else (mid if yy < 5 else mid2))))
    return R


# the region window: where we are, the day, the whole country as an overview, what we carry
OVW, OVH = 156, 104
ov, marks = OV.overview(OVW, OVH)
# C: the march on the overview too, a brass track from the camp to a hollow brass mark on the destination
_s, _cx, _cy = OV.frame_of(OVW, OVH)
_T = lambda p: ((p[0] - _cx) / _s + OVW / 2, (p[1] - _cy) / _s + OVH / 2)
_seen = set()
for lg in LEGS:
    for p in geo.resample(lg['pts'], 1.0):
        X, Y = (int(v) for v in _T(p))
        if (X, Y) in _seen or not (0 <= X < OVW and 0 <= Y < OVH):
            continue
        _seen.add((X, Y))
        if lg['kind'] == 'road' or (X + Y) % 2 == 0:
            ov.put(X, Y, 'o5')
_dx, _dy = (int(v) for v in _T(PT[DEST]))
for dy in range(-3, 4):
    for dx in range(-3, 4):
        d = abs(dx) + abs(dy)
        if d == 3:
            ov.put(_dx + dx, _dy + dy, 'k0')
        elif d == 2:
            ov.put(_dx + dx, _dy + dy, 'o5' if dx + dy < 0 else ('o4' if dx + dy == 0 else 'o3'))
OX, OY = 292, 16                                     # the overview's plate frame, inside the window
ov_html = P.frame(OVW + 8, OVH + 8, 'plate', shadow=1).svg(OX - 4, OY - 4)
ov_html += (f'<img class="abs" alt="" style="left:{OX}px;top:{OY}px;width:{OVW}px;height:{OVH}px;'
            f'image-rendering:pixelated" width="{OVW}" height="{OVH}" src="{ov.data_uri()}">')
PIN = ["..kkk..", ".k565k.", "k56654k", "k56543k", ".k443k.", "..k3k..", "..k2k..", "..k2k..", "..k1k..", "...k..."]
pcx, pcy = marks['camp']
PIN_K = {'1': 'b0', '2': 'b1', '3': 'b2', '4': 'b3', '5': 'b4', '6': 'b5'}   # C: the company's pin in bone, brass is the march
ov_html += P.from_rows(PIN, PIN_K).svg(OX + int(pcx) - 3, OY + int(pcy) - 9)
for name, (lx, ly), anchor, cls in (('Thornwood', marks['labels']['Thornwood'], 'c', 'bone'),
                                    ('Ashfall', marks['labels']['Ashfall'], 'c', 'bone'),
                                    ('Borderlands', (pcx + 22, pcy - 17), 'c', 'bone'),   # C: over the pin, clear of the march
                                    ('Iron Throne', marks['throne'], 'r', 'bone')):
    if anchor == 'c':
        ov_html += (f'<div class="abs s13 {cls} ol1d nowrap" style="left:{OX + int(lx) - 50}px;top:{OY + int(ly) - 9}px;'
                    f'width:100px;text-align:center">{name}</div>')
    else:
        ov_html += (f'<div class="abs s13 {cls} ol1d nowrap" style="left:{OX + int(lx) + 7}px;top:{OY + int(ly) - 14}px">'
                    f'{name}</div>')
here_in10 = int(round(M.region_chance()['borderlands'] * 10))   # C
rations = pips(4, 4).inline('margin:0 0 0 0') + '<span style="display:inline-block;width:6px"></span>' + pips(4, 4).inline()
region = window(14, 14, RW, RH, f"""
  <div class="abs bl48 straw nowrap" style="left:20px;top:12px;font-size:43px;line-height:43px">The Borderlands</div>
  <div class="abs s20 bone nowrap" style="left:20px;top:64px">{icon(sun, 'margin-top:-5px')}Day 1</div>
  <div class="abs s15 dim nowrap" style="left:20px;top:94px">Marching here:</div>
  <div class="abs s15 dim nowrap" style="left:20px;top:113px">an encounter <span class="rust">{here_in10} nights in 10</span></div>
  {ov_html}
  {rule(20, 136, RW - 40)}
  <div class="abs s15 bone nowrap" style="left:20px;top:144px">{icon(coin)}<span class="straw">80</span> gold</div>
  <div class="abs s15 bone nowrap" style="left:116px;top:144px">{icon(sack)}<span class="straw">8</span> food</div>
  <div class="abs nowrap" style="left:206px;top:144px;height:16px">{rations}</div>
  <div class="abs s15 bone nowrap" style="right:20px;top:144px">{icon(potion)}Healing Potion ×1</div>
""")
parts.append(region)

cmds = window(982, 14, 284, 122, f"""
  <div class="abs s18 bone nowrap" style="left:20px;top:16px">The Company</div>
  <div class="abs s13 dim nowrap" style="left:162px;top:19px">roster and gear</div>
  {groove(20, 43, 244)}
  <div class="abs s18 bone nowrap" style="left:20px;top:50px">Contracts</div>
  <div class="abs s13 dim nowrap" style="left:162px;top:53px">none yet</div>
  {groove(20, 77, 244)}
  <div class="abs s18 bone nowrap" style="left:20px;top:84px">Menu</div>
  <div class="abs nowrap" style="left:160px;top:86px"><span class="key">Esc</span></div>
""")
parts.append(cmds)

# the company: faces at 1x, cropped in brass-lipped niches
FACE_CROP = {'face_roy': (28, 14), 'face_marcus': (26, 10), 'face_lilina': (27, 20)}
members = [
    ('The Foundling', 'face_roy', 73, 'Lord · Iron Sword'),
    ('Bagrat "Oak"', 'face_marcus', 84, 'Shield Knight · Iron Lance, Iron Buckler'),
    ('Lilina', 'face_lilina', 62, 'Mage · Fire Tome'),
]


def face_niche(face, x, y, s=52, kind='plate'):
    dx, dy = FACE_CROP.get(face, (22, 8))
    fr = P.frame(s, s, kind, shadow=1)
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{s}px;height:{s}px">'
            f'<div class="abs" style="left:4px;top:4px;width:{s - 8}px;height:{s - 8}px;overflow:hidden;background:{C["s1"]}">'
            f'<img class="abs" style="left:{-dx + 4}px;top:{-dy + 4}px;width:96px;height:96px" src="{B(face)}"></div>'
            f'{fr.svg(0, 0)}</div>')


def hpbar(x, y, w, frac=1.0, ramp=('s5', 's4', 's3', 's2')):
    R = Raster(w, 7)
    keep = round((w - 2) * frac)
    for xx in range(w):
        for yy in range(7):
            if xx in (0, w - 1) or yy in (0, 6):
                if not ((xx in (0, w - 1)) and (yy in (0, 6))):
                    R.set(xx, yy, 'k0')
                continue
            if xx - 1 < keep:
                R.set(xx, yy, ramp[0] if yy == 1 else (ramp[3] if yy == 5 else (ramp[1] if yy < 4 else ramp[2])))
            else:
                R.set(xx, yy, 'w0' if yy == 1 else 'k1')
    return R.svg(x, y)


rows = ''
for i, (nm, face, hp, role) in enumerate(members):
    y = 42 + i * 52
    rows += face_niche(face, 18, y)
    rows += f'<div class="abs s16 bone nowrap" style="left:82px;top:{y + 4}px">{nm}</div>'
    rows += f'<div class="abs s13 dim nowrap" style="left:82px;top:{y + 27}px">{role}</div>'
    rows += hpbar(250, y + 10, 64)
    rows += f'<div class="abs s14 bone nowrap" style="right:20px;top:{y + 4}px">{hp}/{hp}</div>'
parts.append(window(14, 496, 392, 214, f"""
  <div class="abs s16 ochre nowrap" style="left:20px;top:13px">The Company</div>
  <div class="abs s13 dim nowrap" style="right:20px;top:16px">three of us</div>
  {groove(20, 36, 352)}
  {rows}
"""))

# ------------------------------------------------------------------ C: the forecast, beside the route
fx, fy, fw, fh = CARD
_far = [r for _, r, c in ROLLS if r != 'borderlands']
_ch = M.region_chance()
roll_txt = (f'an encounter <span class="rust">{here_in10} nights in 10</span>, '
            f'<span class="rust">{int(round(_ch[_far[0]] * 10))} in 10</span> in {_far[0].title()}'
            if _far else f'an encounter <span class="rust">{here_in10} nights in 10</span>')
ROUND_BY = [k for k in M.places_on(ROAD_LEGS) if WB.drawn(k) and k != 'frontier_camp'][-1]
parts.append(window(fx, fy, fw, fh, f"""
  <div class="abs bl48 straw nowrap" style="left:20px;top:10px;font-size:43px;line-height:43px">{NAMES[DEST]}</div>
  <div class="abs s13 dim nowrap" style="left:20px;top:54px">camp · rest or scout, in {WB.NODE[DEST]['region'].title()}</div>
  <div class="abs s18 bone nowrap" style="left:20px;top:73px">{icon(sun)}{N_DAYS} days<span style="display:inline-block;width:22px"></span>{icon(sack)}{N_DAYS * M.FOOD_PER_DAY} food</div>
  <div class="abs s14 straw nowrap" style="right:20px;top:77px">click to march</div>
  <div class="abs s15 bone nowrap" style="left:20px;top:100px">{roll_txt}</div>
  <div class="abs s13 dim nowrap" style="left:20px;top:120px">by road alone {ROAD_DAYS} days, round by {NAMES[ROUND_BY]}</div>
""", kind='lit'))


parts.append(f'<div class="abs s14 bone ol1d nowrap" style="left:{FOOT_X}px;top:694px">Point at a place, click to march.</div>')

TITLE = f'Map · march anywhere, day 1 at Frontier Camp, pointing at {NAMES[DEST]} across open country'
html = wrap(TITLE, '\n'.join(parts), css_base(), 1280, 720)
out = ARGS.get('out')
if out:
    open(out, 'w', encoding='utf-8').write(html)
    print('wrote', out, len(html))
else:
    print(write('PxOpenC', html), len(html))
print(f'march to {DEST}: {T_DAYS:.2f} days -> {N_DAYS}; by road {BY_ROAD[DEST]:.2f} -> {ROAD_DAYS}, round by '
      f'{ROUND_BY}; px {dict((k, round(v)) for k, v in KM.items())}')
print('rolls', [(tuple(int(c) for c in p), r, c) for p, r, c in ROLLS], 'expected', round(sum(c for *_, c in ROLLS), 2))
print('road rolls', [(r, c) for _, r, c in ROAD_ROLLS], 'expected', round(sum(c for *_, c in ROAD_ROLLS), 2))
print('signs', [sign_words_c(e) for e in WB.EXITS])
print('sign', SIGN_X, SIGN_Y, 'card', CARD)
for r in LABEL_REPORT:
    if r[2] > 30:
        print('label', r)
