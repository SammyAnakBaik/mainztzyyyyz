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

// Vektor sebaran deterministik agar saat mouse hover semua huruf buyar lalu spring-back dengan mulus
const SCATTER_VECTORS: ScatterVector[] = [
  { x: -28, y: -22, rotate: -34, scale: 1.25 },
  { x: -16, y: 24, rotate: 28, scale: 0.85 },
  { x: -8, y: -28, rotate: -22, scale: 1.18 },
  { x: 12, y: 26, rotate: 38, scale: 0.9 },
  { x: 24, y: -20, rotate: 42, scale: 1.3 },
  { x: 0, y: 0, rotate: 0, scale: 1 }, // Spasi
  { x: -22, y: 22, rotate: -38, scale: 1.25 },
  { x: 14, y: -26, rotate: 29, scale: 0.88 },
  { x: -12, y: 25, rotate: -26, scale: 1.15 },
  { x: 30, y: -18, rotate: 36, scale: 1.22 },
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

  // Saat statik (tidak di-hover), huruf acak melompat (translateY), menunduk (scaleY), atau panik (rotate)
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
      }, 720);
    }, 1500);

    return () => window.clearInterval(interval);
  }, [isHovered, isScattered]);

  // Saat mouse hover: semua huruf buyar seketika lalu kembali tersusun rapi secara spring-back
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    setCharGestures(CHARACTERS.map(() => "none"));
    setIsScattered(true);

    if (scatterTimerRef.current) {
      window.clearTimeout(scatterTimerRef.current);
    }

    scatterTimerRef.current = window.setTimeout(() => {
      setIsScattered(false);
    }, 230);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (scatterTimerRef.current) {
      window.clearTimeout(scatterTimerRef.current);
    }
    setIsScattered(false);
  }, []);

  const sizeClasses = {
    sm: "text-lg md:text-xl tracking-tight",
    md: "text-2xl md:text-3xl tracking-tight",
    lg: "text-3xl md:text-5xl tracking-tight",
  }[size];

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`inline-flex items-baseline cursor-pointer select-none font-extrabold ${sizeClasses} ${className}`}
      aria-label={LOGO_TEXT}
    >
      {CHARACTERS.map((char, index) => {
        if (char === " ") {
          return (
            <span key={`space-${index}`} className="inline-block w-2.5 md:w-3.5">
              &nbsp;
            </span>
          );
        }

        const isVoamPart = index >= 6;
        const gesture = charGestures[index];
        const vector = SCATTER_VECTORS[index] || {
          x: 15,
          y: -15,
          rotate: 20,
          scale: 1.1,
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
          // Melompat (translateY)
          animateTarget = {
            x: 0,
            y: [0, -13, 2, 0],
            scaleX: [1, 0.92, 1.06, 1],
            scaleY: [1, 1.18, 0.9, 1],
            rotate: 0,
          };
        } else if (gesture === "duck") {
          // Menunduk (scaleY)
          animateTarget = {
            x: 0,
            y: [0, 5, 0],
            scaleX: [1, 1.24, 1],
            scaleY: [1, 0.48, 1],
            rotate: 0,
          };
        } else if (gesture === "panic") {
          // Panik (rotate)
          animateTarget = {
            x: 0,
            y: [0, -3, 0],
            scaleX: 1,
            scaleY: 1,
            rotate: [0, -18, 18, -14, 14, -7, 7, 0],
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
                    damping: 20,
                    mass: 0.65,
                  }
                : {
                    duration: 0.62,
                    ease: "easeInOut",
                  }
            }
            style={{ transformOrigin: "bottom center" }}
            className={`inline-block ${
              isVoamPart
                ? "bg-gradient-to-r from-voam-neon via-voam-cyan to-voam-violet bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(0,240,255,0.45)]"
                : "text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.12)]"
            }`}
          >
            {char}
          </motion.span>
        );
      })}
    </div>
  );
}
