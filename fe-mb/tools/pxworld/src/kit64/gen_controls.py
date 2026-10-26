"""KitControls: every shared control in every state, labelled, with the game's own words. 1280 wide."""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import sys
sys.path.insert(0, ROOT + '/src/kit64')
from kit import *

W = 1280
parts = []
y = EDGE


def sect(h, title, body, note=None, x=EDGE, w=W - 2 * EDGE):
    return window(x, y, w, h, body, title=title, note=note)


# ------------------------------------------------------------------ header
HH = 96
parts.append(window(EDGE, y, W - 2 * EDGE, HH,
                    T(PAD, 46, 'Every shared control in every state, in the game\'s own words. Pixels at 1:1; Source Serif 4 to read and for people, Jacquard 24 at 43 px for places and titles.', 's15 bone lt')
                    + T(PAD, 68, f'One brass primary per screen. Brass edges and brackets mark only what you point at or have chosen. Disabled always says why.', 's13 dim'),
                    title='Controls', big=True, note='Filigree kit · sheet 1 of 2'))
y += HH + GAP

# ------------------------------------------------------------------ buttons
COLS = [('idle', 170), ('hover', 330), ('press', 490), ('focus', 650), ('armed', 810), ('disabled', 960)]
BH = 292
b = ''
for name, cx in COLS:
    b += label(cx, 50, name)
ROWS_B = [
    ('primary', 'brass · the one act', 'Resume', 'Set', 'a name cannot be empty'),
    ('secondary', 'walnut', 'The Company', 'Rest', 'nobody is wounded: a ration for nothing'),
    ('danger', 'oxblood · final', 'Sell · 40 gold', 'Sell · 40 gold', 'pick something from the satchel first'),
]
for i, (v, sub, text, dtext, why) in enumerate(ROWS_B):
    ry = 78 + i * 70
    b += T(PAD, ry + 2, v, 's15 bone') + label(PAD, ry + 22, sub)
    for st, cx in COLS:
        if st == 'armed':
            if v == 'secondary':
                b += button('Move', v, 'armed', x=cx, y=ry)
                b += label(cx, ry + 40, 'a mode it holds')
            else:
                b += label(cx, ry + 8, 'not used', )
            continue
        b += button(dtext if st == 'disabled' else text, v, st, reason=why if st == 'disabled' else None, x=cx, y=ry)
parts.append(sect(BH, 'Buttons', b, note='button(text, variant, state, reason)'))
y += BH + GAP

