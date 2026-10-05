"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createStage, noiseTile, stickyProgress } from "./stage";

/**
 * Cancha de pádel reglamentaria en 3D (20 × 10 m), generada por código.
 * La cámara la recorre según el scroll de la sección que la contiene:
 *   0.00 vista aérea → 0.25 a través del cristal → 0.50 reflectores
 *   encendidos → 0.75 a ras de césped → 1.00 vista cenital.
 */
export default function CourtScene({ onReady, onFail }: { onReady?: () => void; onFail?: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const section = mount.closest("section") as HTMLElement | null;
    const stage = createStage(mount, { fov: 38, exposure: 1.05, maxDprSmall: 1.25 });
    if (!stage) {
      onFail?.();
      return;
    }
    const { scene, camera, isSmall, reduceMotion } = stage;

    // ── Texturas por canvas ──
    function floorTexture() {
      const ppm = 48; // pixeles por metro
      const c = document.createElement("canvas");
      c.width = 10 * ppm;
      c.height = 20 * ppm;
      const g = c.getContext("2d")!;
      // grano del césped: un mosaico de ruido que se repite
      const grain = noiseTile(96, (tg, n) => {
        tg.fillStyle = "#1d4fb8";
        tg.fillRect(0, 0, n, n);
        const img = tg.getImageData(0, 0, n, n);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = (Math.random() - 0.5) * 22;
          img.data[i] += v;
          img.data[i + 1] += v;
          img.data[i + 2] += v;
        }
        tg.putImageData(img, 0, 0);
      });
      g.fillStyle = g.createPattern(grain, "repeat")!;
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = "#f4f4f0";
      const lw = 0.05 * ppm;
      const sY1 = (10 - 6.95) * ppm;
      const sY2 = (10 + 6.95) * ppm;
      g.fillRect(0, sY1 - lw / 2, c.width, lw); // líneas de servicio
      g.fillRect(0, sY2 - lw / 2, c.width, lw);
      g.fillRect(c.width / 2 - lw / 2, sY1, lw, sY2 - sY1); // línea central
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = stage!.renderer.capabilities.getMaxAnisotropy();
      return t;
    }

    function gridAlpha(cells: number, line = 3) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d")!;
      g.fillStyle = "#000";
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = "#fff";
      const s = 128 / cells;
      for (let i = 0; i <= cells; i++) {
        g.fillRect(i * s - line / 2, 0, line, 128);
        g.fillRect(0, i * s - line / 2, 128, line);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    }

    function glowTexture() {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,248,230,1)");
      grad.addColorStop(0.25, "rgba(255,236,200,.55)");
      grad.addColorStop(1, "rgba(255,236,200,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    }

    // ── Materiales ──
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xdbe7ee,
      transparent: true,
      opacity: 0.16,
      roughness: 0.04,
      metalness: 0,
      clearcoat: 1,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x15140f, metalness: 0.7, roughness: 0.35 });
    const fenceTex = gridAlpha(16);
    fenceTex.repeat.set(4, 2);
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x1a1915, alphaMap: fenceTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.6 });
    const netTex = gridAlpha(10, 2);
    netTex.repeat.set(60, 5);
    const netMat = new THREE.MeshStandardMaterial({ color: 0x0f0f0d, alphaMap: netTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });

    const court = new THREE.Group();
    scene.add(court);

    // Piso de la cancha y plataforma alrededor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 20), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    court.add(floor);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(13, 0.3, 23), new THREE.MeshStandardMaterial({ color: 0x24221e, roughness: 0.9 }));
    apron.position.y = -0.16;
    court.add(apron);

    // Pared: paneles de cristal o malla con postes
    function wall(x1: number, z1: number, x2: number, z2: number, h: number, kind: "glass" | "fence", yBase = 0) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const geo = new THREE.PlaneGeometry(len, h);
      const m = new THREE.Mesh(geo, kind === "glass" ? glassMat : fenceMat);
      m.position.set((x1 + x2) / 2, yBase + h / 2, (z1 + z2) / 2);
      m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      if (kind === "fence") {
        const tex = fenceTex.clone();
        tex.repeat.set(len / 2.5, h / 2.5);
        tex.needsUpdate = true;
        m.material = fenceMat.clone();
        (m.material as THREE.MeshStandardMaterial).alphaMap = tex;
      }
      court.add(m);
      // postes cada ~2 m
      const n = Math.max(1, Math.round(len / 2));
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, yBase + h, 0.08), steelMat);
        post.position.set(x1 + (x2 - x1) * f, (yBase + h) / 2, z1 + (z2 - z1) * f);
        court.add(post);
      }
    }

    for (const s of [-1, 1]) {
      // fondo: cristal 3 m + malla 1 m arriba
      wall(-5, 10 * s, 5, 10 * s, 3, "glass");
      wall(-5, 10 * s, 5, 10 * s, 1, "fence", 3);
      for (const side of [-5, 5]) {
        // laterales: cristal escalonado junto al fondo, malla al centro
        wall(side, 10 * s, side, 8 * s, 3, "glass");
        wall(side, 8 * s, side, 6 * s, 2, "glass");
        wall(side, 8 * s, side, 6 * s, 1, "fence", 2);
        wall(side, 6 * s, side, 0, 3, "fence");
      }
    }

    // Red
    const net = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.88), netMat);
    net.position.set(0, 0.44, 0);
    court.add(net);
    const band = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: 0xf2f0ea }));
    band.position.set(0, 0.88, 0);
    court.add(band);

    // Reflectores
    const glowTex = glowTexture();
    const glows: THREE.Sprite[] = [];
    const lampHeads: THREE.MeshStandardMaterial[] = [];
    const lamps: THREE.PointLight[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * 5.7;
        const z = sz * 5;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6.6, 12), steelMat);
        pole.position.set(x, 3.3, z);
        court.add(pole);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: 0x1a1915, emissive: 0xfff3dc, emissiveIntensity: 0 }));
        head.position.set(x - sx * 0.3, 6.6, z);
        head.rotation.z = sx * 0.35;
        court.add(head);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
        glow.position.set(x - sx * 0.35, 6.5, z);
        glow.scale.setScalar(3.2);
        court.add(glow);
        glows.push(glow);
        if (!isSmall) {
          const lamp = new THREE.PointLight(0xffedd2, 0, 18, 1.6);
          lamp.position.set(x - sx * 0.6, 6.2, z);
          court.add(lamp);
          lamps.push(lamp);
        }
        lampHeads.push(head.material as THREE.MeshStandardMaterial);
      }
    }

    // Pelota sobre la cancha
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshStandardMaterial({ color: 0xd9ec3d, roughness: 0.8 }));
    ball.position.set(1.4, 0.11, 3.2);
    court.add(ball);

    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x1a1712, 0.55);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0dd, 1.4);
    sun.position.set(-10, 18, 8);
    scene.add(sun);

    // ── Recorrido de cámara ──
    // Una sola curva suave (sin frenazos entre tramos). Los puntos marcados
    // con `stop` son las cuatro tomas; los demás solo guían el trayecto, p. ej.
    // pasar por encima de la malla en vez de atravesarla.
    // pantalla vertical (celular): alejar la cámara para que quepa la cancha
    // (la toma a ras de césped casi no se aleja, para no quedar fuera del cristal)
    const aspect = (mount.clientWidth || 1) / (mount.clientHeight || 1);
    const portrait = aspect < 0.8;
    const far = portrait ? 1.65 : isSmall ? 1.25 : 1;
    const path = [
      { pos: [16, 12, 18], look: [0, 0, 0], stop: true }, // aérea
      { pos: [5.5, 3.2, 16.5], look: [0, 1, 3], stop: true }, // tras el cristal
      { pos: [-9.5, 8.5, 15.5], look: [0, 0.8, 1], stop: false }, // rodea la esquina
      { pos: [-14.5, 10, 3], look: [0.5, 0, 0.5], stop: true }, // costado, luces
      { pos: [-6.5, 7.5, -5], look: [0.5, 0.5, 1], stop: false }, // sobre la malla
      { pos: [-3.2, 0.7, -8.6], look: [0.8, 0.9, 2], stop: true }, // a ras de césped
      // cenital: en pantalla horizontal la cancha va a lo ancho; en vertical, a lo largo
      portrait ? { pos: [0, 24, 3], look: [0, 0, 0.4], stop: true } : { pos: [6, 26, 3.5], look: [0, 0, 3.5], stop: true },
    ];
    const posCurve = new THREE.CatmullRomCurve3(path.map((k) => new THREE.Vector3(...k.pos).multiplyScalar(k.pos[1] < 2 ? Math.min(far, 1.1) : far)), false, "centripetal");
    const lookCurve = new THREE.CatmullRomCurve3(path.map((k) => new THREE.Vector3(...k.look)), false, "centripetal");
    const stops = path.map((k, i) => (k.stop ? i / (path.length - 1) : -1)).filter((u) => u >= 0);
    // progreso de scroll → posición en la curva: avanza constante pero se
    // demora un poco en cada toma para que la vista "se asiente".
    const toCurve = (p: number) => {
      const seg = Math.min(stops.length - 2, Math.floor(p * (stops.length - 1)));
      const f = p * (stops.length - 1) - seg;
      const eased = f - Math.sin(f * Math.PI * 2) / (Math.PI * 2) * 0.75;
      return THREE.MathUtils.lerp(stops[seg], stops[seg + 1], eased);
    };
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    let ps = section ? stickyProgress(section) : 0; // progreso con inercia
    const par = { x: 0, y: 0 }; // paralaje del cursor, suavizado
    let lastT = 0;

    const pointer = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let readyCalled = false;
    // En pantalla vertical el título va arriba y el texto abajo: subir un
    // poco la imagen para que la cancha quede en el hueco entre ambos.
    stage.onResize((w, h) => {
      if (w / h < 0.8) camera.setViewOffset(w, h, 0, h * 0.06, w, h);
      else camera.clearViewOffset();
    });

    stage.start((t) => {
      const p = section ? stickyProgress(section) : 0;
      const dt = Math.min(0.1, t - lastT);
      lastT = t;
      // inercia independiente de los cuadros por segundo
      ps += (p - ps) * (1 - Math.exp(-dt * (reduceMotion ? 60 : 4.5)));
      const u = toCurve(ps);
      posCurve.getPoint(u, pos);
      lookCurve.getPoint(u, look);
      if (!reduceMotion) {
        const k = 1 - Math.exp(-dt * 3);
        par.x += (pointer.x - par.x) * k;
        par.y += (pointer.y - par.y) * k;
        // el paralaje se apaga en la toma cenital
        const amt = 1 - THREE.MathUtils.smoothstep(ps, 0.8, 1) * 0.8;
        pos.x += par.x * 0.7 * amt;
        pos.y += (-par.y * 0.35 + Math.sin(t * 0.5) * 0.06) * amt;
      }
      camera.position.copy(pos);
      camera.lookAt(look);

      // Los reflectores se encienden alrededor del paso "Luz de torneo"
      const lights = THREE.MathUtils.smoothstep(ps, 0.3, 0.46);
      glows.forEach((g) => ((g.material as THREE.SpriteMaterial).opacity = lights * 0.95));
      lamps.forEach((l) => (l.intensity = lights * 60));
      lampHeads.forEach((m) => (m.emissiveIntensity = lights * 3));
      sun.intensity = 1.4 - lights * 0.6;

      // Peloteo: la pelota cruza la red, bota del otro lado y sube al golpe
      if (!reduceMotion) {
        const shot = t / 1.35;
        const n = Math.floor(shot);
        const f = shot - n;
        const dir = n % 2 === 0 ? 1 : -1;
        const z = dir * THREE.MathUtils.lerp(-7.2, 7.2, f);
        let y: number;
        if (f < 0.72) {
          const q = f / 0.72;
          y = THREE.MathUtils.lerp(0.95, 0.11, q) + 4 * 1.25 * q * (1 - q);
        } else {
          const q = (f - 0.72) / 0.28;
          y = THREE.MathUtils.lerp(0.11, 0.95, q) + 4 * 0.45 * q * (1 - q);
        }
        ball.position.set(THREE.MathUtils.lerp(Math.sin(n * 1.7), Math.sin((n + 1) * 1.7), f) * 1.3, y, z);
      }

      if (!readyCalled) {
        readyCalled = true;
        onReady?.();
      }
    });

    return () => {
      window.removeEventListener("pointermove", onPointer);
      glowTex.dispose();
      stage.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}

