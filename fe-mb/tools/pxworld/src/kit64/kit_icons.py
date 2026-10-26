"""Filigree kit, icons: 24 px, shaded in 4-5 tones, ink-outlined, lit from the north-west.
Procedural masks with hand-placed details (extends dirs/hyb-64/icons64.py). Use kit.icon(name) to get one.
"""
import math

import numpy as np

from kit_px import (Icon, Raster, cover, circle, ellipse, poly, rect_, seg, union, minus, outline, from_rows, shade, BR)

OCH = ['o1', 'o2', 'o3', 'o4', 'o5']
OCH6 = ['o0', 'o1', 'o2', 'o3', 'o4', 'o5']
OX = ['x1', 'x2', 'x3', 'x4', 'x5']
SL = ['s1', 's2', 's3', 's4', 's5']
SL5 = ['s0', 's1', 's2', 's3', 's4']
WD = ['w3', 'w4', 'w5', 'w6']
LEA = ['w2', 'w3', 'w4', 'w5']
CLOTH = ['w4', 'w5', 'w6', 'b2', 'b3']
IRON = ['b0', 'b1', 'b2', 'b3', 'b4', 'b5']
STEEL = ['s1', 's2', 's3', 's4', 's5']
BONE = ['b1', 'b2', 'b3', 'b4', 'b5']
MOSS = ['m1', 'm2', 'm3', 'm4', 'm5']
ROCK = ['b0', 'b1', 'b2', 'b3']
S = 24


def star_pts(cx, cy, ro, ri, n, rot=-math.pi / 2):
    """Points of an n-pointed star."""
    pts = []
    for i in range(n * 2):
        a = rot + math.pi * i / n
        r = ro if i % 2 == 0 else ri
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def _diag(x0, y0, x1, y1, hw0, hw1=None, tip=0.0):
    """A straight blade from (x0,y0) to (x1,y1): half-width hw0 at the base, hw1 near the tip, then a point."""
    hw1 = hw0 if hw1 is None else hw1
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    tx, ty = x1 - ux * tip, y1 - uy * tip
    return poly([(x0 + nx * hw0, y0 + ny * hw0), (tx + nx * hw1, ty + ny * hw1), (x1, y1),
                 (tx - nx * hw1, ty - ny * hw1), (x0 - nx * hw0, y0 - ny * hw0)])


# ================================================================ resources
def sun():
    """Day: a brass sun."""
    I = Icon()
    c = 12
    I.layer(poly(star_pts(c, c, 11.3, 6.5, 8)), ['o2', 'o3', 'o4', 'o5'], R=1.5, glint=False)
    I.layer(circle(c, c, 6.5), ['o2', 'o3', 'o4', 'o5', 'o6'], R=3.2, inner_line='o1')
    return I.raster()


def moon():
    """Night: a bone crescent."""
    I = Icon()
    I.layer(minus(circle(12, 12, 9.5), circle(16.5, 9, 8)), BONE, R=2.4, glint=False)
    for (x, y) in ((17, 16), (19, 5), (21, 11)):
        I.put(x, y, 'b5')
    return I.raster()


def coin():
    """Gold: a coin over a second coin."""
    I = Icon()
    I.layer(ellipse(8, 15.5, 6.5, 6.5), ['o1', 'o2', 'o3', 'o4'], R=2.2, glint=False)
    I.layer(circle(13.5, 11, 8.6), OCH6, R=2.6, inner_line='o0')
    face = I.m(circle(13.5, 11, 5.6))
    rim = outline(face) & I.m(circle(13.5, 11, 8.6))
    for j, i in zip(*np.nonzero(rim)):
        I.keys[j, i] = 'o2' if (i + j) < 26 else 'o4'
    I.stamp(["k.k.k", "kkkkk", ".k2k.", ".k2k.", "kkkkk"], 11, 8, keymap={'k': 'o1', '2': 'o3'})
    I.put(10, 5, 'o6')
    return I.raster()


def coin16(dim=False):
    """The 16 px coin for prices; dim=True for a price beyond the purse."""
    I = Icon(16, 16)
    ramp = ['w3', 'w4', 'w5', 'w6', 'b1'] if dim else ['o1', 'o2', 'o3', 'o4', 'o5', 'o6']
    I.layer(circle(8, 8, 6.6), ramp, R=2.0, inner_line=None, glint=not dim)
    face = I.m(circle(8, 8, 4.2))
    rim = outline(face) & I.m(circle(8, 8, 6.6))
    for j, i in zip(*np.nonzero(rim)):
        I.keys[j, i] = ramp[1] if (i + j) < 16 else ramp[3]
    I.stamp(["k.k", "kkk", "kkk"], 7, 6, keymap={'k': ramp[0]})
    return I.raster()


def ration():
    """Food: a tied cloth sack."""
    I = Icon()
    body = I.m(ellipse(12, 15.5, 8.2, 7.2))
    neck = I.m(poly([(8.5, 9.5), (15.5, 9.5), (14, 5), (10, 5)]))
    I.layer(body | neck, CLOTH, R=3.2)
    I.layer(poly([(7.5, 5.5), (16.5, 5.5), (15, 2.2), (12, 3.6), (9, 2.2)]), ['w4', 'w5', 'w6', 'b2'], R=1.4, inner_line='w3', glint=False)
    for i in range(8, 16):
        I.put(i, 8, 'o2' if i % 2 else 'o3')
        I.put(i, 9, 'o1')
    I.stamp(["k3k", "323", ".2."], 15, 7, keymap={'k': 'o1', '3': 'o3', '2': 'o2'})
    for j in range(13, 20):
        if j % 2:
            I.put(9, j, 'w4')
    return I.raster()


def flask(liquid=OX, hi='x5'):
    """A stoppered flask with the given liquid ramp."""
    I = Icon()
    glass = I.m(circle(12, 15.2, 7.6)) | I.m(rect_(9.6, 6.5, 14.4, 11))
    I.layer(glass, ['s2', 's3', 's4', 's5'], R=2.4, glint=False)
    liq = I.m(circle(12, 15.2, 6.4)) & I.m(rect_(0, 12.2, 24, 24))
    sh = shade(liq, liquid, R=3)
    for j, i in zip(*np.nonzero(liq)):
        I.keys[j, i] = sh[j, i]
    for i in range(7, 18):
        if liq[12, i]:
            I.keys[12, i] = hi
    I.layer(rect_(9, 2.2, 15, 6.4), ['w3', 'w4', 'w5', 'w6'], R=1.6, inner_line='w2', glint=False)
    for i in range(9, 15):
        I.put(i, 6, 'b3' if i < 12 else 'b2')
    for (x, y) in ((7, 13), (7, 14), (8, 12), (8, 15), (9, 11)):
        I.put(x, y, 's5')
    I.put(14, 18, hi)
    return I.raster()


