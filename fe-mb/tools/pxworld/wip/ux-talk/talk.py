"""ux-talk: the conversation screen, built once: Ren'Py's say, choice, quick-menu and history screens, in Filigree.

    import talk as TK
    body = TK.talk_screen([TK.Stand('roy', 'listener', 318), TK.Stand('kael', 'speaker', 944)], 'Kael', 'right', '...')
    write('UxTalk', board_html('Talk · ...', body))

talk_screen(cast, speaker, side, line, ...) composes one board from:
    the room        full screen at 1:1 behind everything: the tavern builder's interior (dirs/ux-tavern/interior.py,
                    render(people=False)), or until it exists the px-town street as a stand-in, dimmed flat;
    the cast        Stand(sprite, role, x): each person's ComfyUI full art, resized ONCE with LANCZOS to the size it is shown
                    and placed at 1:1, never mirrored (UXREFS 1.7: the side is chosen by the art's facing; all three look
                    to the viewer's right). Each stand is cut at the box's foot, so it shows from the head to the hips.
                    The speaker stands forward (larger, in front) and lit; the listener a step back (smaller, behind) and
                    a ramp darker. Nobody moves between lines; only the light changes;
    the line        the text box along the bottom (Ren'Py's proportions, UXREFS 2.1): the speaker's name plate on the box's
                    top edge on the speaker's side (the game's own rule, DialogueOverlay.tsx: lighting and plaque must
                    agree), the line verbatim in the reading column, the advance mark once the line is finished;
    the choices     answers(...): a centred, numbered list over the room, clear of the faces, the question still in the box;
    the quick menu  History · Auto · Skip, quiet, centred at the box's foot.
No other UI is on a say or choice screen (UXREFS 1.5). Esc in a conversation opens the pause menu, and a talk ends only
through its own last line or answer (UXREFS 2.2), so these screens carry no way back; the History screen has one.
history(...) is the History screen, a modal over the conversation it was opened from.

Built on the kit's primitives (window, the tag frame, key caps, rows, scrim, modal, button, person, T); the kit is not
edited. Local pieces: Stand/stand, name_plate, advance_mark, quick_menu, answer_row/answers, history_rows/history.
"""
import base64
import html
import io
import json
import math
import os
import subprocess
import sys

from PIL import Image
import numpy as np

SP = 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad'
HERE = SP + '/dirs/ux-talk'
CACHE = HERE + '/cache'
sys.path.insert(0, SP + '/dirs/kit64')
from kit import *            # noqa: E402,F401,F403
import kit_px as KP          # noqa: E402  (frames and panels: read-only)
import kit_icons as KI       # noqa: E402  (the row cursor arrow, the side square: read-only)

UNITS = 'E:/Work/GameDev/Godot/fe-mb/game/public/sprites/units'
os.makedirs(CACHE, exist_ok=True)

# ------------------------------------------------------------------ the room
_ROOM = {}
ROOM_DIM, ROOM_SAT = 0.8, 0.9


def room_meta():
    """Render the room in its own process (room.py) and read back what it is. Cached for this run."""
    if not _ROOM:
        out = subprocess.run([sys.executable, HERE + '/room.py'], capture_output=True, text=True, cwd=SP)
        if out.returncode:
            raise RuntimeError(out.stderr)
        with open(CACHE + '/room.json', encoding='utf-8') as fh:
            _ROOM.update(json.load(fh))
        with open(CACHE + '/room.png', 'rb') as fh:
            _ROOM['uri'] = 'data:image/png;base64,' + base64.b64encode(fh.read()).decode('ascii')
    return _ROOM


def room():
    """The room behind the conversation, full screen at 1:1. The stand-in (a street, not a room) is dimmed flat."""
    m = room_meta()
    # the room is a backdrop: a step down (as Hades sets its box over a dimmed room), so the hearth fire between the two people
    # does not compete with the one speaking. The people and the box keep their own light.
    out = (f'<img class="abs" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated;'
           f'filter:brightness({ROOM_DIM}) saturate({ROOM_SAT})" src="{m["uri"]}">')
    if m['standin']:
        out += f'<div class="abs" style="left:0;top:0;width:1280px;height:720px;background:{rgba("k0", .46)}"></div>'
    return out


