extends PanelContainer
class_name CombatForecast

signal attack_confirmed
signal attack_cancelled

@onready var atk_name: Label = %NameLabel
@onready var atk_hp: HealthBar = %HealthBar
@onready var atk_dmg: StatRow = %DmgStat
@onready var atk_hit: StatRow = %HitStat
@onready var atk_crit: StatRow = %CritStat

@onready var def_name: Label = %DefNameLabel
@onready var def_hp: HealthBar = %DefHealthBar
@onready var def_dmg: StatRow = %DefDmgStat
@onready var def_hit: StatRow = %DefHitStat
@onready var def_crit: StatRow = %DefCritStat

@onready var attack_btn: Button = %AttackButton
@onready var cancel_btn: Button = %CancelButton

func _ready():
	attack_btn.pressed.connect(func(): attack_confirmed.emit())
	cancel_btn.pressed.connect(func(): attack_cancelled.emit())

func setup(forecast: Dictionary):
	var attacker: UnitData = forecast.attacker
	var defender: UnitData = forecast.defender
	
	# Attacker Setup
	atk_name.text = attacker.unit_name
	atk_hp.setup(attacker.current_hp, attacker.max_hp)
	
	atk_dmg.set_stat("DMG", forecast.attacker_damage)
	atk_hit.set_stat("HIT", forecast.attacker_hit)
	atk_crit.set_stat("CRIT", forecast.attacker_crit)
	
	if forecast.attacker_doubles:
		atk_dmg.value_label.text += " x2"
		
	# Defender Setup
	def_name.text = defender.unit_name
	def_hp.setup(defender.current_hp, defender.max_hp)
	
	if forecast.defender_can_counter:
		def_dmg.set_stat("DMG", forecast.defender_damage)
		def_hit.set_stat("HIT", forecast.defender_hit)
		def_crit.set_stat("CRIT", forecast.defender_crit)
		
		if forecast.defender_doubles:
			def_dmg.value_label.text += " x2"
	else:
		def_dmg.value_label.text = "--"
		def_hit.value_label.text = "--"
		def_crit.value_label.text = "--"
