"""Export the big country to the game (game/): the data its engine runs on and the art its map screen draws.

    python src/px-big-b/export_game.py          (from tools/pxworld; about two minutes: it renders the country twice)

Writes
    game/src/content/data/overworld/world.json   the sheet: all 195 places and 268 roads (owner 2026-10-25: variant B
                                                 at four times the area; tier bands 4 / 10, owner 2026-10-26)
    game/src/content/data/towns/<id>.json        a town for each new TOWN place, from a town of its region
    game/src/content/data/dungeons/<id>.json     a dungeon for each new DUNGEON place, from a dungeon of its region
    game/src/ui/overworld/sheetArt.json          where the art sits on the sheet: the drawn heartland, each place's
                                                 sprite box and name box, the roads as drawn, the exit signs
    game/public/art/world/                       heart.png (the heartland at 1x, no company), overview.png, company.png
    game/public/art/ui/                          the Filigree frames as 9-slices and the map's small pieces

Only the heartland (the Borderlands, 62 places) is drawn. Places beyond it are in the data, with no art yet.
The game's ids for the wild places are slugs of their names (pxworld keys them w001...). Existing towns and
dungeons are never overwritten; a place the game already has keeps its event, lock, boss group and board.
"""
import json
import os
import re
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../..').replace('\\', '/')          # tools/pxworld
GAME = os.path.abspath(ROOT + '/../../game').replace('\\', '/')
sys.path.insert(0, HERE)
import gen_boards as G                    # noqa: E402  (renders the heartland once, with the company in the camp)
import geo                                # noqa: E402
import icons64 as I                       # noqa: E402
import land as LD                         # noqa: E402
import overview as OV                     # noqa: E402
import px64 as PX                         # noqa: E402
import world_big as WB                    # noqa: E402
from pxworld import folk as FK            # noqa: E402
from pxworld.canvas import Canvas         # noqa: E402

OFF = (1360, 880)                         # sheet px of pxworld's (0, 0): every place lands at x, y >= 0
DATA = GAME + '/src/content/data'
ART = GAME + '/public/art'
BANDS = (4, 10)
REGION = {'borderlands': 'Borderlands', 'thornwood': 'Thornwood', 'ashfall': 'Ashfall'}


def slug(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower().replace("'", '')).strip('_')


ID = {k: (slug(LD.NAMES[k]) if re.fullmatch(r'w\d+', k) else k) for k in LD.NODE}
assert len(set(ID.values())) == len(ID), 'two places slug to one id'


def sheet(p):
    return (int(round(p[0] + OFF[0])), int(round(p[1] + OFF[1])))


