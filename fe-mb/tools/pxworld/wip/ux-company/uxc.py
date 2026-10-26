"""ux-company: the person screen (UxPerson, UxPersonDeck, UxEquip) built once, over the Filigree kit.

    from uxc import *
    body = person_screen(tab='kit' | 'deck', held=None | 'iron_buckler', hover_card=None)

Everything here is read from the game (read-only) or built on the kit's primitives; the kit is imported, never edited.
  - Real data: classes.json (stats, innate cards, weapon classes), items.json (gear, gear cards), cards.json (the cards),
    characters.json (signature cards: none for the three starters). card_face() ports combat/words.ts#cardFace and
    ui/combat/CardHand.tsx#cardType, so every number on a card is the one the game prints (base + STR, no empower).
  - The full art (game/public/sprites/units/roy.png) is cropped to its alpha box, resized ONCE with LANCZOS to the
    size it is shown at, and placed at 1:1 as a WebP data URI. It is never drawn on, recoloured or filtered.
  - The world under the screen is Riverside Market's square as UxTown draws it (dirs/ux-town/uxscene.py, imported,
    not copied) under the kit's flat 62% scrim: the company sheet is opened from the square, so the square stays behind
    it, dimmed, never blurred, exactly as under UxSatchel.
Local pieces the kit lacks, built on its primitives: blade40 / cards40 (40 px card art for the attack and focus kinds,
the kit's own 24 px attack() and focus() drawn at the 40 px card-art size), game_card (kit.card() with the number in its
kind's colour and 150 px wide), face_strip (Q, the three faces, E). screen.py adds hand_well (equip_slot's well without
its labels, plus a 'valid' state: the dashed brass of a legal hand that is not pointed at).
"""
import base64
import io
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SP = 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad'
GAME = 'E:/Work/GameDev/Godot/fe-mb/game'
sys.path.insert(0, SP + '/dirs/kit64')
sys.path.insert(0, SP + '/dirs')
from kit import *            # noqa: E402,F401,F403
import kit as K              # noqa: E402  (the kit's own private pieces: _item_tile, _checker)
import kit_icons as KI       # noqa: E402
import kit_px as KP          # noqa: E402

# ================================================================== game data (read-only)
_D = GAME + '/src/content/data'


def _load(name, key):
    d = json.load(open(f'{_D}/{name}', encoding='utf-8'))
    return d if isinstance(d, list) else list(d.get(key, d).values())


CARDS = {c['id']: c for c in _load('cards.json', 'cards')}
CLASSES = {c['id']: c for c in _load('classes.json', 'classes')}
CHARS = {c['id']: c for c in json.load(open(f'{_D}/characters.json', encoding='utf-8'))}

# the company after the inn and the market at Riverside Market, day 4 (UXFLOW.md "The moment"): everyone whole
PEOPLE = {
    'mc': dict(name='The Foundling', cls='lord', sprite='roy', face='face_roy', hp=(73, 73), hands=('iron_sword', None), pron='he'),
    'oak': dict(name='Bagrat "Oak"', cls='shield_knight', sprite='marcus', face='face_marcus', hp=(84, 84),
                hands=('iron_lance', 'iron_buckler'), pron='he'),
    'lilina': dict(name='Lilina', cls='mage', sprite='lilina', face='face_lilina', hp=(62, 62), hands=('fire_tome', None), pron='she'),
}
ORDER = ('mc', 'oak', 'lilina')
STATS = ('str', 'mag', 'skl', 'spd', 'def', 'res', 'lck')
HAND_SIZE = 5            # engine/rules.ts combat.handSize: each turn draws up to five
BAG_AFTER_MARKET = [('food_rations', 0, 0, 1), ('food_rations', 1, 0, 4), ('healing_potion', 2, 0, None), ('iron_buckler', 3, 0, None)]
# run/bag.ts#findSlot scans row by row: the bought 1 x 1 buckler lands in the first free square, (3, 0)


def stats_of(uid):
    return CLASSES[PEOPLE[uid]['cls']]['baseStats']


def class_name(uid):
    return CLASSES[PEOPLE[uid]['cls']]['name']


# ------------------------------------------------------------------ the deck (combat/deck.ts#buildDeck)
SOURCE_LABEL = {'innate': 'From the class', 'hand_left': 'Left hand', 'hand_right': 'Right hand', 'signature': 'Signature'}


