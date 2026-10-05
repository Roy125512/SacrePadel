"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createStage } from "./stage";

/**
 * Pelota de pádel en 3D: fieltro con brillo aterciopelado, costura real
 * (la curva clásica de dos lóbulos sobre la esfera) y el sello SACRÉ.
 * Cae y rebota la primera vez que entra en pantalla, gira hacia el cursor
 * y, al darle clic, vuelve a botar.
 */
export default function BallScene({ onReady, onFail }: { onReady?: () => void; onFail?: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const stage = createStage(mount, { fov: 30, exposure: 0.9 });
    if (!stage) {
      onFail?.();
      return;
    }
    const { scene, camera, isSmall, reduceMotion, renderer } = stage;
    camera.position.set(0, 0.35, isSmall ? 7.2 : 6.2);
    camera.lookAt(0, -0.15, 0);

    // ── Fieltro: color + fibras (también sirve de relieve) ──
    function feltCanvas(withPrint: boolean) {
      const c = document.createElement("canvas");
      c.width = 2048;
      c.height = 1024;
      const g = c.getContext("2d")!;
      g.fillStyle = withPrint ? "#b8cf12" : "#808080";
      g.fillRect(0, 0, c.width, c.height);
      // fibras cortas en todas direcciones
      for (let i = 0; i < 60000; i++) {
        const x = Math.random() * c.width;
        const y = Math.random() * c.height;
        const a = Math.random() * Math.PI;
        const l = 3 + Math.random() * 7;
        const v = Math.random();
        g.strokeStyle = withPrint
          ? v > 0.5 ? `rgba(235,248,120,${0.35 * v})` : `rgba(90,110,0,${0.35 * (1 - v)})`
          : `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${0.25 * Math.abs(v - 0.5) * 2})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
      if (withPrint) {
        // sello en tinta oscura, dos veces (lados opuestos de la pelota)
        for (const u of [0.125, 0.625]) {
          const cx = u * c.width;
          g.save();
          g.translate(cx, c.height / 2);
          g.fillStyle = "rgba(14,13,11,0.95)";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.font = "700 86px Georgia, 'Times New Roman', serif";
          g.fillText("SACRÉ", 0, -10);
          g.font = "600 22px Arial, sans-serif";
          g.fillText("P Á D E L  ·  P R O", 0, 44);
          g.restore();
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if (withPrint) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    const R = 1;
    const ballMat = new THREE.MeshPhysicalMaterial({
      map: feltCanvas(true),
      bumpMap: feltCanvas(false),
      bumpScale: 2.5,
      roughness: 0.95,
      sheen: 0.55,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color("#eaf7a0"),
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), ballMat);

    // ── Costura: x = a·cos t + b·cos 3t, y = a·sin t − b·sin 3t, z = c·sin 2t
    // con a + b = 1 y c = 2√(ab) queda exactamente sobre la esfera unitaria.
    const a = 0.78;
    const b = 0.22;
    const c = 2 * Math.sqrt(a * b);
    // el eje "z" de la costura pasa a ser el vertical de la escena
    const seamPts: THREE.Vector3[] = [];
    for (let i = 0; i < 240; i++) {
      const t = (i / 240) * Math.PI * 2;
      seamPts.push(
        new THREE.Vector3(a * Math.cos(t) + b * Math.cos(3 * t), c * Math.sin(2 * t), a * Math.sin(t) - b * Math.sin(3 * t)).multiplyScalar(R * 1.002),
      );
    }
    const seamCurve = new THREE.CatmullRomCurve3(seamPts, true);
    const seamMat = new THREE.MeshStandardMaterial({ color: "#f3f1e4", roughness: 0.55 });
    const seam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 480, 0.016, 10, true), seamMat);
    ball.add(seam);

    // pivote = posición (rebote); ball = giro; squash en el pivote
    const pivot = new THREE.Group();
    pivot.add(ball);
    scene.add(pivot);
    ball.rotation.set(0.35, -0.6, 0.15);

    // ── Sombra de contacto ──
    const sc = document.createElement("canvas");
    sc.width = sc.height = 256;
    const sg = sc.getContext("2d")!;
    const grad = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(0,0,0,0.75)");
    grad.addColorStop(0.5, "rgba(0,0,0,0.25)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 256, 256);
    const shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false });
    const FLOOR = -1.25;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = FLOOR + 0.001;
    scene.add(shadow);

    // ── Luces: clave cálida y contraluz bronce ──
    const key = new THREE.DirectionalLight("#fff4e2", 2.2);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#c9a27e", 3);
    rim.position.set(4, 1.5, -4);
    scene.add(rim);
    scene.add(new THREE.AmbientLight("#ffffff", 0.15));

    // ── Física del bote ──
    const REST = 0; // altura sobre el piso en reposo (centro = FLOOR + R)
    let h = reduceMotion ? REST : 2.3; // altura del centro sobre el reposo
    let v = 0;
    let squash = 0; // 0 = redonda, >0 = aplastada
    let squashV = 0;
    let started = reduceMotion;
    let spin = 0;

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio > 0.35) started = true;
      },
      { threshold: [0, 0.35, 0.6] },
    );
    io.observe(mount);

    const kick = () => {
      if (reduceMotion) return;
      started = true;
      v = Math.max(v, 0) + 4.6;
      spin += 4;
    };
    mount.addEventListener("click", kick);

    const pointer = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let last = 0;
    let readyCalled = false;
    stage.start((t) => {
      const dt = Math.min(0.1, t - last);
      last = t;

      if (started && !reduceMotion) {
        // pasos fijos: el bote se ve igual a 30 o a 120 cuadros por segundo
        const STEP = 1 / 120;
        for (let n = Math.ceil(dt / STEP), i = 0; i < n; i++) {
          v -= 14 * STEP;
          h += v * STEP;
          if (h <= REST) {
            h = REST;
            if (v < -0.8) {
              squashV += -v * 0.9; // golpe → aplasta según la velocidad
              spin += -v * 0.35;
              v = -v * 0.62;
            } else v = 0;
          }
          // resorte del aplastado
          squashV += (-squash * 260 - squashV * 14) * STEP;
          squash += squashV * STEP;
        }
      }

      // Flota apenas cuando está quieta
      const idle = reduceMotion || (h === REST && v === 0) ? Math.sin(t * 1.3) * 0.04 + 0.04 : 0;
      const y = FLOOR + R + h + idle;
      const s = THREE.MathUtils.clamp(squash * 0.06, -0.12, 0.18);
      pivot.position.set(isSmall ? 0 : 0.15, y - (s * R) / 2, 0);
      pivot.scale.set(1 + s * 0.6, 1 - s, 1 + s * 0.6);

      // Giro: continuo + impulso de los botes + hacia el cursor
      spin *= 0.97;
      if (!reduceMotion) {
        ball.rotation.y += (0.12 + spin * 0.6) * dt;
        ball.rotation.x += spin * 0.25 * dt;
        ball.rotation.z += (pointer.x * 0.35 - ball.rotation.z) * 0.04;
        pivot.rotation.x += (pointer.y * 0.25 - pivot.rotation.x) * 0.05;
      }

      // La sombra se hace pequeña y tenue cuando la pelota sube
      const k = 1 / (1 + (h + idle) * 0.45);
      shadow.position.x = pivot.position.x;
      shadow.scale.setScalar(0.45 + k * 0.55);
      shadowMat.opacity = 0.15 + k * 0.7;

      if (!readyCalled) {
        readyCalled = true;
        onReady?.();
      }
    });

    return () => {
      io.disconnect();
      mount.removeEventListener("click", kick);
      window.removeEventListener("pointermove", onPointer);
      ballMat.bumpMap?.dispose();
      stage.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="absolute inset-0 cursor-pointer" aria-hidden />;
}
