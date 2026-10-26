"""Cartridge over the Painted Country: shared tokens.

The world is C's painted country (paint.py, world_*.py). Everything the player reads or
acts on is A's cartridge layer: one fat-pixel grid, 1 art pixel = 3 screen px.
All SVG ids are prefixed h64- so the boards can share a page with other directions.
"""
ROOT = __import__('os').path.abspath(__file__ + '/../../..').replace('\\', '/')   # tools/pxworld
import json
import re

OUT = ROOT + '/out/boards'
U = 3
SCOPE = 'dir-hybpixel'
_blobs = json.load(open(ROOT + '/assets/blobs.json'))


def B(key):
    return '/_blob/' + _blobs[key]


blob = B

# ---- the cartridge palette (24) --------------------------------------------
PAL = {
    'k': ('#17120e', 'Ink'), 'K': ('#1f1812', 'Soot'), 'w': ('#2e231b', 'Walnut'), 'W': ('#4b3a2b', 'Burl'),
    'b': ('#6b4f36', 'Bark'), 'r': ('#82623f', 'Rut'), 'd': ('#a47f55', 'Dirt'), 'D': ('#c29f71', 'Dust'),
    'o': ('#d6a23e', 'Ochre'), 'O': ('#f0c868', 'Straw'), 'p': ('#2e3e24', 'Pine'), 'm': ('#465c2e', 'Fern'),
    'M': ('#687c3e', 'Moss'), 'g': ('#929c56', 'Meadow'), 's': ('#2f4052', 'Dusk'), 'S': ('#4f6f8e', 'Slate'),
    'l': ('#8fb0c4', 'Rill'), 'x': ('#4e1a18', 'Blood'), 'X': ('#8e2f28', 'Oxblood'), 'R': ('#d0644e', 'Rust'),
    'B': ('#efe3c6', 'Bone'), 'a': ('#b8a888', 'Ash'), 'f': ('#77706a', 'Flint'), 'F': ('#a59c8c', 'Lime'),
}
HEX = {k: v[0] for k, v in PAL.items()}
FONTS = 'https://fonts.googleapis.com/css2?family=Tiny5&family=Micro+5&display=swap'


def ring(c=None, t=3):
    """1-art-px ink outline as box-shadow (square, no corners rounded)."""
    c = c or HEX['k']
    return f'0 -{t}px 0 0 {c},0 {t}px 0 0 {c},-{t}px 0 0 0 {c},{t}px 0 0 0 {c}'


