"""Rebuild every board of the design canvas and the bare world art, in order.

    python rebuild.py                    every board, then out/boards/canvas.json and out/world/*.png
    python rebuild.py PxCamp F64Title    only the generators that write these boards
    python rebuild.py --preview          and render each board to out/preview/<Board>.png (see README)

The build is deterministic: the same code always writes the same bytes. Check a change by rebuilding
before and after and comparing out/boards/.
"""
import glob
import os
import shutil
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))

# (generator, args, boards it writes). The first generator that needs the map fills its cache (about 50 s);
# every later one reads it.
STEPS = [
    ('src/px-popups/gen_pause.py', [], ['F64Pause']),
    ('src/px-popups/gen_company.py', [], ['F64Company']),
    ('src/px-popups/gen_contracts.py', [], ['F64Contracts']),
    ('src/px-popups/gen_dialogue.py', [], ['F64Dialogue']),
    ('src/px-popups/gen_check.py', [], ['F64Check']),
    ('src/px-popups/gen_name.py', [], ['F64Name']),
    ('src/px-popups/gen_key.py', [], ['Hyb64Key']),
    ('src/px-combat/gen_combat.py', [], ['Hyb64Combat']),
    ('src/f64-interrupts/gen_combat_enemy.py', [], ['F64CombatEnemy']),
    ('src/f64-pages/gen_report.py', [], ['F64Report']),
    ('src/kit64/gen_controls.py', [], ['KitControls']),
    ('src/kit64/gen_panels.py', [], ['KitPanels']),
    ('src/px-scenes1/gen_title.py', [], ['F64Title']),
    ('src/px-scenes1/gen_prologue.py', [], ['F64Prologue']),
    ('src/px-scenes2/gen_dungeon.py', [], ['F64Dungeon']),
    ('src/px-scenes2/gen_win.py', [], ['F64Win']),
    ('src/px-scenes2/gen_lost.py', [], ['F64Lost']),
    ('src/px-town/gen_px_town.py', [], ['PxTownInn', 'PxTownShop', 'PxTownTavern']),
    ('src/px-camp/gen_pxcamp.py', [], ['PxCamp']),
    ('src/pxworld/gen_map.py', ['grain=1'], ['PxMap1x']),
]

# the world each generator draws before the UI goes on, at 1x: out/world/<name>.png
WORLD = {
    'map': 'src/pxworld/t/world1x.png',
    'map_no_company': 'src/px-popups/cache/*_map_c0.png',
    'combat_field': 'src/px-combat/cache/field-*.png',
    'town_inn': 'src/px-town/z/world_inn.png',
    'town_shop': 'src/px-town/z/world_shop.png',
    'town_tavern': 'src/px-town/z/world_tavern.png',
    'camp': 'src/px-camp/t/world.png',
    'title': 'src/px-scenes1/t/title_world.png',
    'prologue': 'src/px-scenes1/t/prologue_world.png',
    'dungeon': 'src/px-scenes2/t/dungeon_world.png',
    'win': 'src/px-scenes2/t/win_world.png',
    'lost': 'src/px-scenes2/t/lost_world.png',
}


def main(argv):
    preview = '--preview' in argv
    want = [a for a in argv if not a.startswith('--')]
    steps = [s for s in STEPS if not want or set(s[2]) & set(want)]
    if want and not steps:
        sys.exit(f'no generator writes {want}; boards: {[b for s in STEPS for b in s[2]]}')
    for d in ('out/boards', 'out/world', 'out/preview'):
        os.makedirs(os.path.join(ROOT, d), exist_ok=True)
    for script, args, boards in steps:
        t0 = time.time()
        r = subprocess.run([sys.executable, os.path.join(ROOT, script)] + args, cwd=ROOT,
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        print(f'{script:42s} {", ".join(boards):38s} {time.time() - t0:5.1f}s')
        if r.returncode:
            sys.exit(f'{script} failed:\n{r.stderr}')
    subprocess.run([sys.executable, os.path.join(ROOT, 'canvas_index.py')], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    for name, pattern in WORLD.items():
        hits = sorted(glob.glob(os.path.join(ROOT, pattern)), key=os.path.getmtime)
        if hits:
            shutil.copyfile(hits[-1], os.path.join(ROOT, 'out', 'world', name + '.png'))
    if preview:
        boards = [b for s in steps for b in s[2]]
        subprocess.run(['node', os.path.join(ROOT, 'preview.mjs')] + boards, cwd=ROOT, check=True)


if __name__ == '__main__':
    main(sys.argv[1:])
