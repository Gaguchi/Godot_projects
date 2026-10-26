"""F64Contracts (px-popups copy: the pixel world under it; the company stands on Pine Crossing's west road, kit_px_map.stand).
The contracts window (the quest log) over the dimmed map. Day 4, back on the map at Pine Crossing.

Derived run (every hop 1 day, 1 food; no road encounter fired):
  day 1 Frontier Camp -> day 2 Riverside Market: Guildmistress Anya's tavern job, The Missing Caravan (sq_caravan_accept;
        the register's name prompt was answered with the stand-in, "The Foundling", which naming.ts allows)
  -> day 3 Old Mill Crossing -> day 4 Pine Crossing: Kael's tavern job, Blood Ties (sq_blood_ties_accept).
  Food 8 - 3 = 5 (the first ration down to 1), gold 80. Blood Ties' onEnter unlocks Smuggler's Cave (and spawns
  Daren's Camp off the Frontier Camp road, which sits under this window).
Rows follow QuestLog.tsx: name, the stage's authored label, 'taken today' or 'day N · M days open'. Givers, places,
promises and lines come from towns/*.json tavernQuests and dialogue/sq_*_accept.json.
"""
from common import *

MW, MH = 660, 460
MX, MY = (1280 - MW) // 2, (720 - MH) // 2
TX = 54


def contract(y, name, when, stage, giver, terms, line):
    out = icon('contract', PAD, y + 1) + T(TX, y, name, 's16 bone') + rtext(MW - PAD, y + 3, when, 's13 dim')
    out += T(TX, y + 23, stage, 's15 lt bone')
    out += T(TX, y + 47, giver, 's13 dim')
    yy = y + 66
    for lab, txt in terms:
        out += T(TX, yy, f'<span class="ochre" style="display:inline-block;width:88px">{lab}</span>{txt}', 's13 bone')
        yy += 18
    out += T(TX, yy + 2, line, 's14 it dim')
    return out, yy + 22


body = T(PAD, 14, 'the company ledger', 's13 dim') + T(PAD, 32, 'Contracts', 'tt')   # QuestLog.tsx's eyebrow, as on the report and the ledger pages
body += rtext(MW - PAD, 46, '<span class="straw">2</span> open · 0 settled · the 4th day', 's15 bone')
body += rule(PAD, 86, MW - 2 * PAD)
body += section_head('Open', y=98, w=MW - 2 * PAD, note='quests move on the road, never from here')
r1, y = contract(134, 'The Missing Caravan', 'day 2 · 2 days open', 'Search the Thornwood road for the caravan',
                 'Guildmistress Anya, at the Riverside Market tavern',
                 [('Promised', 'a serpent-forged blade, Thornwood work')],
                 '“The drivers favoured the south road toward the Thornwood eaves.”')
body += r1 + groove(PAD, y + 8, MW - 2 * PAD)
r2, y = contract(y + 20, 'Blood Ties', 'taken today', "Find Daren's gang on the Frontier Camp road",
                 'Kael, a hooded bounty hunter at the Pine Crossing tavern',
                 [('Taken alive', 'Kael joins the company'), ('Killed', '80 gold, and Kael goes his own way')],
                 '“Capture only takes a foe who is already hurt.”')
body += r2
body += T(PAD, MH - PAD - 26, f'{key("Esc")}<span style="margin-left:6px">closes</span>', 's13 dim')
body += button('Close', 'primary', 'hover', w=120, x=MW - PAD - 120, y=MH - PAD - 36)

world = map_screen('pine_crossing', 4, 80, (3, 0), 'two open',
                   subs={'south_road_ambush': ('a landmark', 'bone'), 'bandit_hideout': ('a landmark', 'dim')},
                   hint='Four roads out of Pine Crossing. Point at one, click to march.')
page = world + modal(MX, MY, MW, MH, body)
print(write('F64Contracts', board_html('Contracts · two open, back at Pine Crossing, day 4', page)))
print('modal', MX, MY, MW, MH, 'content bottom', y)
