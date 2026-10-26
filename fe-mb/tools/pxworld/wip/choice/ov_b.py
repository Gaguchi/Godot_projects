"""Renders variant B's country (C shares it) with px-open-b/overview.py, large, for the choice canvas."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(DIRS, 'px-open-b'))
import overview as OV
W, H = int(sys.argv[1]) if len(sys.argv) > 1 else 600, int(sys.argv[2]) if len(sys.argv) > 2 else 520
cv, marks = OV.overview(W, H)
cv.save(os.path.join(HERE, 't', 'ov_b.png'))
json.dump({'w': W, 'h': H, 'camp': marks['camp'], 'throne': marks['throne'],
           'labels': {k.lower(): v for k, v in marks['labels'].items()}}, open(os.path.join(HERE, 't', 'ov_b.json'), 'w'), indent=1)
print('ok')
