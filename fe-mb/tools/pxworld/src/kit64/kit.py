"""Filigree kit (the 64-bit tier over the Painted Country): the one shared component kit for Embermarch boards.

    import sys; sys.path.insert(0, 'tools/pxworld/src/kit64'); from kit import *
    body = world_map() + window(14, 14, 400, 200, T(20, 46, 'Hello', 's16 bone'), title='The Company')
    write('F64Thing', board_html('Thing', body, 1280, 720))

Every function returns an HTML string. Positioned pieces take (x, y) in the coordinates of whatever they are
placed in (the stage, or a window's own 0,0). Inline pieces (button, key, check_tag, price, icon_inline) flow
in text and are placed with T() or a positioned wrapper. See KIT.md for the rules.
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
REPO = __import__('os').path.abspath(ROOT + '/../..').replace('\\', '/')   # the repo root
import json
import math
import os

import kit_icons as _I
import kit_px as _P
from kit_px import B, C, RAMPS, RAMP, Raster, from_rows, frame, numeral, rgba, text_w

SCOPE = 'f64'
FONTS = ('https://fonts.googleapis.com/css2?family=Jacquard+24'
         '&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,600&display=swap')
STAGE_W, STAGE_H = 1280, 720
EDGE = 14          # stage margin
GAP = 12           # gutter between windows
PAD = 20           # content inset inside a window
HEAD_Y = 46        # first content row under a section head
BIG_Y = 64         # first content row under a Jacquard title
MODAL_Y = 90       # first content row under a modal's eyebrow + title

__all__ = ['B', 'C', 'RAMPS', 'RAMP', 'Raster', 'from_rows', 'numeral', 'rgba', 'text_w', 'SCOPE', 'STAGE_W', 'STAGE_H', 'EDGE', 'GAP',
           'PAD', 'HEAD_Y', 'BIG_Y', 'MODAL_Y', 'COMPANY', 'FOES', 'ITEMS', 'item', 'UNIT', 'board_html', 'write', 'T', 'num', 'window', 'plate', 'rule',
           'groove', 'section_head', 'brackets', 'button', 'command', 'key', 'tabs', 'row', 'scrollbar', 'face', 'sprite_well', 'cutin',
           'hp_bar', 'food_pips', 'ap_gems', 'meter', 'bag_cell', 'bag', 'equip_slot', 'tooltip', 'toast', 'switch', 'check_tag',
           'price', 'choice', 'dialogue', 'text_input', 'scrim', 'modal', 'empty_state', 'icon', 'icon_inline', 'ICON_GROUPS',
           'silhouette', 'card', 'side_glyph', 'base_ring', 'ordinal', 'arrow_down', 'hand_cursor', 'pin', 'world_map', 'world_field', 'world_inset',
           'ground', 'backdrop', 'label', 'person']

# ================================================================== real game data (read-only from game/)
GAME = REPO + '/game/src/content/data'
_items = json.load(open(GAME + '/items.json', encoding='utf-8'))
_items = _items if isinstance(_items, list) else list(_items.get('items', _items).values()) if isinstance(_items, dict) else _items
ITEMS = {i['id']: i for i in _items}
_classes = json.load(open(GAME + '/classes.json', encoding='utf-8'))
_classes = _classes if isinstance(_classes, list) else list(_classes.get('classes', _classes).values())
CLASS = {c['id']: c for c in _classes}

COMPANY = [   # HP from BRIEF.md; stats are the class base stats in classes.json
    dict(id='mc', name='The Foundling', face='face_roy', board='board_roy', full='full_roy', cls='Lord', role='Lord · Iron Sword',
         hp=73, max=73, stats=CLASS['lord']['baseStats'], gear=('iron_sword', None)),
    dict(id='oak', name='Bagrat "Oak"', face='face_marcus', board='board_marcus', full='full_marcus', cls='Shield Knight',
         role='Shield Knight · Iron Lance, Iron Buckler', hp=84, max=84, stats=CLASS['shield_knight']['baseStats'], gear=('iron_lance', 'iron_buckler')),
    dict(id='lilina', name='Lilina', face='face_lilina', board='board_lilina', full='full_lilina', cls='Mage', role='Mage · Fire Tome',
         hp=62, max=62, stats=CLASS['mage']['baseStats'], gear=('fire_tome', None)),
]
FOES = [
    dict(id='of1', name='Obsidian Fighter 1', face='face_bandit', board='board_bandit', full='full_bandit', hp=103, max=103),
    dict(id='of2', name='Obsidian Fighter 2', face='face_bandit', board='board_bandit', full='full_bandit', hp=103, max=103),
    dict(id='mage', name='Ember Mage', face='face_ember_mage', board='board_ember_mage', full='full_ember_mage', hp=90, max=90),
    dict(id='warlord', name='The Warlord', face='face_warlord', board=None, full=None, hp=None, max=None),
]
UNIT = {u['id']: u for u in COMPANY + FOES}
RARITY = {'common': 'b1', 'uncommon': 'm4', 'rare': 's3', 'epic': 'x4', 'legendary': 'o4'}


def item(item_id):
    """One real item from game/items.json, plus its kit icon name: dict(name, kind, w, h, buy, sell, rarity, icon, ...)."""
    i = dict(ITEMS[item_id])
    i['w'], i['h'] = i['gridSize']['width'], i['gridSize']['height']
    i['buy'], i['sell'] = i.get('buyPrice'), i.get('sellPrice')
    i['icon'] = _I.ITEM_ICON.get(i.get('weaponClass') or i['kind'], 'sword')
    if i['kind'] == 'potion' and i.get('effect', {}).get('kind') == 'GainAp':
        i['icon'] = 'elixir'
    return i


# ================================================================== CSS
def _uri(r):
    """A raster as a CSS url()."""
    return r.data_uri()


def _ink3(edge='k0', bottom=True):
    """A 3 x 3 border-image: ink edges with the corner pixels cut (a 1 px chamfer)."""
    r = Raster(3, 3)
    for (x, y) in ((1, 0), (0, 1), (2, 1)) + (((1, 2),) if bottom else ()):
        r.set(x, y, edge)
    return _uri(r)


def _css():
    """The shared stylesheet, every rule scoped under .f64."""
    s = SCOPE
    k = C['k0']
    ol1 = ','.join(f'{dx}px {dy}px 0 {k}' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)))
    ol1d = ol1 + f',1px 2px 0 {k},0 2px 0 {k},2px 2px 0 rgba(17,13,10,.6)'
    ink3 = _ink3()
    ink3x = _ink3(bottom=False)
    brk = ','.join(f'{_uri(_P.bracket_corner(p, True))} {"left" if p[1] == "L" else "right"} {"top" if p[0] == "T" else "bottom"} no-repeat'
                   for p in ('TL', 'TR', 'BL', 'BR'))
    arrow9 = _uri(_I.arrow_e(9))
    lock = _uri(_I.lock_small())
    dith = lambda dot: f'background-image:repeating-conic-gradient({dot} 0 25%,transparent 0 50%);background-size:2px 2px'
    sh = 'filter:drop-shadow(1px 1px 0 rgba(17,13,10,.6))'
    ring = lambda a, b, c=None, d=None: (f'inset 1px 1px 0 0 {C[a]},inset -1px -1px 0 0 {C[b]}'
                                        + (f',inset 2px 2px 0 0 {C[c]},inset -2px -2px 0 0 {C[d]}' if c else ''))
    return f"""
body{{margin:0}}
.{s}{{position:relative;overflow:hidden;font-family:'Source Serif 4',serif;font-optical-sizing:auto;font-variant-numeric:lining-nums tabular-nums;
  color:{C['b4']};background:{C['w0']};will-change:transform;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  -webkit-user-select:none;user-select:none;cursor:default}}
.{s} *{{box-sizing:border-box;margin:0;padding:0}}
.{s} .abs{{position:absolute}}
.{s} .tt{{font-family:'Jacquard 24',serif;font-size:43px;line-height:43px;font-weight:400;letter-spacing:0;color:{C['o5']};white-space:nowrap}}
.{s} .s13{{font-size:13px;line-height:16px;font-weight:600}}
.{s} .s14{{font-size:14px;line-height:18px;font-weight:600}}
.{s} .s15{{font-size:15px;line-height:19px;font-weight:600}}
.{s} .s16{{font-size:16px;line-height:20px;font-weight:700}}
.{s} .s18{{font-size:18px;line-height:22px;font-weight:700}}
.{s} .s20{{font-size:20px;line-height:24px;font-weight:700}}
.{s} .lt{{font-weight:400}} .{s} .md{{font-weight:600}} .{s} .it{{font-style:italic;font-weight:400}}
.{s} .bone{{color:{C['b4']}}} .{s} .dim{{color:{C['b2']}}} .{s} .faint{{color:{C['b1']}}} .{s} .ochre{{color:{C['o3']}}} .{s} .straw{{color:{C['o5']}}}
.{s} .rust{{color:{C['x4']}}} .{s} .rill{{color:{C['s4']}}} .{s} .meadow{{color:{C['m4']}}} .{s} .ink{{color:{k}}}
.{s} .nowrap{{white-space:nowrap}} .{s} .c{{text-align:center}} .{s} .r{{text-align:right}}
.{s} .ol1{{text-shadow:{ol1}}} .{s} .ol1d{{text-shadow:{ol1d}}} .{s} .sh1{{text-shadow:1px 1px 0 {k}}}
.{s} .win{{text-shadow:1px 1px 0 rgba(17,13,10,.85)}}
.{s} .ico{{display:inline-block;vertical-align:middle}}

