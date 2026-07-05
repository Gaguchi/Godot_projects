/**
 * comfy-gen — drive the LOCAL ComfyUI instance to generate transparent pixel
 * sprites from prompts, using the user's own workflow (captured from /history as
 * scripts/cli/comfy/template.workflow.json: waiIllustrious SDXL + DarkFantasy-
 * PixelSprite LoRA [trigger DFSV1], RemBG -> SaveImageWithAlpha). Injects the
 * prompt into node 4 + a seed into node 3, submits, polls /history, downloads the
 * result into the sprite-lab gallery so it can be rated.
 *
 *   npm run comfy -- --id lilina --prompt "1girl, young mage, ..." [--seed 123]
 *   npm run comfy -- --batch scripts/cli/comfy/cast.json
 *   COMFY_URL=http://127.0.0.1:8188  (override if needed)
 *
 * The fast teaching loop: write prompts -> generate -> rate in sprite-lab ->
 * refine prompts. NOTE: the seed must differ between submissions or ComfyUI
 * returns its cached result; we derive a distinct seed from id+prompt.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs'
import { join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { floodKeyAlpha, opaqueFraction } from './cutout'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const TEMPLATE = join(HERE, 'comfy', 'template.workflow.json')
const LAB = join(ROOT, 'public', 'sprites', 'lab')
const COMFY = process.env.COMFY_URL ?? 'http://127.0.0.1:8188'
const CLIENT = 'claude-comfy-gen'

// Fire-Emblem-style house look (vibrant, clean, heroic anime-fantasy pixel art).
// DFSV1 = the pixel-sprite LoRA trigger. Negative/CFG/LoRA stay at template defaults.
// Per-kind framing: characters are full-body front-view; buildings are isometric
// structures with no people. Both keep RemBG (transparent sprite for map/board).
const PREAMBLES: Record<string, string> = {
  character: 'masterpiece, best quality, newest, absurdres, highres, DFSV1, sprite, pixel art,\nsolo, full body, front view, looking at viewer, plain background,\n',
  building: 'masterpiece, best quality, newest, absurdres, highres, DFSV1, pixel art, 3/4 isometric view, single medieval building, architecture, structure, no humans, no people, no characters, centered, plain background,\n',
  scene: 'masterpiece, best quality, newest, absurdres, highres, DFSV1, pixel art, top-down, overhead view, no humans, no characters, no people,\n',
  prop: 'masterpiece, best quality, newest, absurdres, highres, DFSV1, pixel art, single isolated object, centered, full object in frame, bold dark outline, vibrant saturated colors, high contrast, no base, no platform, no ground, no people, no characters, no humans, no text, simple plain white background,\n',
  // Overworld region backdrop: a painterly dark-fantasy LANDSCAPE (terrain only).
  // Deliberately NO DFSV1 / pixel art / top-down — those dither + flatten a vista
  // into AI-slop. The pixel-sprite LoRA is also bypassed for this kind (see generate).
  backdrop: 'masterpiece, best quality, highres, dark fantasy painted landscape, environment concept art, oil painting, painterly, three-quarter oblique view, sweeping vista, atmospheric perspective, dramatic low warm key light from the left, deep cool shadows, hazed distant hills on the horizon, muted earthy palette, cinematic, moody, no people, no characters, no humans, no text,\n',
}
// Terrain/road/backdrop kinds keep the BACKGROUND (they ARE the ground), so they use
// the scene preamble AND strip the RemBG tail at submit time (see generate()).
const SCENE_KINDS = new Set(['scene', 'tile', 'road', 'backdrop', 'terrain'])
function preamble(kind?: string): string {
  if (kind === 'backdrop') return PREAMBLES['backdrop']!
  if (kind && SCENE_KINDS.has(kind)) return PREAMBLES['scene']!
  return PREAMBLES[kind ?? 'character'] ?? PREAMBLES['character']!
}
// Tiling kinds get circular-padding (ComfyUI-seamless-tiling) for seamless edges.
const TILING_KINDS = new Set(['tile', 'road'])
// Cutout kinds (buildings) generate full-colour on a plain WHITE background (RemBG
// ghosts these low-contrast/sparse subjects) then key the white out via a border
// flood-fill in post. We force a strong white-bg suffix to make the key clean.
// PROPS are NOT cutout: a base-on-white cutout always grows a giant diorama base
// (planter/pyramid/mesa). High-contrast bold-outline props segment cleanly via the
// normal RemBG path instead — no base needed, transparent right up to the foliage.
const CUTOUT_KINDS = new Set(['building'])
const WHITE_BG_SUFFIX = ', isolated on a solid pure white background, no shadow on the ground'
// Terrain wants a flat full-frame repeating texture — suppress the model's habit of
// composing a centred scene with fire/glow/focal subjects.
const SCENE_NEGATIVE = 'worst quality, low quality, lowres, blurry, deformed, fire, flames, lava, magma, embers, magic, glowing, glow, energy, lens flare, vignette, centered composition, single object, focal point, character, person, people, creature, animal, frame, border, text, signature, watermark, depth of field, bokeh, map, world map, minimap, islands, island, pond, lake, river, ocean, sea, beach, coastline, shore, trees, tree, forest, bushes, shrubs, rocks, boulders, flowers, scenery, landscape, multiple terrains, varied terrain, buildings, structures, clothing, clothes, coat, jacket, dress, robe, armor, sword, katana, weapon, blade, knife, dagger, axe, shield, item, items, equipment, gear, object, objects, props, furniture, food, still life'
// Backdrop wants the OPPOSITE of SCENE_NEGATIVE: it KEEPS landscape/terrain/hills,
// but bans the pixel/anime look, any UI/road/path (SVG owns those), people, text,
// and the centred-single-subject framing.
const BACKDROP_NEGATIVE = 'worst quality, low quality, lowres, blurry, deformed, pixel art, pixelated, dithered, 8-bit, sprite, anime, manga, cel shading, flat colors, lineart, cartoon, character, person, people, face, portrait, soldier, knight, text, signature, watermark, logo, ui, hud, map, world map, minimap, compass, frame, border, parchment, road, path, trail, dirt road, paved road, cobblestone, centered composition, single focal object, bright, high key, oversaturated, neon, photo, photograph, 3d render'

type Node = { class_type: string; inputs: Record<string, unknown> }
type Graph = Record<string, Node>
type ImgRef = { filename: string; subfolder?: string; type?: string }

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}
function seedFrom(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) % 1_000_000_000
}
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Reclaim VRAM before a batch. The 6 GB GTX 1660 barely fits SDXL; a prior
 * seamless-tiling run leaves a duplicate ("Make a copy") UNet resident, which
 * starves the sampler into RAM-swap (10x slower, multi-minute generations).
 * Unloading models + freeing memory restores a clean ~5 GB free slate.
 */
