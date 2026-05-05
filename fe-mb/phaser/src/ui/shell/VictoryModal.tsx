import React from 'react';
import { useCombatStore } from '../../state/combatStore';

export function VictoryModal(): React.JSX.Element | null {
  const phase = useCombatStore(s => s.phase);
  if (phase !== 'VICTORY') return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-auto">
      <div className="bg-[#2a1c14] border-2 border-[#ffb366] rounded-lg p-8 text-center min-w-[320px]">
        <h1 className="text-3xl font-bold text-[#ffb366] mb-4">Victory</h1>
        <p className="text-[#e8d8c0] mb-6">All enemies defeated.</p>
        <button
          onClick={() => location.reload()}
          className="bg-[#ffb366] text-[#1a1410] font-bold px-6 py-2 rounded hover:bg-[#ffc480]"
        >
          New Battle
        </button>
      </div>
    </div>
  );
}
