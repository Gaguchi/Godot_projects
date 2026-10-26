"""Writes gen_open_c.py from B's board generator (dirs/px-open-b/gen_open_b.py) by applying C's edits, so C stays
B's board with only the travel rule changed whenever B changes. Every edit names an anchor that must occur exactly
once in B's file; a missing anchor stops the build with its name.

    python dirs/px-open-c/make_c.py        # then: python dirs/px-open-c/gen_open_c.py
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), 'px-open-b', 'gen_open_b.py')
DST = os.path.join(HERE, 'gen_open_c.py')

DOC = '''"""PxOpenC: variant C of the open map, march anywhere, under the Filigree UI. B's country unchanged (world_b), with
one rule changed: the company is not tied to roads. Day 1 at Frontier Camp, pointing at Scorched Village, which
lies past the south edge in Ashfall: the south road out of camp, then open country, three days quicker than the
road round by Broken Bridge.

Written by make_c.py from dirs/px-open-b/gen_open_b.py; what C changes is marked `# C:`. Everything about the
march (how far a day carries, the route, the days, the rolls) is computed by march.py from world_b's data at run
time, so this board follows B's country when B changes.

Usage: python gen_open_c.py [out=path]
"""'''

MARCH = '''
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
'''

ROUTE = '''# ------------------------------------------------------------------ C: the route, brass beads on the road, brass stitches across country
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

'''

TAG = '''# ------------------------------------------------------------------ C: the destination's sign: its region on the board, the place and the days above it
parts.append(f'<div class="abs s14 straw nowrap sh1" style="left:{SIGN_X}px;top:{SIGN_Y + 2}px;width:{SIGN_W}px;'
             f'text-align:center;font-weight:700">{WB.NODE[DEST]["region"].title()}</div>')
parts.append(f'<div class="abs s13 straw ol1d nowrap" style="left:{SIGN_CAP_BOX[0]}px;top:{SIGN_CAP_BOX[1]}px">{SIGN_CAP}</div>')
parts.append(f'<div class="abs s13 dim ol1d nowrap" style="left:{GHOST_CAP[0]}px;top:{GHOST_CAP[1]}px">by road {ROAD_DAYS} days</div>')

'''

OVROUTE = '''# C: the march on the overview too, a brass track from the camp to a hollow brass mark on the destination
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
'''

CARD = '''# ------------------------------------------------------------------ C: the forecast, beside the route
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

'''

REPORT = '''print(write('PxOpenC', html), len(html))
print(f'march to {DEST}: {T_DAYS:.2f} days -> {N_DAYS}; by road {BY_ROAD[DEST]:.2f} -> {ROAD_DAYS}, round by '
      f'{ROUND_BY}; px {dict((k, round(v)) for k, v in KM.items())}')
print('rolls', [(tuple(int(c) for c in p), r, c) for p, r, c in ROLLS], 'expected', round(sum(c for *_, c in ROLLS), 2))
print('road rolls', [(r, c) for _, r, c in ROAD_ROLLS], 'expected', round(sum(c for *_, c in ROAD_ROLLS), 2))
print('signs', [sign_words_c(e) for e in WB.EXITS])
print('sign', SIGN_X, SIGN_Y, 'card', CARD)'''

EDITS = [
    ('docstring', r'\A""".*?"""', DOC, True),
    ('path', "for _p in (os.path.join(DIRS, 'hyb-64'), DIRS, HERE):",
     "for _p in (os.path.join(DIRS, 'hyb-64'), DIRS, os.path.join(DIRS, 'px-open-b'), HERE):   # C: B's folder", False),
    ('import', "import geo                               # noqa: E402\n",
     "import geo                               # noqa: E402\nimport march as M                        # noqa: E402   C: the travel rule\n"
     "import bits                              # noqa: E402   C: B's edge sign, for the destination's sign\n"
     "from pxworld import places as PL, pal as WP   # noqa: E402\n", False),
    ('hover', "HOVER = 'riverside_market'\n", "DEST = 'scorched_village'                # C: the destination, past the south edge\n", False),
    ('world png', "cv.save(os.path.join(HERE, 't', 'world_b.png'))\n", MARCH + "cv.save(os.path.join(HERE, 't', 'world_c.png'))\n", False),
    ('beads', r"# -{60,} the four roads out of camp.*?parts\.append\(I\.brackets\(bx0, by0, bx1, by1\)\.svg\(bx0, by0\)\)\n",
     ROUTE, True),
    ('card box', "CARD = (684, 464, 330, 150)\n",
     "CARD = (628, 436, 362, 148)                                       # C: the forecast, beside the route\n", False),
    ('ui', "(CARD[0], CARD[1], CARD[0] + CARD[2] + 2, CARD[1] + CARD[3] + 2), (bx0, by0, bx1, by1),\n      (hx + 26, by1, hx + 36, CARD[1])]",
     "(CARD[0], CARD[1], CARD[0] + CARD[2] + 2, CARD[1] + CARD[3] + 2),\n"
     "      (SIGN_X - 2, SIGN_Y - 2, SIGN_X + SIGN_W + 2, 720), SIGN_CAP_BOX,          # C: the destination's sign\n"
     "      (GHOST_CAP[0], GHOST_CAP[1], GHOST_CAP[0] + 100, GHOST_CAP[1] + 16), (FOOT_X, 692, FOOT_X + 220, 714)]", False),
    ('caption words', "cap = WB.sign_words(e)[1]", "cap = sign_words_c(e)[1]                  # C: days of march", False),
    ('board words', "{WB.sign_words(e)[0]}", "{sign_words_c(e)[0]}", False),
    ('tier', "return 'out' if HOPS.get(k) == 1 else 'q'", "return 'out' if one_day(k) else 'q'      # C: one day's march, not one hop", False),
    ('hover box', "boxes_sprite[HOVER] = (bx0, by0, bx1, by1)            # the hovered place is measured from its bracket\n", "", False),
    ('label ui', "            score += sum(overlap(box, u) for u in UI if u != (bx0, by0, bx1, by1)) * 4\n",
     "            score += 8 * sum(1 for (px, py) in route_samples if g[0] - 4 <= px <= g[2] + 4 and g[1] - 4 <= py <= g[3] + 4)   # C\n"
     "            score += sum(overlap(box, u) for u in UI) * 4\n", False),
    ('fixed', "FIXED = {HOVER: 'a'}                 # the pointed-at market's tag sits right over its bracket",
     "FIXED = {'riverside_market': 'a'}    # C: B's seat for the market's tag, right over the town", False),
    ('at', "AT = {'south_road_ambush': (412, 496),   # west of the south road, under the camp's own label",
     "AT = {'south_road_ambush': (412, 490),   # C: west of the south road, over the wreck, clear of the march\n"
     "      'frontier_camp': (419, 404),       # C: beside the palisade, clear of the beads", False),
    ('hov', "        hov = k == HOVER\n", "        hov = False                           # C: no road out of camp is pointed at\n", False),
    ('tag', "# ------------------------------------------------------------------ windows\nsun, coin, sack, potion",
     TAG + "# ------------------------------------------------------------------ windows\nsun, coin, sack, potion", False),
    ('overview', "ov, marks = OV.overview(OVW, OVH)\n", "ov, marks = OV.overview(OVW, OVH)\n" + OVROUTE, False),
    ('pin', "ov_html += P.from_rows(PIN, P.BR)",
     "PIN_K = {'1': 'b0', '2': 'b1', '3': 'b2', '4': 'b3', '5': 'b4', '6': 'b5'}   # C: the company's pin in bone, brass is the march\n"
     "ov_html += P.from_rows(PIN, PIN_K)", False),
    ('ov label', "('Borderlands', marks['labels']['Borderlands'], 'c', 'bone'),",
     "('Borderlands', (pcx + 22, pcy - 17), 'c', 'bone'),   # C: over the pin, clear of the march", False),
    ('here', "rations = pips(4, 4)", "here_in10 = int(round(M.region_chance()['borderlands'] * 10))   # C\nrations = pips(4, 4)", False),
    ('roads here', ">Roads here:</div>", ">Marching here:</div>", False),
    ('hops in 10', 'an encounter on <span class="rust">4 hops in 10</span>', 'an encounter <span class="rust">{here_in10} nights in 10</span>', False),
    ('card', r"# the forecast, pinned under the market.*?parts\.append\(lead\.svg\(lx - 2, ly0\)\)\n", CARD, True),
    ('footnote', r"""parts\.append\('<div class="abs s14 bone ol1d nowrap" style="left:424px;top:694px">Four roads out of camp\. Point at one, click to march\.</div>'\)""",
     """parts.append(f'<div class="abs s14 bone ol1d nowrap" style="left:{FOOT_X}px;top:694px">Point at a place, click to march.</div>')""", True),
    ('title', r"TITLE = '[^'\n]*'",
     "TITLE = f'Map · march anywhere, day 1 at Frontier Camp, pointing at {NAMES[DEST]} across open country'", True),
    ('write', "print(write('PxOpenB', html), len(html))", REPORT, False),
]


def main():
    s = open(SRC, encoding='utf-8').read().replace('\r\n', '\n')
    for name, old, new, rx in EDITS:
        if rx:
            n = len(re.findall(old, s, flags=re.S))
            if n != 1:
                sys.exit(f'make_c: anchor "{name}" found {n} times in gen_open_b.py')
            s = re.sub(old, lambda m: new, s, count=1, flags=re.S)
        else:
            n = s.count(old)
            if n != 1:
                sys.exit(f'make_c: anchor "{name}" found {n} times in gen_open_b.py')
            s = s.replace(old, new)
    with open(DST, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(s)
    print('wrote', DST)


if __name__ == '__main__':
    main()
