"""Export the camp's art to the game (game/): the clearing the camp screen stands on, with nobody in it.

    python src/px-camp/export_game.py            (from tools/pxworld)

Writes
    game/public/art/camp/clearing.png      the clearing at 1x, 1280 x 720: tent, fire, standard, logs, the woods
    game/src/ui/camp/campArt.json          where the company may stand in it (stage px), and each sprite's foot

The board (PxCamp) seats Lilina on the log under a blanket and mirrors Oak: both are drawn FOR those two sprites.
The game has whoever the run has, so it stands them, unmirrored, on SPOTS: places on the clearing's dirt that are
clear of the fire, the logs and the tent's mouth, ordered so the first three make the board's composition (one at
the fire's west side, one by the tent, one on the near side of the log) and later ones fill in around them.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(HERE + '/../..').replace('\\', '/')            # tools/pxworld
GAME = os.path.abspath(ROOT + '/../../game').replace('\\', '/')
sys.path.insert(0, ROOT + '/src/kit64')
sys.path.insert(0, HERE)
import scene as SC           # noqa: E402
import people as PP          # noqa: E402

# feet on the ground (x, y); a figure is 104 x 152 with its foot near (58, 147)
SPOTS = [
    SC.ROY_AT,          # west of the fire, where the board stands the foundling
    SC.OAK_AT,          # by the tent's mouth, where the board stands Oak
    (548, 598),         # the near side of the log, east of the fire
    (742, 566),         # the clearing's east edge
    (196, 632),         # the near grass by the chopping stump
    (650, 700),         # the near edge, by the bedroll
]


def camp():
    im = SC.compose(company=False).render().convert('RGB')
    os.makedirs(GAME + '/public/art/camp', exist_ok=True)
    im.save(GAME + '/public/art/camp/clearing.png', optimize=True)
    art = {
        'spots': [[int(x), int(y)] for (x, y) in SPOTS],
        'feet': {k.replace('board_', ''): [int(v[0]), int(v[1])] for k, v in PP.FEET.items()},
        'fire': [int(SC.FIRE[0]), int(SC.FIRE[1])],
    }
    os.makedirs(GAME + '/src/ui/camp', exist_ok=True)
    with open(GAME + '/src/ui/camp/campArt.json', 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(art, fh, indent=2)
        fh.write('\n')
    print('exported the camp:', im.size, len(SPOTS), 'spots')


if __name__ == '__main__':
    camp()
