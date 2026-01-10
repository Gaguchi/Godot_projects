# Project Roadmap (Revised)

*Priority Shift: Focusing on solid Technical Architecture before Content Expansion.*

---

## 📅 Phase 1: Technical Foundation (Immediate Priority)
*Goal: Ensure the game state is robust, persistent, and manageable.*

- [ ] **Save/Load System** (Critical)
    - [x] Create `SaveManager` singleton (Backend).
    - [x] Implement serialization for `UnitData`, `ItemData`.
    - [ ] **Multi-Slot Support**: Update `SaveManager` to handle 3 distinct save slots.
    - [ ] **Save/Load UI**: Create `SaveLoadMenu.tscn` (Visual slots with metadata).
    - [ ] **Metadata**: Save specific data (Location, Date, Playtime) for UI preview.
    - [ ] **Integration**: Connect Main Menu "Load" and Pause Menu "Save" to new UI.
- [ ] **Scene & State Management**
    - [ ] Create `SceneLoader` singleton (Transition effects, Loading screen support).
    - [ ] Refactor raw `change_scene` calls to use `SceneLoader`.
    - [ ] Implement `GameState` machine (Menu, Overworld, Dungeon, Combat).
- [ ] **Input & Settings Architecture**
    - [ ] Create `InputManager` or standardize `InputMap` usage.
    - [ ] Create `SettingsManager` (Volume, Resolution, Keybindings).
    - [ ] Implement persistent `user_settings.cfg`.
- [ ] **Party Management UI**
    - [ ] Create a non-combat "Party Screen" scene.
    - [ ] View full Unit Status (Stats, EXP, Equipment).
    - [ ] Equip/Unequip items.
    - [ ] Trade items between units.
- [ ] **Audio Architecture**
    - [ ] Create `AudioManager` singleton.
    - [ ] Implement Music cross-fading and SFX pooling.
- [ ] **Unit Recruitment & Death**
    - [ ] Implement robust `add_unit` / `remove_unit` logic that persists.
    - [ ] Handle "Game Over" state (Party Wipe) correctly (delete save).

---

## 📅 Phase 2: Core Gameplay Loop (Alpha)
*Goal: A fully playable run from start to finish with meaningful choices.*

- [ ] **World Map Interactions**
    - [ ] **Shops**: UI to spend Gold buying items/weapons.
    - [ ] **Events**: Text events with simple risk/reward choices.
    - [ ] **Rest Sites**: Implement "Heal" vs "Buff" choice.
- [ ] **Combat Refinement**
    - [ ] **UI Polish**: "Level Up" screen, Better Forecast.
    - [ ] **Visuals**: Simple animations/tweens for actions.
    - [ ] **Skills**: Basic passive skill support in `UnitData`.
- [ ] **Quest System Architecture**
    - [ ] Create `QuestManager` singleton.
    - [ ] Define `QuestData` resource structure (Objectives, Rewards).
    - [ ] Implement "Trigger" system (e.g., `on_enemy_killed`).

---

## 📅 Phase 3: Content & Depth (Beta)
*Goal: Mechanics that add replayability.*

- [ ] **Advanced Mechanics**
    - [ ] **Class Promotions**: Branching paths for Lord, Linear for others.
    - [ ] **Support System**: Affinity tracking.
    - [ ] **Unique Unit Mechanics**: (Desperation, etc.)
- [ ] **Roguelite Meta-Progression**
    - [ ] **Unlockable Starters**: Achievements.
    - [ ] **Run History**: Log of past runs.
- [ ] **Polish**
    - [ ] Audio, Settings Menu, Controller Support.

---

## 📝 "Nice to Have" / Backlog
- [ ] Auto-Battle / Fast Forward.
- [ ] Character Customization.
- [ ] Daily Challenges.