# ------------------------------------------------------------------ the text box (its geometry places the stands too)
BX, BY, BW, BH = EDGE, 538, 1280 - 2 * EDGE, 168     # along the bottom, foot at 706 (Ren'Py: 185 tall, flush)
COL_X, COL_W = 280, 720                               # the reading column, centred on the stage (Ren'Py: x 268, 744 wide)
PLATE_H = 34
LINE_Y = 34                                           # the line's first row, inside the box

# ------------------------------------------------------------------ the people on stage
# head centre x and eye line y in the 832 x 1216 source art (measured on crops of game/public/sprites/units/<sprite>.png)
HEAD = {'roy': (452, 250), 'kael': (410, 155), 'daren': (440, 245)}
PLANE = {   # the scale of the one LANCZOS resize, and where the eye line lands on the stage
    'speaker': dict(scale=0.80, eye=206),
    'listener': dict(scale=0.63, eye=250),     # a step back: 90% of the old 0.70, its head top 45+ px under the speaker's
}
# The listener is dimmed to a TARGET, not by one fixed filter: the same brightness gives gold-armoured roy and dark-cloaked kael
# very different results. Its mean luma over its alpha (the rows above the box) is brought to LUMA_RATIO of the speaker's.
LUMA_RATIO = 0.6
DIM_MAX = 0.56      # never brighter than this, even beside a dark speaker
DIM_SAT = {'roy': 0.55}   # a step down a ramp loses colour too (the game's own unlit bust: .5); roy's gold and orange need more
DIM_SAT_DEFAULT = 0.75


class Stand:
    """One person on stage: sprite id (game/public/sprites/units/<sprite>.png), role 'speaker' | 'listener', x of the head centre."""

    def __init__(self, sprite, role, x):
        self.sprite, self.role, self.x = sprite, role, x


def _stand_art(sprite, scale, keep_rows):
    """The full art resized once with LANCZOS, cut to the rows that reach the box's foot, cropped to its own alpha box.
    -> (uri, w, h, dx, dy): the crop's size and its offset inside the resized art. Cached as WebP with alpha."""
    key = f'{sprite}_{int(scale * 1000)}_{keep_rows}'
    webp = f'{CACHE}/stand_{key}.webp'
    meta = f'{CACHE}/stand_{key}.json'
    if not (os.path.exists(webp) and os.path.exists(meta)):
        src = Image.open(f'{UNITS}/{sprite}.png').convert('RGBA')
        W, H = round(src.width * scale), round(src.height * scale)
        im = src.resize((W, H), Image.LANCZOS)
        im = im.crop((0, 0, W, min(H, keep_rows)))
        a = np.array(im)[:, :, 3]
        ys, xs = np.nonzero(a > 0)
        box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        im = im.crop(box)
        im.save(webp, 'WEBP', quality=90, method=6, alpha_quality=100, exact=True)
        px = np.array(im).astype(float)
        on = px[:, :, 3] > 128
        luma = float((px[:, :, :3] @ [0.2126, 0.7152, 0.0722])[on].mean())
        with open(meta, 'w') as fh:
            json.dump(dict(w=im.width, h=im.height, dx=box[0], dy=box[1], luma=luma), fh)
    with open(meta) as fh:
        m = json.load(fh)
    if 'luma' not in m:
        os.remove(meta)
        return _stand_art(sprite, scale, keep_rows)
    with open(webp, 'rb') as fh:
        uri = 'data:image/webp;base64,' + base64.b64encode(fh.read()).decode('ascii')
    return uri, m['w'], m['h'], m['dx'], m['dy'], m['luma']