def potion():
    """A Healing Potion: a red flask."""
    return flask(OX, 'x5')


def elixir():
    """A Power Elixir: an amber flask."""
    return flask(['o1', 'o2', 'o3', 'o4', 'o5'], 'o6')


def gem():
    """The AP gem at 24 px: an amber cabochon in a brass bezel."""
    I = Icon()
    I.layer(circle(12, 12, 10.4), ['o0', 'o1', 'o2', 'o3', 'o4'], R=1.6, glint=False)
    I.layer(circle(12, 12, 7.6), ['x1', 'x2', 'o2', 'o3', 'o4', 'o5'], R=4.4, inner_line='o0', glint=False)
    for (x, y, c) in ((8, 7, 'o6'), (9, 7, 'o6'), (8, 8, 'o6'), (7, 9, 'o5'), (14, 16, 'o4'), (15, 15, 'o4')):
        I.put(x, y, c)
    return I.raster()


# ================================================================ card kinds and card art
def flame(s=24, core=True):
    """Fire and Blaze card art: a flame (s = size; core = the white heart)."""
    I = Icon(s, s)
    sc = s / 24
    outer = I.m(poly([(12 * sc, 1.5 * sc), (16.5 * sc, 7 * sc), (19 * sc, 12 * sc), (19.5 * sc, 16 * sc), (17.5 * sc, 20 * sc), (13.5 * sc, 22.6 * sc), (9.5 * sc, 22.4 * sc),
                      (5.6 * sc, 19.6 * sc), (4.4 * sc, 15.2 * sc), (5.6 * sc, 10.6 * sc), (7.4 * sc, 13 * sc), (8.6 * sc, 8 * sc)]))
    I.layer(outer, OX, R=3.0 * sc, glint=False)
    mid = I.m(poly([(12.6 * sc, 7 * sc), (16 * sc, 12.5 * sc), (16.6 * sc, 16.5 * sc), (14.6 * sc, 20 * sc), (11.6 * sc, 21 * sc), (8.6 * sc, 19.6 * sc), (7.6 * sc, 16.2 * sc), (9.4 * sc, 12.4 * sc), (10.6 * sc, 14.4 * sc)]))
    I.layer(mid, ['x3', 'o3', 'o4', 'o5'], R=2.4 * sc, glint=False)
    if core:
        I.layer(ellipse(12.4 * sc, 17.6 * sc, 2.6 * sc, 3.2 * sc), ['o4', 'o5', 'o6'], R=1.6 * sc, glint=False)
    return I.raster()


def burst(s=24):
    """Flame Burst card art: an eight-point blast."""
    I = Icon(s, s)
    c = s / 2
    I.layer(poly(star_pts(c, c, s * .49, s * .2, 8)), ['x2', 'x3', 'x4', 'o3', 'o4'], R=1.8 * s / 24, glint=False)
    I.layer(poly(star_pts(c, c, s * .33, s * .15, 8, -math.pi / 2 + math.pi / 8)), ['o3', 'o4', 'o5', 'o6'], R=1.4 * s / 24, glint=False)
    I.layer(circle(c, c, s * .12), ['o5', 'o6'], R=1, glint=False)
    return I.raster()


def ward(s=24):
    """A heater shield with a pale chevron: the ward kind (armor, heals)."""
    I = Icon(s, s)
    sc = s / 24
    outer = I.m(poly([(3.5 * sc, 3 * sc), (20.5 * sc, 3 * sc), (20.5 * sc, 11 * sc), (18.8 * sc, 16 * sc), (15 * sc, 20 * sc), (12 * sc, 22.4 * sc), (9 * sc, 20 * sc), (5.2 * sc, 16 * sc), (3.5 * sc, 11 * sc)]))
    I.layer(outer, OCH, R=1.6 * sc, glint=False)
    inner = I.m(poly([(6 * sc, 5.5 * sc), (18 * sc, 5.5 * sc), (18 * sc, 11 * sc), (16.6 * sc, 15 * sc), (13.6 * sc, 18.2 * sc), (12 * sc, 19.4 * sc), (10.4 * sc, 18.2 * sc), (7.4 * sc, 15 * sc), (6 * sc, 11 * sc)]))
    I.layer(inner, SL5, R=3.6 * sc, inner_line='o0')
    for i in range(int(7 * sc), int(17.6 * sc)):
        d = abs(i - 12 * sc)
        y = int(round(9 * sc + d * .7))
        if inner[y, i]:
            I.keys[y, i] = 's4'
            if inner[y + 1, i]:
                I.keys[y + 1, i] = 's3'
    return I.raster()


def orb(s=24):
    """Arcane: a blue orb in a brass ring, like the one on Lilina's staff."""
    I = Icon(s, s)
    c = s / 2
    ring = I.m(circle(c, c, s * .46)) & ~I.m(circle(c, c, s * .33))
    I.layer(ring, OCH, R=1.6 * s / 24, glint=False)
    I.layer(circle(c, c, s * .33), ['s0', 's1', 's2', 's3', 's4', 's5'], R=3.6 * s / 24, inner_line='o0')
    for a in range(4):
        ang = -math.pi / 4 + a * math.pi / 2
        x, y = int(round(c + math.cos(ang) * s * .36 - .5)), int(round(c + math.sin(ang) * s * .36 - .5))
        I.put(x, y, 'o4' if a in (2, 3) else 'o2')
    cx = cy = c - .5
    for t in np.linspace(0, 1.6 * math.pi, 22):
        r = s * (.06 + .1 * t / 5)
        x, y = int(round(cx + math.cos(t + 2.4) * r)), int(round(cy + math.sin(t + 2.4) * r))
        I.put(x, y, 's5' if t < 2.5 else 's4')
    return I.raster()


def attack():
    """The attack kind: a blade with a bright strike at its point."""
    I = Icon()
    I.layer(_diag(5.6, 18.4, 17.6, 6.4, 1.7, 1.4, 2.6), IRON[1:], R=1.2, glint=False)
    I.layer(seg(3.0, 14.8, 8.8, 20.6, 1.2), OCH, R=1, glint=False)
    I.layer(seg(2.4, 21.6, 4.8, 19.2, 1.3), LEA, R=1, glint=False)
    I.layer(poly(star_pts(18.5, 5.5, 5.4, 1.5, 4, -math.pi / 2)), ['x3', 'o3', 'o4', 'o5', 'o6'], R=1.2, glint=False)
    I.put(18, 5, 'o6')
    return I.raster()

