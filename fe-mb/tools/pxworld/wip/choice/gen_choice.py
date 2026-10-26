"""The map-choice canvas: one row per choice (today, A, B, C), an explainer board beside the map board it makes.

The owner, 2026-10-25, on the A/B/C question: "I don't understand what I'm choosing can you create a separate canvas
with just the choices". Each explainer shows the whole country large (drawn by the variant's own overview code, see
ov_a.py and ov_b.py, which must run first) and says in plain words what the choice means, costs and gives up.

    cd <scratchpad> && python dirs/choice/ov_a.py 600 500 190 && python dirs/choice/ov_b.py 600 500 && python dirs/choice/gen_choice.py

Writes choice-canvas/project/{ChoiceToday,ChoiceA,ChoiceB,ChoiceC,PxMap1x,PxOpenA,PxOpenB,PxOpenC}.dc.html and
canvas.json. The map boards are copies of the main canvas's, with every /_blob/ image inlined, because a new canvas
does not hold the main canvas's assets.
"""
import base64
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
SP = os.path.dirname(DIRS)
sys.path.insert(0, os.path.join(DIRS, 'hyb-64'))
import px64 as P                                                     # noqa: E402
from px64 import window, rule, css_base, wrap                        # noqa: E402

OUT = os.path.join(SP, 'choice-canvas', 'project')
os.makedirs(OUT, exist_ok=True)
PIN = ["..kkk..", ".k565k.", "k56654k", "k56543k", ".k443k.", "..k3k..", "..k2k..", "..k2k..", "..k1k..", "...k..."]


def uri(path):
    return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def lab(text, x, y, cls='bone', size='s16'):
    return (f'<div class="abs {size} {cls} ol1d nowrap" style="left:{int(x) - 80}px;top:{int(y) - 10}px;width:160px;'
            f'text-align:center">{text}</div>')


def country(k, box_w=600, box_h=520):
    """The overview picture with its labels, centred in a box_w x box_h area."""
    meta = json.load(open(os.path.join(HERE, 't', f'ov_{k}.json')))
    w, h = meta['w'], meta['h']
    ox, oy = (box_w - w) // 2, (box_h - h) // 2
    s = (f'<img class="abs" alt="" style="left:{ox}px;top:{oy}px;width:{w}px;height:{h}px;image-rendering:pixelated" '
         f'width="{w}" height="{h}" src="{uri(os.path.join(HERE, "t", f"ov_{k}.png"))}">')
    names = {'borderlands': 'Borderlands', 'thornwood': 'Thornwood', 'ashfall': 'Ashfall'}
    for r, (x, y) in meta['labels'].items():
        if r in names:
            s += lab(names[r], ox + x, oy + y + (22 if r == 'borderlands' else 0))
    cx, cy = meta['camp']
    s += P.from_rows(PIN, P.BR).svg(ox + int(cx) - 3, oy + int(cy) - 9)
    s += lab('the camp', ox + cx, oy + cy - 22, 'straw', 's15')
    tx, ty = meta['throne']
    s += lab('Iron Throne', ox + tx + (40 if tx < 120 else 0), oy + ty + 16, 'straw', 's15')
    return f'<div class="abs" style="left:20px;top:52px;width:{box_w}px;height:{box_h}px">{s}</div>'


CHOICES = [
    ('ChoiceToday', 'today', 'Today · a road east', 'The camp sits at the west end of a long strip, and the land runs one way.', [
        ('On the map', 'The Borderlands, then Thornwood, then Ashfall, then the Iron Throne, in a line from west to east.'),
        ('In a run', 'Roads run both ways, but nothing lies behind the camp, so every run walks east.'),
        ('What you said', '“You have to travel to the right.” Each choice below opens this up in a different way.'),
    ], 'The Iron Throne: <span class="straw">14 hops</span> from the camp.'),
    ('ChoiceA', 'a', 'A · Same roads, moved', 'Today’s roads exactly, drawn so that the camp stands in the middle.', [
        ('On the map', 'Roads leave the camp north, south-west and south, and a sign stands on every edge.'),
        ('In a run', 'Only where things are drawn changes. Thornwood and Ashfall still lie beyond the Borderlands to the '
                     'east and south, and the north and west roads end in dead ends.'),
        ('To build it', 'Almost nothing: new positions for the 47 places. Every test and the balance check pass unchanged.'),
        ('The catch', 'It looks open, but the adventure still lies one way.'),
    ], 'The Iron Throne: <span class="straw">14 hops</span>, as today.'),
    ('ChoiceB', 'b', 'B · The camp at the hub', 'The Borderlands round the camp, and the wild country in a ring all round them.', [
        ('On the map', 'Thornwood’s forest closes in on the north and east, Ashfall’s burnt hills on the west and south. '
                       'Four roads leave the camp, one each way.'),
        ('In a run', 'Pick any direction. Every road out leads into harder country, and the danger grows the further you '
                     'go from the camp.'),
        ('To build it', 'About a day of data work: 5 roads out, 5 roads in, and 14 places change their danger tier. '
                        'No engine change.'),
        ('The catch', 'As drawn, the Iron Throne is 9 hops away instead of 14, so runs get shorter and the balance check '
                      'fails. Longer roads through Ashfall would keep it as far away as today.'),
    ], 'The Iron Throne: <span class="straw">9 hops</span>, or about <span class="straw">14</span> with longer Ashfall roads.'),
    ('ChoiceC', 'b', 'C · March anywhere', 'B’s country, and the company is no longer tied to the roads.', [
        ('On the map', 'Point at a place and the company cuts across country: roads are quickest, open ground slower, '
                       'forest slower still, and rivers only at bridges and fords.'),
        ('In a run', 'Days and food count the distance walked. On its map board, Scorched Village is 4 days across '
                     'country against 7 by road.'),
        ('To build it', 'About two weeks of engine work on top of B, or 3 to 4 days with agents: travel, encounters, '
                        'scouting, saves and about 25 test files.'),
        ('The catch', 'The biggest change by far, for a gain you mostly feel in Ashfall, where B’s roads go the long way '
                      'round.'),
    ], 'The Iron Throne: <span class="straw">9 days</span> by the quickest march, <span class="straw">11</span> by road.'),
]


