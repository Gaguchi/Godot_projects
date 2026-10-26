"""UxTalk, UxTalkChoice, UxTalkTwo, UxTalkLog: the conversation as visual-novel screens (they replace F64Dialogue for story
and quest talk; road events stay pop-ups over the map).

Every line is read verbatim from the game: content/data/dialogue/sq_blood_ties_accept.json (Kael at Pine Crossing's tavern)
and sq_blood_ties_daren_captured.json (the reunion, back at the tavern). talk.py composes each board from the room, the
people on stage and who speaks, the line, the choices and the quick menu.

    cd <scratchpad> && python dirs/ux-talk/gen_talk.py && node preview.mjs UxTalk UxTalkChoice UxTalkTwo UxTalkLog
"""
import html
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import talk as TK  # noqa: E402
from talk import board_html, write  # noqa: E402

DATA = 'E:/Work/GameDev/Godot/fe-mb/game/src/content/data'


def talk(name):
    with open(f'{DATA}/dialogue/{name}.json', encoding='utf-8') as fh:
        return json.load(fh)['nodes']


def esc(s):
    return html.escape(s, quote=False)


ACCEPT = talk('sq_blood_ties_accept')
REUNION = talk('sq_blood_ties_daren_captured')
line = lambda tree, node: esc(tree[node]['text'])                                   # noqa: E731
answers = lambda tree, node: [esc(c['text']) for c in tree[node]['choices']]        # noqa: E731
assert all(not c['effects'] for c in ACCEPT['request']['choices'])                  # no check, no cost: no tags on these answers


def ends(tree, choice):
    """An answer 'ends the talk' when every path from it reaches 'end' through Continue-only nodes that start nothing.
    (The game would carry this as a derived flag; see NOTES.md.)"""
    node = choice['next']
    while node != 'end':
        n = tree[node]
        if n.get('onEnter') or len(n['choices']) != 1 or n['choices'][0]['effects']:
            return False
        node = n['choices'][0]['next']
    return True


def answer_items(tree, node):
    return [dict(text=esc(c['text']), note='ends the talk' if ends(tree, c) else None) for c in tree[node]['choices']]

# who stands where. The art is never mirrored (UXREFS 1.7): all three look toward the viewer's right, so the one who looks AT
# someone stands on the left. The Foundling (our lead) listens on the left, looking at Kael; Kael on the right faces the room,
# talking to the company. At the reunion Daren stands left, looking at his brother; Kael keeps his place on the right.
FOUNDLING_L = TK.Stand('roy', 'listener', 231)     # his head on the plaster pier between the windows, not haloed by the sky
KAEL_R = TK.Stand('kael', 'speaker', 944)
DAREN_L = TK.Stand('daren', 'speaker', 400)         # her head on the plain wall, clear of the notice board's pinned papers
KAEL_R_BACK = TK.Stand('kael', 'listener', 706)

# ---------------------------------------------------------------- UxTalk: read Kael's line
body = TK.talk_screen([FOUNDLING_L, KAEL_R], 'Kael', 'right', line(ACCEPT, 'explain'))
write('UxTalk', board_html("Talk · Blood Ties at Pine Crossing's tavern, Kael's second line, The Foundling listening", body))

# ---------------------------------------------------------------- UxTalkChoice: what do we say?
body = TK.talk_screen([FOUNDLING_L, KAEL_R], 'Kael', 'right', line(ACCEPT, 'request'),
                      choices=answer_items(ACCEPT, 'request'), pointed=1)
write('UxTalkChoice', board_html("Talk · Blood Ties, Kael's request and the three answers, What's in it for us? pointed at", body))

# ---------------------------------------------------------------- UxTalkTwo: two people on stage
# Daren's first line on any stage: his plate says once who he is (the explain line: "My brother Daren"). Auto is running.
body = TK.talk_screen([DAREN_L, KAEL_R_BACK], 'Daren', 'left', line(REUNION, 'daren_speaks'), epithet="Kael's brother",
                      quick={'Auto': 'on'})
write('UxTalkTwo', board_html('Talk · Blood Ties, the reunion back at the tavern, Daren speaking, Kael beside him', body))

# ---------------------------------------------------------------- UxTalkLog: what was said?
# Opened from the quick menu at Kael's offer (after "What's in it for us?"): the talk so far, the latest line last.
said = [('Kael', False, line(ACCEPT, 'start')),
        ('Kael', False, line(ACCEPT, 'explain')),
        ('Kael', False, line(ACCEPT, 'request')),
        ('The Foundling', True, answers(ACCEPT, 'request')[1]),
        ('Kael', False, line(ACCEPT, 'offer'))]
body = TK.talk_screen([FOUNDLING_L, KAEL_R], 'Kael', 'right', line(ACCEPT, 'offer'), choices=answer_items(ACCEPT, 'offer'))
body += TK.history(said, note='talking with Kael')
write('UxTalkLog', board_html("History · Blood Ties so far, opened at Kael's offer", body))

print('room:', 'stand-in' if TK.room_meta()['standin'] else 'tavern interior', '|', TK.room_meta().get('why', ''))
