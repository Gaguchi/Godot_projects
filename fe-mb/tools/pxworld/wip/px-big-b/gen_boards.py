"""PxBigMap and PxBigCountry: the big country (variant B at four times the area) under the Filigree UI.

    PxBigMap      the map screen, 1280 x 720: a window onto the heartland centred on the company at Frontier Camp,
                  day 1, pointing at a place one road away (HOVER), with PxOpenB's windows over it
    PxBigCountry  the whole heartland at 1x, 2560 x 1440: every place labelled, a thin brass frame on the view

One render of the world serves both, so the map screen is exactly the framed part of the country.
A copy of dirs/px-open-b/gen_open_b.py, generalised. Usage: python gen_boards.py
"""
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
while not os.path.isdir(os.path.join(DIRS, 'pxworld')):
    DIRS = os.path.dirname(DIRS)
for _p in (os.path.join(DIRS, 'hyb-64'), DIRS, HERE):
    if _p not in sys.path:
        sys.path.insert(0, _p)
import icons64 as I                      # noqa: E402
import px64 as PX                        # noqa: E402
from px64 import C, B, Raster, window, rule, groove, css_base, wrap, write   # noqa: E402
import world_big as WB                   # noqa: E402
import land as LD                        # noqa: E402
import overview as OV                    # noqa: E402
import geo                               # noqa: E402

NAMES, P = LD.NAMES, LD.P
HOPS = LD.hops()
HOVER = 'crossroads_well'
CARD_SUB = 'waypoint · a well where four roads cross'
VX, VY = LD.VIEW
VW, VH = 1280, 720

cv, info = WB.render(company=True)
os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
cv.save(os.path.join(HERE, 't', 'heart.png'))
view = WB.window(cv, VX, VY, VW, VH)
view.save(os.path.join(HERE, 't', 'view.png'))
road_px = info['road_px']


def text_w(s, px):
    return int(len(s) * px + .5)


# ================================================================ where each place's sprite stands (world px)
FOOT = {   # the game's places (gen_open_b.py) and the new jobs: (x0, y0, x1, y1) round the place's point
    'frontier_camp': (-44, -34, 44, 30), 'traders_rest': (-24, -22, 32, 18), 'rodericks_camp': (-34, -22, 24, 22),
    'riverside_market': (-62, -30, 66, 42), 'south_junction': (-26, -44, 58, 28), 'pine_crossing': (-34, -32, 46, 30),
    'watchtower_ridge': (-30, -38, 30, 22), 'border_fortress': (-36, -54, 36, 20), 'smugglers_cave': (-42, -40, 48, 18),
    'bandit_hideout': (-30, -26, 32, 28), 'south_road_ambush': (-26, -8, 30, 14), 'old_mill_crossing': (-26, -20, 32, 12),
    'broken_bridge': (-30, -16, 26, 10), 'north_ridge_path': (-10, -16, 18, 8), 'borderland_shrine': (-10, -24, 30, 4),
}
JOB_FOOT = {
    'farm': (-36, -24, 34, 12), 'hamlet': (-50, -42, 50, 36), 'croft': (-26, -20, 26, 8), 'bees': (-20, -24, 32, 8),
    'orchard': (-36, -40, 54, 8), 'cooper': (-24, -20, 26, 12), 'hay': (-24, -18, 36, 10), 'well': (-14, -26, 18, 10),
    'kilns': (-24, -24, 26, 12), 'fold': (-30, -18, 28, 16), 'charcoal': (-26, -16, 28, 14), 'woodcamp': (-32, -18, 32, 18),
    'sawpit': (-28, -10, 26, 10), 'lodge': (-20, -20, 28, 8), 'trappers': (-26, -18, 26, 12), 'fishers': (-28, -16, 24, 14),
    'drovers': (-30, -22, 36, 18), 'burnt': (-26, -20, 32, 12), 'ruin': (-36, -28, 30, 16), 'stones': (-26, -46, 26, -18),
    'marker': (-6, -14, 14, 4), 'gallows': (-6, -20, 14, 4), 'barrow': (-24, -40, 24, -14), 'quarry': (-36, -26, 44, 14),
    'signal': (-22, -14, 12, 6), 'beacon': (-12, -36, 22, 14), 'tower': (-30, -38, 30, 22), 'shrine': (-10, -22, 26, 4),
    'cairn': (-10, -16, 18, 8), 'ford': (-18, -14, 18, 12), 'bridge': (-22, -14, 22, 6), 'mill': (-20, -26, 30, 8),
    'marsh': (-34, -20, 36, 14),
}


