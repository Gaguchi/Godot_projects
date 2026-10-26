"""A pinhole camera over a flat ground plane, for the title's deep view.

The company stands 1:1 in the foreground (the 104 x 152 board sprites, a person about 140 px tall), so the camera
is fixed by two numbers: where the horizon sits on the stage (YH) and where the company's feet are (Y_FEET).
Everything else in the world takes its size from its depth: a thing Z metres away is drawn at S(Z) px per metre.
Big things (the bridge, the village, the woods) are far, so they come out smaller by perspective, never by
mixing scales on one ground plane.

World coordinates: X metres to the right of the camera, Z metres ahead of it, ground at height 0.
"""
import math

import numpy as np

W, H = 1280, 720
CX = 640                  # the vanishing point's x
YH = 232                  # the horizon
F = 1000.0                # focal length, px
PERSON_M = 1.8            # a person, metres
PERSON_PX = 140           # ... and the board sprite's figure, px, at the company's depth
Y_FEET = 668              # the company's feet
HC = (Y_FEET - YH) * PERSON_M / PERSON_PX     # camera height above the ground, metres (about 5.6)


def Z_of_y(y):
    """Depth of the ground seen at stage row y (y > YH)."""
    return F * HC / (np.asarray(y, float) - YH)


def y_of_Z(Z):
    return YH + F * HC / np.asarray(Z, float)


def S(Z):
    """px per metre at depth Z."""
    return F / np.asarray(Z, float)


def S_at_y(y):
    return S(Z_of_y(y))


def proj(X, Z, h=0.0):
    """Stage (x, y) of the world point X, Z at height h above the ground."""
    return CX + F * X / Z, YH + F * (HC - h) / Z


def unproj(x, y):
    Z = Z_of_y(y)
    return (np.asarray(x, float) - CX) * Z / F, Z


def ground_grid(y0=None):
    """Per-pixel world X, Z for every ground row (rows above the horizon get Z = inf)."""
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    yy += .5
    xx += .5
    with np.errstate(divide='ignore', invalid='ignore'):
        Z = np.where(yy > YH + .5, F * HC / (yy - YH), np.inf)
        X = (xx - CX) * Z / F
    return X, Z


def scale_rel(y):
    """Size of things at row y relative to the company (1.0 at their feet)."""
    return S_at_y(y) / S(Z_of_y(Y_FEET))


def proj_poly(pts):
    return [proj(X, Z) for (X, Z) in pts]


if __name__ == '__main__':
    print('camera height', round(HC, 2), 'm; feet depth', round(float(Z_of_y(Y_FEET)), 2), 'm')
    for y in (720, 668, 600, 500, 450, 400, 380, 350, 320, 300, 280, 260, 250, 240):
        print(y, round(float(Z_of_y(y)), 1), 'm', round(float(S_at_y(y)), 1), 'px/m', 'person', round(float(S_at_y(y)) * 1.8), 'px')
