"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";

function tapHaptic() {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* iOS often ignores vibrate; motion feedback still applies */
  }
}

export type TapButtonProps = HTMLMotionProps<"button">;

export const TapButton = forwardRef<HTMLButtonElement, TapButtonProps>(function TapButton(
  { disabled, onPointerDown, whileTap, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      disabled={disabled}
      whileTap={disabled ? { scale: 1 } : (whileTap ?? { scale: 0.96 })}
      transition={{ type: "spring", stiffness: 520, damping: 30 }}
      onPointerDown={(e) => {
        if (!disabled) tapHaptic();
        onPointerDown?.(e);
      }}
      {...props}
    />
  );
});

const MotionLink = motion.create(Link);

export type TapLinkProps = ComponentProps<typeof MotionLink>;

export function TapLink({ onPointerDown, whileTap, ...props }: TapLinkProps) {
  return (
    <MotionLink
      whileTap={whileTap ?? { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 520, damping: 30 }}
      onPointerDown={(e) => {
        tapHaptic();
        onPointerDown?.(e);
      }}
      {...props}
    />
  );
}
