# Embermarch — "The Long Carry": Cast & Premise Design
**Date:** 2026-07-18 · **Status:** PARKED — NOT approved. The user reviewed this concept and wants the story, world, and characters worked out through discussion instead; treat this document as one input, not direction. The Appendix A identity-layer prerequisite was implemented independently using existing unit ids — no `characterId` field (commit e157814).

**Decisions this design implements** (user-selected 2026-07-17):
1. **Signature cards** — every named character carries 1-2 personal cards; personality is played, not read.
2. **Authored ensemble** — 3 starters + 8 recruits, each joining through an authored scene; no shop-row recruitment.
3. **Desperate company** tone — nobody marches for glory; warmth is earned.

**Provenance:** 4-reader codebase survey (narrative/mechanical/visual/docs) → 3-concept tournament (ember-carriers / debt-column / ash-road-home) → 3 adversarial judges (player-experience, craft, production lenses) → synthesis of consensus winner + grafts. Presented and approved via artifact.

---

# EMBERMARCH — The Long Carry
### Definitive Cast & Premise (post-tournament synthesis)

Base: Concept 1 (consensus winner). Grafted: C2's capture economy, "Paid in full" ritual, interlocked starter guilt, villain-owned friction, memorial gear, and the loophole-reading recruitment beat; C3's capturable final boss, pre-measured memorial dread, persistent death markers, Kept Name inheritance, questless milestone recruit, and ordered title reveals. Every judged weakness has a named fix inline.

---

## PREMISE (the Embermarch, literal)

When the city of **Verrow** burned under a lawful fire-writ, one junior keeper carried its hearth-coal out through the gate. Under fire-law, a city is not dead while its hearth burns: if the **Verrow Coal** is struck into a new firepit at the chartered founding site in the Ashfall Peaks before Firstfrost, Verrow legally *persists* — its survivors keep their claims, and the burning becomes the murder of a living city. If the coal goes out, Verrow was never anything but a demolition.

An **Embermarch** is the rite of carriage: the duty, the chartered road through the Borderlands, the Thornwood, and Ashfall — and the company itself. Swearing the **coal-oath** suspends any debt, warrant, or sentence until delivery. So the only people who carry it are people who need that clause.

The coal rides in an iron cask and **eats** — hardwood and a share of the company's tallow (see THE COAL below). A fed coal keeps the Thornwood's dark things outside the light and banks **Ember tokens** the company spends in battle. Starve the company and the coal dims with it — but it does not die of hunger. Fire-law is older than mercy: *flesh may feed the flame.* A keeper can always bank it in ash and blood. The only way the run's fire ends is if the player loses the cask itself.

### The opening: how the rule teaches itself
*(Fix: front-loaded exposition. No lore scroll — the law is performed in the first ten minutes.)*

1. **Cold open (90 seconds).** Night. Verrow burning on the horizon. Maren, Odo, and Vess in the chandlery cellar, swearing the coal-oath over a workbench — in wax, because no one has ink. Three lines of dialogue. Cut to the road.
2. **Tutorial battle.** Two raiders of **the Guttered** hit the first camp, going for the cask. Move, attack. The last raider — **Cobb**, named — drops to 1 HP and the **Subdue** button lights hearth-orange. The tutorial's final instruction is mercy.
3. **First camp.** Maren holds Cobb's warrant-paper to the coal; the edge chars but does not burn. *"Your sentence sleeps while this burns. Deliver it, and the paper's ash. Let it die, and every debt on this road wakes up hungry."* Cobb swears. He joins as a generic unit. Vess, aloud, prices the alternative: his page was worth forty gold at Borderkeep. The entire legal premise, the capture fantasy, and the temptation — dramatized by minute ten, zero exposition scrolls.

---

## NAMING STYLE & VOICE REGISTERS

**Marchspeak:** clipped, hard-consonant given names (Maren, Odo, Vess, Rask, Fenn, Edda, Ilsa, Tulla, Sera, Corvane) followed by a byname *earned* from trade, deed, or place (Gate, Tallow, Warrant, Ledger, Wick, Vigil, Brand, Coldmark). Fire-law speaks in hearth-compounds ("the Underwriter," "coal-oath," "Firstfrost"). A deserter's byname is struck from the rolls: the worst thing you can be is a name no fire will record.

**Register table** *(fix: paperwork monoculture — exactly three institutional voices, each a different institution; everyone else speaks something earthier. A dialogue writer starts here.)*

| Character | Register |
|---|---|
| Maren | Keeper's plain-speech — short declaratives, fire-tending idiom, puts herself last in every sentence |
| Odo | Order-book military — itemizes, reads things aloud, signs off (institutional: garrison) |
| Vess | Chandler's craft-cynicism — wax, wick, render, hunger; trade-talk, not accountancy |
| Rask | Market patter — prices, trades, escrow of favors; warm underneath |
| Iven | Gang deflection — jokes at himself before you can; dares as affection |
| Fenn | Rural south-outland — flock idiom, weather-signs, sentences that end early |
| Doma | Guild-ledger formality (institutional: mercantile) |
| Edda | Hearth-proverb folk-liturgy — kitchen-scripture, endearments with teeth |
| Ilsa | Audit-report — findings, exhibits, qualified statements (institutional: judicial) |
| Tulla | Forge-and-build — heat, iron, load-bearing metaphors; apologizes cheerfully in advance |
| Sera | Road-liturgy — milestone lore, rite-cadence, a "we" that includes the dead |
| Corvane | Contract prose spoken like scripture — the only voice where paper sounds holy |

---