def deck_groups(uid, hands=None):
    """[(source, label, [card ids])]: innate, then the left hand's gear cards, the right's, the signature cards."""
    p = PEOPLE[uid]
    left, right = hands or p['hands']
    out = [('innate', CLASSES[p['cls']]['innateCardIds'])]
    if left:
        out.append(('hand_left', item(left)['gearCardIds']))
    if right:
        out.append(('hand_right', item(right)['gearCardIds']))
    sig = CHARS[uid].get('signatureCardIds') or []
    if sig:
        out.append(('signature', sig))
    return out


def deck_size(uid, hands=None):
    return sum(len(c) for _, c in deck_groups(uid, hands))


# ------------------------------------------------------------------ a card's face (combat/words.ts + CardHand.tsx)
STATUS_WORD = {'poison': 'poison', 'burn': 'burn', 'slow': 'slow', 'immobilize': 'held fast', 'taunt': 'taunt', 'riposte': 'riposte',
               'empower': 'empower'}


def card_type(c):
    """CardHand.tsx#cardType: attack if it deals damage, ward if it heals or grants armor, focus if it draws or gives AP."""
    kinds = [e['kind'] for e in c['effects']]
    if 'Damage' in kinds:
        return 'attack'
    if 'Heal' in kinds or 'GrantArmor' in kinds:
        return 'ward'
    if 'DrawCards' in kinds or 'GainAp' in kinds:
        return 'focus'
    return 'arcane'


def target_word(c):
    """words.ts#targetWord, for the single-target cards these three carry."""
    return {'enemy': 'one foe', 'ally': 'an ally', 'self': 'self', 'tile': 'a tile', 'all_enemies': 'all foes', 'all_allies': 'all allies'}[c['targetKind']]


def card_face(cid, uid):
    """The face the game prints (cardFace: the one number and its foot), laid into the kit card's slots the way the combat
    board lays Blaze ('15 attack / magic / one foe') and Barrier ('3 armor / ward / an ally'): the number, what it counts,
    a small-print line (the damage kind, or the second thing the card does: the words of words.ts#cardIntentLines), and
    who it lands on (words.ts#targetWord). The number is attackPower: base + the damage stat (no empower out of combat)."""
    c = CARDS[cid]
    st = stats_of(uid)
    ty = card_type(c)
    tw = target_word(c)
    effs = c['effects']
    dmg = next((e for e in effs if e['kind'] == 'Damage'), None)
    if dmg:
        power = dmg['base'] + (st[c['damageStat']] if c.get('damageStat') else 0)
        number, unit = str(power), 'attack'
        rider = None
        for e in effs:
            if e['kind'] == 'GainAp':
                rider = f"+{e['amount']} AP to you"
            elif e['kind'] == 'Move':
                rider = f"charge {e['distance']} tiles"
            elif e['kind'] == 'RemoveStatus':
                rider = f"strips {e.get('amount', 0)} armor"
        line1 = rider or ('magic' if dmg['damageType'] == 'magic' else 'physical')
    else:
        e = effs[0]
        k = e['kind']
        if k == 'GrantArmor':
            number, unit = str(e['amount']), 'armor'
            rider = next((f"{STATUS_WORD[x['effectId']]} {x['value']}" for x in effs if x['kind'] == 'ApplyStatus'), None)
            line1 = rider or 'ward'
        elif k == 'DrawCards':
            number, unit, line1 = f"+{e['count']}", 'draw', 'focus'
        elif k == 'GainAp':
            number, unit, line1 = f"+{e['amount']}", 'AP', 'focus'
        elif k == 'ApplyStatus':
            number, unit = str(e['value']), STATUS_WORD[e['effectId']]
            line1 = f"for {e['turns']} turn{'s' if e['turns'] != 1 else ''}"
        else:
            number, unit, line1 = '', '', ty
    return dict(id=cid, name=c['name'], cost=c['apCost'], type=ty, number=number, unit=unit, line1=line1, line2=tw)