async function freeVram(): Promise<void> {
  try {
    await fetch(`${COMFY}/free`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unload_models: true, free_memory: true }) })
    console.log('  freed VRAM (unloaded models)')
  } catch { /* non-fatal */ }
}

/** Upload a control image into ComfyUI's input folder; returns the ref LoadImage wants. */
async function uploadImage(path: string): Promise<string> {
  const buf = readFileSync(isAbsolute(path) ? path : join(process.cwd(), path))
  const name = path.split(/[\\/]/).pop() ?? 'control.png'
  const fd = new FormData()
  fd.append('image', new Blob([new Uint8Array(buf)], { type: 'image/png' }), name)
  fd.append('overwrite', 'true')
  const r = await fetch(`${COMFY}/upload/image`, { method: 'POST', body: fd })
  const j = (await r.json()) as { name: string; subfolder?: string }
  console.log(`  uploaded control -> ${j.name}`)
  return j.subfolder ? `${j.subfolder}/${j.name}` : j.name
}

async function generate(id: string, prompt: string, seed: number, kind?: string): Promise<boolean> {
  const graph = JSON.parse(readFileSync(TEMPLATE, 'utf8')) as Graph
  const pos = graph['4'], ks = graph['3'], save = graph['13']
  if (!pos || !ks) { console.error('template missing node 4 (prompt) or 3 (sampler)'); return false }
  const cutout = !!(kind && CUTOUT_KINDS.has(kind))
  pos.inputs['text'] = preamble(kind) + prompt + (cutout ? WHITE_BG_SUFFIX : '')
  ks.inputs['seed'] = seed
  if (kind && SCENE_KINDS.has(kind)) {
    // terrain/road/backdrop: strip the background-removal tail (it would erase the
    // ground as "background") and save the decoded image (node 6, with bg) directly.
    for (const n of ['11', '12', '13', '14']) delete graph[n]
    graph['20'] = { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: `PixelArt/${id}` } }
    const latent = graph['8'] // square latent for tiles/textures (template default is portrait)
    if (latent) { latent.inputs['width'] = 1024; latent.inputs['height'] = 1024 }
    const neg = graph['5'] // flat-texture negative (no fire/focal/centred-scene)
    if (neg) neg.inputs['text'] = SCENE_NEGATIVE
    if (kind === 'backdrop') {
      // Painterly landscape: BYPASS the pixel-sprite LoRA entirely (model + clip
      // come straight from the checkpoint node 1, not the LoRA node 2), use a wide
      // landscape latent, and the landscape-friendly negative. ControlNet (blur
      // composition) + tiled upscale are layered on after the checkpoint proves out.
      ks.inputs['model'] = ['1', 0]
      pos.inputs['clip'] = ['1', 1]
      if (neg) neg.inputs['clip'] = ['1', 1]
      const w = Number(arg('--width') ?? 1216)
      const h = Number(arg('--height') ?? 832)
      if (latent) { latent.inputs['width'] = w; latent.inputs['height'] = h }
      if (neg) neg.inputs['text'] = BACKDROP_NEGATIVE
      // Optional composition ControlNet (blur): conditions on the value-staged
      // control image so the bake becomes a WIDE plane with reserved clearings
      // instead of a centred mountain hero shot. Upload → LoadImage → apply.
      const ctrl = arg('--control')
      if (ctrl) {
        const upName = await uploadImage(ctrl)
        const cnName = arg('--cn-model') ?? 'noobaiXLControlnet_epsBlur.safetensors'
        const cnStr = Number(arg('--cn-strength') ?? 0.5)
        graph['30'] = { class_type: 'LoadImage', inputs: { image: upName } }
        graph['31'] = { class_type: 'ControlNetLoader', inputs: { control_net_name: cnName } }
        graph['32'] = {
          class_type: 'ControlNetApplyAdvanced',
          inputs: {
            positive: ['4', 0], negative: ['5', 0], control_net: ['31', 0], image: ['30', 0],
            strength: cnStr, start_percent: 0, end_percent: 1,
          },
        }
        ks.inputs['positive'] = ['32', 0]
        ks.inputs['negative'] = ['32', 1]
      }
    }
    if (TILING_KINDS.has(kind!)) {
      // circular-padding seamless tiling: patch the UNet before sampling, decode circular.
      graph['21'] = { class_type: 'SeamlessTile', inputs: { model: ks.inputs['model'], tiling: 'enable', copy_model: 'Make a copy' } }
      ks.inputs['model'] = ['21', 0]
      const vd = graph['6']
      if (vd) { vd.class_type = 'CircularVAEDecode'; vd.inputs['tiling'] = 'enable' }
    }
  } else if (cutout) {
    // buildings/props: strip RemBG (it ghosts these), save the full-colour decode,
    // and flood-key the white background out in post (see download step below).
    for (const n of ['11', '12', '13', '14']) delete graph[n]
    graph['20'] = { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: `PixelArt/${id}` } }
    // Square frame keeps it to ONE centred subject — the tall portrait latent makes
    // SDXL stack two copies (e.g. a double camp) to fill the canvas.
    const latent = graph['8']
    if (latent) { latent.inputs['width'] = 1024; latent.inputs['height'] = 1024 }
    // NOTE: props use the DEFAULT negative. Adding pot/scene suppressors here made
    // SDXL compose full landscape scenes (edge-to-edge, no white border to key) —
    // the "small round grassy earth mound base" framing is what reliably yields ONE
    // isolated keyable object. A small earth base reads fine at map-scatter scale.
  } else if (save) {
    save.inputs['filename_prefix'] = `PixelArt/${id}`
  }

  console.log(`\n[${id}] seed=${seed} :: ${prompt.slice(0, 90)}`)
  const submit = await fetch(`${COMFY}/prompt`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: graph, client_id: CLIENT }),
  })
  if (!submit.ok) { console.error(`  submit failed ${submit.status}: ${await submit.text()}`); return false }
  const { prompt_id, node_errors } = (await submit.json()) as { prompt_id?: string; node_errors?: Record<string, unknown> }
  if (!prompt_id || (node_errors && Object.keys(node_errors).length > 0)) { console.error('  not queued:', JSON.stringify(node_errors)); return false }
  process.stdout.write(`  queued ${prompt_id} `)

  let outputs: Record<string, { images?: ImgRef[] }> | null = null
  for (let i = 0; i < 300; i++) { // up to ~12 min: SDXL on a 6 GB card is slow under any VRAM pressure
    await sleep(2400)
    const h = (await (await fetch(`${COMFY}/history/${prompt_id}`)).json()) as Record<string, { outputs?: Record<string, { images?: ImgRef[] }> }>
    const entry = h[prompt_id]
    if (entry?.outputs && Object.keys(entry.outputs).length > 0) { outputs = entry.outputs; break }
    if (i % 3 === 2) process.stdout.write('.')
  }
  if (!outputs) { console.error('  timed out'); return false }

  let img: ImgRef | undefined = outputs['13']?.images?.[0] ?? outputs['20']?.images?.[0]
  if (!img) for (const k of Object.keys(outputs)) {
    const cand = outputs[k]?.images?.find((im) => !im.filename.includes('_temp_'))
    if (cand) { img = cand; break }
  }
  if (!img) { console.error('  no saved image:', JSON.stringify(outputs)); return false }

  const url = `${COMFY}/view?` + new URLSearchParams({ filename: img.filename, subfolder: img.subfolder ?? '', type: img.type ?? 'output' }).toString()
  let buf: Buffer = Buffer.from(await (await fetch(url)).arrayBuffer())
  if (cutout) {
    // Key the white background out ourselves (RemBG was stripped for this kind).
    try {
      buf = floodKeyAlpha(buf)
      console.log(`  flood-key cutout -> ${(opaqueFraction(buf) * 100).toFixed(0)}% opaque`)
    } catch (e) { console.error('  cutout failed (saving raw):', (e as Error).message) }
  }
  mkdirSync(LAB, { recursive: true })
  writeFileSync(join(LAB, `${id}@review.png`), buf)

  const manPath = join(LAB, 'manifest.json')
  let manifest: Array<{ id: string; label: string; config: unknown }> = []
  try { manifest = JSON.parse(readFileSync(manPath, 'utf8')) } catch { /* fresh */ }
  manifest = manifest.filter((m) => m.id !== id)
  manifest.unshift({ id, label: `comfyui · seed ${seed} · ${prompt.slice(0, 44)}`, config: { seed, prompt } })
  writeFileSync(manPath, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`  ✓ ${id}@review.png (${(buf.length / 1024).toFixed(0)} KB)`)
  return true
}