def focus():
    """The focus kind (draw cards, gain AP): three cards fanned, a gem on the top one."""
    I = Icon()
    for (cx, ang, ramp) in ((8.5, -.42, ['w3', 'w4', 'w5']), (15.5, .42, ['w3', 'w4', 'w5']), (12, 0, ['b1', 'b2', 'b3', 'b4'])):
        hw, hh = 4.2, 7.6
        ca, sa = math.cos(ang), math.sin(ang)
        cy = 13
        pts = [(cx + ca * dx - sa * dy, cy + sa * dx + ca * dy) for dx, dy in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh))]
        I.layer(poly(pts), ramp, R=1.4, inner_line='k0', glint=False)
    I.layer(poly([(12, 8.5), (15, 12.5), (12, 16.5), (9, 12.5)]), ['o2', 'o3', 'o4', 'o5'], R=1.4, inner_line='o1', glint=False)
    return I.raster()


def heal():
    """A sprig of three leaves: mending."""
    I = Icon()
    I.layer(seg(12, 22, 12, 9, .8), ['m1', 'm2'], R=1, glint=False)
    for (cx, cy, a) in ((12, 6.5, 0), (7.4, 12.5, -.9), (16.6, 12.5, .9)):
        ca, sa = math.cos(a), math.sin(a)
        pts = []
        for t in np.linspace(0, 2 * math.pi, 18):
            dx, dy = math.sin(t) * 3.3, -math.cos(t) * 5.6
            dx *= (1 - .35 * (math.cos(t) < 0))
            pts.append((cx + ca * dx - sa * dy, cy + sa * dx + ca * dy))
        I.layer(poly(pts), MOSS, R=2.2, inner_line='m0', glint=False)
    return I.raster()


# ================================================================ commands and places
def boot():
    """Move: a walking boot."""
    I = Icon()
    I.layer(poly([(7, 2.5), (14, 2.5), (14.2, 13), (20.5, 15.5), (21.5, 19.5), (21.5, 21.5), (4.5, 21.5), (5, 17), (6.5, 13)]), LEA + ['w6'], R=2.6, glint=False)
    for x in range(5, 22):
        I.put(x, 20, 'w2'); I.put(x, 21, 'w1')
    for x in range(7, 14):
        I.put(x, 5, 'o3' if x % 2 else 'o2')
    for y in (8, 11):
        I.put(12, y, 'o4'); I.put(13, y, 'o2')
    return I.raster()


def shackles():
    """Capture: two iron cuffs on a short chain."""
    I = Icon()
    for cx, cy in ((7, 15), (17, 15)):
        I.layer(minus(circle(cx, cy, 5.6), circle(cx, cy, 3.1)), IRON, R=1.4, glint=False)
        I.layer(rect_(cx - 1.4, cy - 7.4, cx + 1.4, cy - 4.6), IRON[1:], R=1, glint=False)
    for (x, y) in ((10, 6), (12, 5), (14, 6)):
        I.layer(minus(ellipse(x, y, 2, 1.6), ellipse(x, y, .8, .5)), IRON[1:], R=1, glint=False)
    return I.raster()


def hourglass():
    """End turn."""
    I = Icon()
    glass = poly([(6.5, 4.5), (17.5, 4.5), (17, 7.5), (13, 12), (17, 16.5), (17.5, 19.5), (6.5, 19.5), (7, 16.5), (11, 12), (7, 7.5)])
    I.layer(glass, ['s2', 's3', 's4', 's5'], R=1.6, glint=False)
    I.flat(poly([(8.5, 7.5), (15.5, 7.5), (12.6, 11)]), 'o4')
    I.flat(poly([(8, 18.6), (16, 18.6), (12, 15.4)]), 'o3')
    I.put(12, 13, 'o4'); I.put(12, 14, 'o4')
    I.layer(rect_(3.5, 1.8, 20.5, 4.4), WD, R=1, inner_line='k0', glint=False)
    I.layer(rect_(3.5, 19.6, 20.5, 22.2), WD, R=1, inner_line='k0', glint=False)
    for y in range(5, 20):
        I.put(4, y, 'w4'); I.put(19, y, 'w3')
    return I.raster()


def danger():
    """Danger zone: the foe's lozenge, struck with a warning bar."""
    I = Icon()
    I.layer(poly([(12, 1.5), (22.5, 12), (12, 22.5), (1.5, 12)]), OX, R=2.4, glint=False)
    I.layer(poly([(12, 5.5), (18.5, 12), (12, 18.5), (5.5, 12)]), ['x0', 'x1', 'x2'], R=1.4, inner_line='x1', glint=False)
    for y in range(7, 14):
        I.put(11, y, 'b4'); I.put(12, y, 'b3')
    I.put(11, 15, 'b4'); I.put(12, 15, 'b3'); I.put(11, 16, 'b3'); I.put(12, 16, 'b2')
    return I.raster()


def campfire():
    """Rest: two crossed logs and a small fire."""
    I = Icon()
    I.layer(seg(3.5, 20, 19.5, 15.5, 2), WD, R=1.4, glint=False)
    I.layer(seg(4.5, 15.5, 20.5, 20, 2), WD, R=1.4, inner_line='w2', glint=False)
    for (x, y) in ((3, 20), (20, 20)):
        I.put(x, y, 'b2')
    f = poly([(12, 2), (15.5, 7), (17, 11), (16, 14.5), (12, 16.5), (8, 14.5), (7, 11), (8.6, 8), (10, 10)])
    I.layer(f, OX, R=2.2, glint=False)
    I.layer(poly([(12.2, 7.5), (14.6, 11), (14, 13.6), (12, 14.8), (10, 13.6), (9.6, 11.2), (11, 12)]), ['o3', 'o4', 'o5', 'o6'], R=1.6, glint=False)
    return I.raster()


def spyglass():
    """Scout: a brass spyglass, drawn out in three sections."""
    I = Icon()
    I.layer(_diag(4, 20, 9.5, 14.5, 2.3), OCH, R=1.4, glint=False)
    I.layer(_diag(9, 15, 15, 9, 2.8), ['w3', 'w4', 'w5', 'w6'], R=1.4, inner_line='k0', glint=False)
    I.layer(_diag(14.5, 9.5, 20.5, 3.5, 3.4), OCH, R=1.6, inner_line='k0', glint=False)
    I.layer(ellipse(20.5, 3.5, 2.4, 2.4), ['s3', 's4', 's5'], R=1, glint=False)
    for (x, y) in ((8, 15), (14, 9)):
        I.put(x, y, 'o5')
    return I.raster()


def map_():
    """The map: a folded sheet of three panels with a route and a cross."""
    I = Icon()
    pan = [poly([(2.5, 5), (9, 3), (9, 19), (2.5, 21)]), poly([(9, 3), (15, 5), (15, 21), (9, 19)]), poly([(15, 5), (21.5, 3), (21.5, 19), (15, 21)])]
    for k, p in enumerate(pan):
        I.layer(p, ['b1', 'b2', 'b3'] if k == 1 else ['b2', 'b3', 'b4'], R=1, inner_line='b0', glint=False)
    for (x, y) in ((5, 16), (6, 14), (8, 13), (10, 12), (12, 13), (13, 11), (15, 10), (16, 9)):
        I.put(x, y, 'x3')
    I.stamp(["x.x", ".x.", "x.x"], 17, 6, keymap={'x': 'x2'})
    for (x, y) in ((4, 8), (5, 9), (11, 7), (12, 6), (19, 14), (18, 15)):
        I.put(x, y, 'm3')
    return I.raster()


