"""F64Company (px-popups copy: the 1x pixel world under it, from kit_px_map via the kit).
F64Company: the company sheet (the loadout) over the dimmed map. Day 1 at Frontier Camp.

State (derived from day 1 with one real verb): Oak has used Put away on his Iron Buckler, so it sits in the satchel
at the first free fit (3, 0) beside 2 rations of 4 and the Healing Potion. The player has picked it up and points
at The Foundling's empty right hand. planEquip (engine/run/equipment.ts) makes four hands legal (both of the
Foundling's, both of Oak's: a swap puts the held piece in the satchel) and refuses both of Lilina's with
canHold's sentence "Mages do not carry shields". Rations and the potion carry the satchel's own refusal.
"""
from common import *

MX, MY, MW, MH = 52, 80, 1176, 560
COLS = [20, 280, 540]
CW = 232
SX = MW - PAD - 352          # the satchel column (804)

STATS = ('str', 'mag', 'skl', 'spd', 'def', 'res', 'lck')
MOV = {'mc': 5, 'oak': 3, 'lilina': 5}            # classes.json startingMov
CLASSNAME = {'mc': 'Lord', 'oak': 'Shield Knight', 'lilina': 'Mage'}   # className(classId) from classes.json
HANDS = {'mc': ('iron_sword', None), 'oak': ('iron_lance', None), 'lilina': ('fire_tome', None)}
DECK = {   # buildDeck: innate class cards + left-hand gear cards (+ right)
    'mc': (5, 'sword', 4), 'oak': (4, 'lance', 3), 'lilina': (4, 'tome', 4),
}


def member(u, cx):
    uid = u['id']
    tgt = uid == 'mc'
    out = face(u['face'], cx, MODAL_Y, 96, lit=tgt)
    tx = cx + 116
    out += T(tx, MODAL_Y + 4, u['name'], f's16 {"straw" if tgt else "bone"}')
    out += T(tx, MODAL_Y + 27, CLASSNAME[uid], 's13 dim')
    out += T(tx, MODAL_Y + 44, f'level 1 · mov {MOV[uid]}', 's13 dim')
    out += T(tx, MODAL_Y + 68, f'{u["hp"]}/{u["max"]} hp', 's14 bone')
    out += hp_bar(tx, MODAL_Y + 90, CW - 116, u['hp'], u['max'])
    # the seven stats as a two-row table: labels over values, one column each
    sy = MODAL_Y + 116
    for i, k in enumerate(STATS):
        x = cx + i * 33
        out += T(x, sy, k.upper(), 's13 dim c', w=33)
        out += T(x, sy + 17, str(u['stats'][k]), 's15 bone c', w=33)
    out += groove(cx, sy + 44, CW)
    hy = sy + 56                                       # hand labels top
    left, right = HANDS[uid]
    if uid == 'lilina':
        out += equip_slot(cx, hy, 'left', left, 'refused') + equip_slot(cx + 116, hy, 'right', right, 'refused')
    elif uid == 'mc':
        out += equip_slot(cx, hy, 'left', left, 'idle') + slot_valid(cx, hy)
        out += equip_slot(cx + 116, hy, 'right', right, 'target')
    else:
        out += equip_slot(cx, hy, 'left', left, 'idle') + slot_valid(cx, hy)
        out += equip_slot(cx + 116, hy, 'right', right, 'idle') + slot_valid(cx + 116, hy)
    vy = hy + 182                                      # the verdict row under the hands
    if uid == 'mc':
        out += button('Take Iron Buckler', 'primary', x=cx, y=vy)
    elif uid == 'oak':
        out += T(cx, vy + 1, 'His own buckler. Either hand', 's14 dim') + T(cx, vy + 19, 'takes it back.', 's14 dim')
    else:
        out += f'<div class="abs why" style="left:{cx}px;top:{vy + 9}px">Mages do not carry shields</div>'
    n_cls, gear, n_gear = DECK[uid]
    dy = vy + 52
    if uid == 'mc':
        out += T(cx, dy, f'Deck: {n_cls + n_gear} cards, <span class="straw">12 with it</span>', 's14 bone')
    else:
        out += T(cx, dy, f'Deck: {n_cls + n_gear} cards', 's14 bone')
    out += T(cx, dy + 20, f'{n_cls} from the class, {n_gear} from the {gear}', 's13 dim')
    return out


def satchel():
    out = section_head('The satchel', x=SX, y=MODAL_Y, w=352, note='8 by 4')
    by = MODAL_Y + 34
    out += bag(SX, by, [('food_rations', 0, 0, 4), ('food_rations', 1, 0, 4), ('healing_potion', 2, 0, None), ('iron_buckler', 3, 0, None)],
               selected=(3, 0))
    y = by + 176 + 12
    out += T(SX, y, 'Holding Iron Buckler, pick a hand', 's14 straw')
    out += f'<div class="abs why" style="left:{SX}px;top:{y + 22}px">the rest: not something a hand can hold</div>'
    y += 54
    out += groove(SX, y, 352)
    y += 12
    out += icon('shield', SX, y + 2)
    out += T(SX + 34, y, 'Iron Buckler', 's16 bone') + T(SX + 34, y + 21, 'shield · one hand · common', 's13 dim')
    out += rtext(MW - PAD, y + 3, 'put away by Oak', 's13 dim')
    y += 50
    out += T(SX, y, 'The cards it brings', 's13 ochre')
    y += 22
    for name, cost, what in (('Block', 1, '4 armor'), ('Parry', 1, '3 armor · riposte 2'), ('Deflect', 0, '2 armor')):
        out += T(SX, y, f'{cost} AP', 's13 dim', w=40) + T(SX + 44, y - 2, name, 's15 bone') + rtext(MW - PAD, y - 1, what, 's14 bone')
        y += 24
    return out


body = (T(PAD, 14, 'Frontier Camp · day 1', 's13 dim') + T(PAD, 32, 'The Company', 'tt')
        + rtext(MW - PAD, 22, f'{key("Esc")}<span style="margin-left:6px">Close</span>', 's16 bone'))
for u, cx in zip(COMPANY, COLS):
    body += member(u, cx)
body += vgroove(SX - 18, MODAL_Y, MH - MODAL_Y - 30)
body += satchel()

world = map_screen(hint='Three roads out of camp. Point at one, click to march.')
page = world + modal(MX, MY, MW, MH, body)
print(write('F64Company', board_html('The Company · the loadout, the Iron Buckler picked up, day 1', page)))
