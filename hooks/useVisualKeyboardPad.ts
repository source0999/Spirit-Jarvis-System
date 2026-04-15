"use client";

import { useEffect, useState } from "react";

/** Extra bottom inset when the on-screen keyboard shrinks visual viewport (iOS / mobile). */
export function useVisualKeyboardPad() {
  const [padPx, setPadPx] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setPadPx(overlap);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return padPx;
}