def scroll():
    """A contract: a rolled sheet with an oxblood seal."""
    I = Icon()
    I.layer(rect_(5, 4.5, 19, 19.5), ['b2', 'b3', 'b4'], R=1.4, glint=False)
    I.layer(ellipse(12, 4.2, 9.2, 2.6), ['b1', 'b2', 'b3', 'b4'], R=1.2, inner_line='b0', glint=False)
    I.layer(ellipse(12, 19.8, 9.2, 2.6), ['b1', 'b2', 'b3', 'b4'], R=1.2, inner_line='b0', glint=False)
    for y in (8, 11, 14):
        for x in range(7, 17 if y != 14 else 13):
            I.put(x, y, 'b1')
    I.layer(circle(15.5, 15, 3.4), OX, R=1.6, inner_line='b0', glint=False)
    I.put(15, 14, 'x5')
    for (x, y) in ((14, 18), (16, 18), (15, 19)):
        I.put(x, y, 'x2')
    return I.raster()


def horn(muted=False):
    """Sound: a brass bell ringing; muted adds an oxblood cross."""
    I = Icon()
    body = poly([(12, 2.5), (14.6, 3.4), (16, 6), (16.6, 10.5), (18, 14.5), (20, 17), (20, 18.5), (4, 18.5), (4, 17), (6, 14.5), (7.4, 10.5), (8, 6), (9.4, 3.4)])
    I.layer(body, OCH6, R=2.4, glint=False)
    I.layer(rect_(3, 17.6, 21, 19.6), OCH, R=1, inner_line='o0', glint=False)
    I.layer(circle(12, 21, 1.8), ['o1', 'o2', 'o3'], R=1, inner_line='o0', glint=False)
    I.layer(rect_(11, .8, 13, 2.6), OCH, R=1, glint=False)
    if muted:
        for d in range(8):
            for (x, y) in ((14 + d, 13 + d), (21 - d, 13 + d)):
                I.put(x, y, 'x4'); I.put(x + 1, y, 'x2')
    else:
        for (x, y) in ((2, 6), (1, 8), (1, 10), (2, 12), (22, 6), (23, 8), (23, 10), (22, 12)):
            I.put(x, y, 'b4')
    return I.raster()

def quill():
    """Save: a quill standing in an inkpot."""
    I = Icon()
    I.layer(poly([(19.5, 1.5), (16, 5), (12, 10), (10, 14), (11.4, 14.6), (14.5, 10.5), (18.5, 6.5), (21, 3)]), BONE, R=1.6, glint=False)
    for (x, y) in ((18, 4), (16, 6), (14, 8), (13, 10), (12, 12)):
        I.put(x, y, 'b1')
    I.layer(poly([(5, 13.5), (15, 13.5), (17, 16), (17, 21.5), (3, 21.5), (3, 16)]), ['s0', 's1', 's2', 's3'], R=1.8, glint=False)
    I.layer(rect_(6.5, 11.5, 13.5, 13.6), OCH, R=1, inner_line='k0', glint=False)
    I.put(5, 17, 's4'); I.put(5, 18, 's3')
    return I.raster()


def door():
    """Quit: an arched door left ajar."""
    I = Icon()
    arch = union(rect_(4, 9, 20, 22), ellipse(12, 9.5, 8, 7.6))
    I.layer(arch, ROCK, R=1.4, glint=False)
    inner = union(rect_(6.5, 9.5, 17.5, 22), ellipse(12, 9.8, 5.5, 5.4))
    I.flat(inner, 'k1')
    I.layer(poly([(6.6, 8), (12, 6), (12, 22), (6.6, 22)]), WD, R=1.2, inner_line='k0', glint=False)
    for y in range(9, 22, 4):
        I.put(7, y, 'w2'); I.put(11, y, 'w2')
    I.put(10, 15, 'o5'); I.put(10, 16, 'o3')
    for x in range(13, 18):
        I.put(x, 21, 'o2' if x % 2 else 'o1')
    return I.raster()


def cog():
    """Settings: a brass cog of eight teeth."""
    I = Icon()
    teeth = []
    for k in range(8):
        a = k * math.pi / 4
        teeth.append(seg(12 + math.cos(a) * 7.5, 12 + math.sin(a) * 7.5, 12 + math.cos(a) * 10, 12 + math.sin(a) * 10, 1.8))
    I.layer(union(circle(12, 12, 8), *teeth), OCH6, R=1.8, glint=False)
    I.flat(circle(12, 12, 3.2), 'k1')
    ring = outline(I.m(circle(12, 12, 3.2))) & I.solid
    for j, i in zip(*np.nonzero(ring)):
        I.keys[j, i] = 'o1' if (i + j) < 24 else 'o4'
    return I.raster()


def banner():
    """The company: our standard, red under a blue band with a bone chevron."""
    I = Icon()
    I.layer(rect_(4.2, 1.5, 6, 22.5), WD, R=1, glint=False)
    I.layer(poly([(6.5, 3), (20.5, 3), (20.5, 16.5), (17, 13.5), (13.5, 17), (10, 13.5), (6.5, 16.5)]), OX, R=2, glint=False)
    I.flat(rect_(6.5, 3, 20.5, 5.6), 's2')
    for x in range(7, 21):
        I.put(x, 3, 's3')
    for d in range(-4, 5):
        y = int(round(9.5 + abs(d) * .9))
        I.put(13 + d, y, 'b4'); I.put(13 + d, y - 1, 'b5' if d < 0 else 'b3')
    I.stamp(["k", "o"], 4, 0, keymap={'k': 'b2', 'o': 'b3'})
    return I.raster()


# ================================================================ item kinds
def sword():
    """Item kind sword."""
    I = Icon()
    I.layer(_diag(7.6, 16.4, 20.6, 3.4, 1.7, 1.3, 2.6), IRON[1:], R=1.2, glint=False)
    I.layer(seg(4.6, 13.4, 10.6, 19.4, 1.25), OCH, R=1, glint=False)
    I.layer(seg(4.8, 19.2, 7.2, 16.8, 1.2), LEA, R=1, glint=False)
    I.layer(circle(3.7, 20.3, 1.9), OCH, R=1, glint=False)
    return I.raster()


