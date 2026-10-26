"""px-town folk: the company and the townsfolk at town scale, ~42 px tall (about 2.6x the map minis), drawn in the
same technique as pxworld/folk.py: big readable heads, flat fills stepped down their own ramps, light from the upper
left, and a selout outline (each part inked in the darkest step of its own ramp, never black).

figure(who) -> Sprite, foot anchor at the bottom middle.
  'roy'     The Foundling: red hair, gold pauldrons over a leather jerkin, blue scarf and cape, gilt sword point-down
  'marcus'  Bagrat "Oak": silver hair, grey plate, red cloak and red scarf, a sword at his side
  'lilina'  Lilina: pale blue hair, a blue robe trimmed in gold over a cream gown, a staff with a blue orb
  'trader', 'goodwife', 'porter', 'keeper'  townsfolk in plain wool, linen and leather
"""
from pxt import Sprite, selout, pal, IX

ROY = [
    "........A...A.........",
    ".......AB..AB...A.....",
    "......ABBA.ABB.AB.....",
    ".....ABBBBABBBBBB.....",
    "....ABBBBBBBBBBBBC....",
    "...ABBBBBBBBBBBBBBC...",
    "...ABBBBBBBBBBBBBCC...",
    "..ABBBBBBBBBBBBBBBCC..",
    "..ABBBCBBBBCBBBBCBCC..",
    "..ABBCFFBBBFFBBCFCCC..",
    "..ABBFFFFBFFFFBFFCCC..",
    "..BBFFFFFFFFFFFFFGCC..",
    "..BBFFEFFFFFFEFFFGCC..",
    "..BCFFEFFFFFFEFFGGC...",
    "...CFFFFFFFFFFFFGG....",
    "....FFFFFFFFFFFFG.....",
    ".....GFFFFFFFFFG......",
    "......GGGGGGGGG.......",
    "...OOPTSSSSSSSTUQQ....",
    "..OOPPPTSSSSSTUUPQQ...",
    ".OOPPPPQMLLLLMNPPQQR..",
    ".OPPPPQQMLLLMMNNQQQR..",
    "cOPPPQQRMLMMMMMNRQQRd.",
    "c.RRRR.NMMMMMMMNN.RRd.",
    "cNNM..NMLMMMMMMNNW.NWd",
    "cNMN..NMMMMMMMMNNW.NWd",
    "cPPQ..NMMMMMMMMNNW.QRd",
    "cPPQ..NMMMMMMMNNNW.QRd",
    "cFFG..WWOOWWWWWWWW.GGd",
    "cFFG..WWPQWWWWWWWW.GGd",
    "PQQQR.NNNNNNNNNNNN..cd",
    ".XY...NNNNNNNNNNNN..cd",
    ".XY...NNNNNNWNNNNN..cd",
    ".XY...NNNNNWWNNNNN..cd",
    ".XY...OPPQNW.OPPQN..cd",
    ".XY...PPQQNW.PPQQN..cd",
    ".XY...NNNNNW.NNNNN..cd",
    ".XY...NNNNNW.NNNNW..d.",
    ".XY...WVVVVW.WVVVV....",
    ".X....WVVVVW.WVVVVV...",
    "......VVVVVV.VVVVVV...",
    "......VVVVVV.VVVVVV...",
]
ROY_KM = {'A': 'x5', 'B': 'x4', 'C': 'x3', 'D': 'x2', 'F': 'f3', 'G': 'f2', 'E': 'k1',
          'S': 's4', 'T': 's3', 'U': 's2', 'O': 'o5', 'P': 'o4', 'Q': 'o3', 'R': 'o2',
          'L': 'w5', 'M': 'w4', 'N': 'w3', 'W': 'w2', 'V': 'w1', 'c': 's2', 'd': 's1', 'X': 't6', 'Y': 't4'}


MARCUS = [
    "......AAAAAAA.........",
    ".....AAAABBBBB........",
    "....AAABBBBBBBC.......",
    "...AAABBBBBBBBBC......",
    "...AABBBBBBBBBBCC.....",
    "..AABBBBBBBBBBBBCC....",
    "..ABBBBBBBBBBBBBBC....",
    "..ABBBBCBBBBBCBBBCC...",
    "..ABBCFFFFFFFFFCBBC...",
    "..ABCFFFFFFFFFFFCBC...",
    "..ABCFFFFFFFFFFFGCC...",
    "..ABFFEEFFFFFEEFGCC...",
    "..ABFFFFFFFFFFFFGCC...",
    "..ABFFFFFFFFFFFGGCC...",
    "..ABCFFFFFFFFFFGGCC...",
    "..ABCGFFFFFFFFGGCCD...",
    "..ABC.GGFFFFGGG.CCD...",
    "..BBC.GGGGGGGG..CCD...",
    "..rRRRRHHHHHHHHRRRRx..",
    ".rRRIIJHHhhhhhHJIIRx..",
    ".RRIIIJJKKKKKKJJIIIRx.",
    "rRIIJJQJKKKKKKKQJJQIRx",
    "rRIJJQQJJKKKKKQQJJQQRx",
    "rR.ZZZ.QJJKKKKQQ.ZZZRx",
    "rRJKQ..QJKKKKKQQ..JKQx",
    "rRJKQ..QJKKKKKQQ..JKQx",
    "rRJKQ..QJJKKKKQQ..JKQx",
    "rRQQZ..WWWWOOWWWW.QQZx",
    "rRQQZ..WWWWOPWWWW.QQZx",
    "rRFFG..JKKKZKKKQQ.FGRx",
    "rRR....JKKQZJKKQQ..YRx",
    "rRR....JKKQZJKKQQ..YRx",
    "rRR....JKKQ.JKKQZ..YRx",
    "rRRx...JJKQ.JJKQZ..YRx",
    "rRRx...IJKQ.IJKQZ..YRx",
    "rRRx...JKKQ.JKKQZ..YXx",
    "rRRx...JKKQ.JKKQZ..Yxx",
    ".xxx...JKKQ.JKKQZ..Y..",
    "......JKKQZ.JKKKQZ.Y..",
    "......JKKQZ.JKKKQZ....",
    "......QQQZZ.QQQQZZ....",
    "......ZZZZZ.ZZZZZZ....",
]
MARCUS_KM = {'A': 'b5', 'B': 'b4', 'C': 'b3', 'D': 'b2', 'F': 'f3', 'G': 'f2', 'E': 'k1',
             'r': 'x4', 'R': 'x3', 'x': 'x2', 'X': 'x1', 'H': 'x5', 'h': 'x4',
             'I': 't6', 'J': 't5', 'K': 't4', 'Q': 't3', 'Z': 't2', 'W': 'w2', 'O': 'o5', 'P': 'o3', 'Y': 't5'}

