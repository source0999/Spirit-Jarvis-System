"use client";

import { TapButton } from "@/components/ui/TapButton";
import { AnimatePresence, motion } from "framer-motion";
import { Home, MessageSquare, Menu, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="max-md:fixed max-md:top-3 max-md:right-3 max-md:z-[60] md:hidden">
        <TapButton
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="p-2.5 rounded-xl border border-cyan-500/35 bg-black/50 text-cyan-300 backdrop-blur-lg shadow-[0_0_24px_rgba(0,0,0,0.35)]"
        >
          {open ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
        </TapButton>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="mobile-nav-backdrop"
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-[55] bg-black/50 backdrop-blur-lg"
              onClick={close}
            />
            <motion.nav
              key="mobile-nav-panel"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={[
                "md:hidden fixed left-3 right-3 top-14 z-[56] rounded-2xl border border-cyan-500/25",
                "bg-black/55 backdrop-blur-lg shadow-[0_20px_60px_rgba(0,0,0,0.55)] p-4",
                "font-mono text-slate-200",
              ].join(" ")}
            >
              <p className="text-[9px] uppercase tracking-[0.28em] text-cyan-500/90 px-1 pb-3">Spirit OS</p>
              <div className="flex flex-col gap-1">
                <Link
                  href="/"
                  onClick={close}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 border border-transparent hover:bg-white/[0.05] hover:border-cyan-500/20 transition-colors"
                >
                  <Home size={18} className="text-cyan-400/90 shrink-0" />
                  <span className="text-[12px] uppercase tracking-widest text-cyan-100/90">Dashboard</span>
                </Link>
                <Link
                  href="/chat"
                  onClick={close}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 border border-transparent hover:bg-white/[0.05] hover:border-cyan-500/20 transition-colors"
                >
                  <MessageSquare size={18} className="text-cyan-400/90 shrink-0" />
                  <span className="text-[12px] uppercase tracking-widest text-cyan-100/90">Neural Chat</span>
                </Link>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
