ROOT = __import__('os').path.abspath(__file__ + '/..').replace('\\', '/')   # tools/pxworld
import json, os, re
CAN = ROOT + '/out/boards'

# rows: (note text, [(file, title)]) ; heights read from each board's $preview
def trio(k, n, name, sub=''):
    return (f'{n} · {name}' + (f' · {sub}' if sub else ''), [
        (f'{k}Key.dc.html', f'{n} · {name}'), (f'{k}Map.dc.html', f'{n} · the map, hovering Riverside Market'),
        (f'{k}Combat.dc.html', f'{n} · combat, Blaze aimed at Obsidian Fighter 1'),
    ])
def have(k): return os.path.exists(f'{CAN}/{k}Combat.dc.html')

import glob
def f64(prefixes):
    out = []
    skip = set(filter(None, os.environ.get('F64_SKIP', '').split(',')))
    for pre in prefixes:
        if pre in skip: continue
        for f in sorted(glob.glob(f'{CAN}/F64{pre}*.dc.html')):
            b = os.path.basename(f)
            if b not in [o[0] for o in out]:
                m = re.search(r'<title>(.*?)</title>', open(f, encoding='utf-8').read())
                out.append((b, m.group(1) if m else b[3:-8]))
    return out
F64_ROWS = []
def html_title(f):
    """A board's canvas label is its own <title> ("Screen · the state"), so the label and the board cannot drift."""
    m = re.search(r'<title>(.*?)</title>', open(f'{CAN}/{f}', encoding='utf-8').read())
    return m.group(1) if m else f[:-8]
# owner 2026-10-24: "go pixel everywhere" -- one board per screen, all on the 1x pixel world; the painted
# Hyb64Map, F64Town* and F64Camp are superseded by their Px boards (they stay in the artifact's history)
PX_ROWS = [
    ('The map, the town and the camp', ['PxMap1x', 'PxTownInn', 'PxTownShop', 'PxTownTavern', 'PxCamp']),
    ('Combat, the enemy turn and the dungeon', ['Hyb64Combat', 'F64CombatEnemy', 'F64Dungeon']),
    ('The company, contracts and pause', ['F64Company', 'F64Contracts', 'F64Pause']),
    ('Dialogue, checks and naming', ['F64Dialogue', 'F64Check', 'F64Name']),
    ('Title, prologue, the field report, win and loss', ['F64Title', 'F64Prologue', 'F64Report', 'F64Win', 'F64Lost']),
    ('The key and the kit · every shared piece, in every state', ['Hyb64Key', 'KitControls', 'KitPanels']),
]
SUPERSEDED = ['Hyb64Map', 'F64TownInn', 'F64TownShop', 'F64TownTavern', 'F64Camp', 'PxMap2x']
for label, keys in PX_ROWS:
    items = [(f'{k}.dc.html', html_title(f'{k}.dc.html')) for k in keys if os.path.exists(f'{CAN}/{k}.dc.html')]
    if items: F64_ROWS.append((label, items))
TIERS = [('HybPixel', '8-bit', 'Cartridge over the Painted Country', 'the one the owner picked, 3px per art pixel'),
         ('Hyb16', '16-bit', 'the SNES tier', '2px per art pixel'), ('Hyb64', '64-bit', 'the last sprite generation', '1px per art pixel')]
ROUND4 = [trio(*t) for t in TIERS if have(t[0]) and not (t[0] == 'Hyb64' and any(r[1][0][0] == 'Hyb64Key.dc.html' for r in F64_ROWS))] if have('Hyb16') or have('Hyb64') else []
HYB = [('HybSaga', '1', 'Saga over the Painted Country', 'C’s world, D’s UI')] + ([] if ROUND4 else [('HybPixel', '2', 'Cartridge over the Painted Country', 'C’s world, A’s UI')])
ROUND3 = [trio(*h) for h in HYB if have(h[0])]
DIRS = [('DirPixel', 'A', 'Pixel Cartridge'), ('DirTactical', 'B', 'Field Command'), ('DirCamp', 'C', 'Oak, Iron and Wool'),
        ('DirPainted', 'D', 'Gouache Saga'), ('DirHeraldry', 'E', 'Console Heraldry')]
ROUND2 = [trio(*d) for d in DIRS if have(d[0])]
ROUND5 = [trio('HybMix', '64 + 16', '64-bit UI, 16-bit art', 'Filigree’s frames, layout and type, drawn at SNES grain')] if have('HybMix') else []
SECTIONS = [(r, h) for r, h in [
    (F64_ROWS, 'Filigree over the pixel world · the house style, chosen by the owner 2026-10-24 · every screen'),
    (ROUND5, 'Round 5 · the owner asked for the 64-bit UI with 16-bit art'),
    (ROUND4, 'Round 4 · the pixel UI won · the same UI at three fidelities, 8-bit, 16-bit and 64-bit · pick the tier'),
    (ROUND3, 'Round 3 · C’s world under D’s UI' + (' (the pixel pairing won and moved up to round 4)' if ROUND4 else ' and under A’s UI · pick the UI')),
    (ROUND2, 'Round 2 · five directions, none of them paper'),
] if r]
SECTIONS = SECTIONS[:1]  # owner trimmed the old rounds 2026-10-24
ROWS, STARTS = [], []
for r, h in SECTIONS:
    STARTS.append(len(ROWS)); ROWS += r