def css_base(extra=''):
    c = HEX
    k = c['k']
    s = SCOPE
    return f"""
body{{margin:0}}
.{s}{{position:relative;overflow:hidden;font-family:'Tiny5',monospace;color:{c['B']};
  -webkit-font-smoothing:none;font-smooth:never;text-rendering:optimizeSpeed;background:{c['M']};will-change:transform;
  -webkit-user-select:none;user-select:none;cursor:default}}
.{s} *{{box-sizing:border-box;margin:0;padding:0}}
.{s} .abs{{position:absolute}}
.{s} .t16{{font-family:'Tiny5';font-size:16px;line-height:18px}}
.{s} .t24{{font-family:'Tiny5';font-size:24px;line-height:27px}}
.{s} .t48{{font-family:'Tiny5';font-size:48px;line-height:48px}}
.{s} .t72{{font-family:'Tiny5';font-size:72px;line-height:72px}}
.{s} .m33{{font-family:'Micro 5';font-size:33px;line-height:30px}}
.{s} .m44{{font-family:'Micro 5';font-size:44px;line-height:40px}}
.{s} .m66{{font-family:'Micro 5';font-size:66px;line-height:60px}}
.{s} .n{{font-family:'Micro 5';font-size:1.375em;line-height:0;letter-spacing:0}}
.{s} .m33 .n,.{s} .m44 .n,.{s} .m66 .n{{font-size:1em}}
.{s} .bone{{color:{c['B']}}} .{s} .dim{{color:{c['a']}}} .{s} .ochre{{color:{c['o']}}} .{s} .straw{{color:{c['O']}}}
.{s} .rust{{color:{c['R']}}} .{s} .rill{{color:{c['l']}}} .{s} .meadow{{color:{c['g']}}} .{s} .ink{{color:{k}}}
.{s} .nowrap{{white-space:nowrap}}
.{s} .sh{{text-shadow:3px 3px 0 {k}}}
.{s} .ol2{{text-shadow:2px 0 0 {k},-2px 0 0 {k},0 2px 0 {k},0 -2px 0 {k},2px 2px 0 {k},-2px 2px 0 {k},2px -2px 0 {k},-2px -2px 0 {k},0 4px 0 {k},2px 4px 0 {k}}}
.{s} .ol3{{text-shadow:3px 0 0 {k},-3px 0 0 {k},0 3px 0 {k},0 -3px 0 {k},3px 3px 0 {k},-3px 3px 0 {k},3px -3px 0 {k},-3px -3px 0 {k},0 6px 0 {k},3px 6px 0 {k}}}
/* windows: stepped 1-art-px corner, one light row, one dark row, flat walnut, hard 1-art-px drop */
.{s} .win{{position:absolute;background:{c['w']};
  box-shadow:inset 0 3px 0 0 {c['W']},inset 0 -3px 0 0 {c['K']},{ring()},6px 3px 0 0 rgba(23,18,14,.55),3px 6px 0 0 rgba(23,18,14,.55)}}
.{s} .win.trim{{box-shadow:inset 0 0 0 3px {c['b']},inset 0 6px 0 0 {c['W']},inset 0 -6px 0 0 {c['K']},{ring()},6px 3px 0 0 rgba(23,18,14,.55),3px 6px 0 0 rgba(23,18,14,.55)}}
.{s} .win.lit{{box-shadow:inset 0 0 0 3px {c['O']},inset 0 6px 0 0 {c['W']},inset 0 -6px 0 0 {c['K']},{ring()},6px 3px 0 0 rgba(23,18,14,.55),3px 6px 0 0 rgba(23,18,14,.55)}}
/* a tag: the smallest window, for labels laid on the painted world */
.{s} .tag{{position:absolute;background:{c['w']};padding:0 6px 3px;white-space:nowrap;
  box-shadow:inset 0 -3px 0 0 {c['K']},{ring()},3px 3px 0 3px rgba(23,18,14,.45)}}
.{s} .tag.quiet{{background:rgba(46,35,27,.86)}}
.{s} .rule{{position:absolute;height:3px;background:{c['W']}}}
.{s} .key{{display:inline-block;position:relative;font-family:'Tiny5';font-size:16px;line-height:18px;color:{k};
  background:{c['a']};padding:0 6px 3px;margin:0 3px;box-shadow:inset 0 -3px 0 0 {c['f']},{ring()};vertical-align:3px}}
.{s} .bar{{position:absolute;height:9px;background:{c['K']};box-shadow:{ring()}}}
.{s} .bar i{{position:absolute;top:0;bottom:0;left:0;display:block}}
.{s} .bar i.hl{{height:3px;bottom:auto;background:rgba(255,255,255,.28)}}
.{s} .frame{{position:absolute;box-shadow:{ring()},inset 0 -3px 0 0 rgba(0,0,0,.35)}}
{extra}
"""


def filters_svg():
    """Shared filters. px3*: nearest-neighbour crunch to the 3px art grid (A's sprite filter);
    ol3: the same 1-art-px ink outline but WITHOUT the crunch (painted art, pixel edge)."""
    k = HEX['k']

    def px(fid, blur=0.5, outline=True, contrast=1.0, sat=1.0):
        b = f'<feGaussianBlur stdDeviation="{blur}" result="bl"/>' if blur else ''
        src = 'bl' if blur else 'SourceGraphic'
        ic = (1 - contrast) / 2
        ct = (f'<feComponentTransfer><feFuncR type="linear" slope="{contrast}" intercept="{ic:.3f}"/><feFuncG type="linear" slope="{contrast}" intercept="{ic:.3f}"/>'
              f'<feFuncB type="linear" slope="{contrast}" intercept="{ic:.3f}"/></feComponentTransfer><feColorMatrix type="saturate" values="{sat}"/>') if contrast != 1.0 else ''
        o = (f'<feMorphology in="p" operator="dilate" radius="3" result="d"/><feFlood flood-color="{k}"/>'
             f'<feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="p"/></feMerge>') if outline else ''
        return (f'<filter id="{fid}" x="-6" y="-6" width="900" height="900" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
                f'{b}<feFlood x="1" y="1" width="1" height="1" flood-color="#000"/><feComposite width="3" height="3"/><feTile result="grid"/>'
                f'<feComposite in="{src}" in2="grid" operator="in"/><feMorphology operator="dilate" radius="1"/>'
                f'<feComponentTransfer><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>{ct}'
                f'<feComponentTransfer result="p"><feFuncA type="identity"/></feComponentTransfer>{o}</filter>')

    def ol(fid, r=3, thresh=True):
        # painted sprite kept crisp; a square ink outline r px wide is grown from its alpha
        a = ('<feComponentTransfer in="SourceAlpha" result="sa"><feFuncA type="discrete" tableValues="0 0 1 1 1"/></feComponentTransfer>'
             if thresh else '<feComponentTransfer in="SourceAlpha" result="sa"><feFuncA type="identity"/></feComponentTransfer>')
        return (f'<filter id="{fid}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">{a}'
                f'<feMorphology in="sa" operator="dilate" radius="{r}" result="d"/><feFlood flood-color="{k}"/>'
                f'<feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>')
    return ('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
            + px('h64-px3o', 0.4, True, 1.18, 1.15) + px('h64-px3', 0.4, False, 1.08, 1.05) + ol('h64-ol3', 3) + ol('h64-ol2', 2)
            + '</defs></svg>')