def dump(path, obj, compact=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        if compact:
            json.dump(obj, fh, ensure_ascii=False, separators=(',', ':'))
        else:
            json.dump(obj, fh, ensure_ascii=False, indent=2)
        fh.write('\n')


# ---------------------------------------------------------------- the sheet
def export_world():
    path = DATA + '/overworld/world.json'
    old = json.load(open(path, encoding='utf-8'))
    old_nodes = {n['id']: n for n in old['nodes']}
    old_edges = {'|'.join(sorted((e['from'], e['to']))): e for e in old['edges']}
    hops = LD.hops()
    order = [k for k in old_nodes if k in LD.NODE] + [k for k in LD.NODE if k not in old_nodes]
    nodes = []
    for k in order:
        n, was = LD.NODE[k], old_nodes.get(k, {})
        x, y = sheet(LD.P[k])
        out = {'id': ID[k], 'name': n['name'], 'type': n['type'], 'regionId': n['region'],
               'areaTier': LD.tier(hops[k], BANDS) if k in hops else was.get('areaTier', 1), 'position': {'x': x, 'y': y}}
        if n['type'] == 'BOSS':
            out['areaTier'] = 3
        if n.get('sigil'):
            out['sigil'] = n['sigil']
        for key in ('hidden', 'locked'):
            if n.get(key) or was.get(key):
                out[key] = True
        for key in ('enemyGroupId', 'discoveryEventId', 'battlefieldId'):
            if key in was:
                out[key] = was[key]
        nodes.append(out)
    edges, seen = [], set()
    for a, b, table in LD.roads():
        key = '|'.join(sorted((ID[a], ID[b])))
        seen.add(key)
        e = {'from': ID[a], 'to': ID[b], 'encounterTableId': table}
        if 'rollChance' in old_edges.get(key, {}):
            e['rollChance'] = old_edges[key]['rollChance']
        edges.append(e)
    hidden = {ID[k] for k, n in LD.NODE.items() if n.get('hidden')}
    for key, e in old_edges.items():                          # the roads to hidden places are the game's own
        if key not in seen and (e['from'] in hidden or e['to'] in hidden):
            edges.append(e)
    xs = [n['position']['x'] for n in nodes]
    ys = [n['position']['y'] for n in nodes]
    world = {'id': old['id'], 'name': old['name'], 'width': max(xs) + 100, 'height': max(ys) + 82,
             'startNodeId': old['startNodeId'], 'nodes': nodes, 'edges': edges}
    dump(path, world)
    print('world.json', len(nodes), 'places', len(edges), 'roads', world['width'], 'x', world['height'],
          'throne at', hops['the_iron_throne'], 'hops')
    return old_nodes


TOWN_OF = {'borderlands': 'south_junction', 'thornwood': 'thornwood_chapel', 'ashfall': 'ashfall_outpost'}
TOWN_SAYS = {'borderlands': 'A village on the Borderlands roads, with an inn and a few stalls.',
             'thornwood': 'A clearing under the Thornwood, held by woodsmen who trade with whoever passes.',
             'ashfall': 'A walled yard in the ash, where the last traders before the throne keep their stock.'}
DUNGEON_OF = {'borderlands': ['smugglers_cave'], 'thornwood': ['thornwood_depths', 'ancient_ruins'],
              'ashfall': ['iron_mine', 'obsidian_cavern']}


def export_places(old_nodes):
    """A town or dungeon def for each new TOWN / DUNGEON place (lint: a node of either type needs one)."""
    made = {'towns': [], 'dungeons': []}
    turn = {}
    for k, n in LD.NODE.items():
        if k in old_nodes or n['type'] not in ('TOWN', 'DUNGEON'):
            continue
        kind = 'towns' if n['type'] == 'TOWN' else 'dungeons'
        path = f'{DATA}/{kind}/{ID[k]}.json'
        made[kind].append(ID[k])
        if os.path.exists(path):
            continue
        r = n['region']
        if kind == 'towns':
            d = json.load(open(f'{DATA}/towns/{TOWN_OF[r]}.json', encoding='utf-8'))
            d.update(id=ID[k], name=n['name'], description=TOWN_SAYS[r], regionId=r, tavernQuests=[])
        else:
            pool = DUNGEON_OF[r]
            src = pool[turn.get(r, 0) % len(pool)]
            turn[r] = turn.get(r, 0) + 1
            d = json.load(open(f'{DATA}/dungeons/{src}.json', encoding='utf-8'))
            d.update(id=ID[k], name=n['name'], regionId=r)
        dump(path, d)
    print('new towns', made['towns'])
    print('new dungeons', made['dungeons'])


# ---------------------------------------------------------------- the art
def raster_png(R, path):
    im = Image.new('RGBA', (R.w, R.h), (0, 0, 0, 0))
    px = im.load()
    for y in range(R.h):
        for x in range(R.w):
            c = R.px[y][x]
            if c is None:
                continue
            if c.startswith('sh'):
                px[x, y] = (*bytes.fromhex(PX.C['k0'][1:]), round(int(c[2:]) * 2.55))
            else:
                px[x, y] = (*bytes.fromhex(PX.col(c)[1:7]), 255)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)
    return im


