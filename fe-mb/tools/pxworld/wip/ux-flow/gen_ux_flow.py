"""UxFlow: how the one-job screens connect. Documentation, not pixel art.

Every Ux board, plus today's map (PxMap1x) at the root, as a small picture: each board's preview PNG cropped to its
1280 x 720 stage and downscaled once with Pillow LANCZOS to 192 x 108. The pictures sit in the kit's recessed wells
over the pixel map under the kit's flat scrim. The ways between them are plain 2 px pixel rules in the kit's brass
(o4 on a 1 px ink edge), dashed where the game lacks the way today. Each rule carries the key or click that takes you
there (the upper line) and the way back (the lower line). No arrows, no boxes: two Filigree windows only, the header
and the map's menu.

Three rows, read left to right:
  row B (the spine): the map, the square, the tavern, the say screen, the choice;
  row A (above):     the inn and the market off the square, History off the talk, the reunion after answer 1;
  row C (below):     the map's menu, a person's kit, his deck, the satchel, equipping.

Usage (from the scratchpad root):  python dirs/ux-flow/gen_ux_flow.py && node preview.mjs UxFlow
"""
import base64
import io
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SP = 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad'
sys.path.insert(0, SP + '/dirs/kit64')
from kit import *  # noqa: E402,F403
import kit as K  # noqa: E402  (the kit's recessed well frame, for the pictures)

TW, TH = 192, 108                              # each picture: 1280 x 720 at 0.15, LANCZOS
COL = [14, 279, 544, 809, 1074]                # five columns, 73 px gutters for the rules and their keys
YA, YB, YC = 64, 254, 468                      # picture tops: row A (labels above), B and C (labels below)
MID_B, MID_C = YB + TH // 2, YC + TH // 2


# ------------------------------------------------------------------ the pictures
def thumb_uri(board):
    """The board's own preview, its 1280 x 720 stage only, downscaled once with LANCZOS and embedded as PNG."""
    im = Image.open(f'{SP}/preview/{board}.png').convert('RGB').crop((0, 0, 1280, 720))
    im = im.resize((TW, TH), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def picture(board, x, y, job, sub, above=False, lx=None):
    """A picture in the kit's recessed well, with its job (s14) and its screen name and way back (s13) as two lines."""
    out = (f'<img class="abs" src="{thumb_uri(board)}" style="left:{x}px;top:{y}px;width:{TW}px;height:{TH}px">'
           + K.frame(TW + 4, TH + 4, 'well', shadow=0).svg(x - 2, y - 2))
    lx = x if lx is None else lx
    ly = y - 46 if above else y + TH + 8
    out += T(lx, ly, job, 's14 bone ol1d') + T(lx, ly + 20, sub, 's13 dim ol1d')
    return out


# ------------------------------------------------------------------ the rules
def _seg(x0, y0, x1, y1, dashed=False):
    """One orthogonal run of the rule: a 1 px ink edge round a 2 px brass core, so it reads on the dimmed world."""
    if x0 > x1 or y0 > y1:
        x0, x1, y0, y1 = min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1)
    horiz = y0 == y1
    L = (x1 - x0) if horiz else (y1 - y0)
    runs = []
    if dashed:
        p = 0
        while p < L:
            runs.append((p, min(p + 8, L + 1)))
            p += 13
    else:
        runs = [(0, L + 1)]
    s = ''
    for a, b in runs:
        if horiz:
            s += f'<rect x="{x0 + a - 1}" y="{y0 - 2}" width="{b - a + 2}" height="4" fill="{C["k0"]}"/>'
            s += f'<rect x="{x0 + a}" y="{y0 - 1}" width="{b - a}" height="2" fill="{C["o4"]}"/>'
        else:
            s += f'<rect x="{x0 - 2}" y="{y0 + a - 1}" width="4" height="{b - a + 2}" fill="{C["k0"]}"/>'
            s += f'<rect x="{x0 - 1}" y="{y0 + a}" width="2" height="{b - a}" fill="{C["o4"]}"/>'
    return s


