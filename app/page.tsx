"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  Sparkles,
  Layers,
  Terminal,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import AnimatedLogo from "@/components/animations/AnimatedLogo";
import { useVoam } from "@/context/VoamContext";
import { isLiveFirebaseConfigured } from "@/lib/firebase";

export default function AuthGatewayPage() {
  const router = useRouter();
  const {
    user,
    loadingAuth,
    loginWithEmail,
    registerWithEmail,
    setIslandStatus,
  } = useVoam();

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!loadingAuth && user) {
      router.replace("/dashboard");
    }
  }, [user, loadingAuth, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      if (authMode === "login") {
        setIslandStatus("uploading", "Memverifikasi Kredensial...", {
          subtitle: "Menghubungi Firebase Auth & Koleksi Users",
          progress: 65,
        });
        await loginWithEmail(email, password);
        setIslandStatus("deployed", "Sesi Developer Aktif", {
          subtitle: "Mengalihkan ke Ruang Kerja MainZ Voam",
          autoResetMs: 3500,
        });
      } else {
        setIslandStatus("uploading", "Mendaftarkan Akun Baru...", {
          subtitle: "Menyimpan profil ke Firestore koleksi users",
          progress: 70,
        });
        await registerWithEmail(email, password, displayName);
        setIslandStatus("deployed", "Akun Berhasil Dibuat", {
          subtitle: "Profil tersimpan di koleksi users",
          autoResetMs: 3500,
        });
      }
      router.push("/dashboard");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal memproses autentikasi. Periksa kembali data Anda.";
      setErrorMsg(msg);
      setIslandStatus("error", "Autentikasi Gagal", {
        errorMessage: msg,
        autoResetMs: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemoAccess = async () => {
    setErrorMsg("");
    setSubmitting(true);
    const demoEmail = "architect@mainzvoam.dev";
    const demoPass = "mainzvoam123";
    setEmail(demoEmail);
    setPassword(demoPass);
    setDisplayName("Lead Architect MainZ");

    try {
      setIslandStatus("uploading", "Menyiapkan Sesi Instan...", {
        subtitle: "Sinkronisasi profil ke koleksi users",
        progress: 80,
      });
      await loginWithEmail(demoEmail, demoPass);
      setIslandStatus("deployed", "Selamat Datang, Architect!", {
        autoResetMs: 3500,
      });
      router.push("/dashboard");
    } catch {
      try {
        await registerWithEmail(demoEmail, demoPass, "Lead Architect MainZ");
        router.push("/dashboard");
      } catch (regErr) {
        const msg =
          regErr instanceof Error ? regErr.message : "Gagal masuk otomatis.";
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen pt-20 pb-12 px-4 sm:px-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient Orbs Latar Belakang */}
      <div className="pointer-events-none absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-voam-neon/10 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-voam-violet/15 blur-[130px]" />

      {/* Grid Halus */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #00F0FF 1px, transparent 1px), linear-gradient(to bottom, #00F0FF 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Kolom Kiri: Branding & Value Proposition */}
        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-voam-neon/10 border border-voam-neon/30 text-voam-neon text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>NEXT.JS 14 • VERCEL API v13 • MONACO CLOUD IDE</span>
          </div>

          <div>
            <AnimatedLogo size="lg" />
            <p className="mt-4 text-base sm:text-lg text-voam-muted leading-relaxed max-w-xl mx-auto lg:mx-0">
              Platform SaaS Deployment &amp; In-Browser IDE berkecepatan tinggi.
              Unggah bundel web mentah atau arsip <code className="text-voam-neon font-mono">.zip</code>,
              deploy instan ke jaringan global Vercel v13, dan modifikasi kode
              secara langsung melalui Monaco Editor terintegrasi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="voam-glass rounded-2xl p-4 text-left">
              <Layers className="w-5 h-5 text-voam-neon mb-2" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Auto-Fallback HTML
              </h3>
              <p className="text-xs text-voam-muted mt-1">
                Sintesis otomatis <code className="text-voam-neon">/index.html</code> di memori jika bundel tidak memiliki halaman utama.
              </p>
            </div>

            <div className="voam-glass rounded-2xl p-4 text-left">
              <Terminal className="w-5 h-5 text-voam-violet mb-2" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                In-Browser VS Code
              </h3>
              <p className="text-xs text-voam-muted mt-1">
                Monaco Editor <code className="text-voam-violet">vs-dark</code> dengan deteksi bahasa dinamis &amp; pohon direktori interaktif.
              </p>
            </div>

            <div className="voam-glass rounded-2xl p-4 text-left">
              <ShieldCheck className="w-5 h-5 text-voam-emerald mb-2" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Firestore Sync
              </h3>
              <p className="text-xs text-voam-muted mt-1">
                Struktur <code className="text-voam-emerald">fileSystem</code> tersimpan aman di Firestore untuk Re-deploy satu klik.
              </p>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Kartu Login / Register Glassmorphism dengan AnimatePresence */}
        <div className="lg:col-span-5">
          <div className="voam-glass rounded-3xl p-6 sm:p-8 shadow-island relative overflow-hidden">
            {/* Switcher Tab Login / Register */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-voam-bg/90 border border-voam-border mb-6">
              {(["login", "register"] as const).map((mode) => {
                const active = authMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setAuthMode(mode);
                      setErrorMsg("");
                    }}
                    className={`relative py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors z-10 ${
                      active ? "text-voam-bg" : "text-voam-muted hover:text-white"
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="auth-mode-pill"
                        transition={{
                          type: "spring",
                          stiffness: 450,
                          damping: 30,
                        }}
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-voam-neon to-voam-cyan shadow-neon-cyan -z-10"
                      />
                    )}
                    {mode === "login" ? "Masuk Sesi" : "Daftar Akun"}
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.form
                key={authMode}
                initial={{ opacity: 0, x: authMode === "login" ? -18 : 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: authMode === "login" ? 18 : -18 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {authMode === "login"
                      ? "Selamat Datang Kembali"
                      : "Buat Identitas Developer"}
                  </h2>
                  <p className="text-xs text-voam-muted mt-1">
                    {authMode === "login"
                      ? "Masuk untuk mengelola deployment Vercel & proyek IDE Anda."
                      : "Data profil akan disimpan ke koleksi users di Firestore."}
                  </p>
                </div>

                {authMode === "register" && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-voam-muted">
                      Nama Tampilan Developer
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-voam-muted absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Contoh: MainZ Architect"
                        className="voam-input pl-11"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-voam-muted">
                    Alamat Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-voam-muted absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="developer@mainzvoam.dev"
                      className="voam-input pl-11 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-voam-muted">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-voam-muted absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="voam-input pl-11 font-mono"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-voam-crimson/15 border border-voam-crimson/40 text-xs text-voam-crimson font-medium"
                  >
                    {errorMsg}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="voam-btn-primary w-full mt-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memproses Sesi...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {authMode === "login"
                          ? "Masuk ke Dashboard"
                          : "Daftarkan & Buka Dashboard"}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.form>
            </AnimatePresence>

            {/* Akses Instan 1-Klik untuk Pengujian Cepat */}
            <div className="mt-6 pt-5 border-t border-voam-border/80 flex flex-col gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={handleQuickDemoAccess}
                className="voam-btn-secondary w-full justify-center py-2.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-voam-neon" />
                <span>Masuk Instan (Akun Architect)</span>
              </button>

              <div className="flex items-center justify-between text-[11px] font-mono text-voam-muted px-1">
                <span>Engine: Firebase Auth + Firestore</span>
                <span className="text-voam-emerald">
                  ● {isLiveFirebaseConfigured() ? "Cloud Live" : "Autonomous Hybrid"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