def export_ui():
    ui = ART + '/ui'
    # the kit's own stylesheet, as the boards carry it (type, colours, buttons, commands, tabs, inputs, keys), scoped .f64
    sys.path.insert(0, ROOT + '/src/kit64')
    import kit as K
    with open(GAME + '/src/styles/filigree-kit.css', 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('/* GENERATED by tools/pxworld/src/px-big-b/export_game.py from kit64/kit.py: do not edit by hand.\n'
                 '   The Filigree kit (owner 2026-10-24), every rule scoped under .f64. The game\'s own pieces are in filigree.css. */\n')
        fh.write(K._css().strip() + '\n')
        # the palette as tokens, for the game's hand-written sheets (ARCHITECTURE 5: tokens only, no hex outside a palette file)
        toks = ''.join(f'--f-{k}:{v};' for k, v in PX.C.items())
        toks += ''.join(f'--f-fill-{k}:{v[0]};--f-dot-{k}:{v[1]};' for k, v in PX.FILL.items())
        fh.write('.f64{' + toks + '}\n')
    for kind, shadow in (('win', 2), ('lit', 2), ('tag', 1), ('taglit', 1), ('plate', 1)):
        raster_png(PX.frame(96, 96, kind, shadow=shadow), f'{ui}/frame_{kind}.png')       # 9-slices (see filigree.css)
    for name, r in (('sun', I.sun()), ('coin', I.coin()), ('ration', I.ration()), ('potion', I.potion()),
                    ('arrow_e', I.arrow_e()), ('padlock', I.padlock())):
        raster_png(r, f'{ui}/icon_{name}.png')
    BEAD = ["..kkkkk..", ".k66655k.", "k6665544k", "k6655443k", "k6554433k", "k5544332k", "k4443322k", ".k33322k.", "..kkkkk.."]
    for name, km in (('bead_brass', {'6': 'o6', '5': 'o5', '4': 'o4', '3': 'o3', '2': 'o1'}),
                     ('bead_bone', {'6': 'b5', '5': 'b4', '4': 'b3', '3': 'b2', '2': 'b0'})):
        r = PX.Raster(9, 9)
        r.stamp(BEAD, 0, 0, keymap=dict(km, k='k0'))
        raster_png(r, f'{ui}/{name}.png')
    raster_png(I.brackets(0, 0, 48, 48), f'{ui}/brackets.png')                             # a 9-slice: corners only
    PIN = ["..kkk..", ".k565k.", "k56654k", "k56543k", ".k443k.", "..k3k..", "..k2k..", "..k2k..", "..k1k..", "...k..."]
    raster_png(PX.from_rows(PIN, PX.BR), f'{ui}/pin.png')
    rule = PX.Raster(41, 7)
    rule.stamp(PX.LOZENGE, 41 // 2 - 4, 0, keymap=PX.BR)
    for dx in (-12, 11):
        rule.stamp(PX.RIVET, 41 // 2 + dx, 2, keymap=PX.BR)
    raster_png(rule, f'{ui}/rule_orn.png')
    print('ui pieces written to', ui)


def export_art():
    world = ART + '/world'
    os.makedirs(world, exist_ok=True)
    cv0, info = WB.render(company=False)
    cv0.save(world + '/heart.png')
    ov, marks = OV.overview(156, 104, view=(-10 ** 6, -10 ** 6, 1, 1))     # the view frame is the game's to draw
    ov.save(world + '/overview.png')
    s, cx, cy = OV.frame_of(156, 104)
    # the company: pxworld's three minis under the standard, on their contact shadows
    CW, CH, FX, FY = 64, 60, 32, 52
    cv = Canvas(CW, CH)
    items = sorted(FK.company_items(1), key=lambda it: it[2])
    for spr, dx, dy in items:
        cv.stamp(spr, FX + dx, FY + dy)
    im = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for spr, dx, dy in items:
        d.ellipse((FX + dx + 1 - 5, FY + dy + 1 - 2, FX + dx + 1 + 5, FY + dy + 1 + 2), fill=(18, 22, 10, 96))
    im.alpha_composite(cv.image().convert('RGBA'))
    im.save(world + '/company.png', optimize=True)
    # the name boxes: one layout for the whole heartland, roomy enough for a plate (the roads out of the stop)
    keys = [k for k in WB.HEART_KEYS]
    signs = info['signs']
    avoid = [(e['board_box'][0] - 2, e['board_box'][1] - 2, e['board_box'][0] + e['board_box'][2] + 2,
              e['board_box'][1] + e['board_box'][3] + 20) for e in signs]

    def has_sub(k):
        return k in G.LANDMARK or LD.NODE[k].get('locked')

    def label_size(k):
        return G.text_w(LD.NAMES[k], 8.9) + 22, 26 + (18 if has_sub(k) else 0)
    W, H = LD.HEART_WH
    LBL, rep = G.place_labels(keys, (0, 0, W, H), avoid, lambda k: 'here' if k == 'frontier_camp' else 'q', label_size,
                              prefer={'frontier_camp': ['bl', 'b', 'l'], 'riverside_market': ['a', 'al', 'ar']})
    for r in rep:
        if r[2] > 60:
            print('label', r)
    roads = {}
    for (a, b), fine in info['road_px'].items():
        pts = geo.resample(fine, 4.0)
        roads[f'{ID[a]}|{ID[b]}'] = [v for p in pts for v in sheet(p)]
    fx, fy = G.info['company']
    art = {
        'heart': {'x': OFF[0], 'y': OFF[1], 'w': W, 'h': H},
        'campStand': list(sheet((fx, fy))),
        'company': {'w': CW, 'h': CH, 'ax': FX, 'ay': FY},
        'overview': {'w': 156, 'h': 104, 'scale': s, 'cx': cx + OFF[0], 'cy': cy + OFF[1],
                     'labels': {name: [round(p[0]), round(p[1])] for name, p in marks['labels'].items()},
                     'throne': [round(marks['throne'][0]), round(marks['throne'][1])]},
        'feet': {ID[k]: [*sheet(G.foot(k)[:2]), *sheet(G.foot(k)[2:])] for k in keys},
        'labels': {ID[k]: [*sheet(b[:2]), int(b[2] - b[0]), int(b[3] - b[1])] for k, b in LBL.items()},
        'roads': roads,
        'signs': [{'x': e['board_box'][0] + OFF[0], 'y': e['board_box'][1] + OFF[1], 'w': e['board_box'][2],
                   'h': e['board_box'][3], 'tip': e['tip'] or '', 'region': e['region'], 'to': ID[e['to']]} for e in signs],
    }
    dump(GAME + '/src/ui/overworld/sheetArt.json', art, compact=True)
    print('art:', len(art['feet']), 'places drawn,', len(roads), 'roads,', len(signs), 'signs;',
          os.path.getsize(world + '/heart.png') // 1024, 'KB heart.png')


if __name__ == '__main__':
    want = sys.argv[1:] or ['world', 'ui', 'art']
    if 'world' in want:
        export_places(export_world())
    if 'ui' in want:
        export_ui()
    if 'art' in want:
        export_art()
