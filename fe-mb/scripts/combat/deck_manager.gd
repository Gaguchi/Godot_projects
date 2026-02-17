extends RefCounted
## DeckManager - Manages a single unit's draw pile, hand, and discard pile
## One instance per player unit in combat

signal hand_changed(hand: Array)
signal deck_shuffled

var draw_pile: Array = []     # CardData instances (shuffled)
var hand: Array = []          # Current hand (max 5)
var discard_pile: Array = []  # Used cards

var max_hand_size: int = 5


## Initialize the deck from a unit's card list — copies and shuffles
func init_deck(cards: Array) -> void:
	draw_pile.clear()
	hand.clear()
	discard_pile.clear()
	for card in cards:
		if card is CardData:
			draw_pile.append(card.duplicate_card())
	shuffle_deck()


## Draw cards from the draw pile into hand
func draw_cards(count: int) -> Array:
	var drawn: Array = []
	for i in count:
		if hand.size() >= max_hand_size:
			break
		if draw_pile.is_empty():
			_reshuffle_discard()
			if draw_pile.is_empty():
				break  # No cards left anywhere
		var card = draw_pile.pop_back()
		hand.append(card)
		drawn.append(card)
	hand_changed.emit(hand)
	return drawn


## Play a card from hand — moves to discard (or removes if consumable)
func play_card(card: CardData) -> void:
	var idx := hand.find(card)
	if idx < 0:
		return
	hand.remove_at(idx)
	if not card.is_consumable:
		discard_pile.append(card)
	hand_changed.emit(hand)


## Discard entire hand (end of turn)
func discard_hand() -> void:
	for card in hand:
		discard_pile.append(card)
	hand.clear()
	hand_changed.emit(hand)


## Shuffle the draw pile
func shuffle_deck() -> void:
	# Fisher-Yates shuffle
	for i in range(draw_pile.size() - 1, 0, -1):
		var j = randi() % (i + 1)
		var temp = draw_pile[i]
		draw_pile[i] = draw_pile[j]
		draw_pile[j] = temp


## Reshuffle discard pile into draw pile
func _reshuffle_discard() -> void:
	if discard_pile.is_empty():
		return
	draw_pile.append_array(discard_pile)
	discard_pile.clear()
	shuffle_deck()
	deck_shuffled.emit()


## Get total cards remaining (draw + discard, not counting hand)
func get_cards_remaining() -> int:
	return draw_pile.size() + discard_pile.size()


## Get draw pile size
func get_draw_count() -> int:
	return draw_pile.size()


## Get discard pile size
func get_discard_count() -> int:
	return discard_pile.size()