def place(s):
    """Where one Stand lands: (uri, left, top, w, h, mean luma of the part that shows above the box)."""
    p = PLANE[s.role]
    sc = p['scale']
    hx, ey = HEAD[s.sprite]
    top = p['eye'] - round(ey * sc)                                    # where the resized art's row 0 lands
    uri, w, h, dx, dy, _ = _stand_art(s.sprite, sc, BY + BH - top)     # nothing of them shows under the box
    luma = _stand_art(s.sprite, sc, BY - top)[5]                       # what the eye sees: the rows above the box
    left = s.x - (round(hx * sc) - dx)
    return uri, left, top + dy, w, h, luma


def dim_for(listener, speaker):
    """The listener's brightness: LUMA_RATIO of the speaker's mean luma, never above DIM_MAX."""
    if speaker is None:
        return DIM_MAX
    return round(min(DIM_MAX, LUMA_RATIO * place(speaker)[5] / place(listener)[5]), 3)


def stand(s, dim=None):
    """One Stand as HTML: its head centre at s.x, its eye line on its plane's line, cut at the box's foot, at 1:1.
    The ink edge is the kit's 1 px outline filter (as cutin() uses); a listener gets dim (brightness) and its sprite's saturate."""
    uri, left, top, w, h, _ = place(s)
    flt = 'url(#f64-ol1)'
    if dim is not None:
        flt += f' brightness({dim}) saturate({DIM_SAT.get(s.sprite, DIM_SAT_DEFAULT)})'
    return (f'<img class="abs" style="left:{left}px;top:{top}px;width:{w}px;height:{h}px;filter:{flt}" '
            f'src="{uri}" alt="">')


def extent(s, y0, y1):
    """A stand's solid extent (alpha > 128) across the stage rows y0..y1: (x0, x1), or None. The alpha box would count the
    faint haze and a weapon's tip; this is what the eye sees as the body."""
    uri, left, top, w, h, _ = place(s)
    a = np.array(Image.open(io.BytesIO(base64.b64decode(uri.split(',', 1)[1]))))[:, :, 3]
    band = a[max(0, y0 - top):max(0, y1 - top)]
    xs = np.nonzero((band > 128).any(axis=0))[0]
    return (left + int(xs.min()), left + int(xs.max()) + 1) if len(xs) else None


def cast_html(cast):
    """The listeners first (behind), each dimmed to its target against the speaker, then the speaker (in front)."""
    spk = next((s for s in cast if s.role == 'speaker'), None)
    out = ''
    for s in sorted(cast, key=lambda s: 0 if s.role == 'listener' else 1):
        out += stand(s, dim_for(s, spk) if s.role == 'listener' else None)
    return out


# ------------------------------------------------------------------ the box's pieces
def name_plate(name, side, epithet=None):
    """The speaker's name plate on the box's top edge, over the speaker's end of the reading column: the kit's 'tag' frame
    holding person() in straw (the one speaking). epithet = who they are, said once on a first appearance (s14 dim)."""
    nw = text_w(name, 20, 700)
    w = 16 + nw + 16 + 6
    inner = person(16, 4, name, 'straw')
    if epithet:
        inner += T(16 + nw + 14, 9, epithet, 's14 dim')
        w += 14 + text_w(epithet, 14, 600)
    x = COL_X - 16 if side == 'left' else COL_X + COL_W + 16 - w
    y = BY - PLATE_H + 12
    return KP.panel(x, y, w, PLATE_H, inner, kind='tag')


ADV = ["kkkkkkkkkkk",
       "k655555543k",
       ".k5555443k.",
       "..k55432k..",
       "...k432k...",
       "....k2k....",
       ".....k....."]


def advance_mark():
    """The advance mark at the end of a finished line (Space, Enter or a click goes on): a small brass wedge, pointing down."""
    return from_rows(ADV, {str(i): f'o{i}' for i in range(7)}).inline('margin:-4px 0 0 10px')


