f = 'bits.py'
s = open(f, encoding='utf-8').read()


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a, s.count(a))
    s = s.replace(a, b)


rep('''def edge_sign(bw=110, bh=23, ph=44, tip='e'):
    """BD.board_sign with its point on either end (or none): three planks with grain and knots, a lit top
    edge, on a squared post lit on its west face. The map writes the name on the board. Foot = the post's base."""
    S = Sprite(bw + 8, ph + 6)
    ox = 1
    px = 6 if tip != 'w' else bw - 8
    posts = [px] if tip else [6, bw - 8]              # a plain board stands on two posts''',
    '''def edge_sign(bw=110, bh=23, ph=44, tip='e', post=None):
    """BD.board_sign with its point on either end (or none): three planks with grain and knots, a lit top
    edge, on a squared post lit on its west face. The map writes the name on the board. Foot = the post's base
    (post = its x inside the board; a plain board stands on two posts, the other at 6 or bw - 8)."""
    S = Sprite(bw + 8, ph + 6)
    ox = 1
    px = (6 if tip != 'w' else bw - 8) if post is None else post
    posts = [px] if tip else sorted({px, 6 if px > 12 else bw - 8})''')
i0 = s.index('# a wayside shrine.')
i1 = s.index('def shrine():')
s = s[:i0] + '''# a wayside shrine. 6..1 = the Stone ramp light..dark (the saint and her plinth); m/M = moss; o/O = the coppers in
# their bowl; f/F = dried flowers. Lit from the upper left: her head, left shoulder and the robe's left fall catch
# the light, the right side of the robe steps down into shade; the plinth is wider than she is
SHRINE = [
    "......55.......",
    ".....6654......",
    ".....6543......",
    "......43.......",
    "....566543.....",
    "...56655433....",
    "...6654.433....",
    "...665544332...",
    "....65544332...",
    "....65544332...",
    "...6655443322..",
    "...66554433322.",
    "..666554443332.",
    ".6666665555443.",
    ".5554444444332.",
    ".3222322232221.",
    ".4445444544332.",
    ".mM544454443Mm.",
    "OoO.........fF.",
]
SHRINE_KM = {'6': 't6', '5': 't5', '4': 't4', '3': 't3', '2': 't2', '1': 't1', 'm': 'm3', 'M': 'm2',
             'o': 'o4', 'O': 'o2', 'f': 'h3', 'F': 'x4'}


''' + s[i1:]
rep('''    S.ax, S.ay = 6, len(SHRINE)''', '''    S.ax, S.ay = 8, len(SHRINE)''')
rep('''  shrine()                                 Borderland Shrine: a weathered saint on a coursed plinth, coppers in a
                                           bowl and dried flowers at her feet''',
    '''  shrine()                                 Borderland Shrine: a weathered saint on a coursed plinth, coppers in a
                                           bowl and dried flowers at her feet
  watchtower(sc, x, y, gaps)               Watchtower Ridge with a gate on every road in
  broken_bridge(sc, x, y)                  Broken Bridge on its piers, the fallen span as drowned chunks
  ember(cv, x, y)                          a coal alight in the ash''')
s += open('_bits_add.py', encoding='utf-8').read()
open(f, 'w', encoding='utf-8').write(s)
print('ok')
