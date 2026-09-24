'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { PetalBurst } from './PetalBurst';
import { CursorTrail } from './CursorTrail';
import { AudioPlayer } from './AudioPlayer';
import { FlowerPowerAttribute } from './FlowerPowerAttribute';
import { GlobalButtonEvasion } from './GlobalButtonEvasion';

interface FlowerPowerContextType {
  isActive: boolean;
  isMuted: boolean;
  toggleMute: () => void;
}

const FlowerPowerContext = createContext<FlowerPowerContextType>({
  isActive: false,
  isMuted: false,
  toggleMute: () => {},
});

export const useFlowerPower = () => useContext(FlowerPowerContext);

export function FlowerPowerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, forcedTheme } = useTheme();
  const [isMuted, setIsMuted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Derive isActive from theme instead of storing in state. A forced theme
  // wins over the stored preference, so the evading buttons stay off for
  // anyone who had flower-power selected before the picker was removed.
  const isActive = mounted && !forcedTheme && theme === 'flower-power';

  const toggleMute = () => setIsMuted(!isMuted);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <FlowerPowerContext.Provider value={{ isActive, isMuted, toggleMute }}>
      <FlowerPowerAttribute />
      {children}
      {isActive && (
        <>
          <PetalBurst />
          <CursorTrail />
          <AudioPlayer isMuted={isMuted} />
          <GlobalButtonEvasion />
        </>
      )}
    </FlowerPowerContext.Provider>
  );
}
