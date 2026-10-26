"""Pine Crossing's tavern, by day: the whole 1280 x 720 room as one pixel image at grain 1 (1 art px = 1 screen px).

    import sys; sys.path.insert(0, '<scratchpad>/dirs/ux-tavern')
    import interior
    room, info = interior.render(people=True, seed=6)
    room.data_uri()          # 'data:image/png;base64,...'  ->  <img style="width:1280px;image-rendering:pixelated">
    room.save(path)          # PNG at 1:1 (zoom=n for an n x NEAREST check)
    room.image()             # PIL RGBA, 1280 x 720

people=False takes out the two who can be talked to (Kael and the barkeep: the conversation screens bring them back
as stage art); the two drinkers at the bar stay, so the room does not empty when a talk opens. Every table, mug and
cask stays. info holds stage points in screen px, the same with or without people (only the light mask differs: with
people, Kael cuts the window light):
    info['kael']        foot (x, y), head (x, y) top of the hood, box (x, y, w, h) of the figure, plate (x, y) centre
    info['barkeep']     the same keys; he stands behind the bar, box = what shows above the counter
    info['bounty_desk'] box of the desk and its board of notices, plate (x, y), desk_box, board_box
    info['bar']         box of the counter, top_y (its worn top edge), shelf_box
    info['hearth']      box of the chimney breast, fire (x, y)
    info['windows']     [box, box]; info['light'] the bool mask of the window light on the boards (H x W)
    info['patrons']     [{'foot', 'box'}, ...]   two drinkers on stools at the bar, backs to the room
    info['floor_y']     the back wall's foot; info['scale'] = {'px_per_m': 80, 'depth_px_per_m': 40}
    info['open_floor']  boxes of bare boards (where standing art can go without hiding a choice)

The scale is the camp's: Kael is his 104 x 152 ComfyUI board sprite at exactly 1:1, never redrawn or recoloured; it
gets the kit's 1 px ink edge (f64-ol1), as PxCamp's people do. He stands behind his table, which hides him from the
thigh down, his hand by his tankard. The barkeep and the patrons have no art: they are procedural background folk at
the room's own scale (folk.py), kept behind the bar and on the bar stools with their backs turned, never close up.
Everything in the window light cuts it: its shadow along the light's own direction is unlit floor. The hearth fire is
banked low, so the brightest light on the floor is the window pool round Kael. Determinism: fixed seeds only."""
import base64
import io
import os

import numpy as np
from PIL import Image

import tpx
from tpx import W, H, FLOOR_Y, fy, ix, CLEAR
import shell as SH
import hearth as HE
import props as PR
import folk as FK

GAME_UNITS = 'E:/Work/GameDev/Godot/fe-mb/game/public/sprites/units/board'
KAEL_FOOT = (300, fy(2.6))            # where Kael stands, behind his table
KAEL_SPRITE_FOOT = (52, 146)          # between his boots, in the 104 x 152 sprite
BAR = dict(x0=898, w=384, front=fy(1.4), d=26, h=88)
BARKEEP_FOOT = (1050, fy(.5))
DESK = dict(cx=546, front=fy(0.85))
BOARD = dict(cx=546, bottom=224)
LONG = dict(cx=720, front=fy(4.6), far=fy(3.9), near=fy(5.05))
BAR_STOOLS = ((950, fy(1.65), 61), (1140, fy(1.65), 62))     # (x, foot y, seed): hard against the counter's front
SEAT_UP = 53              # a seated drinker's anchor above his tall stool's foot (the stool's seat is 60 px up)
LEG_DROP = 44             # from under his seat to his boots on the stool's rung
KT = (73, 14)             # Kael's table: its front's centre from his feet (he stands at its end, mid-depth)
MUG = (28, -59)           # his tankard: from his feet, on the table's near-left corner under his right hand


class Room:
    """The rendered room: an RGBA image with the pxworld Canvas's output methods (save, png_bytes, data_uri)."""

    def __init__(self, im):
        self.im = im
        self.w, self.h = im.size

    def image(self, bg=None):
        return self.im

    def png_bytes(self, bg=None):
        buf = io.BytesIO()
        self.im.convert('RGB').save(buf, 'PNG', optimize=True)
        return buf.getvalue()

    def save(self, path, bg=None, zoom=1):
        im = self.im
        if zoom != 1:
            im = im.resize((self.w * zoom, self.h * zoom), Image.NEAREST)
        im.save(path)

    def data_uri(self, bg=None):
        return 'data:image/png;base64,' + base64.b64encode(self.png_bytes()).decode()


