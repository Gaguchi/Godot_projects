extends Node
## Test-driven verification of DeckManager draw/discard/reshuffle logic
## Run scenes/combat/test_deck_manager.tscn directly (F6) to execute all tests

var _pass_count: int = 0
var _fail_count: int = 0
var _test_name: String = ""


func _ready() -> void:
	print("=" .repeat(60))
	print("  DECK MANAGER TESTS")
	print("=" .repeat(60))

	test_init_deck()
	test_draw_cards_basic()
	test_draw_cards_capped()
	test_draw_cards_uncapped()
	test_play_card()
	test_discard_hand()
	test_reshuffle_on_empty()
	test_full_turn_cycle()
	test_multi_turn_no_card_loss()
	test_draw_2_from_full_hand()
	test_draw_after_play()

	print("")
	print("=" .repeat(60))
	if _fail_count == 0:
		print("  ALL %d TESTS PASSED" % _pass_count)
	else:
		print("  %d PASSED, %d FAILED" % [_pass_count, _fail_count])
	print("=" .repeat(60))


# --- Helpers ---

func _make_dm(card_count: int = 12) -> RefCounted:
	var dm_script = load("res://scripts/combat/deck_manager.gd")
	var dm = RefCounted.new()
	dm.set_script(dm_script)

	# Create fake cards
	var cards: Array = []
	for i in card_count:
		var card = _make_card("Card_%d" % i)
		cards.append(card)
	dm.init_deck(cards)
	return dm


func _make_card(cname: String) -> CardData:
	var c := CardData.new()
	c.card_name = cname
	return c


func _total_cards(dm) -> int:
	return dm.draw_pile.size() + dm.hand.size() + dm.discard_pile.size()


func _begin(name: String) -> void:
	_test_name = name


func _assert_eq(actual, expected, label: String = "") -> void:
	if actual == expected:
		_pass_count += 1
	else:
		_fail_count += 1
		var msg := "  FAIL [%s]" % _test_name
		if label != "":
			msg += " %s" % label
		msg += ": expected %s, got %s" % [str(expected), str(actual)]
		print(msg)


func _assert_true(condition: bool, label: String = "") -> void:
	_assert_eq(condition, true, label)


# --- Tests ---

func test_init_deck() -> void:
	_begin("init_deck")
	var dm = _make_dm(12)

	_assert_eq(dm.draw_pile.size(), 12, "draw_pile size")
	_assert_eq(dm.hand.size(), 0, "hand size")
	_assert_eq(dm.discard_pile.size(), 0, "discard size")
	_assert_eq(_total_cards(dm), 12, "total cards")
	print("  [%s] init_deck: 12 cards in draw pile" % ("OK" if _fail_count == 0 else "FAIL"))


func test_draw_cards_basic() -> void:
	_begin("draw_basic")
	var dm = _make_dm(12)

	var drawn = dm.draw_cards(5, true)

	_assert_eq(drawn.size(), 5, "drawn count")
	_assert_eq(dm.hand.size(), 5, "hand size")
	_assert_eq(dm.draw_pile.size(), 7, "draw pile")
	_assert_eq(_total_cards(dm), 12, "total cards")
	print("  [%s] draw_basic: draw 5 from 12" % ("OK" if _fail_count == 0 else "!!"))


func test_draw_cards_capped() -> void:
	_begin("draw_capped")
	var dm = _make_dm(12)
	dm.draw_cards(5, true)  # hand = 5

	# Try drawing 2 more WITH cap — should draw 0
	var drawn = dm.draw_cards(2, true)

	_assert_eq(drawn.size(), 0, "drawn count (capped)")
	_assert_eq(dm.hand.size(), 5, "hand still 5")
	_assert_eq(_total_cards(dm), 12, "total cards")
	print("  [%s] draw_capped: can't exceed max_hand_size with cap" % ("OK" if _fail_count == 0 else "!!"))


func test_draw_cards_uncapped() -> void:
	_begin("draw_uncapped")
	var dm = _make_dm(12)
	dm.draw_cards(5, true)  # hand = 5

	# Draw 2 more WITHOUT cap — should draw 2, hand = 7
	var drawn = dm.draw_cards(2, false)

	_assert_eq(drawn.size(), 2, "drawn count (uncapped)")
	_assert_eq(dm.hand.size(), 7, "hand = 7")
	_assert_eq(dm.draw_pile.size(), 5, "draw pile = 5")
	_assert_eq(_total_cards(dm), 12, "total cards")
	print("  [%s] draw_uncapped: effect draws ignore hand limit" % ("OK" if _fail_count == 0 else "!!"))


func test_play_card() -> void:
	_begin("play_card")
	var dm = _make_dm(12)
	dm.draw_cards(5, true)

	var card = dm.hand[0]
	dm.play_card(card)

	_assert_eq(dm.hand.size(), 4, "hand after play")
	_assert_eq(dm.discard_pile.size(), 1, "discard after play")
	_assert_eq(_total_cards(dm), 12, "total cards")
	print("  [%s] play_card: card moves from hand to discard" % ("OK" if _fail_count == 0 else "!!"))


func test_discard_hand() -> void:
	_begin("discard_hand")
	var dm = _make_dm(12)
	dm.draw_cards(5, true)
	dm.play_card(dm.hand[0])  # play 1, hand=4, discard=1

	dm.discard_hand()

	_assert_eq(dm.hand.size(), 0, "hand empty")
	_assert_eq(dm.discard_pile.size(), 5, "discard = 1 played + 4 discarded")
	_assert_eq(dm.draw_pile.size(), 7, "draw pile unchanged")
	_assert_eq(_total_cards(dm), 12, "total cards")
	print("  [%s] discard_hand: remaining hand goes to discard" % ("OK" if _fail_count == 0 else "!!"))


