"""Variant A's honesty check: the board's graph is world.json's, exactly.

Every road the board draws, hides (Daren's Camp is hidden on day 1) or runs off the view must be one of world.json's
edges, and every one of world.json's Borderlands edges must be one of those (no road dropped, none invented). Every
place the country lays out (country_a.positions) must be one of world.json's 47 places and vice versa. The hop
distances (so the tiers) are then world.json's by construction; they are printed with each place's new position.

Usage (from the scratchpad): python dirs/px-open-a/check_graph.py      exit code 1 on any mismatch
"""
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import country_a as CA   # noqa: E402
import layout_a as LA    # noqa: E402

w = json.load(open(CA.WORLD_JSON, encoding='utf-8'))
reg = {n['id']: n['regionId'] for n in w['nodes']}
ids = set(reg)
J = Counter(frozenset((e['from'], e['to'])) for e in w['edges'])

drawn = [frozenset((a, b)) for a, b, _ in LA.ROADS]
hidden = [frozenset(k) for k in LA.HIDDEN_ROADS]
off = [r for r in drawn if r & LA.OFF]
board = Counter(drawn + hidden)
# the board shows the Borderlands and its two roads out to Thornwood: every world.json edge with a Borderlands end
scope = Counter({e: n for e, n in J.items() if any(reg[p] == 'borderlands' for p in e)})

bad = []
for e in board:
    if e not in J:
        bad.append(('invented', sorted(e)))
    elif board[e] != J[e]:
        bad.append(('drawn %d times, world.json has %d' % (board[e], J[e]), sorted(e)))
for e in scope:
    if e not in board:
        bad.append(('missing from the board', sorted(e)))
if len(J) != sum(J.values()):
    bad.append(('world.json repeats an edge', ''))
pos = CA.positions()
if set(pos) != ids:
    bad.append(('places differ', sorted(set(pos) ^ ids)))
if set(LA.P) - ids:
    bad.append(('board places not in world.json', sorted(set(LA.P) - ids)))
crossings = CA.check()
if crossings:
    bad.append(('straight-line crossings in the country layout', crossings))

print(f'world.json: {len(ids)} places, {sum(J.values())} roads ({len(scope)} touch the Borderlands)')
print(f'board: {len(drawn)} roads drawn ({len(off)} of them run off the view), {len(hidden)} hidden (Daren\'s Camp)')
print(f'country layout: {len(pos)} places placed, {len(crossings)} road crossings')
print('off the view:', ', '.join(sorted('-'.join(sorted(e)) for e in off)))
print('hidden:', ', '.join(sorted('-'.join(sorted(e)) for e in hidden)))
d = CA.hops()
print('hops (visible graph, as the game computes tier):',
      ', '.join(f'{k} {d[k]}' for k in ('traders_rest', 'riverside_market', 'south_road_ambush', 'border_fortress',
                                        'rodericks_camp', 'thornwood_gate', 'southern_trail', 'the_iron_throne')))
print('RESULT:', 'OK, the graph is world.json\'s exactly' if not bad else 'MISMATCH')
for b in bad:
    print('  ', b)
sys.exit(1 if bad else 0)
