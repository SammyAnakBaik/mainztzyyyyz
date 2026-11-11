"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import AnimatedLogo from "@/components/animations/AnimatedLogo";
import { useVoam } from "@/context/VoamContext";
import { isLiveFirebaseConfigured } from "@/lib/firebase";
import { isOwnerEmail } from "@/lib/security-shield";

export default function AuthGatewayPage() {
  const router = useRouter();
  const {
    user,
    isOwner,
    loadingAuth,
    systemConfig,
    loginWithEmail,
    registerWithEmail,
    setIslandStatus,
  } = useVoam();

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [honeypot, setHoneypot] = useState<string>("");

  // Tantangan Verifikasi Anti-Bot untuk tab Registrasi
  const [challengeA, setChallengeA] = useState<number>(7);
  const [challengeB, setChallengeB] = useState<number>(5);
  const [challengeInput, setChallengeInput] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const generateNewChallenge = useCallback(() => {
    const a = Math.floor(Math.random() * 9) + 3;
    const b = Math.floor(Math.random() * 8) + 2;
    setChallengeA(a);
    setChallengeB(b);
    setChallengeInput("");
  }, []);

  useEffect(() => {
    generateNewChallenge();
  }, [generateNewChallenge]);

  useEffect(() => {
    if (!loadingAuth && user) {
      if (isOwner) {
        router.replace("/owner");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [user, isOwner, loadingAuth, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (
      authMode === "register" &&
      systemConfig.requireHumanChallengeOnRegister
    ) {
      const expected = challengeA + challengeB;
      if (parseInt(challengeInput.trim(), 10) !== expected) {
        setErrorMsg(
          "Verifikasi Keamanan Anti-Bot tidak sesuai. Hitung kembali penjumlahan di bawah."
        );
        generateNewChallenge();
        return;
      }
    }

    setSubmitting(true);

    try {
      if (authMode === "login") {
        setIslandStatus("uploading", "Memverifikasi Kredensial & WAF...", {
          subtitle: "Inspeksi Anti-SQLi & Sinkronisasi Firebase Auth",
          progress: 65,
        });
        await loginWithEmail(email, password);
        if (isOwnerEmail(email)) {
          setIslandStatus("deployed", "Otoritas Supreme Owner Aktif", {
            subtitle: "Membuka Owner Command Center",
            autoResetMs: 2800,
          });
          router.push("/owner");
          return;
        }
        setIslandStatus("deployed", "Sesi Developer Aktif", {
          subtitle: "Mengalihkan ke Ruang Kerja MainZ Voam",
          autoResetMs: 2800,
        });
      } else {
        setIslandStatus("uploading", "Memeriksa Kuota & Mendaftarkan Akun...", {
          subtitle: "Proteksi Anti-Spam & Sinkronisasi koleksi users",
          progress: 70,
        });
        await registerWithEmail(email, password, displayName, honeypot);
        setIslandStatus("deployed", "Akun Berhasil Dibuat", {
          subtitle: "Profil tersimpan aman di koleksi users",
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
      if (authMode === "register") {
        generateNewChallenge();
      }
      setIslandStatus("error", "Proteksi Keamanan / Auth", {
        errorMessage: msg,
        autoResetMs: 4800,
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
      {/* Subtle Architectural Micro-Grid */}
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
            v13.5 WAF
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/[0.07] border border-emerald-500/20 text-emerald-300 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Anti-SQLi &amp; Anti-Spam Shield</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="hidden sm:inline">
              {isLiveFirebaseConfigured()
                ? "Firestore Cloud • asia-southeast1"
                : "Hybrid Cloud Engine"}
            </span>
          </div>
        </div>
      </header>

      {/* Global Announcement Banner (Jika Diaktifkan oleh Owner) */}
      {systemConfig.globalAnnouncement && (
        <div className="relative z-10 border-b border-white/[0.07] bg-white/[0.03] px-4 py-2 text-center text-xs text-zinc-200 font-mono">
          <span className="text-sky-400 font-semibold mr-2">[BROADCAST OWNER]</span>
          {systemConfig.globalAnnouncement}
        </div>
      )}

      {/* Main Content Split */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Kolom Kiri: Value Proposition & Architectural Specs */}
          <div className="lg:col-span-7 space-y-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-zinc-300 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>Cloud Deployment • Monaco IDE • WAF Protected</span>
            </div>

            <div className="space-y-3">
              <AnimatedLogo size="lg" />
              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-xl">
                Platform deployment terpadu dan lingkungan pengembangan berbasis
                web. Ekstrak arsip{" "}
                <code className="text-zinc-200 font-mono">.zip</code> di memori
                klien, publikasikan ke jaringan global Vercel REST API v13, dan
                kelola kode produksi secara langsung melalui Monaco Editor.
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
                    Mendeteksi keberadaan{" "}
                    <code className="text-zinc-200 font-mono">/index.html</code>{" "}
                    dan merakit berkas induk pemanggil aset secara otomatis di
                    memori sebelum pengiriman payload.
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
                    pratinjau langsung (
                    <span className="text-zinc-200">split live preview</span>),
                    dan deteksi bahasa otomatis.
                  </p>
                </div>
              </div>

              <div className="py-4 flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-100 tracking-wide">
                    Multi-Layer WAF: Anti-SQLi, Anti-NoSQLi &amp; DB Quota Guard
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Inspeksi mendalam terhadap pola injeksi kueri, pembatasan
                    laju pembuatan akun (anti-spam), serta perlindungan kuota
                    dokumen Firestore secara real-time.
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
                        ? "Gunakan kredensial Developer atau Supreme Owner Anda."
                        : "Dilindungi oleh WAF Anti-Spam & Kuota Database Firestore."}
                    </p>
                  </div>

                  {/* Peringatan jika Registrasi Publik Dikunci oleh Owner */}
                  {authMode === "register" &&
                    !systemConfig.registrationEnabled && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 flex items-start gap-2.5">
                        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          Pendaftaran akun publik sedang dikunci sementara oleh
                          Owner untuk menjaga kuota database.
                        </span>
                      </div>
                    )}

                  {/* Hidden Honeypot Input untuk menjebak bot spam otomatis */}
                  <div
                    className="hidden"
                    aria-hidden="true"
                    style={{ display: "none" }}
                  >
                    <label>
                      Jangan isi kolom ini
                      <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                      />
                    </label>
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
                          maxLength={60}
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
                        maxLength={100}
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
                        maxLength={100}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="voam-input pl-10 font-mono text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* Tantangan Keamanan Anti-Bot (Aktif saat Registrasi) */}
                  {authMode === "register" &&
                    systemConfig.requireHumanChallengeOnRegister && (
                      <div className="p-3 rounded-xl bg-[#050507] border border-white/[0.08] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-zinc-300 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            Verifikasi Anti-Bot: Berapa{" "}
                            <strong className="text-white">
                              {challengeA} + {challengeB}
                            </strong>{" "}
                            ?
                          </span>
                          <button
                            type="button"
                            onClick={generateNewChallenge}
                            title="Acak ulang tantangan"
                            className="text-zinc-400 hover:text-white transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="number"
                          required
                          value={challengeInput}
                          onChange={(e) => setChallengeInput(e.target.value)}
                          placeholder="Ketik hasil penjumlahan..."
                          className="voam-input py-1.5 text-xs font-mono"
                        />
                      </div>
                    )}

                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 leading-relaxed"
                    >
                      {errorMsg}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      (authMode === "register" &&
                        !systemConfig.registrationEnabled)
                    }
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
                            ? "Masuk ke Workspace"
                            : "Buat Akun & Lanjutkan"}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </motion.form>
              </AnimatePresence>

              <div className="mt-5 pt-5 border-t border-white/[0.06] space-y-2.5">
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
