"use client";

import { useEffect, useRef } from "react";

/**
 * Curvas de nivel (como un mapa topográfico de los cerros de Pátzcuaro),
 * dibujadas en un canvas con "marching squares" sobre un relieve
 * procedural. Se dibujan una vez por tamaño de pantalla y se mueven con una
 * deriva lenta por CSS — cero costo por cuadro.
 */
export default function ContourLines({ color = "rgba(201,162,126,0.16)" }: { color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // Relieve: suma de ondas + dos "cerros" (picos gaussianos)
    function height(x: number, y: number) {
      return (
        Math.sin(x * 2.1 + Math.cos(y * 1.3)) * 0.35 +
        Math.cos(y * 2.6 - x * 0.7) * 0.3 +
        Math.sin((x + y) * 3.7) * 0.08 +
        1.2 * Math.exp(-((x - 0.75) ** 2 + (y - 0.35) ** 2) / 0.09) +
        0.9 * Math.exp(-((x - 0.2) ** 2 + (y - 0.8) ** 2) / 0.12)
      );
    }

    function draw() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      const g = canvas!.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.strokeStyle = color;
      g.lineWidth = 1;

      const cell = 9;
      const cols = Math.ceil(w / cell) + 1;
      const rows = Math.ceil(h / cell) + 1;
      const v = new Float32Array(cols * rows);
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) v[j * cols + i] = height(i / cols, (j / rows) * (h / w) + 0.1);

      const lerp = (a: number, b: number, lvl: number) => (lvl - a) / (b - a || 1e-6);
      for (let lvl = -0.6; lvl <= 1.6; lvl += 0.11) {
        g.beginPath();
        for (let j = 0; j < rows - 1; j++) {
          for (let i = 0; i < cols - 1; i++) {
            const a = v[j * cols + i], b = v[j * cols + i + 1], c = v[(j + 1) * cols + i + 1], d = v[(j + 1) * cols + i];
            const idx = (a > lvl ? 8 : 0) | (b > lvl ? 4 : 0) | (c > lvl ? 2 : 0) | (d > lvl ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const x = i * cell, y = j * cell;
            const top: [number, number] = [x + cell * lerp(a, b, lvl), y];
            const right: [number, number] = [x + cell, y + cell * lerp(b, c, lvl)];
            const bottom: [number, number] = [x + cell * lerp(d, c, lvl), y + cell];
            const left: [number, number] = [x, y + cell * lerp(a, d, lvl)];
            const segs: Array<[[number, number], [number, number]]> = [];
            switch (idx) {
              case 1: case 14: segs.push([left, bottom]); break;
              case 2: case 13: segs.push([bottom, right]); break;
              case 3: case 12: segs.push([left, right]); break;
              case 4: case 11: segs.push([top, right]); break;
              case 5: segs.push([left, top], [bottom, right]); break;
              case 6: case 9: segs.push([top, bottom]); break;
              case 7: case 8: segs.push([left, top]); break;
              case 10: segs.push([left, bottom], [top, right]); break;
            }
            for (const [p, q] of segs) {
              g.moveTo(p[0], p[1]);
              g.lineTo(q[0], q[1]);
            }
          }
        }
        g.stroke();
      }
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [color]);

  return <canvas ref={ref} aria-hidden className="contour-drift pointer-events-none absolute inset-0 h-full w-full" />;
}