# ================================================================== 40 px card art for the kinds the kit draws at 24 only
def blade40():
    """The attack kind at the card-art size: kit_icons.attack() (a blade with a strike at its point), drawn at 40 px."""
    s = 40
    k = s / 24
    I = KP.Icon(s, s)
    I.layer(KI._diag(5.6 * k, 18.4 * k, 17.6 * k, 6.4 * k, 1.7 * k, 1.4 * k, 2.6 * k), KI.IRON[1:], R=1.2 * k, glint=False)
    I.layer(KP.seg(3.0 * k, 14.8 * k, 8.8 * k, 20.6 * k, 1.2 * k), KI.OCH, R=1 * k, glint=False)
    I.layer(KP.seg(2.4 * k, 21.6 * k, 4.8 * k, 19.2 * k, 1.3 * k), KI.LEA, R=1 * k, glint=False)
    I.layer(KP.poly(KI.star_pts(18.5 * k, 5.5 * k, 5.4 * k, 1.5 * k, 4, -math.pi / 2)), ['x3', 'o3', 'o4', 'o5', 'o6'], R=1.2 * k, glint=False)
    I.put(int(18.5 * k), int(5.5 * k), 'o6')
    return I.raster()


def cards40():
    """The focus kind at the card-art size: kit_icons.focus() (three cards fanned, a gem on the top one), drawn at 40 px."""
    s = 40
    k = s / 24
    I = KP.Icon(s, s)
    for (cx, ang, ramp) in ((8.5, -.42, ['w3', 'w4', 'w5']), (15.5, .42, ['w3', 'w4', 'w5']), (12, 0, ['b1', 'b2', 'b3', 'b4'])):
        hw, hh = 4.2 * k, 7.6 * k
        ca, sa = math.cos(ang), math.sin(ang)
        cxk, cy = cx * k, 13 * k
        pts = [(cxk + ca * dx - sa * dy, cy + sa * dx + ca * dy) for dx, dy in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh))]
        I.layer(KP.poly(pts), ramp, R=1.4 * k, inner_line='k0', glint=False)
    I.layer(KP.poly([(12 * k, 8.5 * k), (15 * k, 12.5 * k), (12 * k, 16.5 * k), (9 * k, 12.5 * k)]), ['o2', 'o3', 'o4', 'o5'], R=1.4 * k,
            inner_line='o1', glint=False)
    return I.raster()


_ART = {}


def card_art(ty):
    """One art per kind, the way the game's gem gives each kind one shape: attack a blade, ward the shield, focus the
    fanned cards, arcane the orb."""
    if ty not in _ART:
        _ART[ty] = {'attack': blade40, 'ward': lambda: KI.ward(40), 'focus': cards40, 'arcane': lambda: KI.orb(40)}[ty]()
    return _ART[ty]


CARD_W, CARD_H = 150, 172
# the number's colour by kind, as CardHand.tsx colours card__number--{type}: attack the damage red, ward the combat
# board's slate (Barrier), focus the game's hearth amber, arcane a pale bone (the kit has no violet ramp)
NUM_RAMP = {'attack': 'Oxblood', 'ward': 'Slate', 'focus': 'Ochre', 'arcane': 'Bone'}


def game_card(x, y, f, state='idle'):
    """A card in the game's own look: kit.card() as the combat board draws the hand (cost gems and 'n AP', the name,
    the 40 px art, the cast number and what it counts, a groove, the small print and who it lands on). Two changes,
    copied rather than forked: the number takes its kind's colour (CardHand.tsx does), and the card is 150 wide, not 136,
    so 'Inspiring Strike' sits on one line at s16 (127 px) or s15 (121 px) as the kit's 108 px name line cannot hold it."""
    w, h = CARD_W, CARD_H
    sel = state == 'chosen'
    y0 = y - 20 if sel else y
    pips = ''.join(KI.small_gem().inline('margin-right:3px') for _ in range(f['cost']))
    tc = 'straw' if state in ('hover', 'chosen') else 'bone'
    nm = numeral(f['number'], 30, NUM_RAMP[f['type']], track=3)
    ncls = 's16' if text_w(f['name'], 16, 700) <= w - 28 else 's15'
    body = (f'<div class="abs nowrap" style="left:14px;top:13px;height:9px">{pips}</div>'
            + T(w - 14, 11, f'{f["cost"]} AP', f's13 {"straw" if sel else "dim"}', style='transform:translateX(-100%)')
            + T(14, 28 if ncls == 's16' else 29, f['name'], f'{ncls} {tc}')
            + card_art(f['type']).svg(16, 56) + nm.svg(70, 58)
            + T(70, 58 + nm.h + 1, f['unit'], 's13 dim') + groove(14, 110, w - 28)
            + T(14, 118, f['line1'], 's13 dim') + T(14, 136, f['line2'], 's13 bone'))
    out = window(x, y0, w, h, body, state='hover' if state in ('hover', 'chosen') else 'idle', kind='card')
    if sel:
        out += brackets(x - 7, y0 - 7, w + 16, h + 16)
    return out


