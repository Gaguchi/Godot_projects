"""Export the town's art to the game (game/): the worlds its one-job screens stand on, with nobody the game places.

    python src/ux-town/export_game.py            (from tools/pxworld; each scene runs in its own process, because the
                                                 scene folders forked same-named helpers: see ../../README.md)

Writes
    game/public/art/town/square.png        the square at 1x, 1280 x 720, without the company
    game/public/art/town/fig_<who>.png     the company's three town-scale figures, for the square
    game/public/art/town/inn_room.png      the inn's common room, without the company
    game/public/art/town/tavern_room.png   the tavern with its barkeep and drinkers, without the guest at the table
    game/public/art/town/market.png        the market street behind the counter
    game/public/art/ui/num_<c>.png         the kit's cast numerals at 22 px (ochre), one glyph a file
    game/public/art/ui/kicon_<name>.png    the kit's icons the town screens use
    game/src/ui/town/townArt.json          where things stand in those pictures (stage px)

The game stands its own people: the company's figures in the square, their board sprites in the inn, and whoever has
work in the tavern at the guest's table. The boards' generators are untouched in what they draw by default.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../..').replace('\\', '/')            # tools/pxworld
GAME = os.path.abspath(ROOT + '/../../game').replace('\\', '/')
ART = GAME + '/public/art'
PART = HERE + '/t/export'                                              # each scene's numbers, merged at the end


def note(name, obj):
    os.makedirs(PART, exist_ok=True)
    with open(f'{PART}/{name}.json', 'w', encoding='utf-8') as fh:
        json.dump(obj, fh)


def box4(b):
    return [int(v) for v in b]


def square():
    sys.path.insert(0, HERE)
    import uxscene as SC
    cv, info = SC.render(None)
    os.makedirs(ART + '/town', exist_ok=True)
    cv.crop(0, 0, 1280, 720).save(ART + '/town/square.png')
    figs = {}
    for who, dx, dy in SC.COMPANY_SPOTS:
        spr = SC.FT.figure(who)
        spr.save(f'{ART}/town/fig_{who}.png')
        figs[who] = {'w': spr.w, 'h': spr.h, 'ax': spr.ax, 'ay': spr.ay, 'dx': dx, 'dy': dy}
    note('square', {
        'box': {k: box4(v) for k, v in info['box'].items()},
        'company': list(info['company']), 'figures': figs,
        # the plates under the three doors and at the two ways out (gen_ux_town.py town())
        'plates': {'inn': [582, 474], 'shop': [778, 474], 'tavern': [962, 474]},
        'roads': [[96, SC.POST[1] + 38], [1190, 452]],
    })


def inn():
    sys.path.insert(0, HERE)
    import innroom as IR
    room, info = IR.render(company=False)
    room.save(ART + '/town/inn_room.png')
    note('inn', {
        'counter': box4(info['counter']), 'keeper': box4(info['keeper']),
        # where each of the company stands, as the foot of a 104 x 152 board sprite; the room has three spots
        'spots': [list(IR.COMPANY_AT[k]) for k in ('lilina', 'roy', 'marcus')],
        'feet': {k: list(v) for k, v in IR.FEET.items()},
    })


def tavern():
    sys.path.insert(0, ROOT + '/src/ux-tavern')
    import interior as IN
    room, info = IN.render(guest=False)
    room.save(ART + '/town/tavern_room.png')
    note('tavern', {
        'guest': {'foot': list(info['kael']['foot']), 'box': box4(info['kael']['box']), 'spriteFoot': list(IN.KAEL_SPRITE_FOOT)},
        'barkeep': {'box': box4(info['barkeep']['box']), 'plate': [info['barkeep']['foot'][0], info['bar']['top_y'] + 34]},
        'desk': {'box': box4(info['bounty_desk']['box']), 'plate': list(info['bounty_desk']['plate'])},
    })


def market():
    sys.path.insert(0, ROOT + '/src/ux-market')
    import market_scene as MS
    cv, info = MS.render()
    cv.save(ART + '/town/market.png')
    note('market', {'w': cv.w, 'h': cv.h})


def kit():
    """The kit's cast numerals and icons, as files: the game sets a changing number glyph by glyph, at 1:1."""
    from PIL import Image
    sys.path.insert(0, ROOT + '/src/kit64')
    import kit_px as KP
    import kit_icons as KI

    def png(R, path):
        im = Image.new('RGBA', (R.w, R.h), (0, 0, 0, 0))
        px = im.load()
        for y in range(R.h):
            for x in range(R.w):
                c = R.px[y][x]
                if c is None:
                    continue
                if c.startswith('sh'):
                    px[x, y] = (*bytes.fromhex(KP.C['k0'][1:]), round(int(c[2:]) * 2.55))
                else:
                    px[x, y] = (*bytes.fromhex(KP.col(c)[1:7]), 255)
        im.save(path, optimize=True)
        return im

    glyphs = {}
    names = {'→': 'to', '/': 'slash', '-': 'dash', '+': 'plus'}
    for ch in '0123456789→/-+':
        R = KP.numeral(ch, 22, 'Ochre')
        name = names.get(ch, ch)
        png(R, f'{ART}/ui/num_{name}.png')
        glyphs[ch] = {'f': name, 'w': R.w, 'h': R.h}
    icons = {}
    for name in sorted(KI.REGISTRY):                # every kit icon: goods, places, verbs
        R = KI.get(name)
        png(R, f'{ART}/ui/kicon_{name}.png')
        icons[name] = [R.w, R.h]
    png(KI.arrow_e(9), f'{ART}/ui/row_arrow.png')
    note('kit', {'numerals': glyphs, 'icons': icons, 'itemIcon': dict(KI.ITEM_ICON)})


PARTS = {'square': square, 'inn': inn, 'tavern': tavern, 'market': market, 'kit': kit}

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] in PARTS:
        PARTS[sys.argv[1]]()
        print('exported', sys.argv[1])
        sys.exit(0)
    for name in PARTS:
        subprocess.run([sys.executable, os.path.abspath(__file__), name], check=True, cwd=ROOT)
    out = {}
    for name in PARTS:
        with open(f'{PART}/{name}.json', encoding='utf-8') as fh:
            out[name] = json.load(fh)
    with open(GAME + '/src/ui/town/townArt.json', 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write('\n')
    print('townArt.json written')