LILINA = [
    "................o.....",
    "...............oOo....",
    "....AAAAAA.....wo.....",
    "...AAABBBBBB...w......",
    "..AABBBBBBBBC..w......",
    "..ABBBBBBBBBBC.w......",
    ".AABBBBBBBBBBCCw......",
    ".ABBBBBBBBBBBBCw......",
    ".ABBBCBBBBBCBBCw......",
    ".ABBCFFFFFFFFCCw......",
    ".ABCFFFFFFFFFFCw......",
    ".ABCFFFFFFFFFFGwC.....",
    ".ABFFEFFFFFFEFGwC.....",
    ".ABFFEFFFFFFEFGwC.....",
    ".ABFFFFFFFFFFGGwC.....",
    ".ABCFFFFFFFFFGGwCD....",
    ".ABC.GFFFFFFGGFFCD....",
    ".ABC..GGGGGGG.FFCD....",
    ".ABBRRTTVVVVTTRRwCD...",
    ".ABRRRRTVVVVTRRRwRCD..",
    ".BRRRRRTVUUVTRRRwRRr..",
    "LRRRRRRTVUUVTRRRRwRRr.",
    "LRRRRRrTVUUVTrRRRwRRr.",
    "LLRRRr.TVUUVT.rRRwRRr.",
    "LLRRr..TVUUVT..rRwRrr.",
    "LLTTT..WWWWWW..TTwTT..",
    ".FF....TVUUVT....wFF..",
    ".......LTVUUVTr..w....",
    "......LRTVUUVTRr.w....",
    "......LRTVUUuTRr.w....",
    ".....LRRTVUUuTRRrw....",
    ".....LRRTVUUuTRRrw....",
    ".....LRRTVUUuTRRrw....",
    "....LRRRTVUUuTRRRwr...",
    "....LRRRTVUUuTRRRwr...",
    "....LRRRTVUUuTRRRwr...",
    "...LRRRRTVUUuTRRRwrr..",
    "...LRRRRTVUUuTRRRwrr..",
    "...LRRRRTVUUuTRRRwrr..",
    "...TTTTTTTTTTTTTTwTT..",
    "....rrrrrrrrrrrrrwr...",
    ".................w....",
]
LILINA_KM = {'A': 's5', 'B': 's4', 'C': 's3', 'D': 's2', 'F': 'f3', 'G': 'f2', 'E': 's1',
             'L': 's3', 'R': 's2', 'r': 's1', 'T': 'o4', 'V': 'b5', 'U': 'b4', 'u': 'b3', 'W': 'w3',
             'w': 'w4', 'o': 's4', 'O': 's5'}

import folk_more as FM  # noqa: E402

FIGS = {'roy': (ROY, ROY_KM), 'marcus': (FM.MARCUS, FM.MARCUS_KM), 'lilina': (FM.LILINA, FM.LILINA_KM),
        'trader': (FM.MAN, FM.FOLK_KM['trader']), 'porter': (FM.MAN, FM.FOLK_KM['porter']),
        'goodwife': (FM.WOMAN, FM.FOLK_KM['goodwife']), 'keeper': (FM.WOMAN, FM.FOLK_KM['keeper'])}


def figure(who):
    rows, km = FIGS[who]
    w = max(len(r) for r in rows)
    s = Sprite(w + 2, len(rows) + 2, (w + 2) // 2, len(rows))
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch not in '. ':
                s.put(i + 1, j + 1, km[ch])
    selout(s, over={'b': 'b1'})
    return s


if __name__ == '__main__':
    import sys
    from pxt import Canvas
    names = sys.argv[1:] or list(FIGS)
    cv = Canvas(30 * len(names) + 10, 52, 'g5')
    for i, n in enumerate(names):
        cv.stamp(figure(n), 18 + i * 30, 48)
    cv.save('z/folk8.png', zoom=8)
