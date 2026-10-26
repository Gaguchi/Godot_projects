"""F64Check (px-popups copy: the 1x pixel world under it, the company stamped where the run has it).
F64Check: a road event (content/checkEvents/stuck_caravan.json) over the map.

Run state: the first hop out of Frontier Camp, toward Trader's Rest; the hop is begun, so day 2, food 7, gold 80
(dirs/consistency/probe_roadtalk.mts traders_rest: seed 77 rolls stuck_caravan on that hop).
The tags are CheckOverlay's own: a stat check prints `STAT threshold · best-living-name value` and its verdict comes
from evaluateCheck on the unit the engine auto-picks (run/checks.ts). STR: Bagrat "Oak" 6 (shield_knight) against 6,
cleared. SKL: Lilina 5 (mage) against 7, short. 'Wait it out.' has no check, so no tag.
State shown: the moment of choosing, answer 1 hovered. (The card after an answer, the seal and its one Continue,
replaces this one in CheckOverlay.tsx; it is a different state, so it is not drawn beside it.)
"""
from f64i import *  # noqa: F401,F403

at = road_point('frontier_camp', 'traders_rest', 0.55)
body = map_screen(at=at, day=2, food_used=(1, 0), gold=80, hide=('watchtower_ridge',))
body += scrim()

# ------------------------------------------------------------------ the card, choosing
MW, MH = 604, 318
RW, RH = 380, 232
gap = 20
mx = (1280 - MW) // 2
my = (720 - MH) // 2           # centred on the stage, as the kit places a modal
desc = "The driver shouts at his oxen. The road is narrow, and you'd have to push or talk your way past."
mb = (rule(PAD, 86, MW - 2 * PAD)
      + T(PAD, 100, desc, 's16 lt bone', w=MW - 2 * PAD, style='line-height:23px')
      + choice(PAD + 4, 160, MW - 2 * PAD - 4, 1, 'Help push the wagon free.', 'hover', tag='STR 6 · Oak 6', ok=True)
      + choice(PAD + 4, 194, MW - 2 * PAD - 4, 2, 'Talk him into letting you detour.', 'idle', tag='SKL 7 · Lilina 5', ok=False)
      + choice(PAD + 4, 228, MW - 2 * PAD - 4, 3, 'Wait it out.', 'idle')
      + groove(PAD, 274, MW - 2 * PAD)
      + T(PAD, 282, 'Oak answers this one: his STR 6 meets the 6 it asks.', 's14 dim'))
body += modal(mx, my, MW, MH, mb, title='A caravan blocks the road', eyebrow='On the road', scrim_box=(0, 0, 0, 0))

write('F64Check', board_html("Check · a caravan blocks the road to Trader's Rest, Help push pointed at, day 2", body, 1280, 720))
print('ok')
