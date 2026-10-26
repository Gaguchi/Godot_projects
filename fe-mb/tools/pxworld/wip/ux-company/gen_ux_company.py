"""UxPerson, UxPersonDeck, UxEquip: the person screens (they replace F64Company).

One screen function (screen.py#person_screen) with two tabs, Kit and Deck, and a strip of the three faces (Q and E);
these are its three states. Riverside Market, day 4, after the inn and the market: everyone whole, 89 gold, the
satchel holding rations x1 and x4, the Healing Potion and the new Iron Buckler. The Foundling is chosen on all three.

    cd <scratchpad> && python dirs/ux-company/gen_ux_company.py && node preview.mjs UxPerson UxPersonDeck UxEquip
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from screen import *  # noqa: E402,F401,F403
from uxc import card_face  # noqa: E402

# UxPerson: the Kit tab. How is he kitted?
print(write('UxPerson', board_html(
    "The Company · The Foundling's kit: Iron Sword in the left hand, the right hand empty, 9 cards",
    person_screen('mc', 'kit'))))

# UxPersonDeck: the Deck tab. What will he draw? Pointing at Riposte Stance, the card whose face says least: its
# tooltip is the rule in combat/damage.ts (a unit with riposte that takes physical damage from an adjacent attacker
# deals its stacks back), at the card's own value and duration.
rs = card_face('iron_sword_riposte', 'mc')
tip = f'For 1 turn, when a foe beside him lands a physical blow, he hits back for {rs["number"]}.'
print(write('UxPersonDeck', board_html(
    "The Company · The Foundling's deck: 5 cards from the class and 4 from the Iron Sword, pointing at Riposte Stance",
    person_screen('mc', 'deck', hover_card='iron_sword_riposte', tip=tip))))

# UxEquip: holding the Iron Buckler from the satchel, pointing at his empty right hand.
print(write('UxEquip', board_html(
    "The Company · holding the Iron Buckler from the satchel, pointing at The Foundling's right hand: 9 to 12 cards",
    person_screen('mc', 'kit', held='iron_buckler'))))
