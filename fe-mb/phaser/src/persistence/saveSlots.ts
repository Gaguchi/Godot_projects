import type { SaveFile } from './saveFormat'
import { saveToString } from './save'
import { loadFromString, type LoadResult } from './load'

/**
 * 3-slot save manager backed by localStorage. Keys live under
 * `fe-mb:save:slot:N`. Each slot stores a single SaveFile JSON string.
 *
 * Listing reads a sidecar metadata key (`fe-mb:save:meta`) to avoid
 * re-parsing every slot on every UI render. Writes update both the slot
 * data and the metadata atomically.
 */

const SLOT_PREFIX = 'fe-mb:save:slot:'
const META_KEY = 'fe-mb:save:meta'
export const NUM_SLOTS = 3

export interface SaveSlotMeta {
  slotId: string
  label: string
  savedAt: number
  /** Quick-glance snapshot fields surfaced in the slot list. */
  summary: {
    gold: number
    foodCount: number
    partyCount: number
    location: string  // "borderlands · pine_crossing" etc.
  } | null
}

export interface SaveSlotsMeta {
  slots: SaveSlotMeta[]
}

function emptyMeta(): SaveSlotsMeta {
  return {
    slots: Array.from({ length: NUM_SLOTS }, (_, i) => ({
      slotId: String(i),
      label: '',
      savedAt: 0,
      summary: null,
    })),
  }
}

function readMeta(): SaveSlotsMeta {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return emptyMeta()
    const parsed = JSON.parse(raw) as SaveSlotsMeta
    if (!parsed?.slots) return emptyMeta()
    // Pad with empty rows if META has fewer than NUM_SLOTS
    while (parsed.slots.length < NUM_SLOTS) {
      parsed.slots.push({
        slotId: String(parsed.slots.length),
        label: '',
        savedAt: 0,
        summary: null,
      })
    }
    return parsed
  } catch {
    return emptyMeta()
  }
}

function writeMeta(meta: SaveSlotsMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // localStorage full / disabled — non-fatal
  }
}

export function listSlots(): SaveSlotMeta[] {
  return readMeta().slots
}

export function readSlot(slotId: string): LoadResult | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(SLOT_PREFIX + slotId)
  } catch {
    return null
  }
  if (!raw) return null
  return loadFromString(raw)
}

export function writeSlot(slotId: string, save: SaveFile, label?: string): boolean {
  try {
    localStorage.setItem(SLOT_PREFIX + slotId, saveToString(save))
  } catch {
    return false
  }
  const meta = readMeta()
  const idx = meta.slots.findIndex((s) => s.slotId === slotId)
  const summary = save.run
    ? {
      gold: save.run.gold,
      foodCount: save.run.inventoryItems.filter((i) => i.itemId === 'food_rations').length,
      partyCount: save.run.partyUnits.length,
      location: `${save.run.worldPosition.mapId} · ${save.run.worldPosition.nodeId}`,
    }
    : null
  const newRow: SaveSlotMeta = {
    slotId,
    label: label ?? `Save ${slotId}`,
    savedAt: save.createdAt,
    summary,
  }
  if (idx >= 0) meta.slots[idx] = newRow
  else meta.slots.push(newRow)
  writeMeta(meta)
  return true
}

export function deleteSlot(slotId: string): void {
  try { localStorage.removeItem(SLOT_PREFIX + slotId) } catch { /* ignore */ }
  const meta = readMeta()
  const idx = meta.slots.findIndex((s) => s.slotId === slotId)
  if (idx >= 0) {
    meta.slots[idx] = { slotId, label: '', savedAt: 0, summary: null }
    writeMeta(meta)
  }
}

export function isSlotEmpty(slot: SaveSlotMeta): boolean {
  return slot.savedAt === 0 || slot.summary === null
}
