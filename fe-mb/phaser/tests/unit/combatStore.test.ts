import { describe, it, expect, beforeEach } from 'vitest';
import { useCombatStore } from '../../src/state/combatStore';

describe('combatStore', () => {
  beforeEach(() => {
    useCombatStore.getState().reset();
  });

  it('starts in BOOT phase', () => {
    expect(useCombatStore.getState().phase).toBe('BOOT');
  });

  it('transitions BOOT -> DEPLOY -> COMBAT', () => {
    const s = useCombatStore.getState();
    s.setPhase('DEPLOY');
    expect(useCombatStore.getState().phase).toBe('DEPLOY');
    s.setPhase('COMBAT');
    expect(useCombatStore.getState().phase).toBe('COMBAT');
  });

  it('manages card targeting sub-state', () => {
    const s = useCombatStore.getState();
    s.setPhase('COMBAT');
    expect(useCombatStore.getState().subPhase).toBe('IDLE');
    s.selectCard('iron_strike');
    expect(useCombatStore.getState().subPhase).toBe('SELECTING_TARGET');
    expect(useCombatStore.getState().selectedCardId).toBe('iron_strike');
    s.cancelSelection();
    expect(useCombatStore.getState().subPhase).toBe('IDLE');
    expect(useCombatStore.getState().selectedCardId).toBeNull();
  });

  it('tracks current AP', () => {
    const s = useCombatStore.getState();
    s.setAP(3);
    expect(useCombatStore.getState().ap).toBe(3);
    s.spendAP(2);
    expect(useCombatStore.getState().ap).toBe(1);
  });
});