def way(points, dashed=False):
    """A rule through a list of corner points (orthogonal runs only). Corners are filled square, no rounding."""
    s = ''.join(_seg(*points[i], *points[i + 1], dashed) for i in range(len(points) - 1))
    if not dashed:
        for (x, y) in points[1:-1]:
            s += f'<rect x="{x - 1}" y="{y - 1}" width="2" height="2" fill="{C["o4"]}"/>'
    return f'<svg class="abs" style="left:0;top:0;overflow:visible" width="1280" height="720" shape-rendering="crispEdges">{s}</svg>'


def tag(x, y, upper, lower, w=None, align=None):
    """The words on a rule: the upper line is the way in (the key or click), the lower line is the way back."""
    a = dict(w=w, align=align)
    return T(x, y, upper, 's13 bone ol1d', **a) + T(x, y + 24, lower, 's13 bone ol1d', **a)


def gap_tag(gx, ymid, upper, lower):
    """A tag centred in a gutter: the way in over the rule, the way back under it."""
    return (T(gx, ymid - 26, upper, 's13 bone ol1d', w=73, align='center')
            + T(gx, ymid + 6, lower, 's13 bone ol1d', w=73, align='center'))


K1, KE = key('1'), key('Esc')

# ------------------------------------------------------------------ the board
body = world_map() + scrim()

# the header: where this is, and how to read it
leg = 110
hdr_rules = (f'<div class="abs" style="left:0;top:0">'
             f'{way([(PAD, leg + 12), (PAD + 30, leg + 12)])}{way([(PAD, leg + 90), (PAD + 30, leg + 90)], dashed=True)}</div>')
hdr = T(PAD, BIG_Y - 4, 'One job per screen, and how the screens connect.', 's14 bone', w=204) + groove(PAD, leg - 8, 204) + hdr_rules
hdr += T(PAD + 42, leg + 4, 'a way between screens', 's13 bone')
hdr += T(PAD, leg + 26, 'Over it, the way in: a key, a click or a choice. Under it, the way back.', 's13 dim', w=204)
hdr += T(PAD + 42, leg + 82, 'a way the game lacks today', 's13 bone')

HDR_H = 230
body += window(EDGE, EDGE, 244, HDR_H, hdr, title='Flow', big=True)

# row B, the spine: the map, the square, the tavern, the say screen, the choice
body += picture('PxMap1x', COL[0], YB, 'Where do we march?', 'The map · the root', lx=COL[0] + 16)
body += picture('UxTown', COL[1], YB, 'Where in town do we go?', 'Town · Back to the road')
body += picture('UxTavern', COL[2], YB, 'Who do we talk to?', 'Tavern · Back to the square')
body += picture('UxTalk', COL[3], YB, "Read Kael's line.", 'Talk · no way back')
body += picture('UxTalkChoice', COL[4], YB, 'What do we say?', 'Talk · answer 3 ends it')

# row A, above: the inn and the market off the square, History off the talk, the reunion after the job is taken
body += picture('UxInn', COL[1], YA, 'Do we pay to heal?', 'Inn · Back to the square', above=True)
body += picture('UxMarket', COL[2], YA, 'What do we buy or sell?', 'Market · Back to the square', above=True)
body += picture('UxTalkLog', COL[3], YA, 'What was said?', 'History · over the talk', above=True)
body += picture('UxTalkTwo', COL[4], YA, 'Two on stage: hear Daren.', 'Talk · it must be heard', above=True)

# row C, below: a person's kit, his deck, the satchel, equipping (every way in row C reads left to right)
body += picture('UxPerson', COL[1], YC, 'How is he kitted?', 'Q and E: the next person')
body += picture('UxPersonDeck', COL[2], YC, 'What will he draw?', 'The Company · the deck')
body += picture('UxEquip', COL[4], YC, 'Where does the buckler go?', 'The Company · Put it back')
body += picture('UxSatchel', COL[3], YC, 'What do we carry?', 'Satchel · Back to the road')

