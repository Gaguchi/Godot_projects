"""The person screen, built once: person_screen(uid, tab, held, hover_card) returns the whole 1280 x 720 body.

    tab='kit'   How is this person kitted?   the hands (focal), HP and the seven stats, the deck by source
    tab='deck'  What will they draw?          the deck as cards, grouped by where each comes from
    held=item   Where does it go?             the Kit tab with the satchel opened beside him, the target hand lit,
                                              the change shown before it is made, one brass primary

The frame is the same in every state: Riverside Market dimmed under the screen, the header window top-left (the place,
the screen, the one way back), the full art under it at 1:1, the sheet window (name, class line, Q / faces / E, the
Kit and Deck tabs). Holding gear narrows the sheet and opens the satchel window to its right; nothing else moves.
"""
from uxc import *  # noqa: F401,F403
from uxc import K, KI, KP

# ------------------------------------------------------------------ the frame (stage px)
HX, HY, HW, HH = EDGE, EDGE, 320, 134           # the header: where you are, the screen, the way back
ART_H = 540                                      # the full art's height on screen (the figure, cropped to its alpha box)
ART_FOOT = 720 - EDGE                            # his feet on the stage's foot margin
SX, SY = HX + HW + GAP, EDGE                     # the sheet
SH = 720 - 2 * EDGE
SW_WIDE = 1280 - EDGE - SX                       # 920: Kit and Deck
SAT_W = 392                                      # the satchel window: the 8 x 4 bag (352) + its insets
SW_NARROW = 1280 - EDGE - SAT_W - GAP - SX       # 516: the sheet while the satchel is open
SAT_X = SX + SW_NARROW + GAP
HEAD_TABS_Y = 80                                 # the tab strip's top inside the sheet
BODY_Y = 132                                     # the first body row inside the sheet


def header(way_back, way_sub=None):
    """Where you are (the place and the day, then the screen) and the one way back, which Esc also takes."""
    b = T(PAD, 14, 'Riverside Market · day 4', 's13 dim')
    b += T(PAD, 32, 'The Company', 'tt')
    b += groove(PAD, 88, HW - 2 * PAD)
    b += T(PAD, 99, way_back, 's18 bone') + rtext(HW - PAD, 100, key('Esc'), 's13')
    if way_sub:
        b += T(PAD, 121, way_sub, 's13 dim')
    return window(HX, HY, HW, HH, b)


def art(uid):
    uri, w, h = art_uri(PEOPLE[uid]['sprite'], ART_H)
    x = HX + (HW - w) // 2
    return standing_art(PEOPLE[uid]['sprite'], x, ART_FOOT, ART_H)


def sheet_head(uid, w, tab, held=None):
    p = PEOPLE[uid]
    b = person(PAD, 16, p['name'], 'straw')
    b += T(PAD, 44, f'{class_name(uid)} · level 1 · mov {CLASSES[p["cls"]]["startingMov"]}', 's14 dim')
    sw = strip_width()
    refused = {'lilina'} if held == 'iron_buckler' else set()
    strip, _ = face_strip(w - PAD - sw, 12, uid, refused=refused)
    b += strip
    if refused:
        # canHold's sentence for the one who cannot take it, under the strip, in the kit's refusal style
        b += f'<div class="abs why" style="right:{PAD}px;top:{HEAD_TABS_Y + 9}px">Lilina: mages do not carry shields</div>'
    # D opens the deck (Slay the Spire's key, UXREFS §4) and, pressed again, goes back to the kit. While gear is held
    # both tabs are disabled and D does nothing until Enter or Esc settles the held piece.
    kst = 'opacity:.4;' if held else ''
    deck_lab = f'Deck<span class="key" style="margin-left:9px;vertical-align:2px;{kst}">D</span>'
    if held:
        b += tabs(PAD, HEAD_TABS_Y, ['Kit', deck_lab], selected=-1, disabled=(0, 1), w=w - 2 * PAD)
    else:
        b += tabs(PAD, HEAD_TABS_Y, ['Kit', deck_lab], selected=0 if tab == 'kit' else 1, w=w - 2 * PAD)
    return b


