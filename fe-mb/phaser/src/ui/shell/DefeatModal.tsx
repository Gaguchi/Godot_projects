import React from 'react';
import { useCombatStore } from '../../state/combatStore';

export function DefeatModal(): JSX.Element | null {
  const phase = useCombatStore(s => s.phase);
  if (phase !== 'DEFEAT') return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
      <div className="bg-[#2a1c14] border-2 border-[#c04444] rounded-lg p-8 text-center min-w-[320px]">
        <h1 className="text-3xl font-bold text-[#c04444] mb-4">Defeat</h1>
        <p className="text-[#e8d8c0] mb-6">Your party has fallen.</p>
        <button
          onClick={() => location.reload()}
          className="bg-[#c04444] text-[#fff] font-bold px-6 py-2 rounded hover:bg-[#d05454]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
