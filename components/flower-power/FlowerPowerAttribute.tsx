'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

export function FlowerPowerAttribute() {
  const { theme, forcedTheme } = useTheme();

  useEffect(() => {
    const html = document.documentElement;

    // `theme` is the stored preference, which survives even when the provider
    // forces a theme. Without the `forcedTheme` guard, anyone who picked
    // flower-power before the theme picker was removed would stay stuck in it
    // with no control left to switch back.
    if (!forcedTheme && theme === 'flower-power') {
      html.setAttribute('data-flower-power', 'true');
    } else {
      html.removeAttribute('data-flower-power');
    }

    return () => {
      html.removeAttribute('data-flower-power');
    };
  }, [theme, forcedTheme]);

  return null;
}
