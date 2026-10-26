"""F64Title in 1x pixel art: the title screen over a deep daylight view east, the company on the road at 1:1 with
its standard, the road running on to a stone bridge square across the river, the village over the bridge.

The UI layer is F64Title's, copied unchanged from dirs/f64-pages/gen_title.py (the wordmark at 86 px, "a tactical
roguelite", the menu with New run pointed at and Quit); only the world under it changes, now one pixel PNG from
title_scene.py at exactly 1:1.

Usage: python gen_title.py            (writes out/boards/F64Title.dc.html)
"""
import base64
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, ROOT + '/src/kit64')
sys.path.insert(0, HERE)
from kit import *            # noqa: E402,F401,F403
import title_scene as TS     # noqa: E402


def world():
    st, info = TS.compose()
    im = st.render().convert('RGB')
    os.makedirs(os.path.join(HERE, 't'), exist_ok=True)
    im.save(os.path.join(HERE, 't', 'title_world.png'))
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    return (f'<img class="abs" alt="" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
            f'width="1280" height="720" src="{uri}">'), len(uri)


WORD = 86   # the wordmark: Jacquard 24 at exactly 2x its 43 px grid (the one size exception: the game's name on its title)

OL2 = ','.join(f'{dx}px {dy}px 0 #110d0a' for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2) if (dx, dy) != (0, 0))
EXTRA = f""".f64 .word{{font-family:'Jacquard 24',serif;font-size:{WORD}px;line-height:{WORD}px;font-weight:400;color:#f0d488;white-space:nowrap;
  text-shadow:{OL2},2px 4px 0 #110d0a,0 4px 0 #110d0a,4px 4px 0 rgba(17,13,10,.6)}}"""


def title_block(x, y):
    """The game's name laid on the world, lettered like the map's place names (ink edge and drop) at 2x."""
    out = f'<div class="abs word" style="left:{x}px;top:{y}px">Embermarch</div>'
    out += T(x + 6, y + WORD + 4, 'a tactical roguelite', 's18 it bone ol1d')
    return out


def menu_window(x, y, w):
    """The real menu (no run parked; desktop shell, so Quit shows). New run is the brass one and it is pointed at."""
    bw = w - 2 * PAD
    body = button('New run', 'primary', 'hover', w=bw, x=PAD, y=PAD + 2)
    body += button('Quit', 'secondary', 'idle', w=bw, x=PAD, y=PAD + 52)
    body += groove(PAD, PAD + 100, bw)
    body += T(0, PAD + 112, 'steel remembers', 's14 it dim', w=w, align='center')
    return window(x, y, w, PAD + 146, body)


if __name__ == '__main__':
    body, n = world()
    if 'nowin' not in sys.argv:
        body += title_block(80, 150)
        body += menu_window(86, 300, 300)
    write('F64Title', board_html('Title · the company on the road east, pointing at New run', body, 1280, 720, extra_css=EXTRA))
    print('ok', n // 1024, 'KB')
