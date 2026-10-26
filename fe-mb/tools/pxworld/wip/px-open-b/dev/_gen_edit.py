f = 'gen_open_b.py'
s = open(f, encoding='utf-8').read()


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a, s.count(a))
    s = s.replace(a, b)


# ---- the edge boards: the region on the board, the place and its days in the caption beside it
rep('''for e in WB.EXITS:
    sx, sy, bw, bh = e['board_box']
    UI.append((sx - 2, sy - 2, sx + bw + 2, sy + bh + 22))''',
    '''def caption_box(e):
    """The caption's box (x0, y0, x1, y1) and its text: the place the road leads to and its days."""
    sx, sy, bw, bh = e['board_box']
    cap = f'{NAMES[e["to"]]} · {HOPS[e["to"]]} days'
    cw = text_w(cap, 7.1)
    tip = 10 if e['tip'] else 0
    bx0, bx1 = sx + (tip if e['tip'] == 'w' else 0), sx + bw - (tip if e['tip'] == 'e' else 0)
    if e.get('align') == 'r':
        cx0 = bx1 - cw
    else:
        cx0 = int((bx0 + bx1) / 2 - cw / 2)
    cx0 = max(8, min(1272 - cw, int(cx0)))
    cy0 = sy + bh + 3 if e.get('cap', 'below') == 'below' else sy - 18
    return (cx0, cy0, cx0 + cw, cy0 + 16), cap, (bx0, bx1)


for e in WB.EXITS:
    sx, sy, bw, bh = e['board_box']
    UI.append((sx - 2, sy - 2, sx + bw + 2, sy + bh + 2))
    UI.append(caption_box(e)[0])''')
rep('''def text_w(s, px):
    return int(len(s) * px + .5)


''', '')
rep('''# ------------------------------------------------------------------ UI boxes (windows, the card, the edge boards)''',
    '''def text_w(s, px):
    return int(len(s) * px + .5)


# ------------------------------------------------------------------ UI boxes (windows, the card, the edge boards)''')
rep('''for e in WB.EXITS:
    sx, sy, bw, bh = e['board_box']
    to = e['to']
    parts.append(f'<div class="abs s14 bone nowrap sh1" style="left:{sx}px;top:{sy + 2}px;width:{bw}px;'
                 f'text-align:center;font-weight:700">{NAMES[to]}</div>')
    days = HOPS[to]
    cap = f'{e["region"]} · {days} days'
    cw = text_w(cap, 7.1)
    cx0 = max(8, min(1272 - cw, int(sx + bw / 2 - cw / 2)))
    parts.append(f'<div class="abs s13 bone ol1d nowrap" style="left:{cx0}px;top:{sy + bh + 3}px;width:{cw}px;'
                 f'text-align:center">{cap}</div>')''',
    '''for e in WB.EXITS:
    sx, sy, bw, bh = e['board_box']
    (cx0, cy0, cx1, _), cap, (bx0, bx1) = caption_box(e)
    parts.append(f'<div class="abs s14 bone nowrap sh1" style="left:{bx0}px;top:{sy + 2}px;width:{bx1 - bx0}px;'
                 f'text-align:center;font-weight:700">{e["region"]}</div>')
    parts.append(f'<div class="abs s13 bone ol1d nowrap" style="left:{cx0}px;top:{cy0}px;width:{cx1 - cx0}px;'
                 f'text-align:{"right" if e.get("align") == "r" else "center"}">{cap}</div>')''')
# ---- labels
rep("""PREFER = {'frontier_camp': ['bl', 'b', 'l'], 'riverside_market': ['a', 'al', 'ar'], 'north_ridge_path': ['l', 'al', 'ar'],
          'border_fortress': ['l', 'bl'],""",
    """PREFER = {'frontier_camp': ['bl', 'b', 'l'], 'riverside_market': ['a', 'al', 'ar'], 'north_ridge_path': ['a', 'ar', 'r'],
          'border_fortress': ['bl', 'b', 'l'],""")
# ---- the region window: the copy, the overview's labels and north mark
rep('''  <div class="abs s15 dim nowrap" style="left:20px;top:94px">Roads here: an encounter</div>
  <div class="abs s15 dim nowrap" style="left:20px;top:113px">on <span class="rust">4 hops in 10</span></div>''',
    '''  <div class="abs s15 dim nowrap" style="left:20px;top:94px">Roads here:</div>
  <div class="abs s15 dim nowrap" style="left:20px;top:113px">an encounter on <span class="rust">4 hops in 10</span></div>''')
rep("""for name, (lx, ly), anchor, cls in (('Thornwood', marks['labels']['Thornwood'], 'c', 'bone'),
                                    ('Ashfall', marks['labels']['Ashfall'], 'c', 'bone'),
                                    ('Iron Throne', marks['throne'], 'r', 'bone')):""",
    """for name, (lx, ly), anchor, cls in (('Thornwood', marks['labels']['Thornwood'], 'c', 'bone'),
                                    ('Ashfall', marks['labels']['Ashfall'], 'c', 'bone'),
                                    ('Borderlands', marks['labels']['Borderlands'], 'c', 'bone'),
                                    ('Iron Throne', marks['throne'], 'r', 'bone')):""")
rep("""TITLE = 'Map · open country, the camp at the hub, day 1 at Frontier Camp, pointing at Riverside Market'""",
    """TITLE = 'Map · day 1 at Frontier Camp, pointing at Riverside Market'""")
open(f, 'w', encoding='utf-8').write(s)
print('ok')