/* key cap: Esc, Tab, Enter, 1-9 */
.{s} .key{{display:inline-block;position:relative;font-size:13px;line-height:15px;font-weight:700;color:{C['w1']};text-shadow:none;
  background:{C['b3']};padding:1px 6px 2px;margin:0 2px;vertical-align:1px;min-width:20px;text-align:center;
  box-shadow:inset 1px 1px 0 0 {C['b5']},inset -1px -1px 0 0 {C['b1']},inset 0 -2px 0 0 {C['b1']},0 0 0 1px {k},1px 2px 0 1px rgba(17,13,10,.55)}}
.{s} .key.down{{background:{C['b2']};top:1px;box-shadow:inset 1px 1px 0 0 {C['b1']},inset -1px -1px 0 0 {C['b3']},0 0 0 1px {k}}}
.{s} .key.off{{background:{C['w3']};color:{C['b1']};box-shadow:inset 1px 1px 0 0 {C['w4']},inset -1px -1px 0 0 {C['w2']},0 0 0 1px {k}}}

/* buttons: brass primary (one per screen), walnut secondary, oxblood danger */
.{s} .btn{{position:relative;display:inline-block;height:32px;padding:0 16px;font-size:16px;line-height:30px;font-weight:700;white-space:nowrap;
  text-align:center;vertical-align:middle;border:1px solid transparent;border-image:{ink3} 1;background-clip:padding-box;
  color:{C['b4']};text-shadow:1px 1px 0 {k};background-color:{C['w3']};{dith('rgba(255,232,196,.04)')};{sh};
  box-shadow:{ring('w5', 'w1', 'w4', 'w2')}}}
.{s} .btn.hov{{color:{C['o5']};box-shadow:{ring('o5', 'o1', 'w4', 'w2')}}}
.{s} .btn.prs{{transform:translate(1px,1px);filter:none;background-color:{C['w2']};box-shadow:{ring('w1', 'w5', 'w2', 'w4')};line-height:32px}}
.{s} .btn.arm{{transform:translate(1px,1px);filter:none;color:{C['o5']};background-color:{C['w2']};box-shadow:{ring('o1', 'o4', 'w2', 'w3')};line-height:32px}}
.{s} .btn.pri{{height:34px;line-height:32px;padding:0 20px;font-size:17px;color:{C['w0']};text-shadow:0 1px 0 {rgba('o5', .55)};background-color:{C['o3']};
  {dith(rgba('o4', .35))};box-shadow:{ring('o5', 'o1', 'o4', 'o2')}}}
.{s} .btn.pri.hov{{color:{C['w0']};background-color:{C['o4']};{dith(rgba('o5', .35))};box-shadow:{ring('o6', 'o2', 'o5', 'o3')}}}
.{s} .btn.pri.prs{{background-color:{C['o3']};background-image:none;box-shadow:{ring('o1', 'o4', 'o2', 'o3')};line-height:34px}}
.{s} .btn.dgr{{background-color:{C['x2']};{dith(rgba('x3', .4))};box-shadow:{ring('x4', 'x0', 'x3', 'x1')}}}
.{s} .btn.dgr.hov{{color:{C['b5']};background-color:{C['x3']};box-shadow:{ring('x5', 'x1', 'x4', 'x2')}}}
.{s} .btn.dgr.prs{{background-color:{C['x2']};background-image:none;box-shadow:{ring('x1', 'x4', 'x1', 'x3')}}}
.{s} .btn.dis,.{s} .btn.pri.dis,.{s} .btn.dgr.dis{{color:{C['b1']};text-shadow:none;background-color:{C['w2']};background-image:none;
  box-shadow:{ring('w3', 'w1')};cursor:default}}
.{s} .btn.foc::after,.{s} .cmd.foc::after,.{s} .tab.foc::after,.{s} .foc-ring::after{{content:'';position:absolute;left:-6px;top:-6px;right:-6px;bottom:-6px;
  pointer-events:none;background:{brk}}}
.{s} .why{{font-size:13px;line-height:16px;font-weight:600;color:{C['x4']};white-space:nowrap}}
.{s} .why::before{{content:'';display:inline-block;width:8px;height:8px;margin:0 6px 0 0;vertical-align:-1px;background:{lock}}}

/* the plain command line (combat Move / Capture, map Company / Contracts) */
.{s} .cmd{{position:relative;display:inline-block;padding-left:16px;font-size:18px;line-height:22px;font-weight:700;color:{C['b4']};white-space:nowrap}}
.{s} .cmd .sub{{display:block;font-size:13px;line-height:16px;font-weight:600;color:{C['b2']}}}
.{s} .cmd.hov{{color:{C['o5']}}}
.{s} .cmd.hov::before,.{s} .cmd.prs::before{{content:'';position:absolute;left:1px;top:7px;width:7px;height:9px;background:{arrow9}}}
.{s} .cmd.prs{{color:{C['o4']};transform:translate(2px,1px)}}
.{s} .cmd.arm{{color:{C['o5']}}}
.{s} .cmd.arm::before{{content:'';position:absolute;left:0;top:6px;width:9px;height:9px;background:{_uri(_I.side_glyph('ally', True))}}}
.{s} .cmd.dis{{color:{C['b1']}}}
.{s} .cmd.foc::after{{left:4px;right:-8px;top:-5px;bottom:-5px}}

/* tabs */
.{s} .tabs{{position:absolute;display:flex;align-items:flex-end;gap:4px;height:36px;padding:0 8px;
  box-shadow:inset 0 -2px 0 0 {C['w3']},inset 0 -3px 0 0 {C['w0']}}}
.{s} .tab{{position:relative;display:inline-block;height:30px;padding:0 16px;margin-bottom:3px;font-size:16px;line-height:29px;font-weight:700;white-space:nowrap;
  color:{C['b2']};text-shadow:1px 1px 0 {k};border:1px solid transparent;border-bottom:0;border-image:{ink3x} 1;background-clip:padding-box;
  background-color:{C['w2']};box-shadow:inset 1px 1px 0 0 {C['w4']},inset -1px 0 0 0 {C['w1']}}}
.{s} .tab.hov{{color:{C['b4']};box-shadow:inset 0 2px 0 0 {C['o3']},inset 1px 1px 0 0 {C['w4']},inset -1px 0 0 0 {C['w1']}}}
.{s} .tab.sel{{height:34px;margin-bottom:0;line-height:33px;color:{C['o5']};background-color:{C['w3']};{dith('rgba(255,232,196,.04)')};
  box-shadow:inset 0 1px 0 0 {C['o5']},inset 0 2px 0 0 {C['o3']},inset 1px 0 0 0 {C['w5']},inset -1px 0 0 0 {C['w1']}}}
.{s} .tab.dis{{color:{C['b0']};background-color:{C['w1']};box-shadow:inset 1px 1px 0 0 {C['w2']}}}

/* plate: the small window for tags and labels on the world */
.{s} .plate{{position:relative;display:inline-block;height:26px;padding:0 11px;font-size:16px;line-height:24px;font-weight:700;white-space:nowrap;color:{C['b4']};
  text-shadow:1px 1px 0 {k};border:1px solid transparent;border-image:{ink3} 1;background-clip:padding-box;background-color:{C['w2']};{sh};
  box-shadow:{ring('w5', 'w1', 'w3', 'w2')},inset 0 0 0 3px {k}}}
