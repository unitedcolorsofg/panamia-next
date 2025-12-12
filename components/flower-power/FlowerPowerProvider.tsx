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
  const { theme } = useTheme();
  const [isMuted, setIsMuted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Derive isActive from theme instead of storing in state
  const isActive = mounted && theme === 'flower-power';

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