func test_reshuffle_on_empty() -> void:
	_begin("reshuffle")
	var dm = _make_dm(6)  # Small deck
	dm.draw_cards(5, true)  # hand=5, draw=1

	# Play all 5, discard=5, draw=1
	for i in 5:
		dm.play_card(dm.hand[0])

	_assert_eq(dm.hand.size(), 0, "hand empty after playing all")
	_assert_eq(dm.discard_pile.size(), 5, "discard = 5")
	_assert_eq(dm.draw_pile.size(), 1, "draw = 1")

	# Now draw 5 — should draw 1 from draw, reshuffle 5 from discard, draw 4 more
	var drawn = dm.draw_cards(5, true)

	_assert_eq(drawn.size(), 5, "drew 5 after reshuffle")
	_assert_eq(dm.hand.size(), 5, "hand = 5")
	_assert_eq(_total_cards(dm), 6, "total cards preserved")
	print("  [%s] reshuffle: discard reshuffles into draw when empty" % ("OK" if _fail_count == 0 else "!!"))


func test_full_turn_cycle() -> void:
	_begin("full_turn")
	var dm = _make_dm(12)

	# Turn 1: draw 5, play 2, end turn (discard remaining 3)
	dm.draw_cards(5, true)
	_assert_eq(_total_cards(dm), 12, "total after draw")

	dm.play_card(dm.hand[0])
	dm.play_card(dm.hand[0])
	_assert_eq(dm.hand.size(), 3, "hand after 2 plays")
	_assert_eq(dm.discard_pile.size(), 2, "discard after 2 plays")
	_assert_eq(_total_cards(dm), 12, "total after plays")

	dm.discard_hand()  # end turn
	_assert_eq(dm.hand.size(), 0, "hand after end turn")
	_assert_eq(dm.discard_pile.size(), 5, "discard = 2 played + 3 discarded")
	_assert_eq(dm.draw_pile.size(), 7, "draw pile")
	_assert_eq(_total_cards(dm), 12, "total after end turn")

	# Turn 2: discard (no-op) + draw 5
	dm.discard_hand()
	dm.draw_cards(5, true)
	_assert_eq(dm.hand.size(), 5, "hand turn 2")
	_assert_eq(dm.draw_pile.size(), 2, "draw pile turn 2")
	_assert_eq(dm.discard_pile.size(), 5, "discard turn 2")
	_assert_eq(_total_cards(dm), 12, "total turn 2")

	print("  [%s] full_turn: 2-turn cycle preserves all cards" % ("OK" if _fail_count == 0 else "!!"))


func test_multi_turn_no_card_loss() -> void:
	_begin("multi_turn")
	var dm = _make_dm(12)

	# Simulate 10 turns: draw 5, play 3, end turn
	for turn in 10:
		dm.discard_hand()
		dm.draw_cards(5, true)
		_assert_eq(_total_cards(dm), 12, "total at turn %d start" % turn)

		# Play up to 3 cards
		var plays := mini(3, dm.hand.size())
		for p in plays:
			dm.play_card(dm.hand[0])

		_assert_eq(_total_cards(dm), 12, "total at turn %d after plays" % turn)
		dm.discard_hand()
		_assert_eq(_total_cards(dm), 12, "total at turn %d end" % turn)

	print("  [%s] multi_turn: 10 turns, no cards lost" % ("OK" if _fail_count == 0 else "!!"))


func test_draw_2_from_full_hand() -> void:
	_begin("draw2_full")
	var dm = _make_dm(12)
	dm.draw_cards(5, true)  # hand=5

	# Play 1 card (hand=4), then draw 2 uncapped (simulating Rally)
	dm.play_card(dm.hand[0])
	_assert_eq(dm.hand.size(), 4, "hand after play")

	var drawn = dm.draw_cards(2, false)
	_assert_eq(drawn.size(), 2, "drew 2 (uncapped)")
	_assert_eq(dm.hand.size(), 6, "hand = 6")
	_assert_eq(_total_cards(dm), 12, "total preserved")
	print("  [%s] draw2_full: Rally from hand of 5 → play 1, draw 2 = hand of 6" % ("OK" if _fail_count == 0 else "!!"))


func test_draw_after_play() -> void:
	_begin("draw_after_play")
	var dm = _make_dm(12)

	# Simulate: draw 5, play Rally (draw 2), play another card, end turn
	dm.draw_cards(5, true)
	var rally = dm.hand[0]
	dm.play_card(rally)  # hand=4, discard=1
	var drawn = dm.draw_cards(2, false)  # hand=6, draw pile shrinks by 2
	_assert_eq(drawn.size(), 2, "Rally drew 2")
	_assert_eq(dm.hand.size(), 6, "hand = 6 after Rally")
	_assert_eq(_total_cards(dm), 12, "total after Rally")

	# Play another card
	dm.play_card(dm.hand[0])  # hand=5, discard=2
	_assert_eq(_total_cards(dm), 12, "total after 2nd play")

	# End turn
	dm.discard_hand()
	_assert_eq(dm.hand.size(), 0, "hand empty")
	_assert_eq(_total_cards(dm), 12, "total after end turn")

	# Next turn
	dm.discard_hand()
	dm.draw_cards(5, true)
	_assert_eq(dm.hand.size(), 5, "hand next turn")
	_assert_eq(_total_cards(dm), 12, "total next turn")
	print("  [%s] draw_after_play: Rally + play + end turn + next turn" % ("OK" if _fail_count == 0 else "!!"))
