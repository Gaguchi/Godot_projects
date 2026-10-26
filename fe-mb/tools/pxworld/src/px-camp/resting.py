"""Lilina resting: sat on her bedroll with her back against the log, her legs out under a blanket, her staff held
upright beside her. Her board sprite is used at 1:1: cut just under the waist and set down by the drop a seat on
the ground takes (the hips come down to the ground), the staff kept whole and shortened only where it meets the
ground. The bedroll pad and the blanket over her legs are drawn here, in the camp's own technique.

Seen from the front and a little above, a pair of legs lying toward us foreshortens to about 0.45 of its length,
so the blanket is a mound reaching about 36 px down the screen from her waist, lit along its top, with the toes
lifting it at the far end."""
import math

import numpy as np

import cpx
from cpx import pal, ix, CLEAR, K, new, put, get, nb
import people as PP

DROP = 59            # standing foot line -> hips on the ground
CUT = 79             # sprite row (standing) where the blanket takes over


def body(drop=DROP, cut=CUT):
    """RGBA box (152 + drop tall) with the upper body dropped, the staff kept; foot (58, 149) is the point on the
    ground under her hips. Returns (rgba, foot, staff_bottom_row)."""
    a = PP.load('board_lilina')
    H0, W0 = a.shape[:2]
    out = np.zeros((H0 + drop, W0, 4), np.uint8)
    up = a.copy()
    up[cut:, :, 3] = 0
    staff = a.copy()
    keep = np.zeros(a.shape[:2], bool)
    keep[cut:, 12:33] = True
    staff[~keep, 3] = 0
    staff[(staff[:, :, 3] < 200) & (np.arange(H0)[:, None] > 136), 3] = 0
    m = up[:, :, 3] > 0
    out[drop:drop + H0][m] = up[m]
    m = staff[:, :, 3] > 0
    out[drop:drop + H0][m] = staff[m]
    foot = (58, 149)
    sb = foot[1] + 4                       # the staff's butt rests on the ground just beside her hip
    out[sb + 1:, :, 3] = 0
    return out, foot, sb


