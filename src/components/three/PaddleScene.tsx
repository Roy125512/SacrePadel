"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Pala de pádel en 3D, generada por código (sin modelos externos).
 * Medidas reales aproximadas, en centímetros: 46 de largo, cabeza de 26 de
 * ancho, 3.8 de grosor, perforaciones de 1.3 y corazón abierto.
 *
 * - Gira hacia el cursor y flota suavemente.
 * - Al hacer scroll sobre la portada, rota y se aleja.
 * - Se pausa fuera de pantalla o con la pestaña oculta.
 * - Respeta "reducir movimiento": queda quieta.
 * - Si no hay WebGL, llama a onFail para que la portada muestre una foto.
 */
export default function PaddleScene({ onReady, onFail }: { onReady?: () => void; onFail?: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      onFail?.();
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isSmall = window.matchMedia("(max-width: 768px)").matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 9.5);

    // Luces: principal cálida arriba a la izquierda y contraluz de bronce.
    const key = new THREE.DirectionalLight(0xfff1e2, 2.2);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc9a27e, 3);
    rim.position.set(4, -1, -4);
    scene.add(rim);

    // ── Texturas por canvas ──────────────────────────────────────────────
    function carbonFace(): THREE.CanvasTexture {
      const c = document.createElement("canvas");
      c.width = 1024;
      c.height = 1462; // proporción 28 × 40 cm (el área que cubre la cara)
      const g = c.getContext("2d")!;
      g.fillStyle = "#0d0c0b";
      g.fillRect(0, 0, c.width, c.height);
      // Tejido de carbono 3K (sarga 2×2)
      const s = 14;
      for (let y = 0; y < c.height; y += s) {
        for (let x = 0; x < c.width; x += s) {
          const diag = Math.floor(x / s + y / s) % 4 < 2;
          const grad = g.createLinearGradient(x, y, x + (diag ? s : 0), y + (diag ? 0 : s));
          grad.addColorStop(0, diag ? "#1b1a18" : "#141311");
          grad.addColorStop(0.5, diag ? "#2a2825" : "#1f1d1a");
          grad.addColorStop(1, diag ? "#161513" : "#121110");
          g.fillStyle = grad;
          g.fillRect(x, y, s - 1, s - 1);
        }
      }
      // Nombre grabado en bronce, en vertical sobre la cabeza
      g.save();
      g.translate(c.width / 2, c.height * 0.36);
      g.rotate(-Math.PI / 2);
      g.font = "600 112px 'Times New Roman', serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      const metal = g.createLinearGradient(-300, -60, 300, 60);
      metal.addColorStop(0, "#7a5233");
      metal.addColorStop(0.5, "#e2c19d");
      metal.addColorStop(1, "#8a5f3d");
      g.fillStyle = metal;
      g.fillText("SACRÉ", 0, 0);
      g.restore();
      // Filete fino de bronce cerca del borde inferior de la cabeza
      g.strokeStyle = "rgba(201,162,126,.55)";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(c.width * 0.3, c.height * 0.66);
      g.lineTo(c.width * 0.7, c.height * 0.66);
      g.stroke();

      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      // Las UV de la cara son coordenadas en cm: mapear x∈[-14,14], y∈[-22,18]
      t.repeat.set(1 / 28, 1 / 40);
      t.offset.set(0.5, 22 / 40);
      return t;
    }

    function gripTexture(): THREE.CanvasTexture {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 256;
      const g = c.getContext("2d")!;
      g.fillStyle = "#1a1816";
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = "#0b0a09";
      g.lineWidth = 10;
      for (let i = -256; i < 512; i += 36) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + 256, 256);
        g.stroke();
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(2, 3);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    // ── Geometría de la pala (cm) ────────────────────────────────────────
    const HEAD_CY = 2;
    const RX = 13;
    const RY = 15;

    const outline = new THREE.Shape();
    const a0 = THREE.MathUtils.degToRad(238);
    const a1 = THREE.MathUtils.degToRad(302);
    const pL = new THREE.Vector2(RX * Math.cos(a0), HEAD_CY + RY * Math.sin(a0));
    outline.moveTo(-1.9, -21);
    outline.quadraticCurveTo(-3.2, -15.5, pL.x, pL.y);
    outline.absellipse(0, HEAD_CY, RX, RY, a0, a1 - Math.PI * 2, true, 0);
    outline.quadraticCurveTo(3.2, -15.5, 1.9, -21);
    outline.lineTo(-1.9, -21);

    // Corazón abierto (triángulo con esquinas suaves)
    const heart = new THREE.Path();
    heart.moveTo(0, -8.2);
    heart.quadraticCurveTo(1.2, -8.2, 2.8, -11.6);
    heart.quadraticCurveTo(3.4, -13.4, 1.6, -13.4);
    heart.lineTo(-1.6, -13.4);
    heart.quadraticCurveTo(-3.4, -13.4, -2.8, -11.6);
    heart.quadraticCurveTo(-1.2, -8.2, 0, -8.2);
    outline.holes.push(heart);

    // Perforaciones en patrón hexagonal dentro de la cabeza
    const r = 0.65;
    const step = 2.55;
    for (let row = -8; row <= 8; row++) {
      const y = HEAD_CY + row * step * 0.866;
      const offset = row % 2 === 0 ? 0 : step / 2;
      for (let col = -6; col <= 6; col++) {
        const x = col * step + offset;
        // dentro de la elipse con margen y sin invadir el cuello
        const nx = x / (RX - 2.4);
        const ny = (y - HEAD_CY) / (RY - 2.4);
        if (nx * nx + ny * ny > 1 || y < -6.5) continue;
        // zona central sin agujeros para el nombre grabado
        if (Math.abs(x) < 1.9 && y > -3 && y < 12) continue;
        const hole = new THREE.Path();
        hole.absarc(x, y, r, 0, Math.PI * 2, true);
        outline.holes.push(hole);
      }
    }

    const headGeo = new THREE.ExtrudeGeometry(outline, {
      depth: 3.3,
      bevelEnabled: true,
      bevelThickness: 0.25,
      bevelSize: 0.22,
      bevelSegments: 4,
      curveSegments: isSmall ? 24 : 48,
    });
    headGeo.translate(0, 0, -1.65);

    const faceMat = new THREE.MeshPhysicalMaterial({
      map: carbonFace(),
      roughness: 0.38,
      metalness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    });
    const bronzeMat = new THREE.MeshPhysicalMaterial({
      color: 0x9a6a45,
      metalness: 1,
      roughness: 0.28,
      clearcoat: 0.6,
    });
    const head = new THREE.Mesh(headGeo, [faceMat, bronzeMat]);

    // Mango con grip y tapa
    const handleGeo = new THREE.CylinderGeometry(1.45, 1.6, 13.5, 32, 1, false);
    handleGeo.translate(0, -27.6, 0);
    const handle = new THREE.Mesh(handleGeo, new THREE.MeshStandardMaterial({ map: gripTexture(), roughness: 0.85 }));
    const capGeo = new THREE.CylinderGeometry(1.95, 1.8, 1, 32);
    capGeo.translate(0, -34.8, 0);
    const cap = new THREE.Mesh(capGeo, bronzeMat);

    const paddle = new THREE.Group();
    paddle.add(head, handle, cap);
    // centrar (cm → unidades de escena) y escalar
    paddle.position.y = 0;
    const pivot = new THREE.Group();
    paddle.position.set(0, 8.5, 0); // centro visual entre cabeza y mango
    pivot.add(paddle);
    pivot.scale.setScalar(0.072);
    scene.add(pivot);

    // ── Interacción ──────────────────────────────────────────────────────
    const target = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let scrollP = 0;
    const onScroll = () => {
      const h = mount.parentElement?.getBoundingClientRect().height ?? window.innerHeight;
      scrollP = THREE.MathUtils.clamp(window.scrollY / h, 0, 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // altura de la pala: en pantallas angostas sube para dejar abajo el texto
    let baseY = 0.05;
    function resize() {
      const w = mount!.clientWidth;
      const h = mount!.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      // en pantallas angostas, alejar para que quepa la pala completa
      camera.position.z = w / h < 0.8 ? 13 : 10.5;
      baseY = w / h < 0.8 ? 1.15 : 0.05;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    let visible = true;
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(mount);

    const start = performance.now();
    let raf = 0;
    let readyCalled = false;
    const cur = { rx: 0, ry: -0.5 };

    // El navegador ya pausa requestAnimationFrame en pestañas ocultas; aquí
    // solo se evita dibujar cuando la portada salió de la pantalla.
    function frame() {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      draw();
    }

    function draw() {
      const t = (performance.now() - start) / 1000;
      const idle = reduceMotion ? 0 : 1;

      const ry = -0.55 + target.x * 0.55 * idle + Math.sin(t * 0.35) * 0.18 * idle + scrollP * Math.PI * 1.1;
      const rx = 0.12 + target.y * 0.3 * idle + Math.sin(t * 0.5) * 0.05 * idle - scrollP * 0.5;
      cur.ry += (ry - cur.ry) * 0.06;
      cur.rx += (rx - cur.rx) * 0.06;
      pivot.rotation.set(cur.rx, cur.ry, -0.32 + Math.sin(t * 0.3) * 0.04 * idle);
      pivot.position.y = baseY + Math.sin(t * 0.8) * 0.1 * idle + scrollP * 1.4;
      pivot.position.z = -scrollP * 3;

      renderer.render(scene, camera);
      if (!readyCalled) {
        readyCalled = true;
        onReady?.();
      }
    }
    draw(); // primer cuadro de inmediato
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            (m as THREE.MeshStandardMaterial).map?.dispose();
            m.dispose();
          });
        }
      });
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // onReady/onFail se leen una vez al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}