def greatsword():
    """Item kind greatsword (two-handed)."""
    I = Icon()
    I.layer(_diag(6.8, 17.2, 22.2, 1.8, 2.5, 2.1, 3.2), IRON, R=1.6, glint=False)
    for d in range(3, 13):
        I.put(7 + d, 16 - d, 'b2')
    I.layer(seg(3.0, 13.0, 11.0, 21.0, 1.4), OCH, R=1, glint=False)
    I.layer(seg(2.6, 21.4, 6.2, 17.8, 1.3), LEA, R=1, glint=False)
    I.layer(circle(2.4, 21.6, 1.6), OCH, R=1, glint=False)
    return I.raster()


def dagger():
    """Item kind dagger."""
    I = Icon()
    I.layer(_diag(10.4, 13.6, 19.6, 4.4, 1.9, 1.2, 3.2), IRON[1:], R=1.2, glint=False)
    I.layer(seg(7.6, 10.8, 13.2, 16.4, 1.2), OCH, R=1, glint=False)
    I.layer(seg(6.6, 17.4, 9.8, 14.2, 1.3), LEA, R=1, glint=False)
    I.layer(circle(5.6, 18.4, 1.7), OCH, R=1, glint=False)
    return I.raster()


def lance():
    """Item kind lance, with a pennant."""
    I = Icon()
    I.layer(seg(2.6, 21.4, 15.5, 8.5, 1.15), WD, R=1, glint=False)
    I.layer(_diag(14.5, 9.5, 21.6, 2.4, 1.9, 1.6, 3.4), IRON[1:], R=1.2, glint=False)
    I.layer(seg(13.2, 9.8, 15.2, 11.8, 1.3), OCH, R=1, inner_line='k0', glint=False)
    I.layer(poly([(11.5, 12.5), (6.5, 10), (8.5, 13.2), (6.5, 16.5)]), OX, R=1.2, inner_line='k0', glint=False)
    I.layer(poly([(4.5, 17.5), (8.5, 16.5), (7.5, 20.5)]), OCH, R=1, inner_line='k0', glint=False)
    return I.raster()


def axe():
    """Item kind axe."""
    I = Icon()
    I.layer(seg(6.5, 22, 12.8, 3.5, 1.25), WD, R=1, glint=False)
    head = poly([(11.6, 3.6), (14.4, 4.6), (17.6, 1.6), (21.6, 4.2), (23.0, 9.4), (21.6, 14.8), (17.8, 12.4), (14.4, 10.2), (11.2, 9.8)])
    I.layer(head, ['b0', 'b1', 'b2', 'b3'], R=3.0, inner_line='k0', glint=False)
    for (x, y) in ((18, 2), (19, 2), (20, 3), (21, 4), (21, 5), (22, 6), (22, 7), (22, 8), (22, 9), (22, 10), (22, 11), (21, 12), (21, 13)):
        I.put(x, y, 'b5')
    for (x, y) in ((17, 3), (20, 5), (21, 7), (21, 9), (21, 11)):
        I.put(x, y, 'b4')
    I.layer(rect_(10.6, 3.4, 14.2, 9.8), OCH, R=1, inner_line='k0', glint=False)
    return I.raster()

def bow():
    """Item kind bow, an arrow nocked."""
    I = Icon()
    limb = I.m(circle(19, 12, 15)) & ~I.m(circle(19, 12, 13)) & I.m(rect_(0, 1.5, 24, 22.5))
    I.layer(limb, WD, R=1, glint=False)
    for y in range(2, 23):
        I.put(13 if y in range(2, 6) or y in range(18, 23) else 12, y, 'b4')
    I.layer(rect_(3.6, 10, 6.4, 14), LEA, R=1, inner_line='k0', glint=False)
    I.layer(seg(8, 12, 21, 12, .6), ['w5', 'w6'], R=1, glint=False)
    I.layer(poly([(20, 9.8), (23.4, 12), (20, 14.2)]), IRON[2:], R=1, glint=False)
    for (x, y) in ((8, 10), (9, 11), (8, 14), (9, 13)):
        I.put(x, y, 'x4')
    return I.raster()


def crossbow():
    """Item kind crossbow."""
    I = Icon()
    I.layer(rect_(10.6, 6, 13.4, 22.5), WD, R=1, glint=False)
    prod = I.m(circle(12, 18, 14)) & ~I.m(circle(12, 18, 12.4)) & I.m(rect_(0, 2, 24, 12))
    I.layer(prod, IRON, R=1, inner_line='k0', glint=False)
    for t in np.linspace(0, 1, 12):
        I.put(int(round(2.5 + t * 9)), int(round(9.6 + t * 3)), 'b4')
        I.put(int(round(21.5 - t * 9)), int(round(9.6 + t * 3)), 'b4')
    I.layer(rect_(9.6, 12, 14.4, 14.2), OCH, R=1, inner_line='k0', glint=False)
    return I.raster()


def tome():
    """Item kind tome: a bound book with a flame sigil."""
    I = Icon()
    I.layer(rect_(16.5, 4.5, 20.5, 21.5), ['b2', 'b3', 'b4'], R=1, glint=False)
    for y in range(6, 21, 2):
        I.put(19, y, 'b1')
    I.layer(rect_(3.5, 2.5, 17.5, 20.5), OX, R=2.4, inner_line='k0', glint=False)
    I.layer(rect_(3.5, 2.5, 5.6, 20.5), ['x0', 'x1', 'x2'], R=1, glint=False)
    for (x, y) in ((6, 3), (16, 3), (6, 19), (16, 19)):
        I.stamp(["55", "53"], x - (x > 10), y - (y > 10), keymap=BR)
    f = poly([(11.5, 6), (14, 10), (14.4, 13), (12.8, 15.8), (11, 16.2), (9, 15), (8.6, 12.4), (10, 10.6), (10.6, 12)])
    I.layer(f, ['o2', 'o3', 'o4', 'o5'], R=1.4, inner_line='x1', glint=False)
    return I.raster()


def staff():
    """Item kind staff: a ringed blue stone."""
    I = Icon()
    I.layer(seg(3.5, 21.5, 14, 11, 1.2), WD, R=1, glint=False)
    ring = I.m(circle(16.6, 7.4, 5.4)) & ~I.m(circle(16.6, 7.4, 3.2))
    I.layer(ring, OCH, R=1.2, glint=False)
    I.layer(circle(16.6, 7.4, 3.0), SL5 + ['s5'], R=2, inner_line='o0', glint=False)
    I.put(15, 6, 's5')
    I.layer(rect_(12.2, 11.4, 14.4, 13.6), OCH, R=1, inner_line='k0', glint=False)
    return I.raster()


def buckler():
    """Item kind shield: a round iron buckler with a brass boss."""
    I = Icon()
    I.layer(circle(12, 12, 10.2), IRON, R=2.2, glint=False)
    ring = I.m(circle(12, 12, 7.8)) & ~I.m(circle(12, 12, 6.8))
    for j, i in zip(*np.nonzero(ring)):
        I.keys[j, i] = 'b1' if (i + j) < 24 else 'b4'
    I.layer(circle(12, 12, 3.6), OCH6, R=1.6, inner_line='b0')
    for k in range(6):
        a = k * math.pi / 3 + .3
        I.put(int(round(11.5 + math.cos(a) * 8.9)), int(round(11.5 + math.sin(a) * 8.9)), 'o3')
    return I.raster()


