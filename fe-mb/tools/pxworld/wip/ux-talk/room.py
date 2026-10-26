"""ux-talk: render the room behind the conversation into cache/room.png (+ cache/room.json), in its own process.

The room is the tavern's interior, drawn by the tavern builder: dirs/ux-tavern/interior.py, render(people=False) -> (Canvas, info).
Until that module exists and imports, the stand-in is Riverside Market's street from dirs/px-town (scene.render('tavern')),
which the board dims flat (room.json says standin: true).

Run in a subprocess by talk.py, so the tavern builder's modules and px-town's (both have their own scene/pxt helpers) never
share one sys.path. Deterministic: both renderers take fixed seeds.

    python room.py            -> writes cache/room.png, cache/room.json
"""
import json
import os
import sys
import traceback

SP = 'C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad'
HERE = SP + '/dirs/ux-talk'
CACHE = HERE + '/cache'
os.makedirs(CACHE, exist_ok=True)


def _jsonable(v):
    """Info dicts can hold numpy ints and tuples; keep what JSON can carry."""
    try:
        json.dumps(v)
        return v
    except TypeError:
        if isinstance(v, dict):
            return {str(k): _jsonable(x) for k, x in v.items()}
        if isinstance(v, (list, tuple)):
            return [_jsonable(x) for x in v]
        try:
            return int(v)
        except (TypeError, ValueError):
            return str(v)


def tavern():
    """The tavern builder's empty room, or None (with the reason) if it is not there yet or does not import."""
    path = SP + '/dirs/ux-tavern/interior.py'
    if not os.path.exists(path):
        return None, 'dirs/ux-tavern/interior.py does not exist yet'
    sys.path.insert(0, SP + '/dirs/ux-tavern')
    sys.path.insert(1, SP + '/dirs')
    try:
        import interior  # noqa: E402
        cv, info = interior.render(people=False)
        return (cv, info), None
    except Exception:  # noqa: BLE001  (any failure falls back to the stand-in, and says why)
        return None, 'interior.py did not render: ' + traceback.format_exc(limit=3).strip().splitlines()[-1]


def standin():
    """Riverside Market's street (dirs/px-town), the stand-in until the tavern interior exists."""
    sys.path.insert(0, SP + '/dirs/px-town')
    sys.path.insert(1, SP + '/dirs')
    import scene as SC  # noqa: E402
    return SC.render('tavern')


if __name__ == '__main__':
    got, why = tavern()
    if got:
        cv, info = got
        info = {k: v for k, v in info.items() if k != 'light'}     # the window-light mask: the room's own business
        meta = {'standin': False, 'source': 'dirs/ux-tavern/interior.py render(people=False)', 'info': _jsonable(info)}
    else:
        cv, info = standin()
        meta = {'standin': True, 'source': 'dirs/px-town/scene.py render("tavern"), dimmed', 'why': why, 'info': _jsonable(info)}
    im = cv.image()
    if im.size != (1280, 720):
        meta['size'] = list(im.size)
    im.save(CACHE + '/room.png', optimize=True)
    with open(CACHE + '/room.json', 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, indent=1, sort_keys=True)
    print(json.dumps({k: v for k, v in meta.items() if k != 'info'}))