async function main(): Promise<void> {
  const batch = arg('--batch')
  if (batch) {
    const path = isAbsolute(batch) ? batch : join(process.cwd(), batch)
    // A directory of per-character files (each {id, prompt, status?}) OR a single
    // JSON array. Approved characters are skipped so we don't re-burn GPU on them.
    let entries: Array<{ id: string; prompt: string; seed?: number; status?: string; kind?: string }>
    if (statSync(path).isDirectory()) {
      entries = readdirSync(path).filter((f) => f.endsWith('.json')).sort()
        .map((f) => JSON.parse(readFileSync(join(path, f), 'utf8')) as { id: string; prompt: string; seed?: number; status?: string; kind?: string })
        .filter((c) => c.id && c.prompt && c.status !== 'approved')
    } else {
      entries = JSON.parse(readFileSync(path, 'utf8'))
    }
    console.log(`batch: ${entries.length} sprites via ${COMFY}`)
    await freeVram()
    let ok = 0
    for (const e of entries) if (await generate(e.id, e.prompt, e.seed ?? seedFrom(e.id + '|' + e.prompt), e.kind)) ok++
    console.log(`\ndone: ${ok}/${entries.length} generated -> public/sprites/lab/ (refresh sprite-lab)`)
    return
  }
  const id = arg('--id') ?? 'comfy_test'
  const prompt = arg('--prompt') ?? '1girl, young mage, long blue hair, blue robe, staff with glowing orb'
  const seedArg = arg('--seed')
  await generate(id, prompt, seedArg != null ? Number(seedArg) : seedFrom(id + '|' + prompt), arg('--kind'))
}

main().catch((e) => { console.error(e); process.exit(1) })