# ------------------------------------------------------------------ a hand: the slot well, without the kit's name line
def hand_well(x, sy, hand, item_id=None, state='idle', w=64, h=108):
    """equip_slot's well and item tile (kit.py), drawn without its labels and name line so the name can sit beside it
    at reading size. state idle | target (dashed brass + brackets: pointed at) | valid (dashed brass, not pointed at:
    a second legal hand, as Oak's two would be with Q/E while holding; not drawn on these three boards)."""
    well = Raster(w, h)
    for j in range(h):
        for i in range(w):
            if i == 0 or j == 0:
                well.set(i, j, 'w0')
            elif i == w - 1 or j == h - 1:
                well.set(i, j, 'w4')
            elif i == 1 or j == 1 or i == w - 2 or j == h - 2:
                well.set(i, j, 'k0')
    out = K._checker(x + 2, sy + 2, w - 4, h - 4, 'k1', 'k1') + well.svg(x, sy)
    if item_id:
        it = item(item_id)
        tw, th = w - 8, min(h - 8, it['h'] * 48 - 4)
        out += K._item_tile(x + 4, sy + 4, tw, th, it['rarity'], 'filled')
        out += KI.get(it['icon']).svg(x + (w - 24) // 2, sy + 4 + (th - 24) // 2)
    else:
        out += KI.silhouette('sword' if hand == 'left' else 'shield').svg(x + (w - 24) // 2, sy + (h - 24) // 2)
    if state in ('target', 'valid'):
        R = Raster(w + 6, h + 6)
        for i in range(w + 6):
            for j in range(h + 6):
                if (i in (0, w + 5) or j in (0, h + 5)) and (i + j) % 4 < 2:
                    R.set(i, j, 'o4')
        out += R.svg(x - 3, sy - 3)
    if state == 'target':
        out += brackets(x - 8, sy - 8, w + 16, h + 16, small=True)
    return out


def hand_labels(x, y, hand):
    lab, kind = {'left': ('Left hand', 'weapon'), 'right': ('Right hand', 'off-hand')}[hand]
    return T(x, y, lab, 's13 bone') + T(x, y + 16, kind, 's13 dim')


def kind_words(item_id):
    """Town.tsx#shelfWords: what a piece of gear IS, in the shopkeeper's words, and its rarity."""
    it = item(item_id)
    if it['kind'] == 'shield':
        w = 'off-hand shield'
    else:
        w = f"{'two-handed' if it.get('twoHanded') else 'one-handed'} {it.get('weaponClass') or it['kind']}"
    return f"{w} · {it['rarity']}"


# ------------------------------------------------------------------ Kit
def card_rows(x, y, w, cids, uid, pitch=22):
    """What a piece of gear brings, one line a card: the cost, the name, the number and what it counts (and the
    second thing it does, where it does one)."""
    out = ''
    for i, cid in enumerate(cids):
        f = card_face(cid, uid)
        extra = f['line1'] if f['line1'] not in ('physical', 'magic', 'ward', 'focus') else ''
        what = f'{f["number"]} {f["unit"]}' + (f' <span class="dim">· {extra}</span>' if extra else '')
        yy = y + i * pitch
        out += T(x, yy + 2, f'{f["cost"]} AP', 's13 dim') + T(x + 42, yy, f['name'], 's15 bone') + rtext(x + w, yy + 1, what, 's14 bone')
    return out


BAND_Y = BODY_Y + 4                         # the first hand band's top; the bands sit here in every state
BAND_PITCH = 38 + 108 + 20 + 16             # labels, the well, the gap, the groove


def hand_band(uid, hand, iid, w, y, held=None):
    """One hand band: the labels, the slot well, what is in it (or what goes in it) and what it brings. The same x and
    y in the Kit tab and while holding, so the hand the held piece goes to lights where it already is."""
    inner = w - 2 * PAD
    tx = PAD + 64 + 18                     # the name column, right of the slot
    sy = y + 38
    b = hand_labels(PAD, y, hand)
    if held:
        hi = item(held)
        if iid:                            # the hand that keeps its piece: not lit, nothing to do
            b += hand_well(PAD, sy, hand, iid)
            b += T(tx, sy - 2, item(iid)['name'], 's18 bone') + T(tx, sy + 22, 'stays where it is', 's13 dim')
        else:                              # the one hand it goes to, lit where it stands, and the cards it adds
            b += hand_well(PAD, sy, hand, None, 'target')
            b += T(tx, sy - 2, f'the {hi["name"]} goes here', 's18 straw')
            b += T(tx, sy + 23, f'brings {len(hi["gearCardIds"])} cards', 's13 ochre')
            b += card_rows(tx, sy + 44, PAD + inner - tx, hi['gearCardIds'], uid)
        return b
    cx = PAD + 440                         # the 'what it brings' column
    cw = inner - 440
    trained = CLASSES[PEOPLE[uid]['cls']]['weaponClasses']
    b += hand_well(PAD, sy, hand, iid)
    if iid:
        it = item(iid)
        b += T(tx, sy - 2, it['name'], 's18 bone') + T(tx, sy + 22, kind_words(iid), 's13 dim')
        b += button('Put away', 'secondary', x=tx, y=sy + 108 - 32)
        b += T(cx, sy - 1, f'brings {len(it["gearCardIds"])} cards', 's13 ochre')
        b += card_rows(cx, sy + 21, cw, it['gearCardIds'], uid)
    else:
        takes = ' or a '.join(k for k in ('sword', 'shield') if k in trained)
        b += T(tx, sy - 2, 'empty', 's18 faint') + T(tx, sy + 22, f'a {takes} fits here', 's13 dim')
        b += button('Try the Iron Buckler', 'secondary', x=tx, y=sy + 108 - 32)
        fit = item('iron_buckler')
        b += T(cx, sy - 1, 'in the satchel, for this hand', 's13 ochre')
        b += icon(fit['icon'], cx, sy + 22) + T(cx + 32, sy + 21, fit['name'], 's15 bone')
        b += T(cx + 32, sy + 41, kind_words('iron_buckler'), 's13 dim')
        b += rtext(cx + cw, sy + 22, f'brings {len(fit["gearCardIds"])} cards', 's14 bone')
    return b


def hand_bands(uid, w, held=None):
    b = ''
    y = BAND_Y
    for hand, iid in zip(('left', 'right'), PEOPLE[uid]['hands']):
        b += hand_band(uid, hand, iid, w, y, held)
        b += groove(PAD, y + 38 + 108 + 20, w - 2 * PAD)
        y += BAND_PITCH
    return b, y


def kit_body(uid, w):
    """The Kit tab: a band per hand (the slot; what is in it and the one verb for it; what it brings), then health and
    the seven stats beside the deck's count and the way to its cards."""
    p = PEOPLE[uid]
    inner = w - 2 * PAD
    b, y = hand_bands(uid, w)
    # health and the seven
    colw = (inner - 40) // 2
    lx, rx = PAD, PAD + colw + 40
    hp, mx = p['hp']
    b += section_head('Health and stats', x=lx, y=y, w=colw)
    b += T(lx, y + 36, f'{hp}/{mx}', 's18 bone') + T(lx + 62, y + 39, 'hp', 's13 dim')
    b += hp_bar(lx + 92, y + 43, colw - 92, hp, mx)
    st = stats_of(uid)
    sw = colw // 7
    for i, k in enumerate(STATS):
        b += T(lx + i * sw, y + 68, k.upper(), 's13 dim c', w=sw)
        b += T(lx + i * sw, y + 86, str(st[k]), 's18 bone c', w=sw)
    # the deck: only its size, the draw, and the way to the cards. Where the cards come from is in the bands above.
    n = deck_size(uid)
    b += section_head('The deck', x=rx, y=y, w=colw, note=f'{n} cards')
    b += T(rx, y + 38, f'Each turn {p["pron"]} draws up to {HAND_SIZE} of them.', 's15 bone')
    # the link to the deck screen (UXREFS §1.9: the count, with a way to the cards); the Deck tab and D do the same
    b += T(rx, y + 74, f'See the {n} cards<span class="key" style="margin-left:10px;vertical-align:1px">D</span>', 's15 bone')
    return b


# ------------------------------------------------------------------ Deck
def deck_body(uid, w, hover_card=None, tip=None):
    p = PEOPLE[uid]
    left, right = p['hands']
    b = ''
    y = BODY_Y
    pitch = CARD_W + 10
    tip_html = ''
    for src, cids in deck_groups(uid):
        what = class_name(uid) if src == 'innate' else item(left if src == 'hand_left' else right)['name']
        b += section_head(f'{SOURCE_LABEL[src]} · {what}', x=PAD, y=y, w=w - 2 * PAD, note=f'{len(cids)} cards')
        cy = y + 36
        for i, cid in enumerate(cids):
            f = card_face(cid, uid)
            st = 'hover' if cid == hover_card else 'idle'
            cx = PAD + i * pitch
            b += game_card(cx, cy, f, st)
            if st == 'hover':
                # the bracket cursor, as on the map, the town and UxEquip; the rule beside it, its nub pointing left
                b += brackets(cx - 7, cy - 7, CARD_W + 16, CARD_H + 16)
                if tip:
                    tip_html = side_tip(cx + CARD_W + 18, cy + 18, tip, 206)
        y = cy + CARD_H + 18
    if not right:
        b += T(PAD, y, 'Right hand <span class="dim">· empty</span>', 's15 faint')
        b += rtext(w - PAD, y + 3, '0 cards', 's13 dim')
        y += 26
    n = deck_size(uid)
    b += groove(PAD, y + 4, w - 2 * PAD)
    b += T(PAD, y + 16, f'{n} cards. Each turn {p["pron"]} draws up to {HAND_SIZE} of them.', 's14 bone')
    return b + tip_html


# ------------------------------------------------------------------ Kit, holding a piece from the satchel
def equip_body(uid, w, held):
    """Holding a piece: the Kit tab's bands at the same x and y, the hand it goes to lit in place with the cards it
    adds; then the change (the deck count, where the cards come from) with the one primary straight under it."""
    p = PEOPLE[uid]
    left, right = p['hands']
    hi = item(held)
    b, y2 = hand_bands(uid, w, held)
    y2 += 2
    label = f'Put it in {"her" if p["pron"] == "she" else "his"} right hand'
    bw = text_w(label, 17, 700) + 42
    by = y2 + 70                           # the primary straight under the change it commits, right-aligned
    before = deck_size(uid)
    after = deck_size(uid, (left, held))
    n = numeral(f'{before} → {after}', 22, 'Ochre')
    b += T(PAD, y2 + 4, 'The deck', 's16 ochre') + n.svg(PAD + 86, y2) + T(PAD + 86 + n.w + 8, y2 + 5, 'cards', 's13 dim')
    parts = [f'{class_name(uid)} {len(CLASSES[p["cls"]]["innateCardIds"])}', f'{item(left)["name"]} {len(item(left)["gearCardIds"])}']
    b += T(PAD, y2 + 34, ' · '.join(parts) + f' · <span class="bone">{hi["name"]} +{len(hi["gearCardIds"])}</span>', 's13 dim')
    # the one primary, right-aligned with its key beside it as UxSatchel's and UxMarket's are, sits under the change
    # rather than at the sheet's foot: the foot would leave the commit 70 px from what it commits.
    # The Loadout's own verb is 'Take Iron Buckler', printed ON the hand it fills; here it names the hand (UXREFS §1.11)
    b += button(label, 'primary', x=w - PAD - bw, y=by, w=bw)
    b += rtext(w - PAD - bw - 12, by + 9, key('Enter'), 's13')
    return b


def satchel_window(held, uid):
    b = section_head('The satchel', w=SAT_W - 2 * PAD, note='26 squares free')
    rest = [e for e in BAG_AFTER_MARKET if e[0] != held]
    c, r = next((c, r) for iid, c, r, _ in BAG_AFTER_MARKET if iid == held)
    b += bag(PAD, HEAD_Y, rest)
    # the held piece's square, lifted: its icon faint and a dashed bone outline where it sat. The one bracket on the
    # screen is on the hand it goes to.
    cell = 44
    qx, qy = PAD + c * cell, HEAD_Y + r * cell
    R = Raster(cell - 2, cell - 2)
    for i in range(cell - 2):
        for j in range(cell - 2):
            if (i in (0, cell - 3) or j in (0, cell - 3)) and (i + j) % 4 < 2:
                R.set(i, j, 'b2')
    b += R.svg(qx + 1, qy + 1)
    b += f'<div class="abs" style="left:{qx + 10}px;top:{qy + 10}px;width:24px;height:24px;opacity:.4">{icon(item(held)["icon"], 0, 0)}</div>'
    y = HEAD_Y + 176 + 14
    b += groove(PAD, y, SAT_W - 2 * PAD)
    y += 12
    it = item(held)
    b += T(PAD, y, 'Holding', 's13 dim')
    b += icon(it['icon'], PAD, y + 20) + T(PAD + 32, y + 21, it['name'], 's16 straw')
    b += T(PAD + 32, y + 42, kind_words(held), 's13 dim')
    h = y + 42 + 16 + PAD
    return window(SAT_X, EDGE, SAT_W, h, b)


# ------------------------------------------------------------------ the screen
def person_screen(uid='mc', tab='kit', held=None, hover_card=None, tip=None):
    body = town_dim()
    # one step deeper under the art column, so the 1x square reads as backdrop beside the painted figure
    # it eases out under the sheet's left edge, so the stage margins above and below the sheet show no step
    d = rgba("k0", .45)
    body += (f'<div class="abs" style="left:0;top:0;width:{SX + 8}px;height:720px;'
             f'background:linear-gradient(to right,{d} 0,{d} {SX - 40}px,rgba(0,0,0,0) {SX + 8}px)"></div>')
    if held:
        body += header('Put it back', None)
    else:
        body += header('Back to the square', None)
    body += art(uid)
    w = SW_NARROW if held else SW_WIDE
    sb = sheet_head(uid, w, tab, held)
    if held:
        sb += equip_body(uid, w, held)
    elif tab == 'kit':
        sb += kit_body(uid, w)
    else:
        sb += deck_body(uid, w, hover_card, tip)
    body += window(SX, SY, w, SH, sb)
    if held:
        body += satchel_window(held, uid)
    return body
