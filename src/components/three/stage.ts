import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Base común para las escenas 3D de la portada (cancha, pelota): renderer,
 * reflejos de estudio, cámara, ajuste de tamaño, pausa fuera de pantalla y
 * limpieza. Devuelve null si el equipo no soporta WebGL.
 */
export type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  isSmall: boolean;
  reduceMotion: boolean;
  /** Arranca el ciclo de dibujo; `update` recibe segundos desde el inicio. */
  start: (update: (t: number) => void) => void;
  dispose: () => void;
};

export function createStage(mount: HTMLElement, opts: { fov?: number; exposure?: number } = {}): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }

  const isSmall = window.matchMedia("(max-width: 768px)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1;
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;

  const camera = new THREE.PerspectiveCamera(opts.fov ?? 35, 1, 0.1, 200);

  const resize = () => {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "200px" });
  io.observe(mount);

  let raf = 0;
  const t0 = performance.now();

  return {
    renderer,
    scene,
    camera,
    isSmall,
    reduceMotion,
    start(update) {
      const draw = () => {
        update((performance.now() - t0) / 1000);
        renderer.render(scene, camera);
      };
      draw(); // primer cuadro de inmediato
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (visible) draw();
      };
      raf = requestAnimationFrame(loop);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Sprite) {
          o.geometry?.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m: THREE.Material & { map?: THREE.Texture | null; alphaMap?: THREE.Texture | null }) => {
            m.map?.dispose();
            m.alphaMap?.dispose();
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
