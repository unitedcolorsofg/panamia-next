'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

export function FlowerPowerAttribute() {
  const { theme } = useTheme();

  useEffect(() => {
    const html = document.documentElement;

    if (theme === 'flower-power') {
      html.setAttribute('data-flower-power', 'true');
    } else {
      html.removeAttribute('data-flower-power');
    }

    return () => {
      html.removeAttribute('data-flower-power');
    };
  }, [theme]);

  return null;
}