def quiver():
    """Item kind quiver."""
    I = Icon()
    for k, (x0, c) in enumerate(((9, 'b4'), (12.5, 'x4'), (16, 'b4'))):
        I.layer(poly([(x0 - 1.8, 2), (x0 + 1.8, 2), (x0 + 1.4, 8), (x0 - 1.4, 8)]), ['x2', 'x3', 'x4', 'x5'] if c == 'x4' else BONE, R=1, inner_line='k0', glint=False)
    I.layer(poly([(5.5, 7.5), (19, 7.5), (17.6, 22.5), (7, 22.5)]), LEA + ['w6'], R=2.4, inner_line='k0', glint=False)
    for x in range(6, 19):
        I.put(x, 11, 'o3' if x % 2 else 'o2'); I.put(x, 18, 'o3' if x % 2 else 'o2')
    return I.raster()


def armor():
    """A cuirass with pauldrons."""
    I = Icon()
    I.layer(poly([(7, 4), (17, 4), (18.5, 8), (17.5, 14), (18.5, 21), (5.5, 21), (6.5, 14), (5.5, 8)]), IRON, R=3.2, glint=False)
    I.layer(ellipse(4.6, 7, 3.4, 3), IRON[1:], R=1.4, inner_line='k0', glint=False)
    I.layer(ellipse(19.4, 7, 3.4, 3), IRON[1:], R=1.4, inner_line='k0', glint=False)
    I.flat(poly([(9.5, 3.5), (14.5, 3.5), (12, 7)]), 'k1')
    for y in range(8, 20):
        I.put(12, y, 'b1')
    for x in range(6, 19):
        I.put(x, 16, 'w3'); I.put(x, 17, 'w4')
    I.put(12, 16, 'o4'); I.put(12, 17, 'o2')
    return I.raster()


def amulet():
    """Trinket: a pendant on a chain, a red stone in a brass setting."""
    I = Icon()
    for t in np.linspace(0, 1, 9):
        x = 4 + t * 8
        y = 2 + math.sin(t * math.pi / 2) * 9
        I.put(int(round(x)), int(round(y)), 'o3' if int(t * 8) % 2 else 'o4')
        I.put(int(round(20 - t * 8)), int(round(y)), 'o3' if int(t * 8) % 2 else 'o2')
    I.layer(poly([(12, 9.5), (18.5, 15), (12, 22.5), (5.5, 15)]), OCH6, R=1.6, glint=False)
    I.layer(poly([(12, 12), (15.6, 15.4), (12, 19.6), (8.4, 15.4)]), OX, R=1.8, inner_line='o0')
    I.put(11, 14, 'x5')
    return I.raster()


# ================================================================ marks
def padlock():
    """Locked: a brass padlock."""
    I = Icon()
    sh = I.m(circle(12, 9, 6.6)) & ~I.m(circle(12, 9, 4.0)) & I.m(rect_(0, 0, 24, 11.5))
    sh |= I.m(rect_(5.4, 9, 8, 12)) | I.m(rect_(16, 9, 18.6, 12))
    I.layer(sh, IRON[:5], R=1.2, glint=False)
    I.layer(rect_(4, 11, 20, 21.5), OCH6, R=2.2)
    I.stamp(["kk", "kk", ".k", ".k"], 11, 14, keymap={'k': 'o0'})
    return I.raster()


CHECK11 = ["..........k", ".........kk", "........kk.", "k......kk..", "kk....kk...", ".kk..kk....", "..kkkk.....", "...kk......"]
CROSS11 = ["k.......k", "kk.....kk", ".kk...kk.", "..kk.kk..", "...kkk...", "..kk.kk..", ".kk...kk.", "kk.....kk", "k.......k"]


def check_mark(c='m4', small=True):
    """The verdict tick: 11 x 8 hand-placed (small) or a 24 px shaded one."""
    if small:
        return from_rows(CHECK11, {'k': c})
    I = Icon()
    I.layer(union(seg(4, 12.5, 9.5, 18, 1.8), seg(9.5, 18, 20, 5.5, 1.8)), MOSS, R=1.2, glint=False)
    return I.raster()


def cross_mark(c='x4', small=True):
    """The verdict cross: 9 x 9 hand-placed (small) or a 24 px shaded one."""
    if small:
        return from_rows(CROSS11, {'k': c})
    I = Icon()
    I.layer(union(seg(5, 5, 19, 19, 1.9), seg(19, 5, 5, 19, 1.9)), OX, R=1.2, glint=False)
    return I.raster()


def swords():
    """A fight: two blades crossed."""
    I = Icon()
    I.layer(_diag(5.5, 16, 20.5, 2.5, 1.5, 1.2, 2.4), IRON[1:], R=1.1, glint=False)
    I.layer(_diag(18.5, 16, 3.5, 2.5, 1.5, 1.2, 2.4), IRON[1:], R=1.1, inner_line='k0', glint=False)
    for (x0, y0, x1, y1) in ((2.6, 13.6, 8.4, 19.4), (21.4, 13.6, 15.6, 19.4)):
        I.layer(seg(x0, y0, x1, y1, 1.15), OCH, R=1, glint=False)
    I.layer(seg(2.5, 21.5, 5, 19, 1.15), LEA, R=1, glint=False)
    I.layer(seg(21.5, 21.5, 19, 19, 1.15), LEA, R=1, glint=False)
    return I.raster()


def skull():
    """Elite: a skull."""
    I = Icon()
    I.layer(union(ellipse(12, 10.5, 8.6, 8.2), rect_(7.5, 14, 16.5, 20.5)), BONE, R=2.6, glint=False)
    I.flat(ellipse(8.6, 11.5, 2.4, 2.6), 'k1')
    I.flat(ellipse(15.4, 11.5, 2.4, 2.6), 'k1')
    I.flat(poly([(12, 14.5), (13.4, 17), (10.6, 17)]), 'k1')
    for x in (9, 11, 13, 15):
        I.put(x, 19, 'b0'); I.put(x, 20, 'b0')
    return I.raster()


def crown():
    """The boss: an iron crown with red stones."""
    I = Icon()
    I.layer(poly([(3, 7), (7.5, 12), (12, 4), (16.5, 12), (21, 7), (19.6, 18), (4.4, 18)]), OCH6, R=1.8, glint=False)
    I.layer(rect_(4.2, 17, 19.8, 21), OCH, R=1, inner_line='o0', glint=False)
    for (x, y) in ((3, 6), (12, 3), (21, 6)):
        I.put(x, y, 'o6')
    for x in (7, 12, 17):
        I.stamp(["xx", "x2"], x - 1, 18, keymap={'x': 'x4', '2': 'x2'})
    return I.raster()


