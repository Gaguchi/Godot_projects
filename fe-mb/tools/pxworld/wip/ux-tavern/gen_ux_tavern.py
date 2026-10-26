"""UxTavern: who do we talk to? Pine Crossing's tavern on day 6, the room as the menu, pointing at Kael.

It replaces PxTownTavern, which put the rumours, the quest board, the bounty desk and the satchel on one counter.
Here the people in the room are the choices (Mount & Blade's tavern, UXREFS 1.4):
  - Kael alone at his table, the barkeep behind the bar, the bounty desk under its wanted board; the barkeep and the
    desk have plates on the world (the desk's is quiet, with the lock, because the wagon is empty: its row says why);
  - pointing at Kael: the brass bracket, and the forecast pinned under him on the map's brass leader in place of his
    plate, with his one line from the town data and the one primary, Talk, with its Enter key as on UxInn;
  - a window holds the same three as a numbered list, the way back last ("Back to the square", Esc);
  - no satchel, no company, no rumours: the rumours are what the barkeep says when you talk to him.

The world is dirs/ux-tavern/interior.py (render(people=True)). The UI is the kit (dirs/kit64), imported and never
edited; local pieces built on its primitives: leader() (the map's brass leader, as dirs/ux-town draws it) and
person_row() (a numbered row with a sub-line, from the kit's row and key styles).

    cd <scratchpad> && python dirs/ux-tavern/gen_ux_tavern.py && node preview.mjs UxTavern
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SP = 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad'
sys.path.insert(0, SP + '/dirs/kit64')
from kit import *  # noqa: E402,F403
import kit_icons as _I  # noqa: E402  (icon rasters for the local pieces; the kit is not edited)
import kit_px as _P  # noqa: E402
sys.path.insert(0, HERE)
import interior  # noqa: E402

# ------------------------------------------------------------------ the moment: Pine Crossing, day 6 (UXFLOW)
TOWN = 'Pine Crossing'                                   # towns/pine_crossing.json
DAY = 6
KAEL_LINE = 'A hooded bounty hunter nursing a drink alone.'   # tavernQuests[0].npcDescription, verbatim
NO_PRISONERS = 'no prisoners in the wagon'               # engine/run/town.ts NO_PRISONERS, the desk's disabled reason
ROWS = [  # (name, sub-line, state, reason)
    ('Kael', 'work on offer', 'hover', None),
    ('The barkeep', 'the talk of the room', 'idle', None),
    ('The bounty desk', None, 'disabled', NO_PRISONERS),
]
BACK = 'Back to the square'


# ------------------------------------------------------------------ local pieces
def leader(x, y0, y1):
    """The map's brass leader (pxworld/gen_map.py, as dirs/ux-town draws it): a 4 px brass line from the forecast
    to what it points at, ending in a small arrowhead at y1. x = its centre; runs up when y1 < y0."""
    up = y1 < y0
    top, bot = (y1, y0) if up else (y0, y1)
    lead = Raster(5, bot - top + 1)
    for j in range(lead.h):
        if (up and j < 4) or (not up and j >= lead.h - 4):
            continue
        lead.set(0, j, 'k0'); lead.set(1, j, 'o5'); lead.set(2, j, 'o3'); lead.set(3, j, 'k0')
    if up:
        lead.stamp(['..k..', '.k3k.', 'k454k', 'kkkkk'], 0, 0, keymap=_P.BR)
    else:
        lead.stamp(['kkkkk', 'k454k', '.k3k.', '..k..'], 0, lead.h - 4, keymap=_P.BR)
    return lead.svg(x - 2, top)


def person_row(x, y, w, n, name, sub=None, state='idle', reason=None, h=46):
    """A numbered choice with a sub-line: its key cap, the name (s16), what it offers (s13 dim) under it.
    hover: the kit's row band, the brass arrow inside it, a straw name. disabled: the key off, the name faint, the
    reason in the quiet tone with the lock in place of the sub-line (the kit's rule: disabled always says why)."""
    cls = 'row' + (' hov' if state == 'hover' else '')
    kc = key(str(n), 'off' if state == 'disabled' else 'idle')
    nc = {'hover': 'straw', 'disabled': 'faint'}.get(state, 'bone')
    inner = f'<div class="abs nowrap" style="left:{KEY_X}px;top:{(h - 22) // 2 - 9}px;line-height:22px">{kc}</div>'
    inner += T(KEY_X + 34, 5, name, f's16 {nc}')
    if state == 'disabled':
        # an empty wagon is not danger: the reason keeps the lock but drops the kit's rust for the quiet tone
        inner += T(KEY_X + 34, 25, f'<span class="why" style="color:{C["b2"]}">{reason}</span>', 's13')
    elif sub:
        inner += T(KEY_X + 34, 25, sub, 's13 dim')
    # the brass pointer sits inside the row's own band, clear of the window's inner rule
    cur = _I.arrow_e(9).svg(4, (h - 9) // 2) if state == 'hover' else ''
    return f'<div class="{cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">{inner}{cur}</div>'


KEY_X = 18                # the key cap's left in a person row, after the pointer's slot


def back_row(x, y, w, n, text):
    """The way back, last and numbered like the rest, with its Esc key on the right (dirs/ux-town's town list)."""
    return choice(x, y, w, n, text) + f'<div class="abs nowrap" style="left:{x + w - 40}px;top:{y + 6}px">{key("Esc")}</div>'


# ------------------------------------------------------------------ the frame
HX, HY, HW, HH = EDGE, EDGE, 286, 92                    # the room header, as dirs/ux-town's inn header
LW = 330
LX = 1280 - EDGE - LW


def header():
    """Where we are: the place and the day, then the room."""
    b = T(PAD, 14, f'{TOWN} · day {DAY}', 's13 dim')
    b += T(PAD, 32, 'The tavern', 'tt')
    return window(HX, HY, HW, HH, b)


def room_list():
    """The room's three as a numbered list for the keyboard (Mount & Blade's menu), the way back last."""
    rw = LW - 2 * PAD - 4
    b = section_head('In the room', y=13, w=LW - 2 * PAD)
    y = 46
    for i, (name, sub, state, reason) in enumerate(ROWS):
        b += person_row(PAD + 4, y, rw, i + 1, name, sub, state, reason)
        y += 48
        if i < len(ROWS) - 1:
            b += groove(PAD, y - 2, LW - 2 * PAD)
            y += 2
    b += groove(PAD, y + 4, LW - 2 * PAD)
    y += 14
    b += back_row(PAD + 4 + KEY_X - 8, y, rw - (KEY_X - 8), len(ROWS) + 1, BACK)   # its key under the others
    lh = y + 32 + 14
    return window(LX, 720 - EDGE - lh, LW, lh, b), (LX, 720 - EDGE - lh, LW, lh)


def tavern():
    room, info = interior.render(people=True)
    room.save(os.path.join(HERE, 't', 'world.png'))
    body = (f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
            f'width="1280" height="720" src="{room.data_uri()}">')
    # the plates: the three you can point at, named on the world before any hover
    # Kael's plate gives way to his forecast while he is pointed at: the bracket and the forecast name him once
    k = info['kael']
    kx, ky, kw, kh = k['box']
    bk = info['barkeep']
    body += plate('The barkeep', x=bk['foot'][0], y=info['bar']['top_y'] + 34, center=True)
    dk = info['bounty_desk']
    # the desk is shut today (an empty wagon): its plate goes quiet with the lock, as its row in the list does
    body += plate('<span class="why"></span><span class="dim">The bounty desk</span>',
                  x=dk['desk_box'][0] + dk['desk_box'][2] // 2, y=dk['desk_box'][1] + dk['desk_box'][3] + 8, center=True)
    # pointing at Kael: the bracket round him, and his forecast under his plate on the brass leader
    bb_y1 = k['foot'][1] + 12                       # the bracket's foot, just under his boots and their shadow
    body += brackets(kx - 7, ky - 7, kw + 14, bb_y1 - (ky - 7))
    fw, fh = 392, 122
    lx = kx + kw // 2
    fx, fy_ = max(EDGE, lx - fw // 2), bb_y1 + 40
    f = person(PAD, 14, 'Kael', 'straw')
    f += T(PAD, 44, KAEL_LINE, 's15 lt bone', w=fw - 2 * PAD)
    bx_, by_ = fw - PAD - 96, fh - 14 - 34
    f += button('Talk', 'primary', x=bx_, y=by_, w=96)
    f += f'<div class="abs nowrap" style="left:{bx_ - 58}px;top:{by_ + 9}px">{key("Enter")}</div>'   # as UxInn's
    body += window(fx, fy_, fw, fh, f, state='hover')
    body += leader(lx, fy_ - 2, bb_y1 + 4)
    body += header()
    lst, lbox = room_list()
    body += lst
    write('UxTavern', board_html("Tavern · Pine Crossing, day 6, pointing at Kael", body, 1280, 720))
    return info, lbox


if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
    info, lbox = tavern()
    print('wrote UxTavern; list window', lbox)