OLD_ROWS = [
    ('Round 1 · the paper proposal, rejected by the owner 2026-10-24 · kept for the audit and the state grammar', [
        ('Main.dc.html', '0 · The game as it stands'),
    ]),
    ('1 · The audit — every element, catalogued and ranked', [
        ('Catalogue.dc.html', '1 · The element catalogue'),
        ('RootCauses.dc.html', '1a · Eight root causes'),
        ('P0.dc.html', '1b · The twenty-one P0s'),
    ]),
    ('2 · The proposal — Saddle, Sheet and Seal (the element system, chosen 3–0)', [
        ('System1.dc.html', '2 · Materials and light'),
        ('System2.dc.html', '2a · One voice per job'),
        ('System3.dc.html', '2b · One state grammar'),
        ('System4.dc.html', '2c · Colour, motion, tokens'),
    ]),
    ('3 · The map screen — The Surveyed Sheet (chosen 3–0)', [
        ('Map.dc.html', '3 · The Surveyed Sheet'),
    ]),
    ('4 · The first twenty-four elements — now, proposed, every state', [
        ('E1.dc.html', '4a · The strap tab'), ('E2.dc.html', '4b · Gauges and tallies'), ('E3.dc.html', '4c · Faces and rows'),
        ('E4.dc.html', '4d · One bubble'), ('E5.dc.html', '4e · One paper, one table'), ('E6.dc.html', '4f · One plate'),
        ('E7.dc.html', '4g · Glyphs and empty places'), ('E8.dc.html', '4h · Marks and the field'),
    ]),
    ('5 · The other screens — composed from the same system', [
        ('ScrCombat.dc.html', '5 · Combat · The Field Table'), ('ScrTown.dc.html', '5a · Town · The Tariff and the Tray'),
        ('ScrCamp.dc.html', '5b · Camp · The Watch Fire'), ('ScrDungeon.dc.html', '5c · Dungeon · The Chart Cut in Stone'),
        ('ScrLoadout.dc.html', '5d · Company · The Muster Page'), ('ScrLedger.dc.html', '5e · Title, report, win, lose'),
        ('ScrInterrupts.dc.html', '5f · Pause, contracts, talk, check, name'),
    ]),
    ('6 · The rest of the catalogue — every remaining element, family by family', [
        ('F0.dc.html', '6 · Controls, portraits, icons, meters'), ('F1.dc.html', '6a · Lists, cards and board tokens'),
        ('F2.dc.html', '6b · Panels: combat and the loadout'), ('F3.dc.html', '6c · Panels: pages and scenes'),
        ('F4.dc.html', '6d · Feedback and motion'), ('F5.dc.html', '6e · Typography and labels'),
    ]),
    ('7 · Building it — the order, and what the owner decides', [
        ('Build.dc.html', '7 · The build order'), ('Ledger.dc.html', '7a · Open questions and the critic’s ledger'),
    ]),
]
OLD_ROWS = []
OLD_START = len(ROWS) - len(OLD_ROWS)
APPENDIX = ('Appendix · the full element index', [
        ('IndexA.dc.html', '1c · Full index, families 1–4'),
        ('IndexB.dc.html', '1d · Full index, families 5–13'),
    ])
extra = os.environ.get('ROWS_EXTRA')
if extra:
    ROWS += json.load(open(extra, encoding='utf-8'))

def size(f):
    s = open(f'{CAN}/{f}', encoding='utf-8').read()
    m = re.search(r'"\$preview":\{"width":(\d+),"height":(\d+)\}', s)
    return int(m.group(1)), int(m.group(2))

boards, order, notes = {}, [], {}
y = 0
for i, (note, items) in enumerate(ROWS):
    if i > 0: y += 120 + 260 + (420 if i in STARTS[1:] + [OLD_START] else 0)
    notes[f'row{i}'] = {'x': 0, 'y': y - 300 if i == 0 else y - 260, 'text': note, 'kind': 'title1', 'maxW': 3200}
    x = 0; rowh = 0
    for f, title in items:
        w, h = size(f)
        boards[f] = {'x': x, 'y': y, 'w': w, 'h': h, 'title': title}
        order.append(f)
        x += w + 80; rowh = max(rowh, h)
    y += rowh

def head_y(i):  # just above row i's own note
    return notes[f'row{i}']['y'] - 340
for (r, h), st in zip(SECTIONS, STARTS):
    notes[f'sec{st}'] = {'x': 0, 'y': head_y(st), 'text': h, 'kind': 'title1', 'maxW': 3200}
cj = {'v': 3, 'createdOnFiles': {'v': 1, 'at': '2026-10-17T18:40:00Z'}, 'title': 'Embermarch UI Proposal',
      'launch': {'view': 'canvas'}, 'pages': [], 'boards': boards, 'order': order, 'notes': notes, 'designSystems': []}
json.dump(cj, open(f'{CAN}/canvas.json', 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
for f, b in boards.items(): print(f'{f:28s} x={b["x"]:6d} y={b["y"]:6d} {b["w"]}x{b["h"]}')
