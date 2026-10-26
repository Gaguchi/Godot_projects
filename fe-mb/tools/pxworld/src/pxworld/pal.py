"""pxworld palette: the Filigree kit's seven ramps plus eight nature ramps, every ramp dark -> light.

Light comes from the north-west. Shadows move a colour DOWN its own ramp (see Canvas.shift), never
to a new hue, so the whole world stays inside this one list. Hue shifts are built into the ramps:
greens cool toward blue-green in the shade and warm toward straw in the sun.
"""

# the Filigree kit's ramps (kit64/kit_px.py), unchanged: the UI and the world share them
KIT = [
    ('Ink', 'k', ['#110d0a', '#1b1510']),
    ('Walnut', 'w', ['#211810', '#2b2017', '#372a1f', '#4a3828', '#5e4733', '#785a3e', '#94724e']),
    ('Ochre', 'o', ['#3a2710', '#664518', '#936626', '#bf8c38', '#dcb156', '#f0d488', '#fcf1c8']),
    ('Moss', 'm', ['#1c2714', '#2c3c21', '#43582c', '#64783b', '#8e9a55', '#b9bd84']),
    ('Slate', 's', ['#18212c', '#2b3c4e', '#4a6986', '#6e8faa', '#9cbbcf', '#d3e3eb']),
    ('Oxblood', 'x', ['#2a0e0c', '#4b1916', '#772922', '#a23a2d', '#cd624a', '#ea997b']),
    ('Bone', 'b', ['#6b6359', '#908676', '#b5a686', '#d5c8a7', '#ede1c4', '#faf5e6']),
]
# the country: sunlit, earthy, hue-shifted
NATURE = [
    # grass has half-steps around its base (g4 g5 g6) for the meadow's soft patches; a full step is 2 places
    ('Grass', 'g', ['#1a2716', '#25381c', '#334b21', '#456128', '#627e2f', '#6d8a32', '#7a9737', '#8ea841', '#a9bd59', '#cad184']),
    ('Leaf', 'l', ['#121e12', '#1b3019', '#29461f', '#3b6026', '#527e2d', '#739e3a', '#a0bd55']),
    ('Pine', 'p', ['#0d1914', '#15291f', '#1f3c2b', '#2c5336', '#3f6c43', '#5d8a56']),
    ('Water', 'a', ['#12252d', '#1b3a46', '#28535f', '#376d78', '#4d8990', '#73a8a4', '#a6cdc0', '#ddefe5']),
    ('Dirt', 'd', ['#271b11', '#40301e', '#5e472d', '#7c6142', '#9b7f55', '#b89d6e', '#d3bf8e']),
    ('Stone', 't', ['#1a1918', '#32302c', '#4d4a43', '#6b675e', '#8e897d', '#b3ad9f', '#d6d1c2']),
    ('Wheat', 'h', ['#4a3815', '#725a22', '#9a7d32', '#bb9e45', '#d4bb5e', '#e8d68c']),
    ('Roof', 'r', ['#2b100b', '#521f14', '#7a3220', '#a2482b', '#c4653a', '#dd8a58']),
    ('Skin', 'f', ['#5a3426', '#9c5f45', '#d39a74', '#f0c9a0']),     # faces and hands, for the folk only
]
RAMPS = KIT + NATURE

KEYS = []          # index -> key, e.g. 'g4'
HEX = []           # index -> '#rrggbb'
RAMP_OF = []       # index -> ramp letter
LEVEL = []         # index -> level in its ramp
RAMP = {}          # letter -> [indices dark..light]
for name, letter, cols in RAMPS:
    RAMP[letter] = []
    for i, hx in enumerate(cols):
        RAMP[letter].append(len(KEYS))
        KEYS.append(f'{letter}{i}')
        HEX.append(hx)
        RAMP_OF.append(letter)
        LEVEL.append(i)
IDX = {k: i for i, k in enumerate(KEYS)}
CLEAR = 255
assert len(KEYS) < 255


def ix(key):
    """Palette index of 'g4' (or an int passed through)."""
    if isinstance(key, int):
        return key
    return IDX[key]


def rgb(key):
    h = HEX[ix(key)]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


STEP = {'g': 2}     # places per perceptual step, per ramp


def shift_index(i, n, fine=False):
    """The colour n steps along its own ramp (negative = darker), clamped. fine=True moves single places
    (the grass half-steps); otherwise one step is STEP places on ramps that have half-steps."""
    if i == CLEAR:
        return CLEAR
    r = RAMP[RAMP_OF[i]]
    k = n if fine else n * STEP.get(RAMP_OF[i], 1)
    return r[max(0, min(len(r) - 1, LEVEL[i] + k))]


def lut(n, fine=False):
    """A 256-entry lookup: index -> index shifted by n."""
    return [shift_index(i, n, fine) if i < len(KEYS) else CLEAR for i in range(256)]


def flat_palette():
    """768-int list for PIL 'P' images."""
    out = []
    for h in HEX:
        out += [int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)]
    out += [0, 0, 0] * (256 - len(HEX))
    return out