def pad(w=58, h=66):
    """Her bedroll unrolled under her: a canvas pad lying toward us, its head end against the log, a slate wool
    underblanket showing at the edges, the strap undone. Anchor = the middle of its head (north) end."""
    W, H = w + 10, h + 10
    s = new(W, H, W // 2, 3)
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    x0, x1, y0, y1 = 5, 5 + w, 3, 3 + h
    m = (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
    # rounded corners
    for (qx, qy) in ((x0 + 3.5, y0 + 3.5), (x1 - 3.5, y0 + 3.5), (x0 + 3.5, y1 - 3.5), (x1 - 3.5, y1 - 3.5)):
        cor = (np.abs(xx - qx) <= 3.5) & (np.abs(yy - qy) <= 3.5) & (((xx < qx) if qx < W / 2 else (xx > qx)) & ((yy < qy) if qy < H / 2 else (yy > qy)))
        m &= ~(cor & ((xx - qx) ** 2 + (yy - qy) ** 2 > 12.5))
    # a little slack in the long edges
    m &= ~((xx < x0 + 1) & (np.sin(yy * .3) > .6))
    m &= ~((xx >= x1 - 1) & (np.sin(yy * .27 + 1) > .6))
    tone = np.full((H, W), ix('s3'), np.uint8)
    u = (xx - (x0 + x1) / 2) / (w / 2)
    tone[u < -.6] = ix('s4')
    tone[u > .55] = ix('s2')
    tone[yy > y1 - 4] = ix('s1')                # the foot edge shows the pad's thickness
    # the canvas pad shows past the wool along the west edge and the foot
    canv = m & ((xx < x0 + 3) | (yy > y1 - 7))
    tone[canv] = ix('b2')
    tone[canv & (xx < x0 + 2)] = ix('b3')
    tone[canv & (yy > y1 - 3)] = ix('b1')
    # quilting lines across the wool, a lit lip above each
    for yq in range(y0 + 12, y1 - 8, 11):
        for x in range(x0 + 4, x1 - 1):
            if m[yq, x] and not canv[yq, x]:
                tone[yq, x] = ix('s2')
                if m[yq - 1, x] and not canv[yq - 1, x]:
                    tone[yq - 1, x] = ix('s4') if u[yq, x] < .3 else ix('s3')
    s.ix[m] = tone[m]
    # the strap, undone, trailing off the foot to the east
    for k in range(14):
        put(s, x1 - 12 + k * .7, y1 - 1 + k * .2, 'w3')
        put(s, x1 - 12 + k * .7, y1 + k * .2, 'w2')
    put(s, x1 - 2, y1 + 3, 't5'); put(s, x1 - 1, y1 + 3, 't3')
    mm = s.ix != CLEAR
    rg = cpx.ring(np.pad(mm, 1), 4)[1:-1, 1:-1]
    s.ix[rg] = ix('s0')
    s.ix[rg & nb(mm & (s.ix == ix('w3')) | (mm & (s.ix == ix('w2'))), 0, -1)] = ix('w0')
    return s


def legs_blanket(seed=3):
    """The blanket over her legs, lying toward us: wide where it wraps her hips, tapering down the thighs, over
    two knees and the shins to her toes, which lift it at the foot. Its edge spills flat onto the pad either
    side. The ridge of each leg catches the light from the upper left, the valley between them and the east
    flank fall into shade. Madder wool with a bone stripe across the shins. Anchor = top middle (her waist)."""
    n = 40
    legs = [24, 24, 23, 22, 21, 20, 19, 19, 18, 18, 18, 18, 18, 17, 16, 16, 15, 15, 15, 14, 14, 14, 14, 13, 13, 13,
            13, 13, 13, 13, 13, 13, 13, 12, 12, 11, 10, 9, 7, 5]
    spill = [26, 27, 27, 27, 26, 26, 25, 25, 25, 24, 24, 24, 23, 23, 22, 22, 21, 21, 20, 20, 20, 19, 19, 19, 18, 18,
             18, 17, 17, 17, 16, 16, 15, 15, 14, 13, 12, 10, 8, 6]
    W, H = 2 * max(spill) + 12, n + 8
    s = new(W, H, W // 2, 3)
    cx = W / 2 - .5
    top = 3
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    L = np.zeros((H, W), bool)
    S = np.zeros((H, W), bool)
    for r in range(n):
        L[top + r, int(round(cx - legs[r])):int(round(cx + legs[r] + 1))] = True
        wav = int(round(1.2 * math.sin(r * .7 + 1)))
        S[top + r, int(round(cx - spill[r] - wav)):int(round(cx + spill[r] + 1 + wav))] = True
    # the toes: two bumps lifting the blanket at the foot
    for tx in (-6, 6):
        L |= cpx.ell_mask(W, H, cx + tx, top + n - 4, 5.5, 3.6, xx, yy)
    # the waist edge rides up round her hips at the sides
    S &= ~(yy < top + 3 * np.clip(1 - ((xx - cx) / 22) ** 2, 0, 1))
    L &= S | L
    L = cpx.clean(L, 3)
    S = cpx.clean(S | L, 3)
    r_ = yy - top
    u = (xx - cx) / 20
    tone = np.full((H, W), ix('x2'), np.uint8)
    # the spill lies flat on the pad, facing up: mid, its outer lip a step down
    tone[S] = ix('x2')
    tone[S & ~L & (xx < cx)] = ix('x3')
    tone[S & ~nb(S, -1, 0) | S & ~nb(S, 1, 0)] = ix('x1')
    # the legs: a ridge down each, a valley between
    ridge = np.cos((u + .45) * 3.4) * (u < 0) + np.cos((u - .45) * 3.4) * (u >= 0)
    lv = ridge - .5 * u
    T = np.full((H, W), ix('x2'), np.uint8)
    T[lv > .1] = ix('x3')
    T[lv > .72] = ix('x4')
    T[lv < -.45] = ix('x1')
    tone[L] = T[L]
    # the knees, lit on their caps a third of the way down
    for kx, k in ((-8, 'x5'), (8, 'x4')):
        cap = cpx.ell_mask(W, H, cx + kx - 1, top + 13, 5.5, 3, xx, yy) & L
        tone[cap & (T >= ix('x3'))] = ix(k)
    # the valley between the legs
    tone[(np.abs(xx - cx - .5) < 1) & (r_ > 3) & (r_ < n - 5) & L] = ix('x1')
    # the toes: lit tops, a shadow under their front
    for tx in (-6, 6):
        tone[cpx.ell_mask(W, H, cx + tx - 1, top + n - 5.5, 3.5, 1.4, xx, yy) & L] = ix('x4' if tx < 0 else 'x3')
    front = L & ~nb(L, 0, 1) & (r_ > n - 8)
    tone[front] = ix('x1')
    # the step from the legs down to the spill: a shade line on the east, a lit edge on the west
    stepE = S & ~L & nb(L, -1, 0)
    tone[stepE] = ix('x1')
    stepW = L & ~nb(L, -1, 0) & (r_ > 2)
    tone[stepW] = ix('x4')
    # the waist edge turned over and lit
    edge = S & ~nb(S, 0, -1)
    tone[edge] = ix('x4')
    # a bone stripe woven across the shins
    band = (r_ >= 24) & (r_ < 27) & S
    tone[band] = ix('b2')
    tone[band & L & (lv > .1)] = ix('b3')
    tone[band & ((L & (lv < -.4)) | (S & ~L & (xx > cx)))] = ix('b1')
    s.ix[S] = tone[S]
    rg = cpx.ring(np.pad(S, 1), 4)[1:-1, 1:-1]
    upl = rg & (nb(S, 1, 0) | nb(S, 0, 1)) & ~nb(S, -1, 0) & ~nb(S, 0, -1)
    s.ix[rg] = ix('x0')
    s.ix[upl] = ix('x1')
    return s


KNEE_TOP = 37        # px above the ground point under her hips: the top of her drawn-up knees
HEM = 15             # px in front of it (down the screen): the blanket's hem on the pad


def knees_blanket(seed=3):
    """The blanket over her drawn-up knees: two rounded knee caps at chest height, the wool falling from them
    over her shins to the pad and spreading there. Light from the upper left: the knee caps lit, the front of
    the shins mid, the east flank in shade, folds falling from the knees, the spread on the pad facing up.
    Madder wool with a bone stripe across the shins. Anchor = the ground point under her hips."""
    W, H = 92, KNEE_TOP + HEM + 10
    ay = KNEE_TOP + 4
    s = new(W, H, W // 2, ay)
    cx = W / 2 - .5
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + .5
    r = yy - (ay - KNEE_TOP)                    # 0 at the top of the knees
    total = KNEE_TOP + HEM
    # half-width down the shape: knees, the drape over the shins, the spread on the pad
    hw = np.where(r < 12, 19 + r * .12, np.where(r < 40, 20.4 + (r - 12) * .2, 26 + (r - 40) * .75))
    hw += 1.1 * np.sin(r * .6 + 1) * (r > 14)
    m = (np.abs(xx - cx) <= hw) & (r >= 6) & (r <= total)
    for kx in (-9.5, 9.5):
        m |= cpx.ell_mask(W, H, cx + kx, ay - KNEE_TOP + 8, 11, 7.5, xx, yy)
    m &= ~(r < 0)
    # the hem pools in waves on the pad
    for x in range(W):
        cut = int(round(1.5 + 1.4 * math.sin(x * .5) + .8 * math.sin(x * 1.3 + 2)))
        for k in range(max(0, cut)):
            yb = int(ay - KNEE_TOP + total - k)
            if 0 <= yb < H:
                m[yb, x] = False
    m = cpx.clean(m, 3)
    u = (xx - cx) / 24
    tone = np.full((H, W), ix('x2'), np.uint8)
    # the front of the shins: west half a touch lit, east half in shade
    tone[u < -.35] = ix('x3')
    tone[u > .5] = ix('x1')
    # the knee caps: lit tops, a highlight on the west knee, a dark notch between them
    for kx, k, hk in ((-9.5, 'x4', 'x5'), (9.5, 'x3', 'x4')):
        cap = cpx.ell_mask(W, H, cx + kx, ay - KNEE_TOP + 9, 10, 6, xx, yy) & (r < 12)
        tone[cap] = ix(k)
        tone[cpx.ell_mask(W, H, cx + kx - 3, ay - KNEE_TOP + 5.5, 5, 2, xx, yy)] = ix(hk)
    notch = (np.abs(xx - cx) < 1.5) & (r < 11)
    tone[notch] = ix('x1')
    m &= ~((np.abs(xx - cx) < 1) & (r < 3))
    # under the knees the wool turns down: a band of shade
    tone[(r >= 13) & (r < 16) & (u > -.6)] = ix('x1')
    tone[(r >= 13) & (r < 16) & (u <= -.6)] = ix('x2')
    # folds falling from the knees, a shade wedge with a lit lip to its west
    for fx_, w0 in ((-17, 1), (-8, 2), (2, 2), (11, 2), (19, 1)):
        for y in range(int(ay - KNEE_TOP + 16), int(ay + HEM - 2)):
            tt = (y - (ay - KNEE_TOP + 16)) / (total - 16)
            ww = int(round(w0 * (.4 + tt)))
            x = int(round(cx + fx_ * (1 + tt * .35)))
            for j in range(ww):
                if m[y, x + j]:
                    tone[y, x + j] = pal.shift_index(int(tone[y, x + j]), -1)
            if m[y, x - 1]:
                tone[y, x - 1] = pal.shift_index(int(tone[y, x - 1]), 1)
    # where the drape meets the pad it turns flat and faces up again
    spread = r > 40
    tone[spread & m] = ix('x3')
    tone[spread & m & (u > .55)] = ix('x2')
    tone[(r > 39) & (r <= 41) & m] = ix('x1')
    # a bone stripe woven across the shins
    band = (r >= 27) & (r < 30) & m
    tone[band] = ix('b2')
    tone[band & (u < -.3)] = ix('b3')
    tone[band & (u > .5)] = ix('b1')
    s.ix[m] = tone[m]
    rg = cpx.ring(np.pad(m, 1), 4)[1:-1, 1:-1]
    upl = rg & (nb(m, 1, 0) | nb(m, 0, 1)) & ~nb(m, -1, 0) & ~nb(m, 0, -1)
    s.ix[rg] = ix('x0')
    s.ix[upl] = ix('x1')
    return s


def body_behind(bl, drop=DROP):
    """Her sprite dropped to sit on the ground, cut column by column wherever the blanket begins (so arms and
    sleeves tuck behind its flanks), the staff kept down to the ground. Returns (rgba, foot)."""
    a = PP.load('board_lilina')
    H0, W0 = a.shape[:2]
    out = np.zeros((H0 + drop, W0, 4), np.uint8)
    out[drop:drop + H0] = a
    foot = (58, 149)
    # the blanket's top edge per column, in this box (the blanket anchor sits on the foot point)
    bm = bl.ix != CLEAR
    top = np.full(W0, foot[1] + 1, int)
    for x in range(W0):
        bx = x - foot[0] + bl.ax
        if 0 <= bx < bl.w and bm[:, bx].any():
            top[x] = foot[1] - bl.ay + int(np.argmax(bm[:, bx])) + 2
    rows = np.arange(H0 + drop)[:, None]
    hide = rows >= top[None, :]
    staff = np.zeros(hide.shape, bool)
    staff[:, 12:33] = True
    staff &= rows <= foot[1] + 3
    out[hide & ~staff, 3] = 0
    out[rows[:, 0] > foot[1] + 3, :, 3] = 0
    # the baked ground shadow under the old robe is gone with the robe; drop faint warm remnants by the staff
    faint = (out[:, :, 3] < 200) & (rows > foot[1] - 6)
    out[faint, 3] = 0
    return out, foot


def robe_seated(J=86, Dp=34):
    """Lilina sat on a log in her own long robe: the sprite above row J (her waist and hips) is set down Dp px,
    the robe below it keeps its place on the ground, so the band of skirt between is gone and the robe falls
    from her lap to the ground; the staff comes down with her hand and is planted, shortened by Dp. All her own
    pixels, at 1:1. Returns (rgba 104 x 152, foot)."""
    a = PP.load('board_lilina')
    H0, W0 = a.shape[:2]
    out = np.zeros_like(a)
    staffcols = np.zeros(W0, bool)
    staffcols[12:33] = True
    rows = np.arange(H0)
    # the robe's lower part keeps its place
    low = a.copy()
    low[:J + Dp] = 0
    low[:, staffcols] = 0
    # drop the baked ground shadow round the hem
    faint = (low[:, :, 3] < 200) & (rows[:, None] > 138)
    low[faint] = 0
    out[low[:, :, 3] > 0] = low[low[:, :, 3] > 0]
    # the upper body comes down
    up = np.zeros_like(a)
    up[Dp:J + Dp] = a[:J]
    up[:, staffcols] = 0
    m = up[:, :, 3] > 0
    out[m] = up[m]
    # the staff comes down with her hand, planted on the ground
    st = np.zeros_like(a)
    st[Dp:] = a[:H0 - Dp]
    st[:, ~staffcols] = 0
    st[(st[:, :, 3] < 200) & (rows[:, None] > 136)] = 0
    m = st[:, :, 3] > 0
    out[m] = st[m]
    # the lap's front edge: the robe catches the light along the top of her knees, then the knees shade the
    # robe falling under them (her own colours, a step lighter and a step darker)
    jr = J + Dp
    rgb = out[:, :, :3].astype(float)
    for x in range(38, 82):
        # the knees are round: the fold dips a pixel or two toward her sides, and sits a pixel high between them
        k = (x - 58) / 21
        dy = int(round(1.6 * k * k)) - (1 if abs(x - 58) < 3 else 0)
        for (y, f) in ((jr - 2, 1.10), (jr - 1, 1.16), (jr, .62), (jr + 1, .70), (jr + 2, .78), (jr + 3, .86), (jr + 4, .92)):
            yy_ = y + dy
            if out[yy_, x, 3] > 0:
                rgb[yy_, x] = np.clip(rgb[yy_, x] * f, 0, 255)
    out[:, :, :3] = rgb.astype(np.uint8)
    return out, (58, 149)


if __name__ == '__main__':
    from PIL import Image
    import wood as WD
    rgba, foot = robe_seated()
    H, W = rgba.shape[:2]
    bg = np.zeros((H + 30, W + 120), np.uint8)
    bg[:] = ix('d4')
    lg = WD.log_seat(150, 34, seed=7)
    gx, gy = 60 + foot[0], foot[1]
    m = lg.ix != CLEAR
    bg[gy - lg.ay:gy - lg.ay + lg.h, gx - 10 - lg.ax:gx - 10 - lg.ax + lg.w][m] = lg.ix[m]
    im = Image.fromarray(cpx.to_rgba(bg), 'RGBA')
    im.alpha_composite(Image.fromarray(PP.inked(rgba), 'RGBA'), (60, 0))
    im.resize((im.width * 4, im.height * 4), Image.NEAREST).save('t/resting4x.png')
