"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Cpu,
  X,
  UploadCloud,
  RefreshCw,
} from "lucide-react";
import { useVoam } from "@/context/VoamContext";
import type { IslandState } from "@/types/voam";

const ISLAND_DIMENSIONS: Record<
  Exclude<IslandState, "idle">,
  { width: number; height: number; borderRadius: number }
> = {
  uploading: { width: 380, height: 68, borderRadius: 24 },
  redeploying: { width: 392, height: 68, borderRadius: 24 },
  building: { width: 228, height: 40, borderRadius: 999 },
  deployed: { width: 440, height: 48, borderRadius: 999 },
  error: { width: 410, height: 58, borderRadius: 20 },
};

export default function DynamicIsland() {
  const { island, resetIsland } = useVoam();
  const [copied, setCopied] = useState<boolean>(false);

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

  const getBorderClass = (state: Exclude<IslandState, "idle">): string => {
    switch (state) {
      case "uploading":
      case "redeploying":
        return "border-sky-400/35";
      case "building":
        return "border-indigo-400/40";
      case "deployed":
        return "border-emerald-400/40";
      case "error":
        return "border-rose-500/50";
    }
  };

  return (
    <AnimatePresence>
      {island.state !== "idle" && (
        <div className="fixed top-3.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex justify-center w-full max-w-[94vw]">
          <motion.div
            key="active-dynamic-island"
            layout
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{
              opacity: 1,
              y: 0,
              width: ISLAND_DIMENSIONS[island.state].width,
              height: ISLAND_DIMENSIONS[island.state].height,
              borderRadius: ISLAND_DIMENSIONS[island.state].borderRadius,
              x:
                island.state === "error"
                  ? [0, -12, 12, -8, 8, -4, 4, 0]
                  : 0,
              scale: island.state === "building" ? [1, 0.97, 1] : 1,
            }}
            exit={{ opacity: 0, y: -20, scale: 0.92 }}
            transition={{
              width: { type: "spring", stiffness: 420, damping: 30, mass: 0.8 },
              height: {
                type: "spring",
                stiffness: 420,
                damping: 30,
                mass: 0.8,
              },
              borderRadius: { type: "spring", stiffness: 420, damping: 30 },
              y: { type: "spring", stiffness: 440, damping: 28 },
              opacity: { duration: 0.18 },
              x:
                island.state === "error"
                  ? { duration: 0.48, ease: "easeInOut" }
                  : { type: "spring", stiffness: 500, damping: 30 },
              scale:
                island.state === "building"
                  ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.2 },
            }}
            className={`pointer-events-auto relative overflow-hidden bg-[#09090D]/95 backdrop-blur-2xl border shadow-island flex items-center justify-between px-4 select-none ${getBorderClass(
              island.state
            )}`}
          >
            <AnimatePresence mode="wait">
              {/* STATE: UPLOADING / REDEPLOYING */}
              {(island.state === "uploading" ||
                island.state === "redeploying") && (
                <motion.div
                  key={`island-${island.state}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: "spring", stiffness: 450, damping: 28 }}
                  className="w-full flex flex-col justify-center gap-2 py-1"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-400/25 shrink-0">
                        {island.state === "uploading" ? (
                          <UploadCloud className="w-4 h-4 text-sky-400 animate-bounce" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-100 truncate">
                          {island.title}
                        </p>
                        <p className="text-[11px] text-zinc-400 font-mono truncate">
                          {island.subtitle ||
                            "Menyusun payload Vercel API v13..."}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-sky-400 shrink-0">
                      {typeof island.progress === "number"
                        ? `${Math.min(
                            100,
                            Math.max(5, Math.round(island.progress))
                          )}%`
                        : "SYNC"}
                    </span>
                  </div>

                  <div className="w-full h-1 bg-white/[0.07] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-sky-400 to-indigo-400 rounded-full"
                      initial={{ width: "15%" }}
                      animate={{
                        width:
                          typeof island.progress === "number"
                            ? `${Math.min(100, Math.max(10, island.progress))}%`
                            : ["20%", "85%", "45%", "92%"],
                      }}
                      transition={{
                        duration:
                          typeof island.progress === "number" ? 0.3 : 2.2,
                        repeat:
                          typeof island.progress === "number" ? 0 : Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  </div>
                </motion.div>
              )}

              {/* STATE: BUILDING */}
              {island.state === "building" && (
                <motion.div
                  key="island-building"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: [1, 0.5, 1], scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{
                    opacity: {
                      duration: 0.9,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                    scale: { type: "spring", stiffness: 450, damping: 25 },
                  }}
                  className="w-full flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                    <span className="text-xs font-medium text-zinc-100 truncate">
                      {island.title || "Building on Vercel Edge..."}
                    </span>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                </motion.div>
              )}

              {/* STATE: DEPLOYED */}
              {island.state === "deployed" && (
                <motion.div
                  key="island-deployed"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 400, damping: 26 }}
                  className="w-full flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-100 truncate">
                        {island.title}
                      </span>
                      {island.deploymentUrl && (
                        <a
                          href={island.deploymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1 truncate"
                        >
                          <span className="truncate max-w-[170px]">
                            {island.deploymentUrl.replace(/^https?:\/\//, "")}
                          </span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {island.deploymentUrl && (
                      <button
                        type="button"
                        onClick={handleCopyUrl}
                        title="Salin URL Deployment"
                        className="p-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 transition-colors"
                      >
                        {copied ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-zinc-400" />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={resetIsland}
                      title="Tutup"
                      className="p-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-zinc-400 hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STATE: ERROR */}
              {island.state === "error" && (
                <motion.div
                  key="island-error"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  className="w-full flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-400 shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-rose-400 truncate">
                        {island.title}
                      </p>
                      <p className="text-[11px] text-zinc-400 font-mono truncate">
                        {island.errorMessage ||
                          island.subtitle ||
                          "Terjadi kendala saat memproses permintaan."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetIsland}
                    className="p-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