def quick_menu(states=None):
    """History · Auto · Skip (Ren'Py's quick menu, trimmed: UXREFS 2.1), quiet, centred at the box's foot.
    states = {word: 'idle' | 'hover' | 'on'}; 'on' (Auto running) is straw with the kit's brass square, as an armed command."""
    states = states or {}
    parts = []
    for word in ('History', 'Auto', 'Skip'):
        st = states.get(word, 'idle')
        mark = ''
        if st == 'hover':
            mark = KI.arrow_e(9).inline('margin:-3px 6px 0 0')
        elif st == 'on':
            mark = KI.side_glyph('ally', True).inline('margin:-3px 6px 0 0')
        parts.append(f'<span class="s14 {"dim" if st == "idle" else "straw"}">{mark}{word}</span>')
    sep = '<span class="s14 faint" style="margin:0 12px">·</span>'
    return T(0, BH - 38, sep.join(parts), 's14 c', w=BW)


def say_box(line, advance=True, quick=None):
    """The say screen's box: the line verbatim in the reading voice (s20 lt), the advance mark when it is finished, the quick
    menu. The name plate is drawn by talk_screen() after the box, so it rides the box's edge."""
    text = line + (advance_mark() if advance else '')
    body = T(COL_X - BX, LINE_Y, text, 's20 lt bone', w=COL_W, style='line-height:28px')
    body += quick_menu(quick)
    return window(BX, BY, BW, BH, body)


# ------------------------------------------------------------------ the choice screen
ANS_H, ANS_PITCH = 40, 44