# the map's menu (top right of the map): the second window, the root of row C
MX, MY, MW, MH = EDGE, 436, 192, 160
mrow = [MY + HEAD_Y + 11 + 26 * i for i in range(4)]
menu = T(PAD, HEAD_Y, 'The Company', 's16 bone') + T(MW - PAD, HEAD_Y, key('C'), 's13', style='transform:translateX(-100%)')
menu += T(PAD, HEAD_Y + 26, 'The satchel', 's16 bone') + T(MW - PAD, HEAD_Y + 26, 'new ' + key('I'), 's13 ochre', style='transform:translateX(-100%)')
menu += T(PAD, HEAD_Y + 52, 'Contracts', 's16 dim')
menu += T(PAD, HEAD_Y + 78, 'Menu', 's16 dim') + T(MW - PAD, HEAD_Y + 78, KE, 's13', style='transform:translateX(-100%)')
body += window(MX, MY, MW, MH, menu, title="The map's menu")

# ------------------------------------------------------------------ the ways
W = []
G = [COL[i] + TW for i in range(4)]            # gutter left edges: 206, 471, 736, 1001
# the spine
W.append(way([(G[0], MID_B), (COL[1], MID_B)]))
body += gap_tag(G[0], MID_B, 'march', KE)
W.append(way([(G[1], MID_B), (COL[2], MID_B)]))
body += gap_tag(G[1], MID_B, key('3'), KE)
W.append(way([(G[2], MID_B), (COL[3], MID_B)]))
body += gap_tag(G[2], MID_B, K1, 'answer 3')
W.append(way([(G[3], MID_B), (COL[4], MID_B)]))
body += gap_tag(G[3], MID_B, key('Space'), 'none')

# up from the square: the inn and the market
ABOT = YA + TH
xi = COL[1] + 52
W.append(way([(xi, YB), (xi, ABOT)]))
body += tag(xi + 10, ABOT + 14, key('1'), KE)
xm0, xm1, ym = COL[1] + 150, COL[2] + 52, ABOT + 44
W.append(way([(xm0, YB), (xm0, ym), (xm1, ym), (xm1, ABOT)]))
body += tag(xm1 + 10, ABOT + 8, key('2'), KE)

# up from the talk: History; up from the choice: the reunion, after the job is taken and Daren is caught alive
xh = COL[3] + 52
W.append(way([(xh, YB), (xh, ABOT)]))
body += tag(xh + 10, ABOT + 14, 'History, on any line', KE + ' Back to the conversation')
xt = COL[4] + 52
W.append(way([(xt, YB), (xt, ABOT)]))
body += tag(xt + 10, ABOT + 14, key('1') + ' then the field', 'none')

# the map to its menu
W.append(way([(COL[0] + 6, YB + TH), (COL[0] + 6, MY)]))

# the menu to a person; a person to his deck and to equipping; the satchel to equipping
yc = mrow[0]
W.append(way([(MX + MW + 2, yc), (COL[1], yc)]))
body += gap_tag(G[0], yc, key('C'), KE)
W.append(way([(G[1], MID_C), (COL[2], MID_C)]))
body += gap_tag(G[1], MID_C, key('D'), key('D'))
CTOP = YC
xp0, xp1, yq = COL[1] + 150, COL[4] + 52, YC - 30
W.append(way([(xp0, CTOP), (xp0, yq), (xp1, yq), (xp1, CTOP)]))
body += tag(COL[3] - 20, yq - 24, 'Try the Iron Buckler', KE + ' Put it back')
W.append(way([(G[3], MID_C), (COL[4], MID_C)]))
body += gap_tag(G[3], MID_C, key('Enter'), KE)

# the satchel entry, which the game lacks today: dashed, along the foot of the stage
ys = mrow[1]
yf = YC + TH + 90
xs = COL[3] + TW - 6
W.append(way([(MX + MW + 2, ys), (MX + MW + 12, ys), (MX + MW + 12, yf), (xs, yf), (xs, YC + TH)], dashed=True))
body += T(COL[1] + 40, yf - 22, key('I') + ' The satchel, a new entry on the map\'s menu and the square\'s list', 's13 bone ol1d')
body += T(COL[1] + 40, yf + 6, KE + ' Back to the road, or the square', 's13 bone ol1d')

# what these replace (the boards of today), in the empty corner at the foot
body += T(COL[4] - 26, yf - 22, "These replace the town's three tabs, The Company window and the dialogue box for quest talk.", 's13 dim ol1d', w=218)

body += ''.join(W)

write('UxFlow', board_html('Flow · one job per screen, how the screens connect', body))
print('UxFlow written')
