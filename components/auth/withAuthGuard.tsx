"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useVoam } from "@/context/VoamContext";

export function withAuthGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.FC<P> {
  const ProtectedRouteComponent: React.FC<P> = (props: P) => {
    const { user, loadingAuth } = useVoam();
    const router = useRouter();

    useEffect(() => {
      if (!loadingAuth && !user) {
        router.replace("/");
      }
    }, [user, loadingAuth, router]);

    if (loadingAuth) {
      return (
        <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-6 select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-[#0B0B0F] border border-white/[0.08] shadow-glass-sm"
          >
            <Loader2 className="w-4 h-4 text-zinc-300 animate-spin" />
            <span className="text-xs font-medium text-zinc-300">
              Memverifikasi sesi MainZ Voam...
            </span>
          </motion.div>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-6 select-none">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-[#0B0B0F] border border-rose-500/30 text-rose-400"
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span className="text-xs font-mono">
              Sesi terkunci — Mengalihkan ke halaman masuk...
            </span>
          </motion.div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  ProtectedRouteComponent.displayName = `withAuthGuard(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return ProtectedRouteComponent;
}