def answer_row(x, y, w, n, text, state='idle', tag=None, ok=None, note=None):
    """One answer on the choice screen: its number key, the answer verbatim in s18 (a command), an optional check tag, or a
    quiet note in the secondary ink (e.g. 'ends the talk'). The kit's choice() at this size: hover = the band, the brass arrow, straw."""
    tc = 'straw' if state == 'hover' else 'bone'
    body = f'{key(n)}<span class="s18 {tc}" style="margin-left:12px">{text}</span>' + (check_tag(tag, ok) if tag else '')
    if note:
        body += f'<span class="s13 dim" style="margin-left:14px">{note}</span>' 
    cls = 'row' + (' hov' if state == 'hover' else '')
    cur = KI.arrow_e(9).svg(-14, (ANS_H - 9) // 2) if state == 'hover' else ''
    return (f'<div class="{cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{ANS_H}px">'
            f'<div class="abs nowrap" style="left:10px;top:8px;line-height:24px">{body}</div>{cur}</div>')


KEY_W = 26        # a 1-9 key cap with its frame, measured on the render


def answers(items, pointed=None, cx=640):
    """The answers as a numbered list over the room, sized to its longest row and centred on cx (the gap between the two people),
    34 px above the box. items = [text or dict(text, tag, ok, note)]."""
    items = [it if isinstance(it, dict) else dict(text=it) for it in items]

    def row_w(it):
        w = KEY_W + 12 + text_w(html.unescape(it['text']), 18, 600)
        if it.get('note'):
            w += 14 + text_w(it['note'], 13, 600)
        return w
    rx = PAD + 10                   # the hover arrow sits 14 px left of a row: keep it inside the window, off the moulding
    w = round(rx + 10 + max(row_w(it) for it in items) + 24 + PAD)
    h = 2 * PAD + (len(items) - 1) * ANS_PITCH + ANS_H - 4
    x, y = round(cx - w / 2), BY - 34 - h
    rows = ''
    for i, it in enumerate(items):
        rows += answer_row(rx, PAD - 2 + i * ANS_PITCH, w - rx - PAD + 2, i + 1, it['text'], 'hover' if i == pointed else 'idle',
                           it.get('tag'), it.get('ok'), it.get('note'))
    return window(x, y, w, h, rows)


# ------------------------------------------------------------------ the whole screen
def talk_screen(cast, speaker, side, line, choices=None, pointed=None, advance=None, quick=None, epithet=None):
    """One conversation board: the room, the people on stage, the box with the speaker's plate and the line, the answers
    (when the line asks a question), the quick menu. Nothing else."""
    if advance is None:
        advance = not choices
    body = room() + cast_html(cast)
    body += say_box(line, advance=advance, quick=quick)
    body += name_plate(speaker, side, epithet)
    if choices:
        # centred in the gap between the people on stage, so the list sits over the room and not over a body
        y1 = BY - 34
        y0 = y1 - (2 * PAD + (len(choices) - 1) * ANS_PITCH + ANS_H - 4)
        xs = sorted(e for e in (extent(s, y0, y1) for s in cast) if e)
        cx = (xs[0][1] + xs[-1][0]) / 2 if len(xs) > 1 else 640
        body += answers(choices, pointed, cx)
    return body


# ------------------------------------------------------------------ the History screen
NAME_W, NAME_GAP = 150, 20       # Ren'Py: names right-aligned to x 155, the line from x 170 (UXREFS 2.1)


def _rows(text, w, size=16):
    """How many rows the browser will need: the kit's text_w (PIL, bold metrics) runs about 3% wide for the regular weight."""
    return max(1, math.ceil((text_w(text, size, 400) * 0.98) / w))


def history_rows(entries, w):
    """The log, in normal flow so the browser sets each row's height: the speaker right-aligned in the names column, the line
    beside it, grooves between, the latest last. The company's answers are its lead's lines, in rill (ours) to set them apart.
    entries = [(speaker, ours, line)]. -> (html, estimated height, for sizing the window)."""
    tw = w - NAME_W - NAME_GAP
    items, est = [], 0
    for who, ours, line in entries:
        tone = 'bone'               # only the name is ours (rill): blue body text in a read-only log would read as a link
        nm = f'<div class="s16 {"rill" if ours else "dim"}" style="flex:0 0 {NAME_W}px;text-align:right;padding-top:1px">{who}</div>'
        tx = f'<div class="s16 lt {tone}" style="flex:1 1 auto;line-height:22px">{line}</div>'
        items.append(f'<div style="display:flex;gap:{NAME_GAP}px">{nm}{tx}</div>')
        est += _rows(line, tw) * 22
    sep = f'<div style="height:2px;margin:10px 0;line-height:0">{KP.groove_raster(w).inline("display:block")}</div>'
    est += (len(entries) - 1) * 22
    return sep.join(items), est


def history(entries, w=880, place='Pine Crossing', room_name='the tavern', note=None, back='Back to the conversation'):
    """The History screen over the scrim: the eyebrow (where), the title, the log anchored to its foot (opened at the latest
    line, as Ren'Py's is), and the one way back (brass, Esc)."""
    lw = w - 2 * PAD
    rows, rh = history_rows(entries, lw)
    top = MODAL_Y + 4
    gy = top + rh + 12
    h = gy + 2 + 12 + 34 + PAD
    x = (1280 - w) // 2
    y = max(64, BY - PLATE_H + 12 - 14 - h)    # above the box and its plate: the line you go back to stays whole under the scrim
    body = (f'<div class="abs" style="left:{PAD}px;top:{top}px;width:{lw}px;height:{rh}px;display:flex;flex-direction:column;'
            f'justify-content:flex-end;overflow:hidden">{rows}</div>')
    if note:
        body += T(w - PAD, 46, note, 's13 dim', style='transform:translateX(-100%)')
    body += groove(PAD, gy, lw)
    body += (f'<div class="abs nowrap" style="right:{PAD}px;top:{gy + 14}px">{button(back, "primary")}'
             f'<span style="margin-left:8px">{key("Esc")}</span></div>')     # Esc after the way back, as UxTavern's row has it
    return modal(x, y, w, h, body, title='History', eyebrow=f'{place} · {room_name}')


# ------------------------------------------------------------------ QA
def zoom(board, x, y, w, h, k=4, name=None):
    """A NEAREST crop of preview/<board>.png into t/<name>.png."""
    im = Image.open(f'{SP}/preview/{board}.png').crop((x, y, x + w, y + h))
    im = im.resize((w * k, h * k), Image.NEAREST)
    p = f'{HERE}/t/{name or board + "_z"}.png'
    im.save(p)
    return p
