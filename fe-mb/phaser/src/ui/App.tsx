import React from 'react';
import { VictoryModal } from './shell/VictoryModal';
import { DefeatModal } from './shell/DefeatModal';
import { PauseModal } from './shell/PauseModal';

export function App(): React.JSX.Element {
  return (
    <div id="react-shell" className="absolute inset-0 pointer-events-none">
      <VictoryModal />
      <DefeatModal />
      <PauseModal />
    </div>
  );
}