# ================================================================== the full art, resized once and placed 1:1
CACHE = HERE + '/cache'


def art_uri(sprite, h):
    """The sprite's full art cropped to its alpha box and resized ONCE (Pillow LANCZOS) to height h. Returns (uri, w, h).
    Cached as a WebP with alpha; the same bytes on every run."""
    from PIL import Image
    os.makedirs(CACHE, exist_ok=True)
    p = f'{CACHE}/{sprite}_{h}.webp'
    src = Image.open(f'{GAME}/public/sprites/units/{sprite}.png').convert('RGBA')
    bb = src.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    crop = src.crop(bb)
    w = round(crop.width * h / crop.height)
    if not os.path.exists(p):
        crop.resize((w, h), Image.LANCZOS).save(p, 'WEBP', quality=92, alpha_quality=100, method=6)
    data = open(p, 'rb').read()
    return 'data:image/webp;base64,' + base64.b64encode(data).decode('ascii'), w, h


def standing_art(sprite, x, foot_y, h):
    """The full art at 1:1, its feet on foot_y, its left edge at x."""
    uri, w, hh = art_uri(sprite, h)
    return f'<img class="abs" alt="" width="{w}" height="{hh}" style="left:{x}px;top:{foot_y - hh}px;width:{w}px;height:{hh}px" src="{uri}">'


# ================================================================== the world under the screen: Riverside Market, dimmed
_TOWN = {}


def town_dim():
    """Riverside Market's square exactly as UxTown draws it (dirs/ux-town/uxscene.py, imported read-only, UxTown's camera,
    the company standing in the square), at 1:1 under the kit's flat scrim: the same backdrop UxSatchel opens over, since
    both screens are opened from the square. One PNG, embedded once."""
    if 'square' not in _TOWN:
        sys.path.insert(0, SP + '/dirs/ux-town')
        import uxscene as SQUARE
        cv, _ = SQUARE.render('square')
        _TOWN['square'] = cv.crop(0, 0, 1280, 720).data_uri()
    return (f'<img class="abs" alt="" width="1280" height="720" style="left:0;top:0;width:1280px;height:720px;image-rendering:pixelated" '
            f'src="{_TOWN["square"]}">' + scrim())


# ================================================================== local pieces over the kit's primitives
def rtext(x, y, text, cls='s13 dim'):
    """Right-aligned text ending at x."""
    return T(x, y, text, cls, style='transform:translateX(-100%)')


FACE_PITCH = 56


def face_strip(x, y, sel, refused=()):
    """Switch person: Q, the three faces (48, the chosen one lit), E. (x, y) = the strip's top-left; returns (html, width).
    refused = the ones who cannot take the piece being held: their face dimmed, with the kit's small lock on it."""
    out = T(x, y + 15, key('Q'), 's13')
    fx = x + 30
    for uid in ORDER:
        f = face(PEOPLE[uid]['face'], fx, y, 48, lit=uid == sel)
        if uid in refused:
            f = f'<div class="abs" style="left:0;top:0;opacity:.45">{f}</div>' + KI.lock_small().svg(fx + 48 - 12, y + 48 - 13)
        out += f
        fx += FACE_PITCH
    out += T(fx - FACE_PITCH + 48 + 8, y + 15, key('E'), 's13')
    return out, (fx - FACE_PITCH + 48 + 8 + 26) - x


def side_tip(x, y, text, w):
    """kit.tooltip() set beside what it explains: the same box, wrapped to w, its nub turned to point left."""
    nub = (f'<svg class="abs" width="11" height="6" viewBox="0 0 11 6" shape-rendering="crispEdges" '
           f'style="left:-9px;top:14px;transform:rotate(90deg)">{K._NUB.paths()}</svg>')
    return f'<div class="tip" style="left:{x}px;top:{y}px;width:{w}px;white-space:normal">{text}{nub}</div>'


def strip_width():
    return 30 + FACE_PITCH * 2 + 48 + 8 + 26
