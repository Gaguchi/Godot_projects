"""F64Pause (px-popups copy: the 1x pixel world under it, from kit_px_map via the kit).
F64Pause: Esc on the map, day 1 at Frontier Camp. Pause.tsx: eyebrow 'Paused', title 'The road waits', Resume (the one
primary, autofocused), The Company + Contracts as a pair, Sound as a switch, then below a rule and alone: Save & quit,
with 'Esc resumes'. Save & quit is legal everywhere but the title (legality.ts), so nothing here is disabled.
State: Resume holds the keyboard focus it opens with; the pointer rests on The Company."""
from common import *

MW, MH = 420, 334
MX, MY = (1280 - MW) // 2, (720 - MH) // 2
IW = MW - 2 * PAD

body = T(PAD, 14, 'Paused', 's13 dim') + T(PAD, 32, 'The road waits', 'tt')
body += rtext(MW - PAD, 14, 'Frontier Camp · day 1', 's13 dim')
body += button('Resume', 'primary', 'focus', w=IW, x=PAD, y=MODAL_Y)
half = (IW - 12) // 2
body += button('The Company', 'secondary', 'hover', w=half, x=PAD, y=MODAL_Y + 50)
body += button('Contracts', 'secondary', w=half, x=PAD + half + 12, y=MODAL_Y + 50)
body += switch(PAD, MODAL_Y + 104, IW, 'Sound', True)
body += rule(PAD, MODAL_Y + 148, IW)
body += button('Save &amp; quit', 'secondary', x=PAD, y=MODAL_Y + 166)
body += rtext(MW - PAD, MODAL_Y + 173, f'{key("Esc")}<span style="margin-left:6px">resumes</span>', 's13 dim')
body += T(PAD, MODAL_Y + 212, 'Nothing is lost: the run saves as you go.', 's13 dim')

world = map_screen(hint='Three roads out of camp. Point at one, click to march.')
page = world + modal(MX, MY, MW, MH, body)
print(write('F64Pause', board_html('Pause · Esc on the map, pointing at The Company, day 1', page)))
