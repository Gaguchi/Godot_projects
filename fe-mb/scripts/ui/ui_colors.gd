class_name UIColors
extends RefCounted
## UIColors - Shared Stone & Steel color palette constants.
## All UI scripts reference these instead of defining their own copies.

# ---- Core Palette ----
const COLOR_PANEL_BG := Color(0.05, 0.055, 0.08, 0.95)
const COLOR_SIDEBAR_BG := Color(0.04, 0.045, 0.065, 0.95)
const COLOR_IRON_BORDER := Color(0.227, 0.239, 0.282)
const COLOR_EMBER := Color(0.69, 0.44, 0.25)
const COLOR_PARCHMENT := Color(0.832, 0.812, 0.761)
const COLOR_WORN_STONE := Color(0.478, 0.463, 0.439)

# ---- Accent Colors ----
const COLOR_BLOOD := Color(0.769, 0.267, 0.267)
const COLOR_BLOOD_RED := Color(0.769, 0.267, 0.267)  # Alias used by some files
const COLOR_MOSS := Color(0.353, 0.541, 0.353)
const COLOR_MOSS_GREEN := Color(0.353, 0.541, 0.353)  # Alias used by some files
const COLOR_SUBDUE := Color(0.6, 0.5, 0.8)

# ---- Card Type Colors ----
const COLOR_MAGE_PURPLE := Color(0.5, 0.3, 0.65)
const COLOR_ITEM_GREEN := Color(0.353, 0.541, 0.353)
const COLOR_SKILL_BLUE := Color(0.353, 0.541, 0.671)
const COLOR_CARD_DIM := Color(0.3, 0.3, 0.3, 0.7)

# ---- Overlay / Background ----
const COLOR_OVERLAY := Color(0, 0, 0, 0.85)
const COLOR_OVERLAY_LIGHT := Color(0, 0, 0, 0.6)
const COLOR_OVERLAY_MEDIUM := Color(0, 0, 0, 0.8)
const COLOR_CHOICE_BG := Color(0.08, 0.085, 0.11, 0.95)

# ---- Row / List Colors ----
const COLOR_ROW_BG := Color(0.06, 0.065, 0.09, 0.9)
const COLOR_ROW_HOVER := Color(0.08, 0.085, 0.11, 0.95)
const COLOR_ROW_SELECTED := Color(0.1, 0.09, 0.07, 0.95)

# ---- Bar / Misc ----
const COLOR_BAR_BG := Color(0.15, 0.15, 0.15)
const COLOR_HP_BAR_BG := Color(0.15, 0.15, 0.15)  # Alias used by PartySidebar
const COLOR_ACTIVE_BG := Color(0.07, 0.075, 0.1, 0.95)
