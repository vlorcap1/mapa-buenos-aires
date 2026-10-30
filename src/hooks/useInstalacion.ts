import { useCallback, useEffect, useState } from 'react';

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Instalación como app (PWA). Chrome/Edge/Android avisan con `beforeinstallprompt` y permiten abrir el diálogo;
 * Safari en iPhone no, así que ahí se muestran instrucciones. Si ya está instalada, no se ofrece nada.
 */
export function useInstalacion() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [instalada, setInstalada] = useState(() => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;

  useEffect(() => {
    const alOfrecer = (e: Event) => { e.preventDefault(); setEvento(e as EventoInstalacion); };
    const alInstalar = () => { setInstalada(true); setEvento(null); };
    window.addEventListener('beforeinstallprompt', alOfrecer);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', alOfrecer);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  /** Abre el diálogo nativo si está disponible; devuelve false si hay que mostrar instrucciones. */
  const instalar = useCallback(async () => {
    if (!evento) return false;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === 'accepted') setInstalada(true);
    setEvento(null);
    return true;
  }, [evento]);

  return { instalada, puedeDialogo: evento !== null, esIOS, instalar };
}