# ---------------------------------------------------------------- the people with art
def board_sprite(sprite_id):
    return np.array(Image.open(os.path.join(GAME_UNITS, sprite_id + '.png')).convert('RGBA'))


def inked(a):
    """The kit's f64-ol1 under the sprite: alpha >= 0.4 dilated 1 px, filled k0; the sprite over it, unchanged."""
    from scipy import ndimage
    k0 = tuple(int(tpx.pal.HEX[ix('k0')][i:i + 2], 16) for i in (1, 3, 5))
    m = a[:, :, 3] >= 102
    d = ndimage.binary_dilation(m, np.ones((3, 3), bool))
    al = a[:, :, 3:4].astype(float) / 255
    rgb = np.array(k0, float)[None, None, :] * (1 - al) + a[:, :, :3].astype(float) * al
    out = np.zeros_like(a)
    out[:, :, :3] = np.where(d[:, :, None], rgb, a[:, :, :3]).astype(np.uint8)
    out[:, :, 3] = np.where(d, 255, a[:, :, 3]).astype(np.uint8)
    return out


def _sprite_box(a, x0, y0, clip_y=None):
    ys, xs = np.nonzero(a[:, :, 3] >= 102)
    y1 = y0 + ys.max() + 1 if clip_y is None else min(clip_y, y0 + ys.max() + 1)
    return (int(x0 + xs.min()), int(y0 + ys.min()), int(xs.max() - xs.min() + 1), int(y1 - (y0 + ys.min())))


def _ix_box(spr, fx_, fy_, clip_y=None):
    ys, xs = np.nonzero(spr.ix != CLEAR)
    x0, y0 = fx_ - spr.ax, fy_ - spr.ay
    y1 = y0 + ys.max() + 1 if clip_y is None else min(clip_y, y0 + ys.max() + 1)
    return (int(x0 + xs.min()), int(y0 + ys.min()), int(xs.max() - xs.min() + 1), int(y1 - (y0 + ys.min())))


# ---------------------------------------------------------------- things on the wall
def _shadow_on_wall(a, spr, x, y):
    m = spr.ix != CLEAR
    h_, w_ = m.shape
    sub = a[max(0, y):max(0, y + h_), max(0, x):max(0, x + w_)]
    mm = m[max(0, -y):max(0, -y) + sub.shape[0], max(0, -x):max(0, -x) + sub.shape[1]]
    sel = mm & np.isin(sub, tpx.cpx.ids('b'))
    sub[sel] = tpx.cpx.lut(-1)[sub[sel]]


def _wall_things(a):
    """Things fixed to the wall, painted into the base: the board of notices, the irons on the post, the shelves
    behind the bar. Each throws a short shadow down-right onto the plaster."""
    info = {}
    nb_ = PR.wanted_board()
    bx, by = BOARD['cx'] - nb_.w // 2, BOARD['bottom'] - nb_.h
    _shadow_on_wall(a, nb_, bx + 3, by + 3)
    HE._blit(a, nb_, bx, by)
    info['board_box'] = (bx, by, nb_.w, nb_.h)
    sk = PR.shackles()
    _shadow_on_wall(a, sk, 449 - sk.ax + 2, 150 + 2)
    HE._blit(a, sk, 449 - sk.ax, 150)
    items_hi = [(PR.mug('pewter'), x) for x in (20, 34, 48, 62)] + [(PR.jug(1), 92), (PR.jug(2), 110)] + \
               [(PR.bottle(k), x) for k, x in (('green', 140), ('brown', 152), ('green', 164), ('clear', 176), ('brown', 188))]
    items_lo = [(PR.mug('wood'), x) for x in (16, 30, 44, 58, 72)] + \
               [(PR.bottle(k), x) for k, x in (('brown', 104), ('brown', 116), ('green', 128))] + \
               [(PR.jug(2), 160), (PR.mug('pewter'), 190), (PR.mug('pewter'), 204)]
    for (y_, items) in ((150, items_hi), (204, items_lo)):
        sp = PR.shelf(232, items)
        _shadow_on_wall(a, sp, 940 + 3, y_ - sp.ay + 3)
        HE._blit(a, sp, 940, y_ - sp.ay)
    info['shelf_box'] = (940, 110, 236, 134)
    # the hop bine hung under the beam, over the bar
    gl = PR.garland(356, 14, 71)
    _shadow_on_wall(a, gl, 900 + 2, 58 + 2)
    HE._blit(a, gl, 900, 58)
    return info


