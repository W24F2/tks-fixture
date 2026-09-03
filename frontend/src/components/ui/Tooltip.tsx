"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({ content, children, position = "top", delay = 200 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const childRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const positions = {
    top: { x: 0, y: -8, originX: "center", originY: "bottom" },
    bottom: { x: 0, y: 8, originX: "center", originY: "top" },
    left: { x: -8, y: 0, originX: "right", originY: "center" },
    right: { x: 8, y: 0, originX: "left", originY: "center" },
  };

  const pos = positions[position];
  const isVertical = position === "top" || position === "bottom";

  return (
    <div
      ref={childRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      className="inline-block"
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, [isVertical ? "y" : "x"]: isVertical ? pos.y : pos.x }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, [isVertical ? "y" : "x"]: isVertical ? pos.y : pos.x }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              "fixed z-50 px-3 py-1.5 text-xs font-medium text-popover-foreground bg-popover border border-border rounded-md shadow-lg whitespace-nowrap pointer-events-none",
              "max-w-[200px] text-center"
            )}
            style={{
              transformOrigin: `${pos.originX} ${pos.originY}`,
            }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}