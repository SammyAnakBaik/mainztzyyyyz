"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";

interface AnimatedLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

type IdleGesture = "none" | "jump" | "duck" | "panic";

interface ScatterVector {
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

const LOGO_TEXT = "MainZ Voam";
const CHARACTERS = LOGO_TEXT.split("");

const SCATTER_VECTORS: ScatterVector[] = [
  { x: -22, y: -16, rotate: -26, scale: 1.15 },
  { x: -12, y: 18, rotate: 22, scale: 0.9 },
  { x: -6, y: -20, rotate: -18, scale: 1.12 },
  { x: 10, y: 18, rotate: 28, scale: 0.92 },
  { x: 18, y: -15, rotate: 32, scale: 1.18 },
  { x: 0, y: 0, rotate: 0, scale: 1 },
  { x: -16, y: 16, rotate: -28, scale: 1.15 },
  { x: 12, y: -18, rotate: 24, scale: 0.92 },
  { x: -9, y: 18, rotate: -20, scale: 1.1 },
  { x: 22, y: -14, rotate: 28, scale: 1.14 },
];

export default function AnimatedLogo({
  size = "md",
  className = "",
}: AnimatedLogoProps) {
  const [charGestures, setCharGestures] = useState<IdleGesture[]>(
    () => CHARACTERS.map(() => "none")
  );
  const [isScattered, setIsScattered] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const scatterTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isHovered || isScattered) return;

    const interval = window.setInterval(() => {
      const validIndices = CHARACTERS.map((ch, idx) =>
        ch === " " ? -1 : idx
      ).filter((idx) => idx !== -1);

      const randomIdx =
        validIndices[Math.floor(Math.random() * validIndices.length)];
      const gestures: IdleGesture[] = ["jump", "duck", "panic"];
      const pickedGesture =
        gestures[Math.floor(Math.random() * gestures.length)];

      setCharGestures((prev) =>
        prev.map((g, i) => (i === randomIdx ? pickedGesture : "none"))
      );

      window.setTimeout(() => {
        setCharGestures((prev) =>
          prev.map((g, i) => (i === randomIdx ? "none" : g))
        );
      }, 680);
    }, 2200);

    return () => window.clearInterval(interval);
  }, [isHovered, isScattered]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    setCharGestures(CHARACTERS.map(() => "none"));
    setIsScattered(true);

    if (scatterTimerRef.current) {
      window.clearTimeout(scatterTimerRef.current);
    }

    scatterTimerRef.current = window.setTimeout(() => {
      setIsScattered(false);
    }, 210);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (scatterTimerRef.current) {
      window.clearTimeout(scatterTimerRef.current);
    }
    setIsScattered(false);
  }, []);

  const sizeClasses = {
    sm: "text-base sm:text-lg tracking-[-0.03em]",
    md: "text-xl sm:text-2xl tracking-[-0.035em]",
    lg: "text-3xl sm:text-5xl tracking-[-0.04em]",
  }[size];

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`inline-flex items-baseline cursor-pointer select-none font-bold ${sizeClasses} ${className}`}
      aria-label={LOGO_TEXT}
    >
      {CHARACTERS.map((char, index) => {
        if (char === " ") {
          return (
            <span key={`space-${index}`} className="inline-block w-2">
              &nbsp;
            </span>
          );
        }

        const isVoamPart = index >= 6;
        const gesture = charGestures[index];
        const vector = SCATTER_VECTORS[index] || {
          x: 12,
          y: -12,
          rotate: 16,
          scale: 1.08,
        };

        let animateTarget: {
          x: number;
          y: number | number[];
          scaleX: number | number[];
          scaleY: number | number[];
          rotate: number | number[];
          scale?: number;
        } = {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotate: 0,
          scale: 1,
        };

        if (isScattered) {
          animateTarget = {
            x: vector.x,
            y: vector.y,
            rotate: vector.rotate,
            scaleX: vector.scale,
            scaleY: vector.scale,
            scale: vector.scale,
          };
        } else if (gesture === "jump") {
          animateTarget = {
            x: 0,
            y: [0, -9, 1, 0],
            scaleX: [1, 0.94, 1.04, 1],
            scaleY: [1, 1.12, 0.94, 1],
            rotate: 0,
          };
        } else if (gesture === "duck") {
          animateTarget = {
            x: 0,
            y: [0, 4, 0],
            scaleX: [1, 1.18, 1],
            scaleY: [1, 0.56, 1],
            rotate: 0,
          };
        } else if (gesture === "panic") {
          animateTarget = {
            x: 0,
            y: [0, -2, 0],
            scaleX: 1,
            scaleY: 1,
            rotate: [0, -14, 14, -10, 10, -5, 5, 0],
          };
        }

        const isSpringMode = isScattered || gesture === "none";

        return (
          <motion.span
            key={`${char}-${index}`}
            animate={animateTarget}
            transition={
              isSpringMode
                ? {
                    type: "spring",
                    stiffness: 520,
                    damping: 22,
                    mass: 0.65,
                  }
                : {
                    duration: 0.55,
                    ease: "easeInOut",
                  }
            }
            style={{ transformOrigin: "bottom center" }}
            className={`inline-block ${
              isVoamPart
                ? "bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent"
                : "text-white"
            }`}
          >
            {char}
          </motion.span>
        );
      })}
    </div>
  );
}