CAPTION = {'ChoiceC': 'B’s country, the same as choice B. Only the way you travel changes.',
           'ChoiceToday': 'Drawn from the places and roads the game has today.'}


def explainer(name, ov, title, gist, sections, fact):
    left = window(14, 14, 640, 692, f"""
  <div class="abs s15 dim nowrap" style="left:20px;top:18px">The whole country, north up</div>
  {country(ov)}
  <div class="abs s14 dim" style="left:20px;top:640px;width:600px">{CAPTION.get(name, 'Drawn from the places and roads this choice would give the game.')}</div>
""")
    y = 150
    body = ''
    for head, text in sections:
        body += f'<div class="abs s15 ochre nowrap" style="left:24px;top:{y}px">{head}</div>'
        body += f'<div class="abs s16 bone" style="left:24px;top:{y + 22}px;width:548px;line-height:23px">{text}</div>'
        lines = max(1, -(-len(text) // 74))
        y += 22 + lines * 23 + 22
    right = window(668, 14, 598, 692, f"""
  <div class="abs bl48 straw nowrap" style="left:24px;top:18px;font-size:43px;line-height:43px">{title}</div>
  <div class="abs s18 bone" style="left:24px;top:70px;width:548px;line-height:24px">{gist}</div>
  {rule(24, 132, 550)}
  {body}
  {rule(24, 620, 550)}
  <div class="abs s16 bone" style="left:24px;top:636px;width:548px">{fact}</div>
""", kind='lit' if name == 'ChoiceB' else 'win')
    html = wrap(f'Choice · {title}', left + right, css_base(), 1280, 720)
    open(os.path.join(OUT, f'{name}.dc.html'), 'w', encoding='utf-8').write(html)


for c in CHOICES:
    explainer(*c)

# the map boards, with their canvas images inlined
blob_file = {}
for k, bid in json.load(open(os.path.join(SP, 'mock', 'blobs.json'), encoding='utf-8')).items():
    blob_file[bid] = os.path.join(SP, 'shots', k[5:] + '.png') if k.startswith('shot_') else os.path.join(SP, 'mock', 'up', k + '.png')
for v in json.load(open(os.path.join(SP, 'audit', 'sprites', 'index.json'), encoding='utf-8')).values():
    blob_file[v['blob'].replace('/_blob/', '')] = v['file']
_cache = {}


def inline(m):
    f = blob_file.get(m.group(1))
    if not f or not os.path.exists(f):
        raise SystemExit(f'no local file for blob {m.group(1)}')
    if f not in _cache:
        _cache[f] = uri(f)
    return _cache[f]


MAPS = ['PxMap1x', 'PxOpenA', 'PxOpenB', 'PxOpenC']
for b in MAPS:
    s = open(os.path.join(SP, 'canvas', 'project', f'{b}.dc.html'), encoding='utf-8').read()
    s = re.sub(r'/_blob/([0-9a-f]{32})', inline, s)
    open(os.path.join(OUT, f'{b}.dc.html'), 'w', encoding='utf-8').write(s)

# the canvas: one row per choice
ROWS = [
    ('Today · the land runs in a line and every run walks east. This is what you asked to change.', 'ChoiceToday', 'PxMap1x', 'Today’s map'),
    ('A · the same roads, laid round the camp', 'ChoiceA', 'PxOpenA', 'A · the map screen'),
    ('B · the camp at the hub, the wild country all round · the one I recommend', 'ChoiceB', 'PxOpenB', 'B · the map screen'),
    ('C · B’s country, and the company can leave the roads', 'ChoiceC', 'PxOpenC', 'C · the map screen'),
]
boards, order, notes = {}, [], {}
notes['head'] = {'x': 0, 'y': -640, 'kind': 'title1', 'maxW': 3200,
                 'text': 'What you are choosing: how the world around the camp is laid out. Each row is one choice, '
                         'with the idea on the left and the map screen it makes on the right.'}
for i, (note, ex, mp, mtitle) in enumerate(ROWS):
    y = i * (720 + 380)
    notes[f'row{i}'] = {'x': 0, 'y': y - 260, 'kind': 'title1', 'maxW': 3200, 'text': note}
    boards[f'{ex}.dc.html'] = {'x': 0, 'y': y, 'w': 1280, 'h': 720, 'title': f'{note.split(" · ")[0]} · the idea'}
    boards[f'{mp}.dc.html'] = {'x': 1360, 'y': y, 'w': 1280, 'h': 720, 'title': mtitle}
    order += [f'{ex}.dc.html', f'{mp}.dc.html']
cj = {'v': 3, 'createdOnFiles': {'v': 1, 'at': '2026-10-25T03:30:00Z'}, 'title': 'Embermarch · The Map Choice',
      'launch': {'view': 'canvas'}, 'pages': [], 'boards': boards, 'order': order, 'notes': notes, 'designSystems': []}
json.dump(cj, open(os.path.join(OUT, 'canvas.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
print('wrote', len(boards), 'boards to', OUT)
