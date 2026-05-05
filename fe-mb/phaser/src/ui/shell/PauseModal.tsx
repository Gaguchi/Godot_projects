import React, { useEffect, useState } from 'react';

export function PauseModal(): JSX.Element | null {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') setPaused(p => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!paused) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-auto">
      <div className="bg-[#2a1c14] border-2 border-[#ffb366] rounded-lg p-8 text-center">
        <h2 className="text-2xl text-[#ffb366] mb-4">Paused</h2>
        <p className="text-[#e8d8c0] mb-4">Press P to resume.</p>
      </div>
    </div>
  );
}