## THE FIVE MEANINGS OF "EMBERMARCH"
*(Graft: C3's ordered title reveal. Each meaning lands in a specific region; at least two are mechanical, not spoken.)*

1. **The rite** (prologue) — the carriage of a hearth-coal is "an embermarch." Taught by the opening.
2. **The company** (Borderlands) — any sworn column is "an embermarch." Taught when Cobb swears: the march is whoever the coal has claimed.
3. **The road** (Thornwood) — the Waymark Road's true name, earned over centuries of carriages. Taught by the nail-studded waymarks (mechanical: every nail is a marcher who died on it — including yours) and by the Guttered, who are what a march becomes when its coal dies.
4. **The law** (Ashfall) — the Assize of Flames; "to embermarch a sentence" is to suspend it by oath. The amnesty the entire company lives inside, named at last.
5. **The mirror** (finale) — what the road makes of the ones who fail it. Sera Coldmark and Provost Corvane walked the same guttered march nineteen years ago; she became the road's living ritual, he became its executioner. At the trial — or over his body — the word finally means: what you become when you carry, and what you become when you stop.

---

## THE COAL (run system)
*(Fixes: death spiral; tokens irrelevant to most of roster. One variable, three states, one universal spend.)*

**Glow states** (one `runStore` variable, moved at camp):
- **BRIGHT** — fed hardwood + tallow last camp. Company starts battle with 2 Ember tokens. Best camp events; dark things stay far.
- **STEADY** — fed hardwood only. 1 Ember token.
- **DIM** — banked in ash, unfed. 0 tokens; night-event risk up; Edda's lamp goes dark (she snuffs it herself, unasked). **Upkeep cost: zero** — banking is free.

**The floor:** the coal cannot die of hunger. Dim is a debuff spiral with a bottom, not a fail state. The coal is only lost through **scripted, telegraphed risks** — two boss mechanics (Harrow's toll-seizure, the finale) and one clearly-signposted Thornwood event. Losing the cask ends the run; nothing ends it silently.

**The valve:** double-feeding at one camp returns Dim to Bright. Charcoal-burner camps and shrine braziers (map nodes) refuel free. A starving company banks the coal, stops paying upkeep, and claws back.

**Ember tokens in combat — everyone touches the fire:**
- **Stoke** (universal free action, once per unit per turn): spend 1 token, that unit gains +1 AP. Every character, every class.
- **Kindled** riders: most signature cards carry a *Kindled:* line — an optional bonus that fires if you spend 1 token as you play the card. One primitive, reused everywhere.

---

## CAPTURE & THE COAL-OATH (run system)
*(Fixes: 'any captive may swear' backed by one recruit; single-point-of-failure capture engine. Grafts: C2's page-or-quill economy, C3's boss capture.)*

Ember-law makes recruitment and capture the same door. **Subdue is a company-wide basic action** (the existing capture flow) — any unit can take a weakened enemy alive; Rask makes it cheap and Edda makes it safe, so the engine survives any one death.

Every named-or-generic captive becomes a **page** on the company's roll. At the next stop, each page offers the same choice, surfaced in the quest log:
- **Offer the quill** (camp): they swear the coal-oath over the cask. Generics join as units (the Guttered are ex-marchers; most swear). Named captives have authored outcomes.
- **Sell the page** (fort or town): ransom them to the wardens for gold. Legal. Profitable. Watched — Ilsa notes it, and the company hears about it at the fire.
- **Refusals are real:** some captives will not swear (Harrow: *"I sell crossings. I don't buy ash."*). The oath is a door, not a conveyor.

**Named capturables across the run:** Cobb (tutorial), **Iven** (companion — the flagship), **Silt** the toll-reeve (becomes camp quartermaster NPC if sworn: shop discount, +1 fuel found per region; or 60 gold ransomed), **Harrow** (refuses; ransom prize, 150 gold), **the Struck Man** (Fenn's dark-path variant — can be re-taken alive and re-sworn, his byname restored: the redemption rhyme), and **Provost Corvane** himself (finale, below).

**The Guttered** *(graft: C3's enemy humanization)*: the Borderlands "bandits" are failed embermarches — companies whose coals died mid-road. Oaths void, sentences woken, they can't go home, so they rob the marches they used to be. A Guttered who swears to a living coal comes back under law. That is why capture is the game's recruitment fantasy and not a side rule.

---

## THE STARTERS — "the Verrow March"

All three were made keepers by accident of one bad night: Maren carried the coal out through Odo's gate, and Vess's chandlery cellar hid them till dawn. The oath was sworn over her workbench, in wax, because no one had ink.

---

### MAREN of Verrow — Lord (class: `lord`). The least keeper.

- **Want:** To deliver the coal and stop being the mistake that survived — every senior keeper died with the city; the rite fell to the one who happened to be near the gate.
- **Flaw:** Cannot let anyone else pay for anything. Takes every watch, every wound, every blame; spends herself like coin the company doesn't have.
- **Secret** *(rewired — fix: inert secret; graft: C2's interlocking timebomb)*: She was near the gate that night because she was **deserting the keepership** — bags packed, already through the crop-gate. Her post was the **south vigil**: the bell that warns the outlying granges. The bell never rang. The southern farms burned unwarned. Fenn's family farm was south-outland. She knows why the bell was silent. He doesn't — he thinks he was too slow to save them. Every night at the fire, she decides again not to tell him.
- **Authored detonation — "The Silent Bell"** (Thornwood border, triggers with Fenn and Ilsa both in company; Ilsa's default-file exhibits include the vigil roster):
  - The player can have Maren **confess first** — at any camp via a marked "Speak to Fenn" action, or by interrupting Ilsa's exhibit reading. Her line: *"The south bell didn't fail, Fenn. It waited for a keeper who was already through the crop-gate. You've been begging pardon for a sin that's mine."* Consequence: Fenn moves his bedroll inside the fire-ring permanently (sprite delta); his card gains its Kindled line for good.
  - Or **conceal** — Fenn reads the roster himself two nodes later. He leaves the company for the rest of the region (unavailable, marker on map), and returns changed, boots on, with one authored line: *"I came back for the coal. It never lied to me."*
  - Either path is journaled as the third of the Auditor's Questions (see Ilsa).
- **Voice:**
  - *"Feed the coal first. We can be hungry. It can't."*
  - *"I wasn't supposed to be the one carrying this. Neither were you. Eat your half."*
- **Signature cards:**
  - **I'll Carry It** (1 AP) — Maren gains Taunt on adjacent enemies and Armor 2 until her next turn. *Kindled:* Armor 4 and draw 1. *(She cannot physically watch someone else pay.)*
  - **By the Coal** (0 AP) — choose an ally: Maren moves 1 tile toward them for free and they gain Armor 1. *Kindled:* also heal them 2. *(She counts everyone. Always.)*
- **Visual identity:** Small wiry silhouette swallowed by an oversized keeper's storm-cloak, the iron ember-cask on her back like a lantern-reliquary glowing coal-orange through its vents; Verrow-blue scarf, short dark braid — iron-grey palette, ember-glow accent.

---

### ODO GATE — Shield Knight (class: `shield_knight`). The man who opened it.

- **Want:** To see the coal home — the only clause of his gate-oath still unbroken.
- **Flaw:** Obeys paper. He was gate-captain of Verrow; the fire-writ looked lawful and refusal meant his garrison hanged, so he opened the gate to the burners. He still hesitates when an enemy waves a seal — and he knows it, and it doesn't help.
- **Secret** *(retyped — fix: secret monotony; this is a planned confession, not an insurance policy)*: He kept the fire-writ. The original, with Provost Corvane's true seal, sewn into his gambeson — and it names *Officer Odo* as the man who ratified entry. He is not carrying it as leverage. He is carrying it to the Assize at Ashfall, knowing it convicts them both, and he has told no one that he has already decided to hang if that is the price of hanging Corvane.
- **Voice:**
  - *"I've read every order I ever obeyed. Once. Aloud. To the dead."*
  - *"Stand behind me. It's the one order I've never gotten wrong."*
- **Signature cards** *(fix: shield-knight boilerplate — the second card mechanizes the hesitation itself)*:
  - **The Gate Holds** (2 AP) — Odo gains Rooted (cannot move or be moved) until his next turn; Odo and each adjacent ally gain Armor 2. *Kindled:* Armor 3 instead. *(He is done opening.)*
  - **Read It Twice** (0 AP) — Odo ends his activation. At the start of his next turn, he gains +2 AP and draws 1. *Kindled:* no delay — gain 1 AP now. *(His doubt, made playable: he checks the order — unless the fire is bright enough to trust.)*
- **Visual identity:** Squat gate-slab silhouette — massive dented plate and a rectangular tower shield built like a studded gate door with a wicket hatch, faded Verrow-blue tabard, document tube at his hip; verdigris blue-grey palette.

---

### VESS TALLOW — Mage, fire (class: `mage`). The chandler who burns honest now.

- **Want:** To reach a family in Ashfall and put unspent coin in their hands — and to let the March's amnesty wash one specific fire off her.
- **Flaw** *(retyped — fix: resource-flaw sameness)*: Cannot admit need. Ask her for anything and she gives it; watch her, and she steals what she'd die before requesting. The hoarded wax and skimmed rations are the symptom; the shame is the disease.
- **Secret:** Years ago she was paid to set a fire — her only arson — and it killed her own apprentice, the Rennick boy. The coin sits sewn in her hem, never spent. The Rennicks fled to Ashfall — and *(new braid)* they are squatters at the founding site among Tulla's people; their surviving daughter tends the settlement's forge-fire. Vess's reckoning runs through Tulla.
- **Authored detonation — "The Forge-Girl":** at the Ashfall border camp, Tulla names the girl unprompted. Vess must ask, or walk away from the fire. At the founding site: deliver the coin, or keep silent — authored scene either way, epilogue variants both ways.
- **Voice:**
  - *"Fire's honest. It eats what you give it and shows you what you are. People lie about both."*
  - *"I've been cold two winters and warm one. I'll take the wax, if no one minds. No one minds."*
- **Signature cards:**
  - **Tallow-Dip** (1 AP) — this turn, Vess's attack cards deal +2 damage. *Kindled or spend 1 food:* +4 instead, and her next attack applies Burn 1. *(She will burn the company's dinner for power, without asking.)*
  - **Read the Ashes** (0 AP) — look at the top 3 cards of your draw pile and return them in any order; draw 1. *Kindled:* draw 2. *(Futures in cooling embers — hedge-craft, not scholarship.)*
- **Visual identity:** Stooped silhouette in a wax-stained layered apron over robes, candle bandolier across the chest, iron dipping-hook staff; smoke-grey palette, tallow-yellow accent.

---

### The bomb at the fire (starter interlock map)
*(Fix: outward-pointing secrets. Who is sitting on whose wound, nightly:)*

- **Maren → Fenn:** her empty vigil is his dead family; his misplaced guilt is her nightly choice.
- **Odo → everyone:** the writ in his gambeson is the trial's spine and his own noose; Corvane's parley offer prices it out loud.
- **Ilsa → Maren & Fenn & the March:** her bought audit wrote the default that legalized the burning; her pre-sealed finding can kill the March with a signature.
- **Rask ↔ Iven:** he wrote the bounty; his brother knows and has never said it.
- **Vess → Tulla:** the family Vess is marching toward are Tulla's settlers.
- **Sera ↔ Corvane:** the two survivors of the Coldmark march — the ritual and the executioner.

---

## THE RECRUITS (8)

Prisoners are potential brothers — that is why capture matters. Recruitment pacing: two quest-gated (Rask, Doma), one capture (Iven), one event-consequence (Fenn), one faction (Edda), one conscription (Ilsa), one foreshadowed guide (Tulla), one **questless milestone** (Sera — graft: C3's Merta beat, for pacing variety).

---

### RASK WARRANT — Archer, crossbow (class: `bandit_archer`). The hunter of his own making.
- **Want:** To retire the warrant — both meanings.
- **Flaw:** Transactional. Prices everything aloud, including kindness, which makes his kindnesses very hard to accept.
- **Secret:** The bounty on his brother exists because *Rask set it* — he informed on Iven's gang to force him out of the life, and the fort turned his tip into a kill-warrant. The whole hunt is his own handwriting.
- **Line:** *"Everything's got a price. I know because I've been most of them."*
- **Signature card:** **Taken Alive** (1 AP) — 5 damage that cannot reduce the target below 1 HP; if the target ends this turn Subdued, draw 1 and gain 10 gold. *Kindled:* +2 damage (still floors at 1). *(The capture engine's accelerator; mercy as a trade skill.)*
- **Visual identity:** Lean long-coated silhouette with a heavy crossbow and a ring of warrant-papers hanging at his belt like scalps; muted brown-black palette, paper-white accent.
- **Recruitment — "Brotherprice"** (reworks `blood_ties`): Borderlands tavern. He took his brother's kill-warrant himself so no one crueler would. The coal-oath is the one instrument that can void it — *if Iven is taken alive and made to swear.* Joins on accepting the hunt; stays only if Iven lives. Iven dies → Rask pays the company 80 gold, exactly as contracted, and walks out of the game.

### IVEN — Fighter (class: `bandit`). The brother. THE CAPTURE RECRUIT.
- **Want:** To finally be worth the trouble everyone keeps taking over him.
- **Flaw:** Bolts when trusted. Good things feel like traps; he springs them early on purpose.
- **Secret** *(withheld accusation — distinct type)*: He *knows* Rask set the original bounty — he found the fort's copy — and joined the gang harder out of spite. He has never said it, and it is eating him faster than the warrant is.
- **Line:** *"You tied the knots yourself, brother. Least you could do is check them."*
- **Post-capture texture** *(graft: C2's Vess treatment)*: two camps after swearing, he is found holding a night watch nobody assigned him. *"You had rope and a going rate. You used a coal and a question. I'm not saying thanks. I'm saying I counted."*
- **Authored detonation — "The Fort's Copy"** (Thornwood camp, both brothers alive): Iven puts the paper in Rask's hands. Rask prices it, because he has no other language: *"Cost me: one brother. Return: one brother. Worst trade I ever made. I'd make it again."*
- **Signature card:** **Cut and Run** (1 AP) — 4 damage, then Iven moves up to 2 tiles for free. *Kindled:* 5 damage and move 3. *(He hits and he leaves. It's the only plan he's ever had.)*
- **Visual identity:** Young patchwork-leather bandit with the gang's wolf-fur collar half torn off, hatchet in hand, his own capture-rope coiled over one shoulder; road-dust palette, rust-red accent.
- **Recruitment — via CAPTURE:** Subdue him in the Brotherprice ambush; at the next camp Maren offers the oath over the cask — the tutorial's rule, now with a face on it. If he dies instead, the run carries both absences.

### FENN, no byname — Thief, scout (class: `thief`). The deserter whose name was struck.
- **Want:** To go home — knowing there is no home. He marches beside the only piece of it still burning.
- **Flaw:** Watches exits. Sleeps outside the fire-ring, boots on. The company reads it as ready-to-run. Some nights he is.
- **Secret** *(retyped: false guilt — fix for both 'weakest character' and secret monotony)*: Seconded to Provost Corvane's cohort, he read the supply order — so much oil, so many torches — understood it, and deserted the same hour, cross-country, to warn Verrow's south granges himself. He arrived to ash and has carried *too slow* ever since. He cannot read or write; the order's numbers live in the knotted **torch-tally cord** on his wrist — and under Assize rules, a tally sworn on a coal is evidence. His guilt is false: the granges didn't die because he was slow. They died because no south bell rang.
- **Register fix — lines:**
  - *"Back home we counted the flock in twos. Habit stays. Different flock now."*
  - *"That ridge carries twelve torches more than honest men need. Shepherds walk with one."*
- **Signature card:** **Twelve Too Many** (0 AP) — all allies gain +1 move this turn; Fenn draws 1. *Kindled:* +2 move instead. *(He calls the count before the ambush closes.)*
- **Visual identity:** Hooded scout in legion half-uniform with every insignia unpicked (darker cloth where the patches were), twin knives, the knotted tally cord at his wrist; grey-green palette, bare-thread accent.
- **Recruitment — via EVENT CONSEQUENCE** (promotes `deserter_plea`, kept beat-for-beat): Gave him coin (`deserter_helped`)? He resurfaces at the Thornwood border and offers the oath: *"The legion taught me scouting before it taught me killing. I remember who fed me."* Turned him in (`deserter_turned_in`)? He returns in the Thornwood as **the Struck Man** — a named miniboss scouting for the Provost, who learned the Silent Bell truth from Corvane's file and spits it at Maren mid-battle. He can be re-taken alive and re-sworn: the road gives his byname back.

### DOMA LEDGER — Knight, guard-captain (class: `knight`). The guildmistress who wanted it lost.
- **Want:** To buy her guild seat back. She prices the entire run in her head, constantly, and will tell you the number.
- **Flaw:** Cannot write anything off — sunk cost made flesh; she will risk living people to recover dead cargo. *(The one deliberately-kept resource flaw beside Maren's — she is the ledger the theme requires.)*
- **Secret:** She insured the caravan against loss with two rival houses. If its destruction is confirmed she collects twice — guild-hanging fraud — and some quiet part of her wanted it lost. She has not decided who she is about that yet.
- **Line:** *"Grief is a column like any other. You carry it forward until it balances."*
- **Signature card:** **Double Entry** (1 AP) — Doma gains Armor 3; this turn, when her Armor prevents damage, the company gains 1 gold per point prevented. *Kindled:* Armor 5. *(Everything converts. Everything.)*
- **Visual identity:** Broad matronly silhouette in guard-captain's half-plate over merchant robes, halberd with a cargo-hook, chained ledger at her belt; salt-white and deep umber palette, brass accent.
- **Recruitment — "The Salt Road"** (reworks `missing_caravan`; graft: C2's Dagny loophole beat): Her guild is contract-bound to provision Embermarches — the missing caravan *was your resupply*. Recover it intact and she remains a guildmistress patron: supplies, discounts, no recruit. Find it burned in the Thornwood and the guild strips her seat — and at the next camp her creditors' bailiffs arrive with a written seizure order for her arms and armor. **Maren reads the coal-oath's suspension clause over the seizure writ aloud, with full formality, and offers Doma the quill mid-sentence.** The halberd is half-surrendered when the law reverses in her hands. A companion you earn by failing, recruited by the best-staged reading of paperwork in the game.

### EDDA WICK — Cleric (class: `raider_cleric`, player variant). The chapel-warden who bargained.
- **Want:** To lose no one else. Ever. She has a list of the lost and it is exactly long enough.
- **Flaw** *(retyped)*: Cannot accept an ending. She keeps negotiating after the answer is no — with raiders mid-battle, with the Thornwood's dark things, with the dying. Denial dressed as diplomacy.
- **Secret:** The corruption of her chapel is her own bargain. Vicar Dross asked only for her congregation's *names* to spare the chapel flame — and she gave them, thinking names were nothing. Names were everything. *(New braid — fix: villain absence)*: the names reached Dross **through Corvane's clerks**. Her private sin is an entry in the Provost's books, and she finds his ledger-stamp on it when the chapel falls.
- **Line:** *"I have prayed to fire for thirty years. It has never once lied to me. Men, now."*
- **Signature card:** **By This Small Light** (1 AP) — heal an adjacent ally 3; they gain 1 AP at the start of their next activation. May target a Subdued enemy to stabilize them for capture. *Kindled:* heal 5. *(Her mercy has terms, and the terms are generous — and she is the capture engine's second leg.)*
- **Visual identity:** Hearth-cleric in charcoal robes with an ash-white stole, glass-and-iron flame-lamp on a chest chain, wick-scissors at her belt; charcoal palette, lamp-gold accent.
- **Recruitment:** Cleanse the corrupted chapel in the Thornwood. She joins carrying the chapel's lamp and asks one thing: that it feed from the company coal — **+1 fuel upkeep per hop for the run's best healer**, visible in the supply UI. When the coal goes Dim, she snuffs her own lamp unasked, before anyone can spend on her. Her one non-negotiable gift.

### ILSA VIGIL — Mage, auditor (class: `mage`, `raider_mage` chassis). The conscripted truth.
- **Want:** One honest finding. Her last three audits were bought over her own signature, and she carries all three like scars.
- **Flaw:** Procedure over people. She will measure the coal's heat while wolves come through the treeline.
- **Secret** *(braided into the burning — graft: C3's cross-companion intersection)*: The verdict is already written — she carries a pre-sealed finding, *"the Verrow Coal is false,"* that would legally kill the March the day she files it; Corvane bought her superior. And worse, older: one of her three bought audits was the **solvency finding that ruled Verrow's charter in default** — the legal predicate of the fire-writ. She signed the city's death warrant before Corvane sealed it. She has not filed the new lie. Yet.
- **Line:** *"Hold still. I am the only person on this road paid to tell the truth, and I am not paid well."*
- **Signature card:** **Preliminary Finding** (1 AP) — apply Marked to an enemy until it falls: attacks against it deal +1 damage. *Kindled:* +2 instead. *(Scrutiny, weaponized.)*
- **Visual identity:** Severe clerk-mage in a slate traveling coat hung with seals and ribbons, brass pyrometer on a chain, single lens over one eye; slate-blue palette, brass accent.
- **Recruitment:** Arrives at the Thornwood border with a writ from the Assize of Flames, conscripted to verify the coal. Refuse the audit and forts and towns deny resupply (visible price modifier); permit it and she attaches for "continuous observation" — the March's legitimacy, walking beside you, undecided.
- **Resolution — "The Auditor's Questions"** *(fixes: dropped gun + invisible gates — every gate is journaled the moment it happens)*: three moments enter her file, each stamped in the quest log as **"Noted in the auditor's file," with her leaning shown**:
  1. **The Toll-Charter** — expose Harrow's countersigned charter at Borderkeep, or pocket it as leverage.
  2. **The Names Ledger** — after Dross falls, burn Edda's congregation-list publicly, or keep it (it prices every survivor's debt; forts pay well for it).
  3. **The Silent Bell** — Maren confesses before the file is read, or conceals.
  At the Assize (finale): two or more truthful/merciful notes and Ilsa **breaks Corvane's seal on screen** and files the one honest finding of her life — *the coal stands* — opening the trial ending. Otherwise she files nothing, resigns her seals into the fire, and the trial door closes: kill or release only. She is never silent and never ambiguous; the log has told you all run which way she is leaning.

### TULLA BRAND — Fighter, smith (class: `bandit`, heavy). The deed's defender.
- **Want:** For the new city to be *real*. Her people are already squatting at the chartered founding site in Ashfall; only a delivered coal gives them charter rights instead of a raider camp.
- **Flaw** *(retyped: positional, legible in battle)*: She guards the deed, not the company. In a fight she will leave a flanked ally to body-block the cask — cheerfully, apologetically. Maren spends herself; Tulla spends *you*, for it.
- **Secret:** Her settlement has already voted: if the March fails but the coal survives, they take it. She's the one they sent to be close to it when that day comes.
- **Line:** *"You're not carrying a fire. You're carrying a deed. Half the frontier knows it, and the other half is the Provost."*
- **Signature card:** **Brandmark** (1 AP) — 4 damage; while the company has at least 1 Ember token, Tulla's attacks apply Burn 1. *Kindled:* this attack applies Burn 2. *(Her strength runs exactly as hot as the coal does.)*
- **Visual identity:** Broad-shouldered smith in a scorched leather apron over scale, burn-scarred forearms, farrier's hammer; basalt-black palette, magma-red accent.
- **Runway** *(fix: no room to dramatize her secret)*: she is **seen from the Borderlands on** — a rider with a farrier's hammer on two ridge nodes; Harrow grumbles, *"The mountain smith's been asking after your cask. I don't sell to smiths."* She formally joins at the **Thornwood–Ashfall border** as the settlement's sent guide — a full region of play, not a finale cameo.
- **Authored detonation — "The Cold Nail"** (mid-Ashfall camp): a settlement runner brings her the vote's token — a cold iron nail. She shows it to Maren **unprompted**. Player choice: post her guard on the cask (trust) or away from it (doubt). Her battle AI positioning and the epilogue both change; either way, the company now knows what she is holding.

### SERA COLDMARK — Knight, keeper-errant (class: `knight`, level 3 — Tane's slot). The living ritual. THE MILESTONE RECRUIT.
*(Grafts: C3's Merta questless join + living-ritual NPC + pre-measured memorial dread. New secret type: a hope.)*
- **Want:** To see one coal arrive before she stops walking.
- **Flaw:** Reads this march as a re-run of hers. Her advice is calibrated to a road nineteen years gone — dead waymarks, old fords, enemies who no longer hold the pass she still plans around. Living in the failed past, out loud.
- **History:** Her march was **Corim's**, nineteen years ago. It died at the Coldmark pass. The march's young underwriter's-clerk walked away rather than starve another week; she stayed, starved, and failed anyway. His name was **Cormund Corvane**. Two survivors: the ritual and the executioner.
- **Secret** *(a hope, hidden like a sin)*: In her breast-wallet rides a cold cinder of Corim's hearth. Fire-law whispers a mercy clause — *a dead hearth struck alight from a delivered coal gets a second hearing.* Probably a keeper's fairy tale. She has walked nineteen years on it, and she is ashamed to ask — asking means admitting she follows your coal for hers. If the player learns it (final camp, authored), the delivery scene gains the choice to strike Corim's cinder from Verrow's new hearth — and the epilogue gains a second city.
- **Line:** *"Past this stone I've never gone. Forty steps more and we're all young again — mind the ice."*
- **Signature card:** **Keeper's Vigil** (1 AP) — choose an ally within 2 tiles: they gain Armor 2 and Sera gains Armor 1. *Kindled:* both gain Armor 3. *(She has kept watch over dying fires all her life. Now she keeps it over living people.)* — deliberately the cheapest card in the set to build; the questless recruit ships trivially.
- **Visual identity:** Tall old woman in antique plate gone rose-brown with patina, keeper's half-cloak over it, white braid over the pauldron, **cask-nail bandolier** and a milestone chisel at her belt; cold-iron palette, one dull ember-red point at the breast.
- **Recruitment — questless:** The company passes the Coldmark waymark with a living coal. She is there, as she is every year, re-cutting the numerals of the milestone she has never passed. She watches the cask go by. Mounts up. Joins. No quest, no gate, no price — the road, finally going the same way she is.
- **Role in permadeath:** she carries the nails (below). On joining, she quietly forges one for each current member. *"Don't take it hard. Mine's been in the bag nineteen years."*
- **Role in the finale:** authored lines at Corvane's trial — or over his body. She is the only person alive who can say what he was before he stopped carrying.

---

## ANTAGONISTS

### The escalation spine *(fix: villain absent till Ashfall — the road's friction is HIS, visibly, from region one)*

**Region 1 — his purse.** Harrow's toll-charter carries Corvane's countersign (Odo verifies it against a seal only he could know). Posted writs deny hardwood and tallow to the unchartered. Wells fouled a day ahead of the company. Black-and-silver riders at the edges of nodes, counting.
**Region 2 — his law.** Ilsa's conscription is his contingency; Dross's name-ledgers arrive through his clerks; the bought audits are his purchase. The Provost is present as paperwork with your name on it.
**Region 3 — the man.** A letter at each region border in his voice; one face-to-face **parley** at the Thornwood–Ashfall border: he names each companion's suspended sentence to their face — he has read every file — and offers safe passage through the first pass for one item: *the paper the gate-captain carries.* Player choice: sell the writ (easier pass, lose a trial exhibit — the temptation is real and priced) or refuse (the hard road).

### Final: PROVOST CORVANE, called the Underwriter (boss slot: `warlord`)
The man who burned Verrow — by the book, under seal, as lawful demolition of a defaulted charter. **Want:** for the coal to gutter before Firstfrost. If it arrives, Verrow retroactively lived — and its burning becomes the murder of a living city, with his seal on the writ. He is not cruel and he is not calm; he is a desperate man racing his own past.

**Backstory** *(graft: the fifth meaning)*: he was a marcher once. Corim's march, nineteen years ago — the underwriter's-clerk who walked away at the Coldmark rather than starve. His coal-oath broke with the coal; his debts came back doubled; he clawed to Provost by foreclosing on other people's fires. His contempt for the rite is apostasy: he knows exactly what an oath costs, because his own is the thing he is still paying off.

- *"I did not burn a city. I executed a document. If that coal reaches Ashfall, the past changes, and I become a murderer retroactively. You understand why I can't allow the past to change."*
- *"You're not carrying hope, girl. You're carrying evidence."*

**The finale — capture as the crowning instrument** *(graft: C3; scoped to existing primitives)*: Corvane's boss fight ends by kill — or by the same **Subdue** the player has practiced all run (standard capture floor; no new battle mechanics). The choice happens in the post-battle scripted scene:
- **Kill him:** the writ dies with its author's silence; the delivery stands; the epilogue is ash-flavored.
- **Release him:** never authored as wise; the road remembers.
- **Take him to the Assize** (open only if Ilsa filed true): the company lays down the case it has unknowingly carried the whole road — **the fire-writ** (Odo, who stands to be convicted beside him and offers it anyway), **the supply tally** (Fenn's knotted cord, sworn on the coal), **the bought default** (Ilsa's own confessed audit), and — if she confessed — **the silent bell** (Maren, indicting herself at the hour of her vindication). Sera speaks last, for the man who walked away from her march: not forgiveness — testimony. Epilogue variants for conviction with and without Maren's confession, with and without Odo's survival.

**Visual identity:** Tall spare silhouette in an immaculate black-and-silver provost's coat, unarmored, carrying only a flat document case and a silver seal-ring; frost-silver accent.

### Regional bosses — his margin-collectors
- **Borderlands — HARROW THE TOLL** (chassis: `brigand_chief`): a brigand-king holding a *licensed* toll-charter with the Underwriter's countersign — legalized brigandage, paid to bleed the March of fuel and food. *"Everything that crosses my road pays, and embers pay in wind."* **Capturable — and he refuses the oath:** *"I sell crossings. I don't buy ash."* Ransom him to the Assize for 150 gold, or release him; the refusal teaches that the quill is a door, not a conveyor. His toll-reeve **SILT** (chassis: `thief`) is a capturable miniboss who *will* swear: the company gains a quartermaster.
- **Thornwood — VICAR DROSS** (encounter: `ember_mage` + `raider_cleric` kit): a hearth-priest who let his own chapel flame die on purpose and now preaches the mercy of going out. He doesn't want to steal the ember; he wants to *convince* it — and he already owns every name Edda gave him, delivered through Corvane's clerks. *"He thinks he's using me. We each think that."* **Not capturable** — what he is now doesn't fit in a rope, and the fiction says so out loud.
- **Ashfall — the Underwriter's bailiffs**, with **VARRA KILN's** mountain-raiders as a wild third side who believe stolen fire must be thrown back into the mountain it came from (chassis: `alpha_wolf` packs + raiders). Not Corvane's people — the finale's chaos variable.

---

## PERMADEATH: THE ASH-LIST
*(Grafts: C2's "Paid in full" + strike ritual + memorial gear; C3's nails, persistent markers, Kept Names, fallback mourners. Fix: grief is no longer pure subtraction.)*

When a companion falls, their name is chalked in ash on the ember-cask. At the next camp:

1. **The strike.** Maren strikes the name herself — *"No one strikes our names but us."* — and writes beneath it the road's oldest, blackest joke: ***Paid in full.*** Authored fallback chain if she's gone: Odo (who reads the full name and every byname aloud first, order-book formal), then Sera, then Edda, then anyone, flat.
2. **One authored line** from the closest surviving bond — pairwise pools, always about *the dead person*, never generic:
   - Vess falls, Maren: *"She skimmed the wax. Every camp, a little short. …The coal never once went hungry, though. Now I know why."*
   - Odo falls, Fenn: *"He held gates for a living. Somebody finally had to hold one for him."*
   - Iven falls, Rask: silence — then he pays the company 80 gold, exactly as contracted, and no one takes it.
   - Maren falls, Fenn (post-confession): *"She rang true in the end. Late bell's still a bell."*
   - Vess falls, Tulla: *"She'd have hated the wood we'll spend on her. Cheap pine, Vess. I promise."*
   - Anyone falls, Sera: *"Walk on. They do."*
   - **If the natural mourner is already dead**, the line falls to Maren's flat ledger voice — *"Struck: one name."* Losing the griever is itself content.
3. **The nail** *(persistent world scar)*: Sera drives that member's pre-forged cask-nail into the waymark at the node where they fell. The marker stays on the overworld map for the rest of the run. If Sera is dead, Maren drives them.
4. **Memorial gear** *(wordless, permanent sprite deltas — one per principal bond)*:
   - Rask ← Iven: wears Iven's capture-rope coiled on the crossbow stock; stops pricing things aloud for one full region.
   - Iven ← Rask: nails the 80-gold purse shut and hangs it from his belt, unspent.
   - Maren ← Odo: the document tube rides strapped to the cask.
   - Odo ← Maren: carries the cask himself and refuses to log the weight.
   - Vess ← Edda: wears the wick-scissors; trims every candle in camp, no charge.
   - Edda ← Vess: a tallow candle burns beside her lamp — one flame she will not feed from the coal.
   - Fenn ← Maren: moves his bedroll inside the fire-ring, permanently.
   - Tulla ← Sera: wears the milestone chisel; drives Sera's own nineteenth nail at the Coldmark.
   - Sera ← anyone: adds their nail to the bandolier. She came pre-measured.
   - Any unlisted pair defaults to the nail alone.
5. **Ashes, then Kept Names** *(two-stage deck ritual)*: the fallen's signature card flips to an unplayable **Ashes of [Name]** card that clogs the company deck — until, at a camp of the player's choosing, they perform the removal: a deliberate second goodbye. Removing it **forges a Kept Name** — a renamed, single-copy relic version of the card (**Odo's Gate**, **Vess's Wax**, **Iven's Run**, **Sera's Nail**), inherited by one chosen survivor and playable once per battle. Subtraction first, then chosen warmth: the company literally carries its dead into every fight.
6. **The coal burns low that night.** Just flavor. Everyone notices anyway.

---

## SAMPLE BANTER

**Vess & Odo, at camp**

> **VESS:** You sleep in the armor, Gate?
> **ODO:** I signed for it. It's on a list.
> **VESS:** Everything you own is on a list.
> **ODO:** Everything I own that didn't burn. It's a short list. Sleeping in it isn't hard.
> **VESS:** …Have some wax. For the joints. No charge.
> **ODO:** No charge. So you're dying, or it's poisoned.
> **VESS:** It's *cold*, Odo. Take the wax.

**Maren & Fenn, night watch, Thornwood edge** *(the bomb, ticking)*

> **FENN:** South granges rang nothing, you know. That night. Twelve years of bell-drills. I used to sleep through the drills.
> **MAREN:** You were four counties east, Fenn.
> **FENN:** Flock scatters, you count what's left. I've counted it every way there is. Always come up one bell short.
> **MAREN:** …Give me the watch. Go sleep.
> **FENN:** You had the watch yesterday.
> **MAREN:** I know. Give it anyway.

*(She takes every watch she can steal from him. He reads it as kindness. It isn't only that.)*

---

## WHAT HAPPENS TO THE CURRENT CONTENT

Grounded against `phaser/src/data/content/` and `phaser/src/ui/data/characters.ts` as of this branch. Save-compatible flag keys may be kept and aliased; display names change.

| Existing element | Where it lives | Fate |
|---|---|---|
| **Roy / Marcus / Lilina** | `characters.ts`, `/sprites/units/*` | **Cut (replaced).** Same lord / tank / mage triangle becomes **Maren / Odo / Vess**, now bound by the night of the burning. Sprite and portrait slots reused; ComfyUI re-prompt per new visual specs. |
| **Kael** | `characters.ts`, `quests/blood_ties.json`, `sq_blood_ties_*` dialogues | **Renamed → RASK WARRANT.** Quest kept structurally intact (capture-alive via Subdue; joins on capture; pays 80 gold and leaves on death), reweaved as **"Brotherprice"**: Rask authored the bounty himself. Dialogue rewritten in his register; `sq_blood_ties` stages/listeners unchanged. |
| **Daren** | `darens_camp` node, `daren_captured` / `daren_killed` flags | **Renamed → IVEN**, and **promoted** from quest prop to the flagship playable capture recruit — sworn at camp over the cask (`daren_captured` kept as the trigger key, aliased `iven_captured`; new `iven_sworn` flag + camp scene). |
| **The Deserter** | `dialogue/deserter_plea.json`, `deserter_helped` / `deserter_turned_in` | **Renamed → FENN, no byname.** Event kept beat-for-beat (coin / turn-in / walk-on / no-coin branches). `deserter_helped` → Thornwood recruitment scene; `deserter_turned_in` → **the Struck Man** miniboss (thief-elite chassis), re-capturable and re-swearable. His desertion rewired into the burning's backstory (he read the supply order; his tally cord is trial evidence). |
| **Guildmistress Anya** | `quests/missing_caravan.json`, `sq_caravan_*` dialogues | **Renamed → DOMA LEDGER**; quest reweaved as **"The Salt Road"** — the caravan is the March's own contracted resupply. Success branch: patron NPC (existing reward flow, `caravan_reward_claimed`). Failure branch (new): seat stripped → seizure-writ camp scene → **Maren reads the suspension clause** → recruit. `caravan_supplies_found` kept; one new branch flag (`salt_road_lost`). |
| **Garrik** | `towns/pine_crossing.json` recruits | **Cut** as a named character ("grizzled veteran for steady pay" fails the could-be-anyone test). His tavern slot becomes the **Guttered oath-pipeline** slot — sworn generic captives surface here as hireable units. |
| **Lyra** | `towns/pine_crossing.json` recruits | **Cut**; slot absorbed into the same pipeline. Her mechanical role (second sword) is covered by Iven/Tulla. |
| **Tane the Elder** | `towns/borderkeep_castle.json`, `bc_tane_knight` (knight, lvl 3) | **Rewoven → SERA COLDMARK.** The knight-class veteran recruit is kept at the same level/stat slot, moved out of the tavern to the **Coldmark waymark node**, and his king's-ransom price is deleted: she joins questless, for free, because the road finally goes her way. |
| **Seraphine** | `towns/borderkeep_castle.json`, `bc_seraphine_mage` (mage, lvl 2) | **Rewoven → ILSA VIGIL.** "Court scholar between patrons" inverted into "auditor conscripted by the Assize." Same mage recruit slot, relocated to the Thornwood-border conscription scene; her join is a choice with a visible resupply cost, not a purchase. |
| **The Warlord** | `enemyAI/warlord.json`, `seedBossBattle.ts`, `art/characters/warlord.json`, `overworld/ashfall.json` | **Renamed/reworked → PROVOST CORVANE, the Underwriter.** Same boss slot and AI chassis; art re-prompted from armored warlord to unarmored black-and-silver provost. Adds: three border letters, one parley scene, and the post-battle capture/trial scene (Subdue flag + scripted dialogue — no new battle mechanics). |
| **`blood_ties` quest** | `quests/blood_ties.json` | **Kept** (see Kael/Daren). Stage machine untouched; adds one camp scene (the swearing) and one Thornwood camp scene ("The Fort's Copy"). |
| **`missing_caravan` quest** | `quests/missing_caravan.json` | **Kept** (see Anya). Adds the failure branch and recruitment scene. |
| **Enemy chassis** (Bandit, Bandit Archer, Brigand Chief, Wolf, Alpha Wolf, Shield Knight, Raider Mage, Raider Cleric, Bone Dagger Thief, Ember Mage, Bandit Leader) | `classes.json`, `characters.ts` | **Kept, re-skinned by faction:** Borderlands bandits → **the Guttered** (failed marches); Brigand Chief boss slot → **Harrow the Toll**; Bandit Leader/Bone Dagger Thief → **Silt**; Raider/Ember casters + Shield Knights → **Dross's Quenchers** and **Corvane's bailiffs**; wolves → Thornwood dark things and **Varra Kiln's** beasts. |
| **Towns & dungeon** (`pine_crossing`, `riverside_market`, `borderkeep_castle`, `smugglers_cave`) | `towns/`, `dungeons/` | **Kept** — ids and economy untouched; rumor pools rewritten to carry the salted-miles pressure (Corvane's writs, refused fuel-sellers, riders counting at the crossroads). Smuggler's Cave becomes a Guttered den. |

---

## DATA-MODEL NOTES (for the developer)

**Reused as-is:** capture floor + Subdued flag + capture button flow; `taunt` and `burn` statuses (already read by `enemyAI.ts`); effect union `damage / heal / applyStatus / move (any unitId — forced movement is free) / grantArmor / drawCards / gainAp`; quest runner (stages, listeners, flag predicates); dialogue trees; town recruit slots; food-per-hop supply system; boss seeding; permanent flags.

**New, budgeted small:**
1. `coalGlow: 'bright' | 'steady' | 'dim'` on runStore + a camp feed action (rides the existing supply UI).
2. Ember tokens: combat counter seeded from glow at battle start; **Stoke** free action (token → +1 AP, once per unit per turn); optional **Kindled** cost line on CardDef (spend 1 token on play → rider fires). One primitive powers every character's coal touch.
3. StatusEffectDef hooks: `marked` (+1/+2 damage taken), `rooted` (immobile), `delayed-gain` (turn-boundary AP/draw grant — same trigger family as burn).
4. Scry effect (Read the Ashes) — one new effect kind.
5. On-block-gold hook (Double Entry) — one new hook.
6. Ashes/Kept Name: unplayable-card flag + camp removal action + relic-copy insertion (the one real chunk of deckBuilder surgery; it carries the whole permadeath design and both judges asked for it).
7. Waymark nails: per-node boolean + map render tick.
8. Journal surfacing for the Auditor's Questions and every capture/oath gate — content entries, not systems.

**Explicitly not built** (cut from the source concepts on the judges' production notes): negate/counterspell, hidden-enemy reveal, enemy deck-stealing, walking prisoner units (prisoners are camp-scene dialogue + flags), and any morale system.

**Flag namespace (all permanent scope):** `cobb_sworn`, `iven_captured`/`iven_killed` (alias `daren_*`), `iven_sworn`, `fenn_helped`/`fenn_turned_in` (alias `deserter_*`), `fenn_recruited`, `struck_man_taken`, `silt_sworn`/`silt_ransomed`, `salt_road_saved`/`salt_road_lost`, `doma_sworn`, `chapel_cleansed`, `ilsa_conscripted`, `audit_note_1/2/3`, `maren_confessed`, `bell_scene_done`, `forge_girl_named`, `coin_delivered`, `tulla_vote_shown`, `tulla_posted_cask`, `writ_sold`, `harrow_ransomed`, `corvane_subdued`, `verdict_true_filed`, `cinder_struck`.

---

## WHY THIS CAST HOLDS

Every member carries the coal for a reason the amnesty clause makes literal — debt (Doma), warrant (Rask, Iven, Fenn), sentence (Vess), broken oath (Odo, Edda), bought signature (Ilsa), a settlement's deed (Tulla), a nineteen-year-old hope (Sera) — and the leader's secret is that her oath was already broken before the fire made her a hero, and the man her silence wounded eats beside her every night. The villain owns every mile of the road until the road's own law — practiced one Subdue at a time, from Cobb to Corvane — becomes the instrument that convicts him. Nobody marches for glory; the warmth is the coal's until, wax by wax, nail by nail, name by name, it becomes theirs.

---

# APPENDIX A — Identity-layer refactor (prerequisite, from codebase survey)

The current identity plumbing is name-string matching and must be replaced BEFORE cast data lands, or every rename multiplies across five sync points:

1. `BoardScene.ts` `unitSpriteKey()` — lowercase SUBSTRING match on display name; `UNIT_SPRITES` preload list; duplicate list in `BootScene.ts`.
2. `CharacterPortrait.tsx` `unitSpritePathForName()` — hand-maintained mirror ("KEEP IN SYNC" comment).
3. `characters.ts` `KNOWN` — keyed by EXACT dialogue `speaker` strings.
4. Capture chain — `encounters/*.json captureTargets.unitName` string-equals `enemyGroups/*.json` member name; capture marker = appending `' (captured)'` to `unit.name` (combatReducer.ts:704-708); the marker round-trips through saves.
5. `Unit.name` serialized whole in saves — renames strand old saves' display names into the sprite lookup.

**Required shape:** a stable `characterId` on units/speakers/capture-targets; sprite + portrait + registry keyed by `characterId` with ONE mapping module; capture state as a boolean flag, not a name suffix; display names become presentation-only. Flag aliases per the content-mapping table keep old saves loadable.

# APPENDIX B — Known content bugs to fix in passing
- `runStore.ts:119-124` — quest-effect `recruitUnit` is a no-op stub (breaks Rask's join; the design depends on it).
- `sq_blood_ties_accept.json` — `advanceQuestStage` to `find_daren` fires twice.
- `enemyAI/bandit_priest.json` — AI table for a class that doesn't exist in `classes.json`; either cut or become a Dross Quencher.
- `TavernPanel.tsx:55` — every tavern hardcoded "The Drunken Boar"; town JSONs should name their own.
- `classes.json` growthRates authored but unused by `buildUnit()` — decide: use them or delete them (the clone problem).
