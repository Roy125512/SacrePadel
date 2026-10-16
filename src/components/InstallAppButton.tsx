"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const noop = () => () => {};
// En el servidor se asume "ya instalada" para no mostrar nada hasta hidratar.
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * "Instalar app": en Android/Chrome abre el diálogo de instalación; en iPhone
 * explica cómo agregarla a la pantalla de inicio (Safari no tiene diálogo).
 * No se muestra si ya se abrió como app.
 */
export default function InstallAppButton({ className = "" }: { className?: string }) {
  const [prompt, setPrompt] = useState<BIPEvent | null>(null);
  const ios = useSyncExternalStore(noop, isIos, () => false);
  const standalone = useSyncExternalStore(noop, isStandalone, () => true);
  const [justInstalled, setJustInstalled] = useState(false);
  const installed = standalone || justInstalled;
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BIPEvent);
    };
    const onInstalled = () => setJustInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;

  return (
    <span className="inline-block">
      <button
        type="button"
        className={className}
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            await prompt.userChoice.catch(() => null);
            setPrompt(null);
          } else setHelp((h) => !h);
        }}
      >
        Instalar app
      </button>
      {help && (
        <span className="mt-2 block max-w-[16rem] text-xs leading-relaxed opacity-80">
          En Safari toca <b>Compartir</b> (el cuadro con flecha) y luego <b>Agregar a inicio</b>.
        </span>
      )}
    </span>
  );
}