def _farm_foot(k):
    import sites as ST
    from pxworld import places as PL
    i = ST._sd(k) % len(PL.FARM_PLANS)
    hx, hy = [(586, 432), (318, 322), (872, 650), (716, 452), (270, 448), (196, 330)][i]
    xs, ys = [], []
    for it in PL.FARM_PLANS[i]:
        if it[0] in ('ew', 'ns', 'barn', 'L'):
            w_ = it[3].get('w', 14)
            xs += [it[1] - hx - w_ / 2 - 2, it[1] - hx + w_ / 2 + 2]
            ys += [it[2] - hy - 20, it[2] - hy + 3]
        elif it[0] in ('yard', 'garden'):
            xs += [it[1] - hx, it[1] - hx + it[3]]
            ys += [it[2] - hy, it[2] - hy + it[4]]
    return (min(xs), min(ys), max(xs), max(ys))


def foot(k):
    f = FOOT.get(k) or (_farm_foot(k) if LD.JOB.get(k) == 'farm' else None) or JOB_FOOT.get(LD.JOB.get(k), (-24, -18, 24, 10))
    x, y = P[k]
    return (x + f[0], y + f[1], x + f[2], y + f[3])


SUB = {'frontier_camp': ('the company is here', 'rill'), 'smugglers_cave': ('locked for now', 'rust')}
LANDMARK = {k for k in P if LD.NODE[k]['type'] == 'DISCOVERY' and not LD.NODE[k].get('hidden')}

road_samples = np.array([p for v in road_px.values() for p in geo.resample(v, 3.0)])
river_samples = np.array(geo.resample(WB.river_pts, 3.0) + geo.resample(WB.brook_pts, 3.0))


