"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Cpu,
  X,
  UploadCloud,
  RefreshCw,
} from "lucide-react";
import { useVoam } from "@/context/VoamContext";
import type { IslandState } from "@/types/voam";

const ISLAND_DIMENSIONS: Record<
  IslandState,
  { width: number; height: number; borderRadius: number }
> = {
  idle: { width: 256, height: 38, borderRadius: 999 },
  uploading: { width: 396, height: 74, borderRadius: 28 },
  redeploying: { width: 406, height: 74, borderRadius: 28 },
  building: { width: 236, height: 40, borderRadius: 999 },
  deployed: { width: 476, height: 52, borderRadius: 999 },
  error: { width: 428, height: 64, borderRadius: 24 },
};

export default function DynamicIsland() {
  const { island, resetIsland } = useVoam();
  const [copied, setCopied] = useState<boolean>(false);

  const currentDim = ISLAND_DIMENSIONS[island.state];

  const handleCopyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!island.deploymentUrl) return;
    try {
      await navigator.clipboard.writeText(island.deploymentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Abaikan jika clipboard tidak diizinkan
    }
  };

  const getGlowClass = (state: IslandState): string => {
    switch (state) {
      case "uploading":
      case "redeploying":
        return "shadow-neon-cyan border-voam-neon/50";
      case "building":
        return "shadow-neon-violet border-voam-violet/60";
      case "deployed":
        return "shadow-neon-emerald border-voam-emerald/60";
      case "error":
        return "shadow-neon-crimson border-voam-crimson/70";
      default:
        return "shadow-island border-white/10 hover:border-voam-neon/35";
    }
  };

  return (
    <div className="fixed top-3.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex justify-center w-full max-w-[95vw]">
      <motion.div
        layout
        initial={false}
        animate={{
          width: currentDim.width,
          height: currentDim.height,
          borderRadius: currentDim.borderRadius,
          x:
            island.state === "error"
              ? [0, -14, 14, -10, 10, -6, 6, -3, 3, 0]
              : 0,
          scale: island.state === "building" ? [1, 0.96, 1] : 1,
        }}
        transition={{
          width: { type: "spring", stiffness: 420, damping: 30, mass: 0.8 },
          height: { type: "spring", stiffness: 420, damping: 30, mass: 0.8 },
          borderRadius: { type: "spring", stiffness: 420, damping: 30 },
          x:
            island.state === "error"
              ? { duration: 0.55, ease: "easeInOut" }
              : { type: "spring", stiffness: 500, damping: 30 },
          scale:
            island.state === "building"
              ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.2 },
        }}
        className={`pointer-events-auto relative overflow-hidden bg-[#05070E]/95 backdrop-blur-2xl border transition-colors duration-300 flex items-center justify-between px-4 select-none ${getGlowClass(
          island.state
        )}`}
      >
        {/* Efek kilau ambient internal kapsul */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            background:
              island.state === "deployed"
                ? "radial-gradient(circle at 20% 50%, rgba(16, 185, 129, 0.35), transparent 70%)"
                : island.state === "error"
                ? "radial-gradient(circle at 20% 50%, rgba(244, 63, 94, 0.4), transparent 70%)"
                : island.state === "building"
                ? "radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.4), transparent 70%)"
                : "radial-gradient(circle at 20% 50%, rgba(0, 240, 255, 0.28), transparent 70%)",
          }}
        />

        <AnimatePresence mode="wait">
          {/* STATE 1: IDLE */}
          {island.state === "idle" && (
            <motion.div
              key="island-idle"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.16 }}
              className="w-full flex items-center justify-between gap-2.5 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-voam-neon opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-voam-neon" />
                </span>
                <span className="font-medium text-voam-text/90 tracking-tight truncate">
                  {island.title}
                </span>
              </div>
              <span className="text-[10px] font-mono text-voam-neon/80 bg-voam-neon/10 px-2 py-0.5 rounded-full border border-voam-neon/20">
                v13 Ready
              </span>
            </motion.div>
          )}

          {/* STATE 2: UPLOADING / REDEPLOYING (Membesar dengan Loader & Progress) */}
          {(island.state === "uploading" ||
            island.state === "redeploying") && (
            <motion.div
              key={`island-${island.state}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
              className="w-full flex flex-col justify-center gap-2 py-1"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-2xl bg-voam-neon/15 border border-voam-neon/40 shrink-0">
                    {island.state === "uploading" ? (
                      <UploadCloud className="w-4 h-4 text-voam-neon animate-bounce" />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-voam-neon animate-spin" />
                    )}
                    <span className="absolute inset-0 rounded-2xl border border-voam-neon/50 animate-ping opacity-30" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {island.title}
                    </p>
                    <p className="text-[11px] text-voam-muted font-mono truncate">
                      {island.subtitle ||
                        "Menyusun payload JSON Vercel API v13..."}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-voam-neon shrink-0">
                  {typeof island.progress === "number"
                    ? `${Math.min(100, Math.max(5, Math.round(island.progress)))}%`
                    : "SYNC"}
                </span>
              </div>

              {/* Bar Progres Spring */}
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-voam-neon via-voam-cyan to-voam-violet rounded-full"
                  initial={{ width: "12%" }}
                  animate={{
                    width:
                      typeof island.progress === "number"
                        ? `${Math.min(100, Math.max(10, island.progress))}%`
                        : ["20%", "85%", "45%", "92%"],
                  }}
                  transition={{
                    duration: typeof island.progress === "number" ? 0.3 : 2.2,
                    repeat:
                      typeof island.progress === "number" ? 0 : Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* STATE 3: BUILDING (Mengecil & Berkedip) */}
          {island.state === "building" && (
            <motion.div
              key="island-building"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: [1, 0.45, 1], scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{
                opacity: { duration: 0.85, repeat: Infinity, ease: "easeInOut" },
                scale: { type: "spring", stiffness: 450, damping: 25 },
              }}
              className="w-full flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Cpu className="w-4 h-4 text-voam-violet animate-spin shrink-0" />
                <span className="text-xs font-semibold text-white truncate">
                  {island.title || "Vercel Edge Building..."}
                </span>
              </div>
              <span className="h-2 w-2 rounded-full bg-voam-amber animate-ping shrink-0" />
            </motion.div>
          )}

          {/* STATE 4: DEPLOYED (Memanjang & Tampilkan URL Sukses) */}
          {island.state === "deployed" && (
            <motion.div
              key="island-deployed"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 400, damping: 26 }}
              className="w-full flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-voam-emerald/20 border border-voam-emerald/50 text-voam-emerald shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white truncate">
                      {island.title}
                    </span>
                    <Sparkles className="w-3 h-3 text-voam-emerald shrink-0" />
                  </div>
                  {island.deploymentUrl && (
                    <a
                      href={island.deploymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-voam-emerald hover:underline flex items-center gap-1 truncate"
                    >
                      <span className="truncate">{island.deploymentUrl}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {island.deploymentUrl && (
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    title="Salin URL Deployment"
                    className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-voam-text transition-colors"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-voam-emerald" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-voam-muted" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetIsland}
                  title="Tutup Notifikasi"
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-voam-muted hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STATE 5: ERROR (Bergetar dengan Pesan Diagnostik) */}
          {island.state === "error" && (
            <motion.div
              key="island-error"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-2xl bg-voam-crimson/20 border border-voam-crimson/50 text-voam-crimson shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-voam-crimson truncate">
                    {island.title}
                  </p>
                  <p className="text-[11px] text-voam-text/80 font-mono truncate">
                    {island.errorMessage ||
                      island.subtitle ||
                      "Terjadi kegagalan saat memproses transaksi."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetIsland}
                className="p-1.5 rounded-full bg-voam-crimson/15 hover:bg-voam-crimson/30 text-voam-crimson transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