# ------------------------------------------------------------------ commands + keys (left), tabs (right)
CH = 300
LW = 616
c = ''
CMDS = [
    ('idle', 'Capture', 'take a foe alive when low', None),
    ('hover', 'Move', None, None),
    ('press', 'The Company', 'roster and gear', None),
    ('focus', 'Contracts', 'none yet', None),
    ('armed', 'Move', 'pick a tile in reach', None),
    ('disabled', 'Capture', None, "no foe within arm's reach"),
]
for i, (st, t, sub, why) in enumerate(CMDS):
    cx = PAD + (i % 2) * 290
    cy = 50 + (i // 2) * 62
    c += label(cx, cy + 3, st)
    c += command(t, sub, st, reason=why, x=cx + 66, y=cy)
c += groove(PAD, 238, LW - 2 * PAD)
c += T(PAD, 250, f'Keys{key("Esc")}{key("Tab")}{key("Enter")}{key("1")}{key("2")}{key("3")}', 's14 bone')
c += label(PAD + 286, 252, 'idle')
c += T(PAD + 330, 250, f'{key("Tab", "down")}', 's14 bone') + label(PAD + 372, 252, 'held')
c += T(PAD + 418, 250, f'{key("Esc", "off")}', 's14 bone') + label(PAD + 460, 252, 'not now')
parts.append(window(EDGE, y, LW, CH, c, title='Commands and key caps', note='command() · key()'))

t = ''
t += label(PAD, 50, 'selected: Shop · hover: Tavern')
t += tabs(PAD, 70, ['Inn', 'Shop', 'Tavern'], selected=1, hover=2, w=LW - 2 * PAD)
t += label(PAD, 128, 'focus (keyboard): Inn · selected: Shop')
t += tabs(PAD, 148, ['Inn', 'Shop', 'Tavern'], selected=1, focus=0, w=LW - 2 * PAD)
t += label(PAD, 206, 'a strip with a tab not open yet')
t += tabs(PAD, 226, ['The Company', 'Contracts', 'The satchel'], selected=0, disabled=(2,), w=LW - 2 * PAD)
parts.append(window(EDGE + LW + GAP, y, W - 2 * EDGE - LW - GAP, CH, t, title='Tabs', note='tabs(x, y, items, selected, hover, focus)'))
y += CH + GAP

# ------------------------------------------------------------------ rows
RH = 360
r = ''
RW = 560
r += label(PAD, 48, 'The Company: face, name, role, HP')
company = [('idle', 0), ('hover', 1), ('selected', 2), ('disabled', 2)]
for i, (st, ui) in enumerate(company):
    u = COMPANY[ui]
    ry = 70 + i * 66
    r += label(PAD, ry + 20, st)
    r += row(PAD + 86, ry, RW - 86, u['name'], u['role'], face_key=u['face'], value=f'{u["hp"]}/{u["max"]}', state=st,
             reason='Mages do not carry swords' if st == 'disabled' else None)
sx = PAD + RW + 40
r += label(sx, 48, 'the shop counter: icon, name, what it is, price · purse 80')
shop = [('idle', 'healing_potion', 'heals 10'), ('hover', 'iron_buckler', 'off-hand shield'), ('selected', 'iron_sword', 'one-handed sword'),
        ('idle', 'iron_lance', 'one-handed lance'), ('disabled', 'steel_sword', None)]
for i, (st, iid, what) in enumerate(shop):
    it = item(iid)
    ry = 70 + i * 52
    r += label(sx, ry + 14, st)
    short = it['buy'] > 80
    r += row(sx + 86, ry, 470, it['name'], what, icon_name=it['icon'], value=price(it['buy'], short=short, note=''), state=st,
             reason=f'{it["name"]} costs {it["buy"]} gold; the purse holds 80' if st == 'disabled' else None)
r += scrollbar(sx + 86 + 470 + 10, 70, 256, pos=0.0, frac=0.62)
r += label(sx + 86 + 470 - 60, 332, 'shelf 1 of 2')
parts.append(sect(RH, 'Rows and lists', r, note='row(x, y, w, name, sub, face_key | icon_name, value, state, reason) · scrollbar()'))
y += RH + GAP

# ------------------------------------------------------------------ switches (left), text input (middle), prices (right)
SH = 306
s = ''
SWW = 300
sws = [('idle · on', 'Sound', True, 'idle', None), ('idle · off', 'Sound', False, 'idle', None), ('hover', 'Sound', True, 'hover', None),
       ('focus', 'Sound', False, 'focus', None), ('disabled', 'Danger zone', False, 'disabled', 'shown on your turn only')]
for i, (lab, txt, on, st, why) in enumerate(sws):
    sy = 52 + i * 44
    s += label(PAD, sy + 3, lab)
    s += switch(PAD + 78, sy, SWW - 78 - 10, txt, on, st, reason=why)
parts.append(window(EDGE, y, SWW + 2 * PAD, SH, s, title='Switches', note='switch()'))
ix = EDGE + SWW + 2 * PAD + GAP
IW = 470
s = ''
inps = [('idle', '', 'idle', None), ('focus · typing', 'Corwin', 'focus', None), ('error · empty', '', 'error', 'a name cannot be empty'),
        ('error · taken', 'Lilina', 'error', 'someone on these roads already answers to that')]
for i, (lab, val, st, why) in enumerate(inps):
    sy = 48 + i * 62
    s += label(PAD, sy + 12, lab)
    s += text_input(PAD + 110, sy, IW - 2 * PAD - 110, val, 'a name', st, reason=why)
parts.append(window(ix, y, IW, SH, s, title='Text field', note='text_input()'))
px_ = ix + IW + GAP
PW = W - EDGE - px_
s = T(PAD, 46, 'The tariff at the counter. Purse: ' + price(80, note=''), 's14 dim')
tariff = ['healing_potion', 'iron_buckler', 'iron_sword', 'iron_lance', 'steel_sword']
for i, iid in enumerate(tariff):
    it = item(iid)
    sy = 76 + i * 40
    s += icon(it['icon'], PAD, sy - 2) + T(PAD + 32, sy + 2, it['name'], 's15 bone')
    s += f'<div class="abs" style="left:{PAD + 168}px;top:{sy + 1}px">{price(it["buy"], short=it["buy"] > 80)}</div>'
parts.append(window(px_, y, PW, SH, s, title='Price tags', note='price(amount, short)'))
y += SH + GAP

# ------------------------------------------------------------------ check tags (left), tooltips + toasts (right)
KH = 270
k = ''
k += T(PAD, 46, 'A caravan blocks the road', 's16 bone') + label(PAD + 220, 48, 'from the road event: stat, threshold, who answers it best')
chks = [('Help push the wagon free.', 'STR 6 · Oak 6', True), ('Talk him into letting you detour.', 'SKL 7 · Lilina 5', False),
        ('Answer with the old signs.', 'needs a Bandit Archer', False), ('Pay the toll (15 gold)', '15 gold · 80 held', None)]
for i, (line, tg, ok) in enumerate(chks):
    ky = 76 + i * 36
    k += T(PAD, ky, f'{line}{check_tag(tg, ok, word=ok is not None)}', 's15 bone')
k += label(PAD, 226, 'moss + tick: within reach · rust + cross: falls short · dim, no mark: a cost, not a test')
KW = 620
parts.append(window(EDGE, y, KW, KH + 84, k, title='Check tags', note='check_tag(text, ok)'))
tx = EDGE + KW + GAP
TW = W - EDGE - tx
t = ''
t += label(PAD, 48, 'a note: the name of a 1-square item')
t += bag_cell(PAD + 30, 118, 'healing_potion', 'filled')
t += tooltip(PAD + 2, 72, 'Healing Potion')
t += label(PAD + 250, 48, 'a refusal: what to change, on the glass')
t += tooltip(PAD + 250, 72, 'Steel Sword costs 160 gold; the purse holds 80', reason=True, w=250)
t += button('Buy', 'secondary', 'disabled', reason='beyond the purse', x=PAD + 344, y=134)
t += groove(PAD, 196, TW - 2 * PAD)
t += label(PAD, 206, 'refusal toast, with a head and without')
t += toast(PAD, 228, 'It costs 160 gold; the purse holds 80.', head="Can't buy the Steel Sword")
t += toast(PAD, 292, 'nobody is wounded: a ration for nothing')
parts.append(window(tx, y, TW, KH + 84, t, title='Tooltip and refusal toast', note='tooltip() · toast()'))
y += KH + 84 + GAP

# ------------------------------------------------------------------ choices (left), type (right)
QH = 330
q = ''
q += label(PAD, 46, 'answers in a talk or event box: number key, line, check tag')
chs = [('idle', 'Help push the wagon free.', 'STR 6 · Oak 6', True, None), ('hover', 'Talk him into letting you detour.', 'SKL 7 · Lilina 5', False, None),
       ('chosen', 'Wait it out.', None, None, None), ('locked', 'Answer with the old signs.', None, None, 'needs a Bandit Archer')]
for i, (st, line, tg, ok, req) in enumerate(chs):
    qy = 72 + i * 50
    q += label(PAD, qy + 8, st)
    q += choice(PAD + 84, qy, KW - 2 * PAD - 84, i + 1, line, st, tg, ok, req)
parts.append(window(EDGE, y, KW, QH + 44, q, title='Choices', note='choice(x, y, w, n, text, state, tag, ok, req)'))
t = ''
TYPE = [('tt', 'Riverside Market', 'Jacquard 24 at 43 px · places, screen titles, Round'),
        ('s20 person', 'Bagrat "Oak"', 's20 bold · a person or foe named alone'), ('s20', 'Day 1', 's20 · the one readout a window leads with'),
        ('s18', 'End turn', 's18 · commands, a dialogue line'), ('s16', 'Obsidian Fighter 1', 's16 · names in rows, buttons, heads'),
        ('s15 lt', 'An encounter on the road: 4 in 10', 's15 · the body line'), ('s14', 'Oak\'s taking bets on who bleeds first.', 's14 · notes, the log'),
        ('s13', 'take a foe alive when low', 's13 · sub-lines, labels: the floor')]
ty = 46
for cls, sample, role in TYPE:
    hgt = 46 if cls == 'tt' else 30
    t += T(PAD, ty, sample, cls.replace(' person', '') + (' straw' if cls in ('tt', 's20 person') else ' bone'))
    t += T(TW - PAD, ty + (14 if cls == 'tt' else 3), role, 's13 dim', style='transform:translateX(-100%)')
    ty += hgt
t += groove(PAD, ty + 2, TW - 2 * PAD)
cols_t = [('bone', 'bone · read'), ('dim', 'dim · second'), ('faint', 'faint · off'), ('straw', 'straw · chosen'), ('ochre', 'ochre · heads'),
          ('rust', 'rust · harm, refusal'), ('rill', 'rill · ours'), ('meadow', 'meadow · clears')]
for i, (cc, lab) in enumerate(cols_t):
    t += T(PAD + (i % 4) * 140, ty + 12 + (i // 4) * 20, lab, f's13 {cc}')
parts.append(window(tx, y, TW, QH + 44, t, title='Type and text colour', note='T(x, y, text, cls)'))
y += QH + 44 + EDGE

H = y
html = board_html('Kit · every shared control, in every state', ground(W, H) + '\n'.join(parts), W, H)
print(write('KitControls', html), H, len(html))
