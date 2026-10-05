import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Base común para las escenas 3D de la portada (pala, cancha, pelota):
 * renderer, reflejos de estudio, cámara, ajuste de tamaño, pausa fuera de
 * pantalla y limpieza. Devuelve null si el equipo no soporta WebGL.
 *
 * Pensado para que en celular se sienta fluido:
 * - los shaders se compilan en segundo plano antes del primer cuadro;
 * - si el equipo no alcanza ~50 cuadros por segundo, baja la resolución.
 */
export type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  isSmall: boolean;
  reduceMotion: boolean;
  /** Arranca el ciclo de dibujo; `update` recibe segundos desde el inicio. */
  start: (update: (t: number) => void, onFirstFrame?: () => void) => void;
  /** Se llama al cambiar de tamaño (después de ajustar la cámara). */
  onResize: (fn: (w: number, h: number) => void) => void;
  dispose: () => void;
};

/** Pantalla chica o táctil: se usa para bajar el detalle. */
export function isSmallScreen() {
  return window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
}

export function createStage(
  mount: HTMLElement,
  opts: { fov?: number; exposure?: number; maxDpr?: number; maxDprSmall?: number } = {},
): Stage | null {
  const isSmall = isSmallScreen();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }

  const maxDpr = Math.min(window.devicePixelRatio, isSmall ? (opts.maxDprSmall ?? 1.5) : (opts.maxDpr ?? 1.75));
  let dpr = maxDpr;
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1;
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;

  const camera = new THREE.PerspectiveCamera(opts.fov ?? 35, 1, 0.1, 200);

  const resizeHandlers: Array<(w: number, h: number) => void> = [];
  let lastW = 0;
  let lastH = 0;
  const resize = () => {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    // En celular la barra del navegador cambia el alto unos pixeles al hacer
    // scroll; redimensionar el canvas por eso causa tirones.
    if (lastW === w && Math.abs(lastH - h) < 120 && lastH !== 0) return;
    lastW = w;
    lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizeHandlers.forEach((fn) => fn(w, h));
  };
  const ro = new ResizeObserver(resize);
  ro.observe(mount);

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "100px" });
  io.observe(mount);

  let raf = 0;
  let disposed = false;
  const t0 = performance.now();

  return {
    renderer,
    scene,
    camera,
    isSmall,
    reduceMotion,
    onResize(fn) {
      resizeHandlers.push(fn);
      resize();
    },
    start(update, onFirstFrame) {
      resize();
      const draw = () => {
        update((performance.now() - t0) / 1000);
        renderer.render(scene, camera);
      };

      // Medidor de fluidez: si el promedio pasa de ~20 ms por cuadro, baja
      // la resolución un escalón (hasta 1×) y vuelve a medir.
      let acc = 0;
      let n = 0;
      let last = 0;
      const govern = (now: number) => {
        if (last) {
          const dt = now - last;
          if (dt < 100) {
            acc += dt;
            n++;
          }
        }
        last = now;
        if (n >= 45) {
          const avg = acc / n;
          acc = 0;
          n = 0;
          if (avg > 20 && dpr > 1) {
            dpr = Math.max(1, dpr - 0.25);
            renderer.setPixelRatio(dpr);
            lastH = 0; // forzar setSize con la nueva resolución
            resize();
          }
        }
      };

      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (!visible) {
          last = 0;
          return;
        }
        govern(now);
        draw();
      };

      const begin = () => {
        if (disposed) return;
        draw(); // primer cuadro
        onFirstFrame?.();
        raf = requestAnimationFrame(loop);
      };
      // Compilar los shaders sin congelar la página (si el navegador lo permite)
      renderer.compileAsync(scene, camera).then(begin, begin);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Sprite) {
          o.geometry?.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m: THREE.Material & { map?: THREE.Texture | null; alphaMap?: THREE.Texture | null; bumpMap?: THREE.Texture | null }) => {
            m.map?.dispose();
            m.alphaMap?.dispose();
            m.bumpMap?.dispose();
            m.dispose();
          });
        }
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/** Progreso 0→1 del scroll a lo largo de una sección "pegajosa" (sticky). */
export function stickyProgress(section: HTMLElement): number {
  const rect = section.getBoundingClientRect();
  const total = rect.height - window.innerHeight;
  if (total <= 0) return 0;
  return THREE.MathUtils.clamp(-rect.top / total, 0, 1);
}

/**
 * Textura de "ruido" que se repite: se dibuja un mosaico chico una vez y se
 * usa como patrón. Mucho más rápido que pintar cada pixel o fibra en un
 * canvas grande (en celular la diferencia es de segundos).
 */
export function noiseTile(size: number, paint: (g: CanvasRenderingContext2D, size: number) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  paint(c.getContext("2d")!, size);
  return c;
}
