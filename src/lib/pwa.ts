import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    for (const fn of listeners) fn();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    for (const fn of listeners) fn();
  });
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIOS && !isStandaloneMode();
}

export function useInstallPrompt() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const update = () => setTick((n) => n + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const canPromptChromium = Boolean(deferredPrompt) && !isStandaloneMode();
  const showIosGuide = !canPromptChromium && isIosSafari();

  const triggerInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    setTick((n) => n + 1);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    return choice.outcome === 'accepted';
  };

  return { canPromptChromium, showIosGuide, triggerInstall };
}
