"""The ASCII sketches for NOTES.md, drawn from the data (land.py): the whole country, and the heartland's 2 x 2
screens with every place as a code. python ascii_maps.py -> t/ascii_country.txt, t/ascii_heart.txt, t/legend.txt"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import land as LD   # noqa: E402

SYM = {'TOWN': 'T', 'CAMP': 'c', 'TRAIL': '+', 'DISCOVERY': '!', 'DUNGEON': 'D', 'BOSS': 'X'}


def country():
    X0, Y0, X1, Y1 = -1300, -880, 3560, 2400
    cw, ch = 54, 90
    cols, rows = int((X1 - X0) / cw), int((Y1 - Y0) / ch)
    pts = [(k, p) for k, p in LD.P.items() if not LD.NODE[k].get('hidden')]
    g = [[' '] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            x, y = X0 + (c + .5) * cw, Y0 + (r + .5) * ch
            if 0 <= x < 2560 and 0 <= y < 1440:
                reg = 'borderlands'
            else:
                k, _ = min(pts, key=lambda t: (t[1][0] - x) ** 2 + (t[1][1] - y) ** 2)
                reg = LD.NODE[k]['region']
                if reg == 'borderlands':
                    reg = 'thornwood' if y < 0 or x > 2560 else 'ashfall'
            g[r][c] = {'borderlands': ' ', 'thornwood': '^', 'ashfall': ','}[reg]
    for course in (LD.RIVER_FAR, LD.BROOK_FAR):
        for (x, y) in LD.spline(course, 30):
            c, r = int((x - X0) / cw), int((y - Y0) / ch)
            if 0 <= r < rows and 0 <= c < cols:
                g[r][c] = '~'
    c0, c1, r0, r1 = int((0 - X0) / cw), int((2560 - X0) / cw), int((0 - Y0) / ch), int((1440 - Y0) / ch)
    for cc in range(c0, c1 + 1):
        for rr in (r0, r1):
            if g[rr][cc] in ' ^,':
                g[rr][cc] = '-'
    for rr in range(r0, r1 + 1):
        for cc in (c0, c1):
            if g[rr][cc] in ' ^,':
                g[rr][cc] = '|'
    for k, p in pts:
        c, r = int((p[0] - X0) / cw), int((p[1] - Y0) / ch)
        if 0 <= r < rows and 0 <= c < cols:
            g[r][c] = SYM[LD.NODE[k]['type']]
    c, r = int((1280 - X0) / cw), int((720 - Y0) / ch)
    g[r][c] = '@'
    return '\n'.join(''.join(row).rstrip() for row in g)


def code_of(k):
    words = [w for w in LD.NAMES[k].replace("'", '').replace('The ', '').split() if w]
    return (words[0][0] + (words[1][0] if len(words) > 1 else words[0][1])).upper()


def heart():
    cw, ch = 20, 40
    cols, rows = 2560 // cw, 1440 // ch
    g = [[' '] * cols for _ in range(rows)]
    from pxworld.canvas import poly  # noqa
    for name, ch_ in (('thornwood', '^'), ('ashfall', ',')):
        import geo
        for r in range(rows):
            for c in range(cols):
                if geo.pip(((c + .5) * cw, (r + .5) * ch), LD.ZONES[name]):
                    g[r][c] = ch_
    for course in (LD.RIVER, LD.BROOK):
        for (x, y) in LD.spline(course, 40):
            c, r = int(x / cw), int(y / ch)
            if 0 <= r < rows and 0 <= c < cols:
                g[r][c] = '~'
    for r in range(rows):
        g[r][cols // 2] = ':' if g[r][cols // 2] == ' ' else g[r][cols // 2]
    for c in range(cols):
        g[rows // 2][c] = '.' if g[rows // 2][c] == ' ' else g[rows // 2][c]
    vx0, vy0 = LD.VIEW[0] // cw, LD.VIEW[1] // ch
    vx1, vy1 = (LD.VIEW[0] + 1280) // cw, (LD.VIEW[1] + 720) // ch
    for c in range(vx0, vx1 + 1):
        for r in (vy0, vy1):
            if g[r][c] in ' .:':
                g[r][c] = '='
    for r in range(vy0, vy1 + 1):
        for c in (vx0, vx1):
            if g[r][c] in ' .:':
                g[r][c] = '#'
    codes = {}
    for k, p in LD.P.items():
        if LD.NODE[k]['region'] != 'borderlands':
            continue
        cd = code_of(k)
        while cd in codes.values():
            cd = cd[0] + chr(ord(cd[1]) + 1)
        codes[k] = cd
        c, r = int(p[0] / cw), int(p[1] / ch)
        txt = ('@' if k == 'frontier_camp' else cd)
        if LD.NODE[k].get('hidden'):
            txt = cd.lower()
        for i, chx in enumerate(txt):
            if 0 <= c + i < cols:
                g[r][c + i] = chx
    return '\n'.join(''.join(row).rstrip() for row in g), codes


if __name__ == '__main__':
    open(os.path.join(HERE, 't', 'ascii_country.txt'), 'w', encoding='utf-8').write(country())
    h, codes = heart()
    open(os.path.join(HERE, 't', 'ascii_heart.txt'), 'w', encoding='utf-8').write(h)
    leg = sorted((cd, LD.NAMES[k]) for k, cd in codes.items())
    open(os.path.join(HERE, 't', 'legend.txt'), 'w', encoding='utf-8').write(
        '\n'.join(f'{cd} {nm}' for cd, nm in leg))
    print(h)