def chest():
    """Treasure: a banded chest."""
    I = Icon()
    I.layer(union(rect_(3, 10, 21, 21), ellipse(12, 10.5, 9, 5.4) if False else rect_(3, 6.5, 21, 10)), WD, R=1.8, glint=False)
    I.layer(ellipse(12, 7.6, 9, 4), WD, R=1.6, inner_line='w2', glint=False)
    for x in range(3, 22):
        I.put(x, 11, 'k0')
    for xb in (6, 17):
        for y in range(4, 21):
            if I.solid[y, xb]:
                I.put(xb, y, 'o3'); I.put(xb + 1, y, 'o2')
    I.layer(rect_(10.4, 9.6, 13.6, 14), OCH6, R=1, inner_line='k0', glint=False)
    I.put(11, 12, 'k0'); I.put(12, 12, 'k0')
    return I.raster()


def house():
    """A town: a house with a red roof."""
    I = Icon()
    I.layer(rect_(5, 11, 19, 21.5), ['b1', 'b2', 'b3', 'b4'], R=1.6, glint=False)
    I.layer(poly([(2, 12.5), (12, 3), (22, 12.5)]), ['x1', 'x2', 'x3', 'x4'], R=1.6, inner_line='k0', glint=False)
    I.flat(rect_(10, 15, 14, 21.5), 'w2')
    I.put(13, 18, 'o4')
    I.flat(rect_(15.5, 13.5, 17.5, 15.5), 's1')
    I.layer(rect_(16, 3.5, 18.4, 8.5), ROCK, R=1, inner_line='k0', glint=False)
    return I.raster()


