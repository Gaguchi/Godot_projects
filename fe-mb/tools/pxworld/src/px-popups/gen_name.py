"""F64Name (px-popups copy: the 1x pixel world under it, the company stamped where the run has it).
F64Name: the name prompt (ui/overlays/NamePrompt.tsx) for the FOUNDLING, over the map.

Where it comes from: Guildmistress Anya's contract at Riverside Market (dialogue sq_caravan_accept, node 'accept':
"Give her a name for the register." -> promptName { target: 'mc' }). So the run is at Riverside Market after one hop:
day 2, food 7, gold 80, and The Missing Caravan is the open contract (its onEnter started the quest).
Copy is the prompt's own: eyebrow 'The foundling', title 'What do they call you?', placeholder 'a name', input
maxLength 24, the Set primary. The reason is run/naming.ts#canTakeName: the player has typed "Lilina", a name the cast
already holds, so NAME_TAKEN prints under the field and Set stays dark.
State shown: the field focused, typed into, refused.
"""
from f64i import *  # noqa: F401,F403

NAME_TAKEN = 'someone on these roads already answers to that'

body = map_screen(here='riverside_market', day=2, food_used=(1, 0), gold=80, contracts='The Missing Caravan',
                  hide=('north_ridge_path', 'old_mill_crossing', 'bandit_hideout', 'riverside_market'))

MW, MH = 572, 232
mx, my = (1280 - MW) // 2, (720 - MH) // 2
fx = PAD + 104 + 20
fw = MW - fx - PAD - 12 - 72
mb = (rule(PAD, 86, MW - 2 * PAD)
      + face('face_roy', PAD, 104, 96)
      + T(fx, 108, 'A name for the guild to write down.', 's14 lt dim')
      + text_input(fx, 134, fw, value='Lilina', state='error', reason=NAME_TAKEN)
      + f'<div class="abs" style="left:{fx + fw + 12}px;top:137px"><span class="btn pri dis" style="width:72px">Set</span></div>')
body += modal(mx, my, MW, MH, mb, title='What do they call you?', eyebrow='The foundling')

write('F64Name', board_html('Name · the Foundling\'s name for the register, "Lilina" refused, day 2', body, 1280, 720))
print('ok')