.{s} .plate.lit{{color:{C['o5']};background-color:#3d2e1f;box-shadow:{ring('o5', 'o1', 'o3', 'o2')},inset 0 0 0 3px {k}}}
.{s} .plate.sm{{height:22px;padding:0 9px;font-size:14px;line-height:20px}}

/* tooltip and refusal toast */
.{s} .tip{{position:absolute;padding:6px 11px 7px;font-size:14px;line-height:18px;font-weight:600;color:{C['b4']};text-shadow:1px 1px 0 {k};
  border:1px solid transparent;border-image:{ink3} 1;background-clip:padding-box;background-color:{C['w0']};
  box-shadow:{ring('w4', 'k1')};filter:drop-shadow(2px 2px 0 rgba(17,13,10,.55))}}
.{s} .tip.refuse{{box-shadow:{ring('x3', 'x1')}}}
.{s} .tip .nub{{position:absolute;left:50%;margin-left:-5px;bottom:-6px;width:11px;height:6px}}
.{s} .toast{{position:absolute;padding:10px 18px 11px 16px;border:1px solid transparent;border-image:{ink3} 1;background-clip:padding-box;
  background-color:{C['w1']};{dith('rgba(255,232,196,.03)')};box-shadow:{ring('x4', 'x0', 'x2', 'x1')},inset 0 0 0 3px {k};
  filter:drop-shadow(2px 2px 0 rgba(17,13,10,.55));white-space:nowrap;text-shadow:1px 1px 0 {k}}}

/* check tag: a skill check (stat, threshold, who answers it) or a cost */
.{s} .chk{{display:inline-block;position:relative;height:20px;padding:0 7px;margin:0 0 0 8px;font-size:13px;line-height:18px;font-weight:700;white-space:nowrap;
  vertical-align:1px;color:{C['b2']};text-shadow:none;border:1px solid transparent;border-image:{ink3} 1;background-clip:padding-box;background-color:{C['w0']};
  box-shadow:inset 1px 1px 0 0 {C['k1']},inset -1px -1px 0 0 {C['w3']}}}
.{s} .chk.ok{{color:{C['m4']}}} .{s} .chk.no{{color:{C['x4']}}}
.{s} .chk svg{{margin:-2px 0 0 5px}}

/* price */
.{s} .price{{display:inline-block;white-space:nowrap;font-size:16px;line-height:20px;font-weight:700;color:{C['o5']}}}
.{s} .price svg{{margin:-3px 4px 0 0}}
.{s} .price.short{{color:{C['x4']}}}
.{s} .price .note{{font-size:13px;font-weight:600;margin-left:6px}}

/* rows */
.{s} .row{{position:absolute}}
.{s} .row.hov{{background:{C['w2']};box-shadow:inset 0 1px 0 0 {C['w3']},inset 0 -1px 0 0 {C['w0']}}}
.{s} .row.sel{{background-color:{C['w3']};{dith('rgba(255,232,196,.035)')};box-shadow:inset 1px 1px 0 0 {C['o4']},inset -1px -1px 0 0 {C['o2']}}}

/* text input */
.{s} .inp{{position:absolute;height:40px;padding:0 12px;font-size:20px;line-height:38px;font-weight:600;color:{C['b4']};white-space:nowrap;overflow:hidden;
  border:1px solid transparent;border-image:{ink3} 1;background-clip:padding-box;background-color:{C['k1']};
  box-shadow:inset 1px 1px 0 0 {C['k0']},inset 2px 2px 0 0 {C['w0']},inset -1px -1px 0 0 {C['w4']}}}
.{s} .inp.foc{{box-shadow:inset 1px 1px 0 0 {C['o2']},inset -1px -1px 0 0 {C['o4']},inset 2px 2px 0 0 {C['k0']},inset 3px 3px 0 0 {C['w0']}}}
.{s} .inp.bad{{box-shadow:inset 1px 1px 0 0 {C['x2']},inset -1px -1px 0 0 {C['x4']},inset 2px 2px 0 0 {C['k0']}}}
.{s} .inp .ph{{color:{C['b0']};font-style:italic;font-weight:400}}
.{s} .inp .caret{{display:inline-block;width:2px;height:24px;margin:0 0 0 1px;vertical-align:-5px;background:{C['o5']};box-shadow:1px 1px 0 0 {k}}}
"""


_FILTERS = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
            '<filter id="f64-ol1" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">'
            '<feComponentTransfer in="SourceAlpha" result="sa"><feFuncA type="discrete" tableValues="0 0 1 1 1"/></feComponentTransfer>'
            f'<feMorphology in="sa" operator="dilate" radius="1" result="d"/><feFlood flood-color="{C["k0"]}"/>'
            '<feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
            '</defs></svg>')


def board_html(title, body, w=STAGE_W, h=STAGE_H, extra_css=''):
    """The exact canvas board wrapper: fonts, the .f64 CSS, the SVG filter defs; $preview, height and min-height = h."""
    _WORLD_SENT.clear()
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="{FONTS}">
<style>
{_css()}{extra_css}
</style>
</helmet>
<div class="{SCOPE}" style="width:{w}px;height:{h}px;min-height:{h}px;position:relative;overflow:hidden">
{_FILTERS}
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""


def write(name, html):
    """Write out/boards/<name>.dc.html and return its path."""
    p = f'{_P.OUT}/{name}.dc.html'
    with open(p, 'w', encoding='utf-8') as fh:
        fh.write(html)
    return p


# ================================================================== type
def T(x, y, text, cls='s14 bone', w=None, align=None, style=''):
    """Positioned text. cls = a size (tt s13..s20) + a colour (bone dim faint straw ochre rust rill meadow) + options."""
    wd = f'width:{w}px;' if w else ''
    al = f'text-align:{align};' if align else ''
    nw = '' if w else ' nowrap'
    return f'<div class="abs {cls}{nw}" style="left:{x}px;top:{y}px;{wd}{al}{style}">{text}</div>'


def num(text, x, y, size=30, ramp='Oxblood'):
    """Cast digits for a headline number (damage, a big HP readout): two tones, ink edge, 1 px drop. ramp: Oxblood Ochre Bone Slate Moss."""
    return numeral(str(text), size, ramp).svg(x, y)


def label(x, y, text, w=None, align='left'):
    """A specimen caption (s13 dim) for kit sheets and annotations."""
    return T(x, y, text, 's13 dim', w=w, align=align)


# ================================================================== windows and plates
def window(x, y, w, h, body='', state='idle', title=None, note=None, big=False, kind='win', corners=True):
    """The Filigree window. state idle (walnut), hover (brass moulding), chosen (brass moulding + bracket cursor).
    title: a section head (ochre, a groove under it) or, with big=True, a Jacquard 43 title (a place or a screen's title
    only, never a person). note: a dim line top-right.
    kind='card' gives the lighter card moulding with small caps. body is positioned from the window's own 0,0."""
    lit = state in ('hover', 'chosen')
    k = {'win': 'lit', 'card': 'cardlit'}[kind] if lit else kind
    head = ''
    if title and big:
        head = T(PAD, 9, title, 'tt')
    elif title:
        head = section_head(title, w=w - 2 * PAD, note=note)
    elif note:
        head = T(w - PAD, 15, note, 's13 dim', style='transform:translateX(-100%)')
    if title and big and note:
        head += T(w - PAD, 24, note, 's13 dim', style='transform:translateX(-100%)')
    html = _P.panel(x, y, w, h, head + body, kind=k, corners=corners)
    if state == 'chosen':
        html += brackets(x - 7, y - 7, w + 16, h + 16)
    return html


def plate(text, state='idle', small=False, x=None, y=None, center=False):
    """A plate: the small framed tag for a label laid on the world (a road out, a place name). state idle | lit.
    Inline unless x, y are given; center=True centres it on x."""
    cls = 'plate' + (' lit' if state in ('lit', 'hover', 'chosen') else '') + (' sm' if small else '')
    el = f'<span class="{cls}">{text}</span>'
    if x is None:
        return el
    tf = 'transform:translateX(-50%);' if center else ''
    return f'<div class="abs" style="left:{x}px;top:{y}px;{tf}">{el}</div>'


def rule(x, y, w, orn=True):
    """The ornament rule: a carved groove with a brass lozenge and two rivets at its centre (y = the groove line)."""
    return _P.rule_raster(w, orn).svg(x, y - 3)


def groove(x, y, w):
    """A plain carved groove (2 px: dark over light) to separate rows."""
    return _P.groove_raster(w).svg(x, y)


def section_head(text, x=PAD, y=13, w=236, note=None):
    """A window's section head: ochre s16, a groove 23 px under it, an optional dim note on the right."""
    out = T(x, y, text, 's16 ochre') + groove(x, y + 23, w)
    if note:
        out += T(x + w, y + 3, note, 's13 dim', style='transform:translateX(-100%)')
    return out


def brackets(x, y, w, h, small=False):
    """The brass bracket cursor around a box: what the pointer (or keyboard focus) is on."""
    return _P.brackets_raster(w, h, small).svg(x, y)


# ================================================================== buttons and commands
def button(text, variant='secondary', state='idle', reason=None, w=None, x=None, y=None):
    """A button. variant primary (brass; ONE per screen) | secondary (walnut) | danger (oxblood, irreversible).
    state idle | hover | press | focus | armed (a mode it holds) | disabled. Disabled needs a reason; it prints under the button."""
    cls = 'btn' + {'primary': ' pri', 'secondary': '', 'danger': ' dgr'}[variant]
    cls += {'idle': '', 'hover': ' hov', 'press': ' prs', 'focus': ' foc', 'armed': ' arm', 'disabled': ' dis'}[state]
    wd = f' style="width:{w}px"' if w else ''
    el = f'<span class="{cls}"{wd}>{text}</span>'
    if state == 'disabled':
        assert reason, 'a disabled button must say why'
        el = f'<span style="display:inline-block;vertical-align:top">{el}<div class="why" style="margin-top:6px">{reason}</div></span>'
    if x is None:
        return el
    return f'<div class="abs" style="left:{x}px;top:{y}px">{el}</div>'


def command(text, sub=None, state='idle', reason=None, x=None, y=None):
    """A plain command line (Move, Capture, Company): no box. hover/press show the brass arrow, armed the brass square,
    focus the brackets, disabled dims it and prints the reason as its sub-line."""
    cls = 'cmd' + {'idle': '', 'hover': ' hov', 'press': ' prs', 'focus': ' foc', 'armed': ' arm', 'disabled': ' dis'}[state]
    if state == 'disabled':
        assert reason, 'a disabled command must say why'
        sub_html = f'<span class="why" style="display:block">{reason}</span>'
    else:
        sub_html = f'<span class="sub">{sub}</span>' if sub else ''
    el = f'<span class="{cls}">{text}{sub_html}</span>'
    if x is None:
        return el
    return f'<div class="abs" style="left:{x}px;top:{y}px">{el}</div>'


def key(text, state='idle'):
    """A key cap chip, inline: Esc, Tab, Enter, 1-9. state idle | down (held) | off (not available)."""
    return f'<span class="key{" down" if state == "down" else " off" if state == "off" else ""}">{text}</span>'


def tabs(x, y, items, selected=0, hover=None, focus=None, disabled=(), w=None):
    """A tab strip on a carved baseline. items = labels; selected/hover/focus = indexes; disabled = indexes."""
    out = []
    for i, t in enumerate(items):
        c = 'tab' + (' sel' if i == selected else '') + (' hov' if i == hover and i != selected else '') + (' foc' if i == focus else '') + (' dis' if i in disabled else '')
        out.append(f'<span class="{c}">{t}</span>')
    wd = f'width:{w}px;' if w else ''
    return f'<div class="tabs" style="left:{x}px;top:{y}px;{wd}">{"".join(out)}</div>'


# ================================================================== rows and scroll
def row(x, y, w, name, sub=None, face_key=None, icon_name=None, value=None, state='idle', reason=None, h=None, flip=False, lit_face=False):
    """A list row: optional face (48 niche) or icon (24), name (s16), sub-line (s13), right-aligned value (any HTML, e.g. price()).
    state idle | hover (band + brass arrow) | selected (brass ring, straw name) | disabled (dim; the reason replaces the sub-line)."""
    lead = 56 if face_key else (34 if icon_name else 0)
    h = h or (56 if face_key else 44)
    cls = 'row' + {'idle': '', 'hover': ' hov', 'selected': ' sel', 'disabled': ''}[state]
    nc = {'idle': 'bone', 'hover': 'bone', 'selected': 'straw', 'disabled': 'faint'}[state]
    inner = ''
    if face_key:
        inner += face(face_key, 4, (h - 48) // 2, 48, lit=lit_face or state == 'selected', flip=flip)
    elif icon_name:
        r = _I.silhouette(icon_name) if state == 'disabled' else _I.get(icon_name)
        inner += r.svg(6, (h - 24) // 2)
    tx = lead + (8 if lead else 10)
    if sub or state == 'disabled':
        ny = (h - 38) // 2
        inner += T(tx, ny, name, f's16 {nc}')
        inner += (T(tx, ny + 21, f'<span class="why">{reason}</span>', 's13') if state == 'disabled' else T(tx, ny + 21, sub, 's13 dim'))
    else:
        inner += T(tx, (h - 20) // 2, name, f's16 {nc}')
    if value is not None:
        inner += f'<div class="abs nowrap s16 {"faint" if state == "disabled" else "bone"}" style="right:10px;top:{(h - 20) // 2}px">{value}</div>'
    cursor = _I.arrow_e(9).svg(-12, (h - 9) // 2) if state == 'hover' else ''
    return f'<div class="{cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">{inner}{cursor}</div>'


def scrollbar(x, y, h, pos=0.0, frac=0.4):
    """A pixel scrollbar: a recessed track, a walnut thumb with grip lines, notch caps. pos 0..1, frac = visible share."""
    W = 12
    R = Raster(W, h)
    for j in range(h):
        for i in range(W):
            edge_tl = i == 0 or j == 0
            edge_br = i == W - 1 or j == h - 1
            R.set(i, j, 'w0' if edge_tl else ('w4' if edge_br else ('k0' if i in (1, W - 2) or j in (1, h - 2) else 'k1')))
    for cap_y, up in ((3, True), (h - 9, False)):
        for d in range(4):
            yy = cap_y + (d if up else 3 - d)
            for i in range(5 - d, 7 + d):
                R.set(i, yy + 1, 'w5' if up else 'w3')
    tt, tb = 12, h - 12
    th = max(16, int((tb - tt) * frac))
    t0 = tt + int((tb - tt - th) * pos)
    for j in range(t0, t0 + th):
        for i in range(2, W - 2):
            e = j in (t0, t0 + th - 1) or i in (2, W - 3)
            R.set(i, j, 'k0' if e else ('w6' if (j == t0 + 1 or i == 3) else ('w2' if (j == t0 + th - 2 or i == W - 4) else 'w4')))
    for g in range(-1, 2):
        gy = t0 + th // 2 + g * 3
        for i in range(4, W - 4):
            R.set(i, gy, 'w2'); R.set(i, gy + 1, 'w6')
    return R.svg(x, y)


# ================================================================== faces, sprites, cut-ins
# the face crops: (cx, cy) of the 40-44 px crop worked out in dirs/hyb-64, and a tighter (cx, cy) for the 24 px crop
FACE = {
    'face_roy': ((50, 36), (49, 41)), 'face_marcus': ((48, 32), (47, 37)), 'face_lilina': ((49, 42), (48, 45)),
    'face_bandit': ((51, 33), (52, 39)), 'face_ember_mage': ((48, 36), (46, 41)), 'face_warlord': ((56, 42), (57, 48)),
}


def face(key_, x, y, size=48, lit=False, flip=False, bg=None):
    """A face at 1x in a brass-edged niche. size 32 (24 px crop) | 48 (40 px crop) | 96 (the whole face, niche 104 outside).
    lit = the brass lip of the one acting or chosen; flip mirrors it (foes face left); bg defaults slate for ours, oxblood for theirs."""
    foe = key_ in ('face_bandit', 'face_ember_mage', 'face_warlord')
    bg = bg or ('x1' if foe else 's1')
    if size >= 96:
        outer, inner, left, top = 104, 96, 0, 0
    else:
        outer = size
        inner = size - 8
        cx, cy = FACE[key_][1 if size <= 32 else 0]
        left = min(max(int(cx - inner / 2), 0), 96 - inner)
        top = min(max(int(cy - inner / 2), 0), 96 - inner)
    tf = ''
    if flip:
        tf = 'transform:scaleX(-1);'
        left = 96 - inner - left
    fr = frame(outer, outer, 'platelit' if lit else 'plate', shadow=1)
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{outer}px;height:{outer}px">'
            f'<div class="abs" style="left:4px;top:4px;width:{inner}px;height:{inner}px;overflow:hidden;background:{C[bg]}">'
            f'<img class="abs" style="left:{-left}px;top:{-top}px;width:96px;height:96px;{tf}" src="{B(key_)}"></div>'
            f'{fr.svg(0, 0)}</div>')


def sprite_well(board_key, x, y, flip=False):
    """The full-size board sprite (104 x 152) at 1x, standing on grass in a recessed well 118 x 174."""
    tf = 'transform:scaleX(-1);' if flip else ''
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:120px;height:176px">'
            f'<div class="abs" style="left:4px;top:4px;width:110px;height:166px;background:{C["w0"]};overflow:hidden">'
            f'<div class="abs" style="left:0;top:112px;width:110px;height:54px;background:url({B("tex_grass")}) 0 0/128px 128px;filter:brightness(1.25) saturate(.9)"></div>'
            f'<div class="abs" style="left:0;top:111px;width:110px;height:1px;background:{C["m1"]}"></div></div>'
            + frame(118, 174, 'well', shadow=0).svg(0, 0)
            + _contact_shadow(60, 162)
            + f'<img class="abs" style="left:7px;top:12px;width:104px;height:152px;image-rendering:pixelated;{tf}" src="{B(board_key)}"></div>')


def cutin(full_key, x, y, w=240, h=330, scale=0.36, dx=0, dy=0, flip=False, kind='plate'):
    """A large cut-in of the full art (832 x 1216) in a brass niche: the art is scaled by `scale` and cropped to w x h.
    dx, dy shift the crop (art px at that scale); flip mirrors it."""
    aw, ah = int(832 * scale), int(1216 * scale)
    left = (w - 8 - aw) // 2 + dx
    tf = 'transform:scaleX(-1);' if flip else ''
    fr = frame(w, h, 'platelit' if kind == 'lit' else 'plate', shadow=2)
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
            f'<div class="abs" style="left:4px;top:4px;width:{w - 8}px;height:{h - 8}px;overflow:hidden;background:{C["w1"]};'
            f'background-image:repeating-conic-gradient(rgba(255,232,196,.03) 0 25%,transparent 0 50%);background-size:2px 2px">'
            f'<img class="abs" style="left:{left}px;top:{dy}px;width:{aw}px;height:{ah}px;filter:url(#f64-ol1);{tf}" src="{B(full_key)}"></div>'
            f'{fr.svg(0, 0)}</div>')


# ================================================================== gauges
ALLY = ('s5', 's4', 's3', 's2')
FOE = ('x5', 'x4', 'x3', 'x2')


def hp_bar(x, y, w, hp, mx, side='ally', lose=0, gain=0, h=7):
    """An HP bar: ink frame, lit top row, the fill, a dark foot. lose = the damage-preview ghost (bone), gain = a heal preview."""
    ramp = ALLY if side == 'ally' else FOE
    R = Raster(w, h)
    inner = w - 2
    keep = round(inner * max(0, hp - lose) / mx)
    nl = round(inner * min(lose, hp) / mx)
    ng = round(inner * min(gain, mx - hp) / mx)
    for xx in range(w):
        for yy in range(h):
            if xx in (0, w - 1) or yy in (0, h - 1):
                if not (xx in (0, w - 1) and yy in (0, h - 1)):
                    R.set(xx, yy, 'k0')
                continue
            i = xx - 1
            if i < keep:
                R.set(xx, yy, ramp[0] if yy == 1 else (ramp[3] if yy == h - 2 else (ramp[1] if yy < h / 2 else ramp[2])))
            elif i < keep + nl:
                R.set(xx, yy, 'b5' if yy < h / 2 else 'b3')
            elif i < keep + nl + ng:
                R.set(xx, yy, ramp[0] if (xx + yy) % 2 == 0 else ramp[2])
            else:
                R.set(xx, yy, 'w0' if yy == 1 else 'k1')
    return R.svg(x, y)


def food_pips(x, y, rations=(4, 4), used=(0, 0)):
    """Food as pips: one group of 4 per ration in the bag, a used charge goes dark. rations = charges per ration."""
    R = Raster(sum(n * 8 for n in rations) + 6 * (len(rations) - 1), 11)
    x0 = 0
    for g, n in enumerate(rations):
        u = used[g] if g < len(used) else 0
        for i in range(n):
            on = i < n - u
            lit, mid, mid2, dk = ('o5', 'o4', 'o3', 'o1') if on else ('w3', 'w2', 'w1', 'k0')
            for xx in range(x0, x0 + 7):
                for yy in range(11):
                    if xx in (x0, x0 + 6) and yy in (0, 10):
                        continue
                    e = xx in (x0, x0 + 6) or yy in (0, 10)
                    R.set(xx, yy, 'k0' if e else (lit if (yy == 1 or xx == x0 + 1) else (dk if yy == 9 else (mid if yy < 5 else mid2))))
            x0 += 8
        x0 += 6
    return R.svg(x, y)


def ap_gems(x, y, total=3, spend=0, spent=0):
    """AP as 20 px amber gems on 26 px cells (28 px pitch). spend = ringed (the aimed card will spend them), spent = dark sockets."""
    out = ''
    for i in range(total):
        st = 'spent' if i >= total - spent else ('spend' if i < spend else 'full')
        out += _I.gem20(st).svg(x + i * 28, y)
    return out


def meter(x, y, on, n=10, ramp='x'):
    """A row of n square lights, `on` of them lit (an encounter on 4 hops in 10). ramp x (oxblood) | o (brass) | m (moss)."""
    R = Raster(n * 12, 10)
    tones = {'x': ('x5', 'x4', 'x3', 'x2'), 'o': ('o6', 'o4', 'o3', 'o1'), 'm': ('m5', 'm4', 'm3', 'm1')}[ramp]
    for i in range(n):
        x0 = i * 12
        for xx in range(x0, x0 + 10):
            for yy in range(10):
                if xx in (x0, x0 + 9) or yy in (0, 9):
                    if not (xx in (x0, x0 + 9) and yy in (0, 9)):
                        R.set(xx, yy, 'k0')
                    continue
                if i < on:
                    R.set(xx, yy, tones[0] if yy == 1 else (tones[3] if yy >= 7 else (tones[1] if yy < 4 else tones[2])))
                else:
                    R.set(xx, yy, 'w0' if yy == 1 else 'k1')
    return R.svg(x, y)


# ================================================================== items: bag cells, the bag, hands
def _checker(x, y, w, h, a, b=None):
    """A 1 px two-tone checker as a CSS fill (b=None leaves every other pixel clear)."""
    bg = f'background-color:{C[b]};' if b else ''
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{bg}'
            f'background-image:repeating-conic-gradient({C[a]} 0 25%,transparent 0 50%);background-size:2px 2px"></div>')


def _cell_well(x, y, w, h):
    """A recessed satchel square: ink lip top-left, a light lip bottom-right, a faint checker floor."""
    R = Raster(w, h)
    for j in range(h):
        for i in range(w):
            if i == 0 or j == 0:
                R.set(i, j, 'k0')
            elif i == w - 1 or j == h - 1:
                R.set(i, j, 'w3')
            elif i == 1 or j == 1:
                R.set(i, j, 'w0')
    return _checker(x + 2, y + 2, w - 3, h - 3, 'w1') + R.svg(x, y)


def _item_tile(x, y, w, h, rarity='common', state='filled'):
    """A raised walnut tile with a rarity keyline: the face of a packed item."""
    R = Raster(w, h)
    rk = RARITY.get(rarity, 'b1')
    lit = state in ('selected', 'target')
    for j in range(h):
        for i in range(w):
            if (i in (0, w - 1)) and (j in (0, h - 1)):
                continue
            if i in (0, w - 1) or j in (0, h - 1):
                R.set(i, j, 'k0')
            elif i == 1 or j == 1:
                R.set(i, j, 'o5' if lit else 'w5')
            elif i == w - 2 or j == h - 2:
                R.set(i, j, 'o2' if lit else 'w1')
            elif i == 2 or j == 2 or i == w - 3 or j == h - 3:
                R.set(i, j, 'k0' if lit else 'w2')
            elif i == 3 or j == 3 or i == w - 4 or j == h - 4:
                R.set(i, j, rk)
    return _checker(x + 4, y + 4, w - 8, h - 8, 'w4', 'w3') + R.svg(x, y)


def bag_cell(x, y, item_id=None, state='empty', count=None, cell=44, show_name=None):
    """One satchel square (or a packed item spanning its grid size). state empty | filled | selected | equipped (in a hand) | refused.
    count = a stack or charges count (bottom-right). Names show on items two cells wide (show_name overrides)."""
    if item_id is None:
        return _cell_well(x, y, cell, cell)
    it = item(item_id)
    w, h = it['w'] * cell, it['h'] * cell
    st = 'filled' if state == 'refused' else state
    out = _item_tile(x + 1, y + 1, w - 2, h - 2, it['rarity'], st)
    ic = _I.get(it['icon'])
    named = show_name if show_name is not None else it['w'] >= 2
    iy = (h - 24) // 2 if not named else (h - 24) // 2 - 8
    out += ic.svg(x + (w - 24) // 2, y + iy)
    if named:
        out += T(x, y + iy + 28, it['name'], 's13 bone c', w=w)
    if count is not None:
        out += f'<div class="abs s13 bone ol1 nowrap" style="left:{x}px;top:{y + h - 19}px;width:{w - 6}px;text-align:right">×{count}</div>'
    if state == 'equipped':
        out += _I.side_glyph('ally').svg(x + 5, y + 5)
    if state == 'selected':
        out += brackets(x - 5, y - 5, w + 10, h + 10, small=True)
    if state == 'refused':
        R = Raster(w, h)
        for i in range(w):
            for j in range(h):
                if i in (0, 1, w - 1, w - 2) or j in (0, 1, h - 1, h - 2):
                    R.set(i, j, 'x4' if (i + j) % 2 == 0 else 'x2')
        out += R.svg(x, y)
    return out


def bag(x, y, entries=(), cols=8, rows=4, cell=44, selected=None, equipped=(), refused=()):
    """The 8 x 4 satchel: every square a recessed cell, packed items drawn over their squares.
    entries = [(item_id, col, row, count_or_None)]; selected / equipped / refused = (col, row) of an entry."""
    out = ''.join(_cell_well(x + c * cell, y + r * cell, cell, cell) for r in range(rows) for c in range(cols))
    for iid, c, r, n in entries:
        st = 'selected' if selected == (c, r) else 'equipped' if (c, r) in equipped else 'refused' if (c, r) in refused else 'filled'
        out += bag_cell(x + c * cell, y + r * cell, iid, st, n, cell)
    return out


HAND_LABEL = {'left': ('Left hand', 'weapon'), 'right': ('Right hand', 'off-hand')}


def equip_slot(x, y, hand='left', item_id=None, state='idle', reason=None, w=64, h=108):
    """A hand slot (the game has two: left = the weapon hand, right = the off-hand). Labelled above, item named below.
    state idle | target (the picked gear can go here) | locked (a two-handed item holds it; reason names it) | refused.
    Footprint: w x (38 + h + 42) px including the labels, the name and a reason line."""
    lab, kind = HAND_LABEL[hand]
    out = T(x, y, f'{lab}', 's13 bone') + T(x, y + 16, kind, 's13 dim')
    sy = y + 38
    well = Raster(w, h)
    for j in range(h):
        for i in range(w):
            if i == 0 or j == 0:
                well.set(i, j, 'w0')
            elif i == w - 1 or j == h - 1:
                well.set(i, j, 'w4')
            elif i == 1 or j == 1 or i == w - 2 or j == h - 2:
                well.set(i, j, 'k0')
    out += _checker(x + 2, sy + 2, w - 4, h - 4, 'k0' if state == 'locked' else 'k1', 'k1') + well.svg(x, sy)
    if item_id:
        it = item(item_id)
        tw, th = w - 8, min(h - 8, it['h'] * 48 - 4)
        out += _item_tile(x + 4, sy + 4, tw, th, it['rarity'], 'filled')
        out += _I.get(it['icon']).svg(x + (w - 24) // 2, sy + 4 + (th - 24) // 2)
        out += T(x, sy + h + 6, it['name'], 's13 bone', w=w + 40)
    elif state == 'locked':
        out += _I.get('lock').svg(x + (w - 24) // 2, sy + (h - 24) // 2)
    else:
        out += _I.silhouette('sword' if hand == 'left' else 'shield').svg(x + (w - 24) // 2, sy + (h - 24) // 2)
        out += T(x, sy + h + 6, 'empty', 's13 faint')
    if state == 'target':
        R = Raster(w + 6, h + 6)
        for i in range(w + 6):
            for j in range(h + 6):
                if (i in (0, w + 5) or j in (0, h + 5)) and (i + j) % 4 < 2:
                    R.set(i, j, 'o4')
        out += R.svg(x - 3, sy - 3) + brackets(x - 8, sy - 8, w + 16, h + 16, small=True)
    if state in ('locked', 'refused') and reason:
        out += f'<div class="abs why" style="left:{x}px;top:{sy + h + (26 if item_id else 6)}px">{reason}</div>'
    if state == 'refused':
        R = Raster(w, h)
        for i in range(w):
            for j in range(h):
                if i in (0, 1, w - 1, w - 2) or j in (0, 1, h - 1, h - 2):
                    R.set(i, j, 'x4' if (i + j) % 2 == 0 else 'x2')
        out += R.svg(x, sy)
    return out


# ================================================================== small widgets
_NUB = from_rows(["kkkkkkkkkkk", ".kwwwwwwwk.", "..kwwwwwk..", "...kwwwk...", "....kwk....", ".....k....."], {'w': 'w0'})


def tooltip(x, y, text, reason=False, w=None, nub=True):
    """A tooltip at (x, y) = its top-left; the nub points down from its centre. reason=True is a refusal (oxblood lip, lock)."""
    wd = f'width:{w}px;white-space:normal;' if w else 'white-space:nowrap;'
    pre = f'<span class="why" style="color:{C["b4"]};font-size:14px"></span>' if reason else ''
    nb = f'<svg class="nub" width="11" height="6" viewBox="0 0 11 6" shape-rendering="crispEdges">{_NUB.paths()}</svg>' if nub else ''
    return f'<div class="tip{" refuse" if reason else ""}" style="left:{x}px;top:{y}px;{wd}">{pre}{text}{nb}</div>'


def toast(x, y, reason, head=None):
    """The refusal toast: what you can't do (head, rust) and why (the engine's sentence). Prints over the screen for a beat."""
    mark = _I.cross_mark('x4').inline('margin:-3px 9px 0 0')
    h = f'<div class="s16 rust">{mark}{head}</div>' if head else ''
    body = f'<div class="s14 bone" style="{"margin:3px 0 0 18px" if head else ""}">{"" if head else mark}{reason}</div>'
    return f'<div class="toast" style="left:{x}px;top:{y}px">{h}{body}</div>'


def _track(on, state):
    """The switch track and knob as one 36 x 18 raster."""
    R = Raster(36, 18)
    dis = state == 'disabled'
    for j in range(18):
        for i in range(36):
            if (i in (0, 35)) and (j in (0, 17)):
                continue
            if i == 0 or j == 0:
                R.set(i, j, 'w0')
            elif i == 35 or j == 17:
                R.set(i, j, 'w4')
            elif i in (1, 34) or j in (1, 16):
                R.set(i, j, 'k0')
            elif on and not dis:
                R.set(i, j, 'm3' if j == 2 else 'm2')
            else:
                R.set(i, j, 'w1' if dis else 'k1')
    kx = 19 if on else 3
    lit = state == 'hover'
    tl, br, fill = (('o5', 'o1', 'o3') if lit else ('w3', 'w2', 'w2') if dis else ('w6', 'w2', 'w4'))
    if on and not lit and not dis:
        tl, br, fill = 'b5', 'b1', 'b3'
    for j in range(3, 15):
        for i in range(kx, kx + 14):
            e = i in (kx, kx + 13) or j in (3, 14)
            R.set(i, j, 'k0' if e else (tl if (j == 4 or i == kx + 1) else (br if (j == 13 or i == kx + 12) else fill)))
    for g in (5, 8):
        for jj in range(6, 12):
            R.set(kx + g, jj, br if not dis else 'w3')
            R.set(kx + g + 1, jj, tl if not dis else 'w2')
    return R


def switch(x, y, w, label_text, on, state='idle', reason=None, on_word='on', off_word='off'):
    """A two-state setting (Sound: on). The knob's side carries the state and the word beside it says it again.
    state idle | hover (brass knob) | focus (brackets) | disabled (with a reason)."""
    dis = state == 'disabled'
    word = on_word if on else off_word
    wc = 'faint' if dis else ('meadow' if on else 'dim')
    out = T(0, 0, label_text, f's16 {"faint" if dis else "bone"}') + T(w - 46, 1, word, f's14 {wc}', style='transform:translateX(-100%)')
    out += _track(on, state).svg(w - 36, 0)
    if state == 'focus':
        out += brackets(-8, -8, w + 16, 34, small=True)
    if dis:
        out += f'<div class="abs why" style="left:0;top:24px">{reason}</div>'
    return f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:20px">{out}</div>'


def check_tag(text, ok=None, word=False):
    """A check badge, inline: e.g. 'STR 6 · Oak 6'. ok True = within reach (moss, tick), False = falls short (rust, cross),
    None = a cost, not a test (dim, no mark). word=True adds 'within reach' / 'falls short' after it."""
    cls = 'chk' + (' ok' if ok is True else ' no' if ok is False else '')
    mark = _I.check_mark('m4').inline() if ok is True else _I.cross_mark('x4').inline() if ok is False else ''
    w = ''
    if word and ok is not None:
        w = f'<span class="s13 {"meadow" if ok else "rust"}" style="margin-left:8px">{"within reach" if ok else "falls short"}</span>'
    return f'<span class="{cls}">{text}{mark}</span>{w}'


def price(amount, short=False, note=None):
    """A price with the 16 px coin, inline. short=True is beyond the purse: rust, a dimmed coin and the words."""
    c = _I.coin16(dim=short).inline()
    n = note if note is not None else ('beyond the purse' if short else '')
    nh = f'<span class="note">{n}</span>' if n else ''
    return f'<span class="price{" short" if short else ""}">{c}{amount}{nh}</span>'


# ================================================================== dialogue and input
def choice(x, y, w, n, text, state='idle', tag=None, ok=None, req=None):
    """One answer in a talk or event box: its number key, the line, an optional check tag.
    state idle | hover (band, brass arrow, straw) | locked (dim, lock, the requirement in rust) | chosen (brass ring)."""
    h = 32
    if state == 'locked':
        body = (f'{key(n, "off")}<span class="s16 faint" style="margin-left:10px">{text}</span>'
                f'<span class="why" style="margin-left:12px">{req}</span>')
    else:
        tc = 'straw' if state in ('hover', 'chosen') else 'bone'
        body = f'{key(n)}<span class="s16 {tc}" style="margin-left:10px">{text}</span>' + (check_tag(tag, ok) if tag else '')
    cls = 'row' + (' hov' if state == 'hover' else ' sel' if state == 'chosen' else '')
    cur = _I.arrow_e(9).svg(-14, 11) if state == 'hover' else ''
    return (f'<div class="{cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
            f'<div class="abs nowrap" style="left:8px;top:5px;line-height:22px">{body}</div>{cur}</div>')


def person(x, y, name, tone='bone'):
    """A person or foe named on their own (the speaker, the one acting, the target): Source Serif 4 bold at 20 px.
    Jacquard is for places, screen titles and the Round marker only; at 43 px it turns 'Oak' into 'Dak'."""
    return T(x, y, name, f's20 {tone}')


def dialogue(x, y, w, h, face_key, speaker, line, choices=(), flip=False, cue=None):
    """The talk box: the speaker's whole face in a lit niche, the speaker's name (person(): s20 bold, straw), the line in
    the reading voice (s18), then the choices. choices = [dict(text, state, tag, ok, req)]; none = a Continue cue."""
    body = face(face_key, PAD, PAD, 96, lit=True, flip=flip)
    tx = PAD + 104 + 18
    body += person(tx, 22, speaker, 'straw')
    body += T(tx, 54, line, 's18 lt bone', w=w - tx - PAD, style='line-height:25px')
    cy = 54 + 25 * max(1, math.ceil(text_w(line, 18, 400) / (w - tx - PAD))) + 12
    if choices:
        for i, c in enumerate(choices):
            body += choice(tx - 8, cy + i * 34, w - tx - PAD + 8, i + 1, c['text'], c.get('state', 'idle'), c.get('tag'), c.get('ok'), c.get('req'))
    else:
        body += T(w - PAD, h - 36, cue or f'Continue {key("Enter")}', 's14 dim', style='transform:translateX(-100%)')
    return window(x, y, w, h, body)


def text_input(x, y, w, value='', placeholder='a name', state='idle', reason=None, maxlen=None):
    """A one-line text field: a recessed well (40 px tall), the value in s20, a pixel caret when focused.
    state idle | focus | error (the reason prints 6 px under it, rust). maxlen=24 adds an 'n of 24' count on the right."""
    cls = 'inp' + (' foc' if state == 'focus' else ' bad' if state == 'error' else '')
    txt = value if value else f'<span class="ph">{placeholder}</span>'
    caret = '<span class="caret"></span>' if state in ('focus', 'error') else ''
    if not value and caret:
        txt = caret + f'<span class="ph" style="margin-left:4px">{placeholder}</span>'
        caret = ''
    out = f'<div class="{cls}" style="left:{x}px;top:{y}px;width:{w}px">{txt}{caret}</div>'
    if maxlen:
        out += T(x + w, y + 46, f'{len(value)} of {maxlen}', 's13 faint', style='transform:translateX(-100%)')
    if reason:
        out += f'<div class="abs why" style="left:{x}px;top:{y + 46}px">{reason}</div>'
    return out


# ================================================================== overlays and empty states
def scrim(w=STAGE_W, h=STAGE_H, x=0, y=0):
    """The dim laid over the world under a modal: one flat ink tone at 62%. No blur, no vignette, no glow."""
    return f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{rgba("k0", .62)}"></div>'


def modal(x, y, w, h, body='', title=None, eyebrow=None, scrim_box=(0, 0, STAGE_W, STAGE_H)):
    """A modal over the world: the scrim over scrim_box, then a large window with an optional eyebrow (s13 dim) and Jacquard title."""
    head = ''
    if eyebrow:
        head += T(PAD, 14, eyebrow, 's13 dim')
    if title:
        head += T(PAD, 32 if eyebrow else 12, title, 'tt')
    sx, sy, sw, sh_ = scrim_box
    return scrim(sw, sh_, sx, sy) + window(x, y, w, h, head + body)


def empty_state(x, y, w, icon_name, line, hint, action=None):
    """An empty list or register: the icon as a dim silhouette at 2x, a line in the game's voice, and a pointer to what fills it."""
    out = _I.silhouette(icon_name).svg(0, 0, scale=2)
    out += T(64, 4, line, 's16 lt bone it', w=w - 64)
    arr = _I.arrow_e(9).inline('margin:-2px 7px 0 0')
    out += T(64, 30, f'{arr}{hint}', 's13 dim', w=w - 64)
    if action:
        out += f'<div class="abs" style="left:64px;top:56px">{action}</div>'
    return f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:96px">{out}</div>'


# ================================================================== icons
ICON_GROUPS = _I.GROUPS


def icon(name, x, y, scale=1):
    """A 24 px icon at (x, y). Names: see ICON_GROUPS (gold food potion ... sword lance tome shield armor trinket bow axe ...)."""
    return _I.get(name).svg(x, y, scale=scale)


def icon_inline(name, style='margin:-4px 6px 0 0'):
    """A 24 px icon inline with text (vertically centred)."""
    return _I.get(name).inline(style)


def silhouette(name, x, y, scale=1):
    """An icon as a dim walnut silhouette (empty slots, empty states)."""
    return _I.silhouette(name).svg(x, y, scale=scale)


# ================================================================== combat pieces
def card(x, y, name, cost, kind, mag, mag_word, line1, line2, art=None, state='idle', reason=None, w=136, h=172):
    """A card in the hand: cost pips + 'n AP', name, its art (24 px icon at 40 px slot), the cast magnitude, kind word, two lines.
    state idle | hover (brass) | chosen (picked up: raised 20 px, brass, brackets) | disabled (dim, reason as line 2)."""
    sel = state == 'chosen'
    y0 = y - 20 if sel else y
    pips = ''.join(_I.small_gem().inline('margin-right:3px') for _ in range(cost))
    tc = 'straw' if state in ('hover', 'chosen') else ('faint' if state == 'disabled' else 'bone')
    ramp = 'Dim' if state == 'disabled' else 'Slate' if kind == 'ward' else 'Oxblood'
    nm = numeral(str(mag), 30, ramp, track=3)
    art_html = ''
    if art is not None:
        big = {'flame': lambda: _I.flame(40), 'fire': lambda: _I.flame(40, core=False), 'burst': lambda: _I.burst(40),
               'ward': lambda: _I.ward(40), 'arcane': lambda: _I.orb(40)}
        a = art if isinstance(art, Raster) else big[art]() if art in big else _I.get(art)
        art_html = a.svg(16, 56) if a.w >= 40 else a.svg(24, 64)
    l2 = f'<span class="why">{reason}</span>' if state == 'disabled' else line2
    body = (f'<div class="abs nowrap" style="left:14px;top:13px;height:9px">{pips}</div>'
            + T(w - 14, 11, f'{cost} AP', f's13 {"straw" if sel else "dim"}', style='transform:translateX(-100%)')
            + T(14, 28, name, f's16 {tc}') + art_html + nm.svg(70, 58)
            + T(70, 58 + nm.h + 1, mag_word, 's13 dim') + groove(14, 110, w - 28)
            + T(14, 118, line1, 's13 dim') + T(14, 136, l2, 's13 bone'))
    out = window(x, y0, w, h, body, state='hover' if state in ('hover', 'chosen') else 'idle', kind='card')
    if sel:
        out += brackets(x - 7, y0 - 7, w + 16, h + 16)
    return out


def side_glyph(side, act=False, x=None, y=None):
    """The 9 px side mark: square = ours, diamond = theirs. Inline unless x, y are given."""
    r = _I.side_glyph(side, act)
    return r.svg(x, y) if x is not None else r.inline('margin:-3px 6px 0 0')


def base_ring(x, y, side, act=False, ts=48, feet=37):
    """The ring under a unit on its tile (x, y = the tile's top-left): a flat square for ours, a flat lozenge for theirs, brass for
    the one acting. Returns (back, front): draw back, then the figure, then front (so the ring passes in front of the feet)."""
    back, front = Raster(ts, ts), Raster(ts, ts)
    rg = ('o5', 'o3') if act else (('s4', 's3') if side == 'ally' else ('x4', 'x3'))
    cy = feet + .5
    for j in range(ts):
        for i in range(ts):
            dx, dy = abs(i + .5 - ts / 2), abs(j + .5 - cy)
            tgt = front if j + .5 >= cy else back
            lit = rg[0] if j + .5 < cy else rg[1]
            if side == 'ally':
                if dx <= 18 and dy <= 6 and (dx >= 17 or dy >= 5) and not (dx >= 17 and dy >= 5):
                    tgt.set(i, j, lit)
                elif dx <= 19 and dy <= 7 and (dx >= 18 or dy >= 6) and not (dx >= 18.5 and dy >= 6.5):
                    tgt.set(i, j, 'k0')
                elif dx <= 16 and dy <= 4 and (dx >= 16 or dy >= 4):
                    tgt.set(i, j, 'k0')
            else:
                m = dx / 21 + dy / 7.2
                if .86 <= m < 1.0:
                    tgt.set(i, j, lit)
                elif .74 <= m < .86 or 1.0 <= m < 1.13:
                    tgt.set(i, j, 'k0')
    return back.svg(x, y), front.svg(x, y)


def _contact_shadow(cx, fy):
    """The soft dithered shadow under a standing figure, centred on (cx, fy)."""
    R = Raster(36, 9)
    for j in range(9):
        for i in range(36):
            e = ((i + .5 - 18) / 17) ** 2 + ((j + .5 - 4.5) / 4.2) ** 2
            if e <= .45:
                R.set(i, j, 'sh45')
            elif e <= 1 and (i + j) % 2 == 0:
                R.set(i, j, 'sh35')
    return R.svg(cx - 18, fy - 5)


def ordinal(n, x, y):
    """The small plaque with a cast numeral that tells two foes of one kind apart (Obsidian Fighter 1 and 2)."""
    d = numeral(str(n), 15, 'Bone', drop=0)
    pw, ph = 15, 19
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{pw}px;height:{ph}px;background:{C["x2"]}"></div>'
            + frame(pw, ph, 'plate', shadow=1).svg(x, y) + d.svg(x + (pw - d.w) // 2, y + (ph - d.h) // 2))


def arrow_down(x, y):
    """The brass arrow over the unit that is acting."""
    return _I.arrow_down().svg(x, y)


def hand_cursor(x, y):
    """The tactics gauntlet, pointing right (its fingertip is at x + 19, y + 6)."""
    return _I.hand().svg(x, y)


def pin(x, y):
    """A brass 'you are here' pin (7 x 10)."""
    return _I.pin().svg(x, y)


# ================================================================== the painted world
_WORLD_SENT = set()


def _world(kind, inner, crop, extra=''):
    """Each painted world goes into a board once, as a <symbol>; every later view of it is a <use> (boards stay small)."""
    vb = f'{crop[0]} {crop[1]} {crop[2]} {crop[3]}' if crop else '0 0 1280 720'
    w, h = (crop[2], crop[3]) if crop else (1280, 720)
    sym = ''
    if kind not in _WORLD_SENT:
        _WORLD_SENT.add(kind)
        sym = (f'<svg class="abs" width="0" height="0" style="left:0;top:0;overflow:hidden" aria-hidden="true">'
               f'<symbol id="f64-{kind}" viewBox="0 0 1280 720" width="1280" height="720" overflow="visible">{inner()}</symbol></svg>')
    return sym + f'<svg class="abs" style="left:0;top:0" width="{w}" height="{h}" viewBox="{vb}"><use href="#f64-{kind}" x="0" y="0" width="1280" height="720"/></svg>' + extra


def _px(mod):
    """The pixel world (owner 2026-10-24: "go pixel everywhere") replaces the painted one once its module exists; F64_PAINTED=1 forces paint."""
    if os.environ.get('F64_PAINTED'):
        return None
    try:
        return __import__(mod)
    except ImportError:
        return None


def _px_image(uri, w=1280, h=720):
    return f'<image href="{uri}" x="0" y="0" width="{w}" height="{h}" style="image-rendering:pixelated"/>'


def world_map(crop=None, company=True):
    """The Borderlands at 1280 x 720: pixel art from kit_px_map when present, else C's painted country.
    crop=(x, y, w, h) returns just that part at 1:1, placed at 0,0."""
    PX = _px('kit_px_map')
    if PX:
        return _world('pmap' if company else 'pmap0', lambda: _px_image(PX.map_uri(company=company)), crop)

    def inner():
        import kit_world_map as WM
        sign = WM.sign.split('<text')[0] + '</g>'
        return ''.join(WM.svg) + WM.places_svg + sign + (WM.company if company else '')
    return _world('wmap' if company else 'wmap0', inner, crop)


def world_field(crop=None, grid=True):
    """The painted combat field at 1280 x 720 with its 14 x 10 board (48 px tiles at 303, 18), 1 px seams. crop as world_map."""
    import kit_world_field as WC
    PX = _px('kit_px_field')
    if PX and not getattr(PX, 'SEAMS', True):
        grid = False

    def inner():
        if PX:
            return _px_image(PX.field_uri())
        return ''.join(s for s in WC.svg if not (s.startswith('<g stroke="#1b2a0c" stroke-width="1"') or s.startswith('<g stroke="#f4f0c8"')
                                                 or s.startswith(f'<rect x="{WC.OX}" y="{WC.OY}" width="{WC.T * WC.COLS}"')))
    extra = ''
    kind = 'pfield' if PX else 'wfield'
    if grid:
        W, H = WC.COLS * WC.T, WC.ROWS * WC.T
        seams = Raster(W, H)
        for c in range(1, WC.COLS):
            for yy in range(H):
                seams.set(c * WC.T, yy, 'k0')
        for r in range(1, WC.ROWS):
            for xx in range(W):
                seams.set(xx, r * WC.T, 'k0')
        ox, oy = (WC.OX - crop[0], WC.OY - crop[1]) if crop else (WC.OX, WC.OY)
        extra = seams.svg(ox, oy, style='opacity:.17')
    return _world(kind, inner, crop, extra)


def world_inset(x, y, w, h, src='map', at=(0, 0)):
    """A w x h crop of the painted world at 1:1 in a recessed frame, placed at (x, y). src map | field; at = crop top-left in world px."""
    inner = world_map(crop=(at[0], at[1], w, h)) if src == 'map' else world_field(crop=(at[0], at[1], w, h))
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;overflow:hidden">{inner}</div>'
            + frame(w + 4, h + 4, 'well', shadow=0).svg(x - 2, y - 2))


def ground(w, h, seed=3):
    """A plain meadow of any size (the sunlit grass of the Key card) for sheets and screens without a map: pixel when kit_px_map has one."""
    PX = _px('kit_px_map')
    if PX and hasattr(PX, 'ground_uri'):
        return f'<img class="abs" style="left:0;top:0;width:{w}px;height:{h}px;image-rendering:pixelated" src="{PX.ground_uri(w, h, seed)}">'
    return (f'<svg class="abs" style="left:0;top:0" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><defs>'
            f'<pattern id="f64-g{seed}" patternUnits="userSpaceOnUse" width="128" height="128"><image href="{B("tex_grass")}" width="128" height="128"/></pattern>'
            f'<filter id="f64-sun{seed}" x="0" y="0" width="100%" height="100%"><feColorMatrix values="1.46 0 0 0 .02  0 1.38 0 0 .02  0 0 1.05 0 0  0 0 0 1 0"/></filter>'
            f'<filter id="f64-mdw{seed}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="{seed + 6}"/>'
            f'<feColorMatrix values="0 0 0 0 .86  0 0 0 0 .86  0 0 0 0 .45  2.6 0 0 0 -1.3"/></filter>'
            f'<filter id="f64-drk{seed}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="3" seed="{seed + 28}"/>'
            f'<feColorMatrix values="0 0 0 0 .1  0 0 0 0 .2  0 0 0 0 .05  2.8 0 0 0 -1.5"/></filter></defs>'
            f'<rect width="{w}" height="{h}" fill="url(#f64-g{seed})" filter="url(#f64-sun{seed})"/>'
            f'<rect width="{w}" height="{h}" filter="url(#f64-mdw{seed})" opacity=".32"/>'
            f'<rect width="{w}" height="{h}" filter="url(#f64-drk{seed})" opacity=".38"/></svg>')


def backdrop(key_, x=0, y=0, w=1280, h=720, pos='50% 60%'):
    """A painted panorama (backdrop_borderlands | backdrop_thornwood | backdrop_ashfall), cover-fitted into a box."""
    return f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:url({B(key_)}) {pos}/cover no-repeat"></div>'