def tent():
    """A camp: a striped tent."""
    I = Icon()
    I.layer(poly([(12, 3), (22, 20.5), (2, 20.5)]), ['b1', 'b2', 'b3', 'b4'], R=2, glint=False)
    for j in range(4, 21):
        for i in range(24):
            if I.solid[j, i] and (i - 12 + (j // 2)) % 6 in (0, 1) and I.keys[j, i] is not None:
                I.keys[j, i] = 'x3' if I.keys[j, i] in ('b3', 'b4') else 'x2'
    I.flat(poly([(12, 11), (15, 20.5), (9, 20.5)]), 'k1')
    I.layer(rect_(11.4, 1, 12.6, 3.5), WD, R=1, glint=False)
    return I.raster()


def cave():
    """A dungeon: a rock mouth."""
    I = Icon()
    I.layer(union(ellipse(12, 15, 10.5, 9.6), rect_(1.5, 15, 22.5, 21.5)), ROCK, R=2.6, glint=False)
    I.flat(union(ellipse(12, 16.5, 5.4, 6), rect_(6.6, 16.5, 17.4, 21.5)), 'k1')
    for (x, y) in ((5, 8), (17, 7), (19, 12), (4, 14)):
        I.put(x, y, 'b0')
    I.layer(rect_(1.5, 20.5, 22.5, 22.5), ['m1', 'm2', 'm3'], R=1, glint=False)
    return I.raster()


def flag():
    """A battle site: a black flag struck with a pale cross."""
    I = Icon()
    I.layer(rect_(4.2, 2, 6, 22.5), WD, R=1, glint=False)
    I.layer(poly([(6.5, 3), (20.5, 4.5), (18, 9), (20.5, 13.5), (6.5, 13)]), ['k1', 'w0', 'w1', 'w2'], R=1.6, inner_line='k0', glint=False)
    I.stamp(["b...b", ".b.b.", "..b..", ".b.b.", "b...b"], 10, 5, keymap={'b': 'b4'})
    return I.raster()


def milestone():
    """A waypoint: a signpost with two road boards."""
    I = Icon()
    I.layer(rect_(10.6, 2, 13.4, 22.5), WD, R=1, glint=False)
    I.layer(poly([(4, 5), (17.5, 5), (20.5, 8), (17.5, 11), (4, 11)]), ['w3', 'w4', 'w5', 'w6'], R=1.2, inner_line='k0', glint=False)
    I.layer(poly([(20, 12.5), (6.5, 12.5), (3.5, 15.5), (6.5, 18.5), (20, 18.5)]), ['w2', 'w3', 'w4', 'w5'], R=1.2, inner_line='k0', glint=False)
    for x in range(7, 16, 2):
        I.put(x, 8, 'w2')
    for x in range(9, 18, 2):
        I.put(x, 15, 'w1')
    I.layer(rect_(5, 21, 19, 22.8), ['m1', 'm2', 'm3'], R=1, glint=False)
    return I.raster()

def eye():
    """Watch: an open eye (the danger toggle's 'shown' state, a scouted road)."""
    I = Icon()
    I.layer(union(ellipse(12, 12, 10.5, 6)), BONE, R=1.6, glint=False)
    I.layer(circle(12, 12, 4.2), SL5 + ['s5'], R=1.6, inner_line='b0', glint=False)
    I.flat(circle(12, 12, 1.8), 'k0')
    I.put(10, 10, 'b5')
    return I.raster()


REGISTRY = {
    # resources
    'gold': coin, 'food': ration, 'potion': potion, 'elixir': elixir, 'day': sun, 'night': moon, 'ap': gem,
    # card kinds and card art
    'attack': attack, 'ward': ward, 'arcane': orb, 'focus': focus, 'heal': heal, 'flame': flame, 'burst': burst,
    # commands and places
    'move': boot, 'capture': shackles, 'end_turn': hourglass, 'danger': danger, 'watch': eye, 'rest': campfire, 'scout': spyglass,
    'map': map_, 'contract': scroll, 'sound': horn, 'sound_off': lambda: horn(True), 'save': quill, 'quit': door,
    'settings': cog, 'company': banner,
    # item kinds
    'sword': sword, 'greatsword': greatsword, 'dagger': dagger, 'lance': lance, 'axe': axe, 'bow': bow, 'crossbow': crossbow,
    'tome': tome, 'staff': staff, 'shield': buckler, 'quiver': quiver, 'armor': armor, 'trinket': amulet,
    # marks
    'lock': padlock, 'check': lambda: check_mark(small=False), 'cross': lambda: cross_mark(small=False), 'fight': swords,
    'elite': skull, 'boss': crown, 'treasure': chest, 'town': house, 'camp': tent, 'dungeon': cave, 'battle': flag,
    'waypoint': milestone,
}
GROUPS = [
    ('Resources', ['gold', 'food', 'potion', 'elixir', 'day', 'night', 'ap']),
    ('Card kinds', ['attack', 'ward', 'arcane', 'focus', 'heal', 'flame', 'burst']),
    ('Commands', ['move', 'capture', 'end_turn', 'danger', 'watch', 'rest', 'scout', 'map', 'contract', 'sound', 'sound_off', 'save', 'quit', 'settings', 'company']),
    ('Item kinds', ['sword', 'greatsword', 'dagger', 'lance', 'axe', 'bow', 'crossbow', 'tome', 'staff', 'shield', 'quiver', 'armor', 'trinket']),
    ('Marks and places', ['lock', 'check', 'cross', 'fight', 'elite', 'boss', 'treasure', 'town', 'camp', 'dungeon', 'battle', 'waypoint']),
]
# the game's item `kind` (and weaponClass) -> icon
ITEM_ICON = {'food': 'food', 'potion': 'potion', 'shield': 'shield', 'quiver': 'quiver', 'tome': 'tome', 'staff': 'staff',
             'sword': 'sword', 'greatsword': 'greatsword', 'dagger': 'dagger', 'lance': 'lance', 'axe': 'axe', 'bow': 'bow',
             'crossbow': 'crossbow', 'weapon': 'sword'}

_cache = {}


def get(name):
    """One icon by name, cached."""
    if name not in _cache:
        _cache[name] = REGISTRY[name]()
    return _cache[name]


def silhouette(name, tones=('w2', 'w3')):
    """The icon's shape in two dim walnut tones with its ink edge: for empty states and empty slots."""
    r = get(name)
    lit, body = tones[1], tones[0]

    def fn(c):
        if c == 'k0':
            return 'k0'
        return lit if c in ('b4', 'b5', 'o5', 'o6', 's5', 'x5', 'm5', 'w6') else body
    return r.recolor(fn)


# ================================================================ small hand-drawn marks (not part of the 24 px set)
def gem20(state='full'):
    """A 20 px AP gem on a 26 px cell. state: full | spend (the aimed card will spend it) | spent."""
    s = 20
    I = Icon(s, s)
    if state == 'spent':
        I.layer(circle(10, 10, 9.4), ['w1', 'w2', 'w3', 'w4'], R=1.6, glint=False)
        I.flat(circle(10, 10, 6.6), 'k1')
        ring = outline(I.m(circle(10, 10, 6.6))) & I.solid
        for j, i in zip(*np.nonzero(ring)):
            I.keys[j, i] = 'w0' if (i + j) < 20 else 'w4'
    else:
        I.layer(circle(10, 10, 9.4), ['o0', 'o1', 'o2', 'o3', 'o4'], R=1.6, glint=False)
        I.layer(circle(10, 10, 6.9), ['x1', 'x2', 'o2', 'o3', 'o4', 'o5'], R=4.2, inner_line='o0', glint=False)
        for (x, y, c) in ((7, 6, 'o6'), (8, 6, 'o6'), (7, 7, 'o6'), (6, 8, 'o5'), (12, 14, 'o4'), (13, 13, 'o4')):
            I.put(x, y, c)
    r = I.raster()
    R = Raster(26, 26)
    if state == 'spend':
        for j in range(26):
            for i in range(26):
                d = math.hypot(i + .5 - 13, j + .5 - 13)
                if 11.2 <= d < 12.4:
                    R.set(i, j, 'b5' if (i + j) < 26 else 'b3')
                elif 12.4 <= d < 13.4 or 10.4 <= d < 11.2:
                    R.set(i, j, 'k0')
    R.blit(r, 3, 3)
    return R


SMALL_GEM = ["..kkk..", ".k554k.", "k55543k", "k54432k", "k43321k", ".k321k.", "..kkk.."]


def small_gem():
    """The 7 px cost pip printed on a card's corner, one per AP."""
    return from_rows(SMALL_GEM, BR)


SQ = ["kkkkkkkkk", "k4444443k", "k4333332k", "k4322212k", "k4322212k", "k4322212k", "k4311112k", "k3222222k", "kkkkkkkkk"]
DIA = ["....k....", "...k4k...", "..k432k..", ".k43321k.", "k4332211k", ".k32211k.", "..k211k..", "...k1k...", "....k...."]


def side_glyph(side, act=False):
    """9 px side mark: a square for ours, a diamond for theirs (shape, not only colour). act = the one acting (brass)."""
    if side == 'ally':
        return from_rows(SQ, {'4': 'o6', '3': 'o5', '2': 'o4', '1': 'o3'} if act else {'4': 's5', '3': 's4', '2': 's3', '1': 's2'})
    return from_rows(DIA, {'4': 'x5', '3': 'x4', '2': 'x3', '1': 'x2'})


ARROW_DN = [
    "kkkkkkkkkkkkk",
    "k55555555544k",
    "kk555555443kk",
    ".k45554433k..",
    ".kk544432kk..",
    "..k443321k...",
    "..kk3321kk...",
    "...k3221k....",
    "...kk21kk....",
    "....k21k.....",
    "....kk1k.....",
    ".....kk......",
]


def arrow_down():
    """The brass arrow that hangs over the acting unit."""
    return from_rows([r.ljust(13, '.') for r in ARROW_DN], BR)


def arrow_e(h=15):
    """A brass arrowhead pointing east: the row/command cursor (h 15) or a small one (h 9)."""
    w = 12 if h >= 15 else 7
    I = Icon(w, h)
    I.layer(poly([(1, 1), (w - .6, h / 2), (1, h - 1)]), OCH, R=2.2 if h >= 15 else 1.2, glint=False)
    I.put(2, 3 if h >= 15 else 2, 'o6')
    return I.raster()


HAND = [
    "......kkkk..........",
    ".....k5554k.........",
    ".....k5443k.........",
    "..kkkk5432kkkkkkk...",
    ".k5554k4432555544k..",
    "k555544k43344444432k",
    "k5444443k3333333321k",
    "k5444443333kkkkkkkk.",
    "k4443333332k5543k...",
    "k4433333322kkkkk....",
    "k443333322k43k......",
    ".k3333222kkkkk......",
    ".k33222211k32k......",
    "..kk21111kkkk.......",
    "....kkkkk...........",
]


def hand():
    """The tactics gauntlet cursor, pointing right."""
    return from_rows([r.ljust(20, '.') for r in HAND], {'5': 'b5', '4': 'b4', '3': 'b3', '2': 'b2', '1': 'b1'})


PIN = ["..kkk..", ".k565k.", "k56654k", "k56543k", ".k443k.", "..k3k..", "..k2k..", "..k2k..", "..k1k..", "...k..."]


def pin():
    """A brass 'you are here' pin."""
    return from_rows(PIN, BR)


LOCK9 = ["..kkkk..", ".k1111k.", ".k1..1k.", "kkkkkkkk", "k544432k", "k43kk21k", "k432221k", "kkkkkkkk"]


def lock_small():
    """An 8 px padlock for locked rows and choices."""
    return from_rows(LOCK9, {'1': 'b1', '5': 'o5', '4': 'o4', '3': 'o3', '2': 'o2'})
