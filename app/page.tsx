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
  Terminal,
  ShieldCheck,
  Layers,
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
          autoResetMs: 2800,
        });
      } else {
        setIslandStatus("uploading", "Mendaftarkan Akun Baru...", {
          subtitle: "Menyimpan profil ke Firestore koleksi users",
          progress: 70,
        });
        await registerWithEmail(email, password, displayName);
        setIslandStatus("deployed", "Akun Berhasil Dibuat", {
          subtitle: "Profil tersimpan di koleksi users",
          autoResetMs: 2800,
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
        autoResetMs: 4500,
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
      setIslandStatus("deployed", "Selamat Datang, Architect", {
        autoResetMs: 2500,
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
    <div className="min-h-screen flex flex-col bg-[#050507] text-zinc-100 relative overflow-hidden">
      {/* Subtle Architectural Top Light & Micro-Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Minimal Top Bar */}
      <header className="relative z-10 h-14 border-b border-white/[0.06] bg-[#050507]/80 backdrop-blur-xl px-6 flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <AnimatedLogo size="sm" />
          <span className="text-[11px] font-mono text-zinc-400 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.07]">
            v13.4
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="hidden sm:inline">
            {isLiveFirebaseConfigured()
              ? "Firestore Cloud • asia-southeast1"
              : "Hybrid Cloud Engine"}
          </span>
        </div>
      </header>

      {/* Main Content Split */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Kolom Kiri: Value Proposition & Architectural Specs */}
          <div className="lg:col-span-7 space-y-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-zinc-300 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>Cloud Deployment &amp; In-Browser Monaco IDE</span>
            </div>

            <div className="space-y-3">
              <AnimatedLogo size="lg" />
              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-xl">
                Platform deployment terpadu dan lingkungan pengembangan berbasis
                web. Ekstrak arsip <code className="text-zinc-200 font-mono">.zip</code> di
                memori klien, publikasikan ke jaringan global Vercel REST API
                v13, dan kelola kode produksi secara langsung melalui Monaco
                Editor.
              </p>
            </div>

            {/* Daftar Spesifikasi Arsitektur Bergaya Linear */}
            <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
              <div className="py-4 flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-4 h-4 text-zinc-200" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-100 tracking-wide">
                    Auto-Fallback HTML Synthesis
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Mendeteksi keberadaan <code className="text-zinc-200 font-mono">/index.html</code> dan
                    merakit berkas induk pemanggil aset secara otomatis di memori
                    sebelum pengiriman payload.
                  </p>
                </div>
              </div>

              <div className="py-4 flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                  <Terminal className="w-4 h-4 text-zinc-200" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-100 tracking-wide">
                    In-Browser Monaco Studio (vs-dark)
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Navigasi pohon berkas interaktif, pembuatan file baru instan,
                    pratinjau langsung (<span className="text-zinc-200">split live preview</span>),
                    dan deteksi bahasa otomatis.
                  </p>
                </div>
              </div>

              <div className="py-4 flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-zinc-200" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-100 tracking-wide">
                    Cloud Firestore FileSystem Sync
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Seluruh pohon kode tersimpan aman pada koleksi{" "}
                    <code className="text-zinc-200 font-mono">projects</code> di
                    Firestore untuk mendukung proses Re-deploy berulang.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Kartu Autentikasi Presisi */}
          <div className="lg:col-span-5">
            <div className="voam-glass rounded-2xl p-6 sm:p-7 relative border-white/[0.1]">
              {/* Segmented Control */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-[#050507] border border-white/[0.08] mb-6">
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
                      className={`relative py-2 text-xs font-semibold rounded-lg transition-colors z-10 ${
                        active
                          ? "text-white"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="auth-mode-pill"
                          transition={{
                            type: "spring",
                            stiffness: 480,
                            damping: 34,
                          }}
                          className="absolute inset-0 rounded-lg bg-[#181822] border border-white/[0.12] shadow-sm -z-10"
                        />
                      )}
                      {mode === "login" ? "Masuk Sesi" : "Daftar Akun"}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.form
                  key={authMode}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-white tracking-tight">
                      {authMode === "login"
                        ? "Masuk ke Workspace"
                        : "Buat Akun Developer"}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      {authMode === "login"
                        ? "Gunakan akun Anda untuk mengakses dashboard & IDE."
                        : "Profil Anda akan disinkronkan ke koleksi users Firestore."}
                    </p>
                  </div>

                  {authMode === "register" && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-zinc-300">
                        Nama Tampilan
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="MainZ Architect"
                          className="voam-input pl-10"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-zinc-300">
                      Alamat Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@domain.com"
                        className="voam-input pl-10 font-mono text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-zinc-300">
                      Kata Sandi
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="voam-input pl-10 font-mono text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300"
                    >
                      {errorMsg}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="voam-btn-primary w-full py-2.5 mt-1"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {authMode === "login"
                            ? "Masuk ke Dashboard"
                            : "Buat Akun & Lanjutkan"}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </motion.form>
              </AnimatePresence>

              <div className="mt-5 pt-5 border-t border-white/[0.06] space-y-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleQuickDemoAccess}
                  className="voam-btn-secondary w-full justify-center py-2.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Akses Cepat (Sesi Architect)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
