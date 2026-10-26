"""F64Prologue in 1x pixel art: the opening beat inside Frontier Camp in the morning sun, the gate open on the roads
east; the talk box carries the prologue's words.

The UI layer is F64Prologue's, copied unchanged from dirs/f64-pages/gen_prologue.py: the place plate, and Bagrat
"Oak"'s line (the prologue's fourth beat, read from game/) in the kit's dialogue() with Continue pointed at. Only the
world under it changes, now one pixel PNG from prologue_scene.py at exactly 1:1, drawn with PxCamp's technique.

Usage: python gen_prologue.py         (writes out/boards/F64Prologue.dc.html)
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
REPO = __import__('os').path.abspath(ROOT + '/../..').replace('\\', '/')   # the repo root
import base64
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, ROOT + '/src/kit64')
sys.path.insert(0, HERE)
from kit import *            # noqa: E402,F401,F403
import prologue_scene as PS  # noqa: E402

PRO = json.load(open(REPO + '/game/src/content/data/dialogue/prologue.json', encoding='utf-8'))
NODE = PRO['nodes']['intro_4']           # the fourth beat of six: Oak, on the roads (speaker 'oak')
assert NODE['speaker'] == 'oak'
LINE = NODE['text']
CHOICE = NODE['choices'][0]['text']      # 'Continue'


def world():
    st, info = PS.compose()
    im = st.render().convert('RGB')
    os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
    im.save(os.path.join(HERE, 't', 'prologue_world.png'))
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    return (f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
            f'width="1280" height="720" src="{uri}">'), len(uri)


if __name__ == '__main__':
    body, n = world()
    body += plate('Frontier Camp', x=EDGE, y=EDGE)
    body += dialogue(190, 524, 900, 182, 'face_marcus', 'Bagrat "Oak"', LINE, choices=[dict(text=CHOICE, state='hover')])
    write('F64Prologue', board_html("Prologue · Oak's word at Frontier Camp, Continue pointed at", body, 1280, 720))
    print('ok', n // 1024, 'KB')