# ---------------------------------------------------------------- the room
def render(people=True, seed=6):
    """The tavern by day. Returns (Room, info); see the module docstring."""
    a, sinfo = SH.build(seed)
    hinfo = HE.build(a, banked=True)
    winfo = _wall_things(a)
    st = tpx.Stage(a)
    info = dict(floor_y=FLOOR_Y, scale={'px_per_m': tpx.PXM, 'depth_px_per_m': tpx.DPM},
                windows=[(x0, top, x1 - x0, sill - top) for (x0, x1, top, sill), _ in sinfo['windows']],
                hearth=dict(box=hinfo['box'], fire=hinfo['fire']))
    blockers = np.zeros((H, W), bool)          # the window light's own shadows, laid in once everything stands

    def put_prop(spr, fx_, fy_, z=None, shadow=True, zcap=None, block=True):
        st.add(spr, fx_, fy_, z=z)
        if shadow:
            st.throw_sprite(spr, fx_, fy_, zcap=zcap)
        if block:
            blockers[:] |= _light_cast(spr, fx_, fy_)

    # ---- the bar: a cradle of casks against the wall, the counter, mugs on it
    bc = PR.back_counter(116, 78)
    put_prop(bc, 1222, fy(.35), shadow=False)
    for (kx, sd) in ((1196, 1), (1246, 2)):
        put_prop(PR.keg_end(20, seed=sd), kx, fy(.35) - 78 - 6, z=fy(.35) + .5, shadow=False)
    bar = PR.counter(BAR['w'], BAR['d'], BAR['h'])
    put_prop(bar, BAR['x0'] + BAR['w'] // 2, BAR['front'], zcap=24)
    bar_top = BAR['front'] - BAR['h'] - BAR['d']
    info['bar'] = dict(box=(BAR['x0'], bar_top, BAR['w'], BAR['front'] - bar_top), top_y=bar_top, shelf_box=winfo['shelf_box'])
    for (mx, my, k) in ((1004, bar_top + 14, 'pewter'), (1092, bar_top + 10, 'wood'), (1190, bar_top + 16, 'pewter')):
        st.add(PR.mug(k), mx, my, z=BAR['front'] + .5)

    # ---- the bounty desk under its board
    dk = PR.desk()
    put_prop(dk, DESK['cx'], DESK['front'])
    desk_box = (DESK['cx'] - dk.w // 2, DESK['front'] - dk.h + 1, dk.w, dk.h)
    bb = winfo['board_box']
    x0_ = min(bb[0], desk_box[0])
    x1_ = max(bb[0] + bb[2], desk_box[0] + desk_box[2])
    info['bounty_desk'] = dict(box=(x0_, bb[1], x1_ - x0_, desk_box[1] + desk_box[3] - bb[1]), desk_box=desk_box,
                               board_box=bb, plate=(DESK['cx'], bb[1] - 20))

    # ---- Kael's table: he stands at its end, its corner at his right hand and his tankard on it under that hand
    kt = PR.table(96, 26, 60, seed=31)
    kt_at = (KAEL_FOOT[0] + KT[0], KAEL_FOOT[1] + KT[1])
    put_prop(kt, *kt_at)
    st.add(PR.mug('pewter'), KAEL_FOOT[0] + MUG[0], KAEL_FOOT[1] + MUG[1], z=kt_at[1] + .5)
    info['kael_table'] = (kt_at[0] - kt.ax, kt_at[1] - kt.ay, kt.w, kt.h)

    # ---- the long table, its benches, two drinkers on the near bench
    put_prop(PR.bench(232, seed=41), LONG['cx'], LONG['far'])
    put_prop(PR.table(256, 34, 60, seed=42), LONG['cx'], LONG['front'])
    st.add(PR.mug('wood'), 690, LONG['front'] - 60 - 14, z=LONG['front'] + .5)     # one cup left behind
    put_prop(PR.bench(232, seed=43), LONG['cx'], LONG['near'])

    # ---- casks by the far end of the bar, stools at the bar
    for (bx_, by_, sd) in ((1196, fy(2.5), 51), (1244, fy(2.2), 52), (1232, fy(3.2), 53)):
        put_prop(PR.barrel(sd), bx_, by_)
    # two tall stools hard against the counter, a drinker on each (below)
    for (sx_, sy_, sd) in BAR_STOOLS:
        put_prop(PR.stool(seed=sd, tall=22), sx_, sy_)

    # ---- a small table near the door end, a tankard left on it
    put_prop(PR.table(112, 28, 60, seed=71), 640, fy(8.3))
    st.add(PR.mug('wood'), 624, fy(8.3) - 60 - 14, z=fy(8.3) + .5)
    put_prop(PR.stool(seed=72), 566, fy(8.6))
    put_prop(PR.stool(seed=73), 718, fy(8.0))

    # ---- people
    ka = board_sprite('kael')
    kx0, ky0 = KAEL_FOOT[0] - KAEL_SPRITE_FOOT[0], KAEL_FOOT[1] - KAEL_SPRITE_FOOT[1]
    kbox = _sprite_box(ka, kx0, ky0)
    info['kael'] = dict(foot=KAEL_FOOT, head=(kbox[0] + kbox[2] // 2, kbox[1]), box=kbox,
                        plate=(kbox[0] + kbox[2] // 2, kbox[1] - 18))
    bk = FK.barkeep()
    bkbox = _ix_box(bk, *BARKEEP_FOOT, clip_y=bar_top)
    info['barkeep'] = dict(foot=BARKEEP_FOOT, head=(bkbox[0] + bkbox[2] // 2, bkbox[1]), box=bkbox,
                           plate=(bkbox[0] + bkbox[2] // 2, bkbox[1] - 20))
    # the drinkers: low-chroma tunics (grey wool, dull tan) so none outshines Kael's leathers; elbows on the bar
    pats = [(FK.patron('t', 1, 'w', shade=-1, arms=True), BAR_STOOLS[0]),
            (FK.patron('d', 3, 'k', shade=-1, arms=True), BAR_STOOLS[1])]
    info['patrons'] = []
    for (sp, (sx_, sy_, _)) in pats:
        seat = sy_ - SEAT_UP                      # where his sprite's anchor sits on the tall stool
        info['patrons'].append(dict(foot=(sx_, seat), box=_ix_box(sp, sx_, seat)))
        st.add(sp, sx_, seat, z=sy_ + .5)
        st.add(FK.stool_legs(drop=LEG_DROP), sx_, seat - 7, z=sy_ - .5)
    if people:
        st.add_rgba(inked(ka), kx0, ky0, KAEL_FOOT[1])
        kal = _alpha_sprite(ka)
        st.throw_sprite(kal, KAEL_FOOT[0], KAEL_FOOT[1])
        # the hard block his boots stand on, down-right, as UxInn's people have
        fx_, fy_ = KAEL_FOOT
        st.throw_poly([(fx_ - 24, fy_ - 4), (fx_ + 24, fy_ - 4), (fx_ + 44, fy_ + 10), (fx_ - 4, fy_ + 10)])
        blockers |= _light_cast(kal, *KAEL_FOOT)
        st.add(bk, *BARKEEP_FOOT)
    light = SH.window_light(sinfo['windows'], blockers=blockers)
    a[light] = tpx.cpx.lut(1)[a[light]]
    info['light'] = light
    info['open_floor'] = [(0, fy(5.7), 520, H - fy(5.7)), (760, fy(5.7), 520, H - fy(5.7))]
    im = st.render()
    return Room(im), info


def _light_cast(spr, fx_, fy_):
    """Where a standing sprite keeps the window light off the boards: each of its pixels z px up is carried along the
    light's own direction (z * LX right, z * LY down from its foot line), the same rule the windows' patches follow."""
    from scipy import ndimage
    m_ = spr.ix != CLEAR
    ys, xs = np.nonzero(m_)
    out = np.zeros((H, W), bool)
    if not len(xs):
        return out
    z = np.maximum(0, spr.ay - ys).astype(float)
    px = np.round(fx_ - spr.ax + xs + z * tpx.LX).astype(int)
    py = np.round(fy_ + z * tpx.LY).astype(int)
    ok = (px >= 0) & (px < W) & (py >= 0) & (py < H)
    out[py[ok], px[ok]] = True
    return ndimage.binary_closing(ndimage.binary_dilation(out, np.ones((2, 2), bool)), np.ones((3, 3), bool))


def _alpha_sprite(a, foot=KAEL_SPRITE_FOOT):
    """An indexed stand-in with the RGBA sprite's silhouette, so the stage can throw its shadow."""
    s = tpx.Sprite(a.shape[1], a.shape[0], foot[0], foot[1])
    s.ix[a[:, :, 3] >= 102] = ix('k0')
    return s


if __name__ == '__main__':
    import sys
    room, info = render(people='empty' not in sys.argv)
    os.makedirs(os.path.join(tpx.HERE, 't'), exist_ok=True)
    room.save(os.path.join(tpx.HERE, 't', 'room_empty.png' if 'empty' in sys.argv else 'room.png'))
    print({k: v for k, v in info.items() if k != 'light'})
