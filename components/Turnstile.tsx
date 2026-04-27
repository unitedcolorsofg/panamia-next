'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: Record<string, unknown>
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileProps {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
  action?: string;
  className?: string;
}

let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadScript() {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) {
    return new Promise<void>((resolve) => {
      loadCallbacks.push(resolve);
    });
  }

  scriptLoading = true;
  return new Promise<void>((resolve) => {
    loadCallbacks.push(resolve);
    const script = document.createElement('script');
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

export default function Turnstile({
  siteKey,
  onToken,
  onExpire,
  action,
  className,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    loadScript().then(() => {
      if (!mounted || !containerRef.current || !window.turnstile) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        'expired-callback': () => onExpire?.(),
        action,
        appearance: 'interaction-only',
      });
    });

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action]);

  return <div ref={containerRef} className={className} />;
}

export function useTurnstile(siteKey: string | undefined, action?: string) {
  const [token, setToken] = useState<string | null>(null);

  const reset = useCallback(() => {
    setToken(null);
  }, []);

  const Widget = siteKey ? (
    <Turnstile
      siteKey={siteKey}
      onToken={setToken}
      onExpire={reset}
      action={action}
    />
  ) : null;

  return { token, reset, Widget };
}
