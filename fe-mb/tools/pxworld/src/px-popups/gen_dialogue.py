"""F64Dialogue (px-popups copy: the 1x pixel world under it, the company stamped on the road out of camp).
F64Dialogue: the Bandit Leader's toll (content/dialogue/bandit_threat.json, node 'start') over the map.

Run state: the first hop out of Frontier Camp toward Trader's Rest (a road INTO a town never rolls, rules.travel.noRollInto,
so this talk cannot open on the road to Riverside Market). dirs/consistency/probe_roadtalk.mts traders_rest: seed 35 rolls
bandit_threat on that hop. The hop is begun (food eaten, day counted: run/travel.ts BEGIN): day 2, food 7, gold 80.
Busts: [null, bandit_leader] (run/dialogue.ts#bustsAfter); the leader speaks. Choice 1 has no check (visibleIf gold
>= 15 only), so it carries no tag; choice 2 is a STR 6 check, best in the company Bagrat "Oak" with STR 6.
State shown: choice 2 hovered.
"""
from f64i import *  # noqa: F401,F403

# px-popups: 0.55, not 0.3. On the pixel map Frontier Camp's stake ring is wider than the painted camp, and 0.3 of the road
# still lies inside it; 0.55 is the same hop on open road, the point F64Check uses.
at = road_point('frontier_camp', 'traders_rest', 0.55)
body = map_screen(at=at, day=2, food_used=(1, 0), gold=80, hide=('bandit_hideout', 'smugglers_cave'))
body += scrim()

DW, DH = 760, 244
dx, dy = (1280 - DW) // 2, 720 - EDGE - 2 - DH
body += dialogue(dx, dy, DW, DH, 'face_bandit', 'Bandit Leader',
                 'Hold it right there! This road has a toll now. Pay up or draw steel.', [
                     dict(text='Pay the toll (15 gold)', state='idle'),
                     dict(text='Intimidate them', state='hover', tag='STR 6 · Oak 6', ok=True),
                     dict(text='Fight them!', state='idle'),
                 ], flip=True)
# the hovered answer, said in words at the foot of the box: who in the company answers it, and that he clears it
body += groove(dx + 142, dy + 206, DW - 142 - PAD)
body += T(dx + 142, dy + 214, 'Oak answers this one: his STR 6 meets the 6 it asks.', 's14 dim')

write('F64Dialogue', board_html('Dialogue · the Bandit Leader blocks the road to Trader\'s Rest, Intimidate pointed at, day 2', body, 1280, 720))
print('ok')
