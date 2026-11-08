"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useVoam } from "@/context/VoamContext";

/**
 * Higher-Order Component (HOC) Pelindung Rute — MainZ Voam
 * Mengunci halaman Dashboard dan In-Browser IDE agar hanya dapat diakses oleh
 * pengguna yang telah terautentikasi di Firebase Auth / sesi aktif.
 */
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
        <div className="min-h-screen bg-voam-bg flex flex-col items-center justify-center p-6 select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="flex flex-col items-center gap-4 px-8 py-6 rounded-3xl bg-voam-surface/80 backdrop-blur-2xl border border-voam-border shadow-neon-cyan"
          >
            <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-voam-neon/10 border border-voam-neon/30">
              <Loader2 className="w-6 h-6 text-voam-neon animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-voam-text tracking-wide">
                Memverifikasi Sesi Keamanan MainZ Voam...
              </p>
              <p className="text-xs text-voam-muted mt-1 font-mono">
                Firebase Auth &amp; Firestore Security Handshake
              </p>
            </div>
          </motion.div>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="min-h-screen bg-voam-bg flex flex-col items-center justify-center p-6 select-none">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-voam-surface/90 border border-voam-crimson/40 text-voam-crimson shadow-neon-crimson"
          >
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span className="text-xs font-mono uppercase tracking-wider">
              Akses Terkunci — Mengalihkan ke Gerbang Autentikasi...
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