def overlap(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    return max(0, w) * max(0, h)


def count_in(arr, g, pad_x=0):
    return int(((arr[:, 0] >= g[0] - pad_x) & (arr[:, 0] <= g[2] + pad_x) & (arr[:, 1] >= g[1]) & (arr[:, 1] <= g[3])).sum())


def place_labels(keys, frame, ui, tier_of, label_size, prefer=None, fixed=None, at=None):
    """Label boxes (world px) for keys, each beside its sprite: tried below, above, right, left and the four
    corners, scored against roads, water, windows, other sprites and the labels already placed."""
    prefer, fixed, at = prefer or {}, fixed or {}, at or {}
    fx0, fy0, fx1, fy1 = frame
    placed = {}
    report = []
    boxes_sprite = {k: foot(k) for k in keys}
    order = sorted(keys, key=lambda k: (tier_of(k) != 'here', tier_of(k) != 'out', -P[k][1], k))
    for k in order:
        w, h = label_size(k)
        x0, y0, x1, y1 = boxes_sprite[k]
        cx = (x0 + x1) / 2
        cands = {'b': (cx - w / 2, y1 + 4), 'a': (cx - w / 2, y0 - 4 - h), 'r': (x1 + 6, (y0 + y1) / 2 - h / 2),
                 'l': (x0 - 6 - w, (y0 + y1) / 2 - h / 2), 'br': (x1 - 10, y1 + 2), 'bl': (x0 + 10 - w, y1 + 2),
                 'ar': (x1 - 10, y0 - 2 - h), 'al': (x0 + 10 - w, y0 - 2 - h)}
        pref = prefer.get(k, []) + [c for c in ('b', 'a', 'r', 'l', 'br', 'bl', 'ar', 'al') if c not in prefer.get(k, [])]
        if k in fixed:
            pref = [fixed[k]]
        if k in at:
            cands['at'] = at[k]
            pref = ['at']
        best = None
        for rank, c in enumerate(pref):
            lx, ly = cands[c]
            box = (lx, ly, lx + w, ly + h)
            score = rank * 6
            if box[0] < fx0 + 6 or box[1] < fy0 + 4 or box[2] > fx1 - 6 or box[3] > fy1 - 4:
                score += 4000
            g = (box[0] - 2, box[1] - 2, box[2] + 2, box[3] + 2)
            score += 3 * count_in(road_samples, g)
            score += 5 * count_in(river_samples, g, 12)
            score += sum(overlap(box, u) for u in ui) * 4
            score += sum(overlap(box, b) for kk, b in boxes_sprite.items() if kk != k) * 2
            score += sum(overlap(box, b) for b in placed.values()) * 6
            if best is None or score < best[0]:
                best = (score, box, c)
        placed[k] = best[1]
        report.append((k, best[2], round(best[0])))
    return placed, report


# ================================================================ the map screen
def map_board():
    ox, oy = VX, VY
    parts = [f'<img class="abs" alt="" style="left:0;top:0;width:{VW}px;height:{VH}px;image-rendering:pixelated" '
             f'width="{VW}" height="{VH}" src="{view.data_uri()}">']

    def V(p):
        return (p[0] - ox, p[1] - oy)
    in_view = [k for k in WB.HEART_KEYS if 0 <= P[k][0] - ox < VW and 0 <= P[k][1] - oy < VH]
    # the camp's roads: brass beads on the pointed-at road, bone beads on the rest
    BEAD = ["..kkkkk..", ".k66655k.", "k6665544k", "k6655443k", "k6554433k", "k5544332k", "k4443322k", ".k33322k.", "..kkkkk.."]
    BEAD_O = {'6': 'o6', '5': 'o5', '4': 'o4', '3': 'o3', '2': 'o1'}
    BEAD_B = {'6': 'b5', '5': 'b4', '4': 'b3', '3': 'b2', '2': 'b0'}
    beads = Raster(VW, VH)
    arrow_at = None
    n_out = 0
    for key, fine in road_px.items():
        if 'frontier_camp' not in key:
            continue
        n_out += 1
        pts = fine if key[0] == 'frontier_camp' else fine[::-1]
        pts = [V(p) for p in geo.resample(pts, 1.0)]
        L = len(pts) - 1
        hov = HOVER in key
        gap = 14 if hov else 15
        acc = 0.0
        for i in range(1, len(pts)):
            acc += 1
            if acc >= gap and 52 < i < L - (58 if hov else 34):
                acc = 0
                if 0 <= pts[i][0] < VW and 0 <= pts[i][1] < VH:
                    beads.stamp(BEAD, int(pts[i][0]) - 4, int(pts[i][1]) - 4, keymap=BEAD_O if hov else BEAD_B)
        if hov:
            ax_, ay_ = pts[max(0, L - 50)]
            bx_, by_ = pts[max(0, L - 44)]
            arrow_at = (int(ax_) - 3, int(ay_) - 7, math.degrees(math.atan2(by_ - ay_, bx_ - ax_)))
    parts.append(beads.svg(0, 0))
    if arrow_at:
        parts.append(I.arrow_e().svg(arrow_at[0], arrow_at[1], style=f'transform:rotate({arrow_at[2]:.0f}deg);'
                                     'transform-origin:6px 7px'))
    # the bracket cursor on the pointed-at place
    hx, hy = V(P[HOVER])
    f = foot(HOVER)
    bx0, by0, bx1, by1 = int(f[0] - ox - 8), int(f[1] - oy - 8), int(f[2] - ox + 8), int(f[3] - oy + 8)
    parts.append(I.brackets(bx0, by0, bx1, by1).svg(bx0, by0))
    # windows and the forecast card (view px)
    RW, RH = 472, 176
    CARD = (bx1 + 34, (by0 + by1) // 2 - 62, 330, 150)
    UI = [(14, 14, 14 + RW + 2, 14 + RH + 2), (982, 14, 1268, 138), (14, 496, 408, 712),
          (CARD[0], CARD[1], CARD[0] + CARD[2] + 2, CARD[1] + CARD[3] + 2), (bx0, by0, bx1, by1)]
    UIW = [(a + ox, b + oy, c + ox, d + oy) for (a, b, c, d) in UI]
    # the place labels
    def tier_of(k):
        if k == 'frontier_camp':
            return 'here'
        return 'out' if HOPS.get(k) == 1 else 'q'

    def label_size(k):
        t = tier_of(k)
        name = NAMES[k]
        if t == 'out':
            w, h = text_w(name, 8.9) + 22, 26
        elif t == 'here':
            w, h = text_w(name, 9.6), 22
        else:
            w, h = text_w(name, 7.6), 18
        sub = SUB.get(k) or (('a landmark', 'dim') if k in LANDMARK else None)
        if sub:
            w = max(w, text_w(sub[0], 7.0))
            h += 18
        return w, h
    frame = (ox, oy, ox + VW, oy + VH)
    LBL, rep = place_labels(in_view, frame, UIW, tier_of, label_size,
                            prefer={'frontier_camp': ['bl', 'b', 'l'], 'riverside_market': ['a', 'al', 'ar']},
                            fixed={HOVER: 'al'})
    for k, box in LBL.items():
        x0, y0, x1, y1 = box[0] - ox, box[1] - oy, box[2] - ox, box[3] - oy
        w = x1 - x0
        t = tier_of(k)
        name = NAMES[k]
        pos = f'left:{int(x0)}px;width:{int(w)}px;text-align:center'
        if t == 'out':
            hov = k == HOVER
            tw = text_w(name, 8.9) + 22
            tx = int(x0 + (w - tw) / 2)
            parts.append(window(tx, int(y0), tw, 26, f'<div class="abs s16 {"straw" if hov else "bone"} nowrap sh1" '
                                f'style="left:0;width:{tw}px;text-align:center;top:3px">{name}</div>',
                                kind='taglit' if hov else 'tag', corners=False, shadow=1))
            sub_top = y0 + 30
        elif t == 'here':
            parts.append(f'<div class="abs nowrap s18 rill ol1d" style="{pos};top:{int(y0)}px">{name}</div>')
            sub_top = y0 + 22
        else:
            parts.append(f'<div class="abs nowrap s14 bone ol1d" style="{pos};top:{int(y0)}px">{name}</div>')
            sub_top = y0 + 18
        sub = SUB.get(k) or (('a landmark', 'dim') if k in LANDMARK else None)
        if sub:
            parts.append(f'<div class="abs nowrap s13 {sub[1]} ol1d" style="{pos};top:{int(sub_top)}px">{sub[0]}</div>')
    for r in rep:
        if r[2] > 40:
            print('map label', r)
    # the roads off the edges of the screen: each names the place it leads to and its days from the camp
    edge_boxes = []
    taken = list(UI) + [(b[0] - ox, b[1] - oy, b[2] - ox, b[3] - oy) for b in LBL.values()]
    taken += [(f_[0] - ox, f_[1] - oy, f_[2] - ox, f_[3] - oy) for f_ in (foot(k) for k in in_view)]
    edges = []
    for key, fine in road_px.items():
        a, b = key
        ina = 0 <= P[a][0] - ox < VW and 0 <= P[a][1] - oy < VH
        inb = 0 <= P[b][0] - ox < VW and 0 <= P[b][1] - oy < VH
        if ina == inb:
            continue
        far = b if ina else a
        pts = [V(p) for p in (fine if ina else fine[::-1])]
        cross = None
        for i in range(1, len(pts)):
            x, y = pts[i]
            if not (0 <= x < VW and 0 <= y < VH):
                cross = pts[i - 1]
                break
        if cross is None:
            continue
        edges.append((far, cross))
    seen = set()
    for far, (x, y) in sorted(edges, key=lambda e: (e[1][1], e[1][0])):
        if far in seen:
            continue
        seen.add(far)
        cap = f'{NAMES[far]} · {HOPS[far]} days' if HOPS.get(far) != 1 else f'{NAMES[far]} · 1 day'
        cw = text_w(cap, 7.1)
        side = 'n' if y < 4 else ('s' if y > VH - 5 else ('w' if x < 4 else 'e'))
        if side == 'n':
            box = (x - cw / 2, 6, x + cw / 2, 22)
        elif side == 's':
            box = (x - cw / 2, VH - 24, x + cw / 2, VH - 8)
        elif side == 'w':
            box = (8, y - 22, 8 + cw, y - 6)
        else:
            box = (VW - 8 - cw, y - 22, VW - 8, y - 6)
        shift = [0] + [s * d for d in range(14, 214, 14) for s in (1, -1)]
        ok = None
        for s_ in shift:
            bb = (box[0] + (s_ if side in 'ns' else 0), box[1] + (s_ if side in 'we' else 0),
                  box[2] + (s_ if side in 'ns' else 0), box[3] + (s_ if side in 'we' else 0))
            if bb[0] < 8:
                bb = (8, bb[1], 8 + (bb[2] - bb[0]), bb[3])
            if bb[2] > VW - 8:
                bb = (VW - 8 - (bb[2] - bb[0]), bb[1], VW - 8, bb[3])
            if any(overlap((bb[0] - 4, bb[1] - 2, bb[2] + 4, bb[3] + 2), t) for t in taken + edge_boxes):
                continue
            ok = bb
            break
        if ok is None:
            print('edge label dropped', far, side)
            continue
        edge_boxes.append(ok)
        al = 'right' if side == 'e' else ('left' if side == 'w' else 'center')
        parts.append(f'<div class="abs s13 bone ol1d nowrap" style="left:{int(ok[0])}px;top:{int(ok[1])}px;'
                     f'width:{int(ok[2] - ok[0])}px;text-align:{al}">{cap}</div>')
    # ---- the windows
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
    OVW, OVH = 156, 104
    ov, marks = OV.overview(OVW, OVH, view=(VX, VY, VW, VH))
    ov.save(os.path.join(HERE, 't', 'overview_board.png'), zoom=4)
    OX, OY = 292, 16
    ov_html = PX.frame(OVW + 8, OVH + 8, 'plate', shadow=1).svg(OX - 4, OY - 4)
    ov_html += (f'<img class="abs" alt="" style="left:{OX}px;top:{OY}px;width:{OVW}px;height:{OVH}px;'
                f'image-rendering:pixelated" width="{OVW}" height="{OVH}" src="{ov.data_uri()}">')
    PIN = ["..kkk..", ".k565k.", "k56654k", "k56543k", ".k443k.", "..k3k..", "..k2k..", "..k2k..", "..k1k..", "...k..."]
    pcx, pcy = marks['camp']
    ov_html += PX.from_rows(PIN, PX.BR).svg(OX + int(pcx) - 3, OY + int(pcy) - 9)
    for name, (lx, ly), anchor in (('Thornwood', marks['labels']['Thornwood'], 'c'),
                                   ('Ashfall', marks['labels']['Ashfall'], 'c'),
                                   ('Borderlands', marks['labels']['Borderlands'], 'c'),
                                   ('Iron Throne', marks['throne'], 'r')):
        if anchor == 'c':
            ov_html += (f'<div class="abs s13 bone ol1d nowrap" style="left:{OX + int(lx) - 50}px;top:{OY + int(ly) - 9}px;'
                        f'width:100px;text-align:center">{name}</div>')
        elif lx > OVW - 80:                                  # near the right edge: the name sits left of the mark
            ov_html += (f'<div class="abs s13 bone ol1d nowrap" style="left:{OX + int(lx) - 107}px;top:{OY + int(ly) - 14}px;'
                        f'width:100px;text-align:right">{name}</div>')
        else:
            ov_html += (f'<div class="abs s13 bone ol1d nowrap" style="left:{OX + int(lx) + 7}px;top:{OY + int(ly) - 14}px">'
                        f'{name}</div>')
    rations = pips(4, 4).inline('margin:0 0 0 0') + '<span style="display:inline-block;width:6px"></span>' + pips(4, 4).inline()
    parts.append(window(14, 14, RW, RH, f"""
  <div class="abs bl48 straw nowrap" style="left:20px;top:12px;font-size:43px;line-height:43px">The Borderlands</div>
  <div class="abs s20 bone nowrap" style="left:20px;top:64px">{icon(sun, 'margin-top:-5px')}Day 1</div>
  <div class="abs s15 dim nowrap" style="left:20px;top:94px">Roads here:</div>
  <div class="abs s15 dim nowrap" style="left:20px;top:113px">an encounter on <span class="rust">4 hops in 10</span></div>
  {ov_html}
  {rule(20, 136, RW - 40)}
  <div class="abs s15 bone nowrap" style="left:20px;top:144px">{icon(coin)}<span class="straw">80</span> gold</div>
  <div class="abs s15 bone nowrap" style="left:116px;top:144px">{icon(sack)}<span class="straw">8</span> food</div>
  <div class="abs nowrap" style="left:206px;top:144px;height:16px">{rations}</div>
  <div class="abs s15 bone nowrap" style="right:20px;top:144px">{icon(potion)}Healing Potion ×1</div>
"""))
    parts.append(window(982, 14, 284, 122, f"""
  <div class="abs s18 bone nowrap" style="left:20px;top:16px">The Company</div>
  <div class="abs s13 dim nowrap" style="left:162px;top:19px">roster and gear</div>
  {groove(20, 43, 244)}
  <div class="abs s18 bone nowrap" style="left:20px;top:50px">Contracts</div>
  <div class="abs s13 dim nowrap" style="left:162px;top:53px">none yet</div>
  {groove(20, 77, 244)}
  <div class="abs s18 bone nowrap" style="left:20px;top:84px">Menu</div>
  <div class="abs nowrap" style="left:160px;top:86px"><span class="key">Esc</span></div>
"""))
    FACE_CROP = {'face_roy': (28, 14), 'face_marcus': (26, 10), 'face_lilina': (27, 20)}
    members = [('The Foundling', 'face_roy', 73, 'Lord · Iron Sword'),
               ('Bagrat "Oak"', 'face_marcus', 84, 'Shield Knight · Iron Lance, Iron Buckler'),
               ('Lilina', 'face_lilina', 62, 'Mage · Fire Tome')]

    def face_niche(face, x, y, s=52, kind='plate'):
        dx, dy = FACE_CROP.get(face, (22, 8))
        fr = PX.frame(s, s, kind, shadow=1)
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
    # the forecast, pinned under the farm, with a brass leader up to the bracket
    fx, fy, fw, fh = CARD
    parts.append(window(fx, fy, fw, fh, f"""
  <div class="abs bl48 straw nowrap" style="left:20px;top:12px;font-size:43px;line-height:43px">{NAMES[HOVER]}</div>
  <div class="abs s13 dim nowrap" style="left:20px;top:56px">{CARD_SUB}</div>
  <div class="abs s18 bone nowrap" style="left:20px;top:76px">{icon(sun)}1 day<span style="display:inline-block;width:22px"></span>{icon(sack)}1 food</div>
  <div class="abs s14 straw nowrap" style="right:20px;top:80px">click to march</div>
  <div class="abs s15 bone nowrap" style="left:20px;top:104px">an encounter on the road: <span class="rust">4 in 10</span></div>
  <div class="abs s13 dim nowrap" style="left:20px;top:124px">every Borderlands road rolls at 4 in 10</div>
""", kind='lit'))
    ly = (by0 + by1) // 2
    lx0, lx1 = bx1 + 2, fx - 2
    lead = Raster(max(5, lx1 - lx0 + 1), 5)
    lead.stamp(['..k.', '.k5.', 'k54.', '.k3.', '..k.'], 0, 0, keymap=PX.BR)
    for i in range(3, lead.w):
        lead.set(i, 0, 'k0'); lead.set(i, 1, 'o5'); lead.set(i, 2, 'o3'); lead.set(i, 3, 'k0')
    parts.append(lead.svg(lx0, ly - 2))
    words = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight']
    note = f'{words[n_out - 1]} roads out of camp. Point at one, click to march.'
    nw = text_w(note, 7.0)
    best = None
    vs = np.array([(p[0] - ox, p[1] - oy) for p in road_samples])
    for ny_ in (694, 676, 658):                               # the quietest stretch near the foot for the footnote
        for nx_ in range(420, VW - 8 - nw, 4):
            box = (nx_ - 4, ny_ - 2, nx_ + nw + 4, ny_ + 18)
            sc_ = (count_in(vs, box) * 3 + sum(overlap(box, t) for t in taken + edge_boxes) * 10
                   + (694 - ny_) * 2)
            if best is None or sc_ < best[0]:
                best = (sc_, nx_, ny_)
    parts.append(f'<div class="abs s14 bone ol1d nowrap" style="left:{best[1]}px;top:{best[2]}px">{note}</div>')
    title = f'Map · the big country, day 1 at Frontier Camp, pointing at {NAMES[HOVER]}'
    html = wrap(title, '\n'.join(parts), css_base(), VW, VH)
    print(write('PxBigMap', html), len(html), 'roads out of camp', n_out, 'in view', len(in_view))


# ================================================================ the whole heartland
def country_board():
    W, H = LD.HEART_WH
    parts = [f'<img class="abs" alt="" style="left:0;top:0;width:{W}px;height:{H}px;image-rendering:pixelated" '
             f'width="{W}" height="{H}" src="{cv.data_uri()}">']
    keys = list(WB.HEART_KEYS)

    def tier_of(k):
        return 'here' if k == 'frontier_camp' else 'q'

    def label_size(k):
        name = NAMES[k]
        if k == 'frontier_camp':
            w, h = text_w(name, 9.6), 22
        else:
            w, h = text_w(name, 7.6), 18
        if k in SUB:
            w = max(w, text_w(SUB[k][0], 7.0))
            h += 18
        return w, h
    signs = info['signs']
    ui = []
    for e in signs:
        sx, sy, bw, bh = e['board_box']
        ui.append((sx - 2, sy - 2, sx + bw + 2, sy + bh + 20))
    LBL, rep = place_labels(keys, (0, 0, W, H), ui, tier_of, label_size, prefer={'frontier_camp': ['bl', 'b', 'l']})
    for r in rep:
        if r[2] > 40:
            print('country label', r)
    for k, (x0, y0, x1, y1) in LBL.items():
        pos = f'left:{int(x0)}px;width:{int(x1 - x0)}px;text-align:center'
        if k == 'frontier_camp':
            parts.append(f'<div class="abs nowrap s18 rill ol1d" style="{pos};top:{int(y0)}px">{NAMES[k]}</div>')
            sub_top = y0 + 22
        else:
            parts.append(f'<div class="abs nowrap s14 bone ol1d" style="{pos};top:{int(y0)}px">{NAMES[k]}</div>')
            sub_top = y0 + 18
        if k in SUB:
            parts.append(f'<div class="abs nowrap s13 {SUB[k][1]} ol1d" style="{pos};top:{int(sub_top)}px">{SUB[k][0]}</div>')
    # the boards where the roads leave the heartland: the region on the board, the place and its days under it
    for e in signs:
        sx, sy, bw, bh = e['board_box']
        tip = 10 if e['tip'] else 0
        b0, b1 = sx + (tip if e['tip'] == 'w' else 0), sx + bw - (tip if e['tip'] == 'e' else 0)
        parts.append(f'<div class="abs s14 bone nowrap sh1" style="left:{b0}px;top:{sy + 2}px;width:{b1 - b0}px;'
                     f'text-align:center;font-weight:700">{e["region"]}</div>')
        cap = f'{NAMES[e["to"]]} · {e["days"]} days'
        cw = text_w(cap, 7.1)
        cx0 = int(max(8, min(W - 8 - cw, (b0 + b1) / 2 - cw / 2)))
        parts.append(f'<div class="abs s13 bone ol1d nowrap" style="left:{cx0}px;top:{sy + bh + 3}px;width:{cw}px;'
                     f'text-align:center">{cap}</div>')
    # the view frame: the 1280 x 720 the map screen shows, a thin brass line between two dark keylines
    # four px: a dark keyline, two of brass (lit on the top and left runs, a step down on the bottom and right,
    # as the windows' frames are), a dark keyline; the frame's inner edge is the view's edge
    fw, fh = VW + 8, VH + 8
    fr = Raster(fw, fh)
    for i in range(4):
        tone = ['k0', 'o5', 'o4', 'k0'][i]
        tone_d = ['k0', 'o3', 'o2', 'k0'][i]
        for x in range(i, fw - i):
            fr.set(x, i, tone)
            fr.set(x, fh - 1 - i, tone_d)
        for y in range(i, fh - i):
            fr.set(i, y, tone)
            fr.set(fw - 1 - i, y, tone_d)
    parts.append(fr.svg(VX - 4, VY - 4))
    title = 'Map · the whole Borderlands at 1×, with the view frame on the camp'
    html = wrap(title, '\n'.join(parts), css_base(), W, H)
    print(write('PxBigCountry', html), len(html), 'labels', len(LBL), 'signs', len(signs))


map_board()
country_board()