def numerals(html):
    """Every run of digits in Micro 5 (A's rule): only inside text nodes, never inside tags."""
    def fix(m):
        return '>' + re.sub(r'(\d+(?:/\d+)?)', lambda d: '<span class="n">' + d.group(1) + '</span>', m.group(1)) + '<'
    return re.sub(r'>([^<>]*\d[^<>]*)<', fix, html)


def wrap(title, body_html, css, w, h, digits=True):
    if digits:
        body_html = numerals(body_html)
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
{css}
</style>
</helmet>
<div class="{SCOPE}" style="width:{w}px;height:{h}px;position:relative;overflow:hidden">
{body_html}
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
    p = f'{OUT}/{name}.dc.html'
    with open(p, 'w', encoding='utf-8') as fh:
        fh.write(html)
    return p


class Raster:
    """Art-pixel canvas of palette keys; emits one SVG path per key."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[y][x]
        return None

    def rect(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.set(i, j, c)

    def stamp(self, rows, x, y, flip=False, recolor=None):
        for j, row in enumerate(rows):
            if flip:
                row = row[::-1]
            for i, ch in enumerate(row):
                if ch in '. ':
                    continue
                if recolor and ch in recolor:
                    ch = recolor[ch]
                self.set(x + i, y + j, ch)

    def paths(self, fill_for=None, skip=()):
        runs = {}
        for y in range(self.h):
            row = self.px[y]
            x = 0
            while x < self.w:
                c = row[x]
                if c is None or c in skip:
                    x += 1
                    continue
                x0 = x
                while x < self.w and row[x] == c:
                    x += 1
                runs.setdefault(c, []).append(f'M{x0} {y}h{x - x0}v1h-{x - x0}z')
        out = []
        for c, rs in runs.items():
            fill = fill_for(c) if fill_for else None
            if fill is None:
                fill = HEX.get(c, c)
            out.append(f'<path fill="{fill}" d="{"".join(rs)}"/>')
        return '\n'.join(out)


def svg_layer(r, x=0, y=0, extra='', cls='', style=''):
    return (f'<svg class="abs {cls}" style="left:{x}px;top:{y}px;{style}" width="{r.w * U}" height="{r.h * U}" '
            f'viewBox="0 0 {r.w} {r.h}" shape-rendering="crispEdges">{r.paths()}{extra}</svg>')


def sprite_svg(rows, x, y, scale=U, flip=False, cls='', style=''):
    h = len(rows)
    w = max(len(r) for r in rows)
    r = Raster(w, h)
    r.stamp(rows, 0, 0, flip=flip)
    return (f'<svg class="abs {cls}" style="left:{x}px;top:{y}px;{style}" width="{w * scale}" height="{h * scale}" '
            f'viewBox="0 0 {w} {h}" shape-rendering="crispEdges">{r.paths()}</svg>')


def sprite_inline(rows, scale=U, style=''):
    h = len(rows)
    w = max(len(r) for r in rows)
    r = Raster(w, h)
    r.stamp(rows, 0, 0)
    return (f'<svg style="display:inline-block;vertical-align:middle;{style}" width="{w * scale}" height="{h * scale}" '
            f'viewBox="0 0 {w} {h}" shape-rendering="crispEdges">{r.paths()}</svg>')


def snap(v):
    return int(round(v / U)) * U
