"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FolderGit2,
  Code2,
  ExternalLink,
  Trash2,
  KeyRound,
  LogOut,
  FileArchive,
  CheckCircle2,
  Layers,
  Clock,
  Wand2,
  FileWarning,
  ArrowUpRight,
  Database,
  Shield,
  Globe,
  ShieldCheck,
} from "lucide-react";
import AnimatedLogo from "@/components/animations/AnimatedLogo";
import { withAuthGuard } from "@/components/auth/withAuthGuard";
import { useVoam } from "@/context/VoamContext";
import {
  createProjectDocument,
  listUserProjects,
  deleteProjectDocument,
} from "@/lib/firebase";
import {
  extractFilesFromDrop,
  deployToVercelEngine,
  createStarterProjectFiles,
} from "@/lib/vercel-deploy";
import type { VirtualFileSystem, VoamProject } from "@/types/voam";

function DashboardContent() {
  const router = useRouter();
  const {
    user,
    isOwner,
    systemConfig,
    logoutUser,
    vercelToken,
    setVercelToken,
    setIslandStatus,
    resetIsland,
  } = useVoam();

  const [projects, setProjects] = useState<VoamProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [customProjectName, setCustomProjectName] = useState<string>("");
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [showTokenModal, setShowTokenModal] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>(vercelToken);

  useEffect(() => {
    setTokenInput(vercelToken);
  }, [vercelToken]);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setLoadingProjects(true);
    try {
      const list = await listUserProjects(user.uid);
      setProjects(list);
    } finally {
      setLoadingProjects(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const effectiveQuota = isOwner
    ? 9999
    : user?.customMaxProjects || systemConfig.maxProjectsPerUser;

  const executeFullDeployPipeline = useCallback(
    async (rawProjectName: string, initialFs: VirtualFileSystem) => {
      if (!user) return;
      setIsDeploying(true);

      try {
        setIslandStatus("uploading", `Mengunggah ${rawProjectName}...`, {
          subtitle: "Inspeksi WAF & merakit payload JSON Vercel v13",
          progress: 28,
        });

        await new Promise((resolve) => setTimeout(resolve, 420));

        const {
          response,
          finalFileSystem,
          hasAutoFallbackIndex,
          slug,
        } = await deployToVercelEngine({
          projectName: rawProjectName,
          fileSystem: initialFs,
          vercelToken,
          onStageChange: (stage, progress, subtitle) => {
            if (stage === "uploading") {
              setIslandStatus("uploading", `Mengunggah ${rawProjectName}...`, {
                subtitle,
                progress,
              });
            } else {
              setIslandStatus("building", "Vercel Edge Building...", {
                subtitle,
              });
            }
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 600));

        const savedProject = await createProjectDocument({
          uid: user.uid,
          ownerEmail: user.email,
          name: rawProjectName,
          slug,
          deploymentId: response.deploymentId,
          deploymentUrl: response.deploymentUrl,
          status: "deployed",
          hasAutoFallbackIndex,
          fileSystem: finalFileSystem,
        });

        setProjects((prev) => [savedProject, ...prev]);
        setCustomProjectName("");

        setIslandStatus("deployed", `Deployed: ${savedProject.name}`, {
          deploymentUrl: savedProject.deploymentUrl,
          autoResetMs: 8000,
        });
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Terjadi kegagalan saat mendeploy ke Vercel API v13.";
        setIslandStatus("error", "Deployment Ditolak / Gagal", {
          errorMessage: msg,
          autoResetMs: 6500,
        });
      } finally {
        setIsDeploying(false);
      }
    },
    [user, vercelToken, setIslandStatus]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles || acceptedFiles.length === 0 || isDeploying) return;

      try {
        setIslandStatus("uploading", "Mengekstrak Berkas Klien...", {
          subtitle: "Membaca struktur arsip dengan JSZip di memori",
          progress: 18,
        });

        const { fileSystem, suggestedName } =
          await extractFilesFromDrop(acceptedFiles);
        const finalName = customProjectName.trim() || suggestedName;

        await executeFullDeployPipeline(finalName, fileSystem);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Gagal mengekstrak arsip atau berkas yang dijatuhkan.";
        setIslandStatus("error", "Ekstraksi Gagal", {
          errorMessage: msg,
          autoResetMs: 6000,
        });
      }
    },
    [customProjectName, isDeploying, executeFullDeployPipeline, setIslandStatus]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isDeploying,
  });

  const handleCreateStarterProject = async () => {
    if (isDeploying) return;
    const title =
      customProjectName.trim() || `voam-starter-${projects.length + 1}`;
    const starterFs = createStarterProjectFiles(title);
    await executeFullDeployPipeline(title, starterFs);
  };

  const handleCreateFallbackTestProject = async () => {
    if (isDeploying) return;
    const title =
      customProjectName.trim() || `voam-fallback-${projects.length + 1}`;
    const bundleWithoutIndex: VirtualFileSystem = {
      "/css/neon.css": `/* Stylesheet Tanpa index.html Asli */\nbody {\n  border-top: 3px solid #38bdf8;\n}\n`,
      "/js/runtime.js": `console.log("Auto-Fallback index.html berhasil memanggil /js/runtime.js!");\n`,
    };
    await executeFullDeployPipeline(title, bundleWithoutIndex);
  };

  const handleDeleteProject = async (project: VoamProject) => {
    await deleteProjectDocument(project.id);
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
    resetIsland();
  };

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100 flex flex-col">
      {/* Top Sticky Navbar Bergaya Vercel / Linear */}
      <header className="sticky top-0 z-30 h-14 border-b border-white/[0.07] bg-[#050507]/85 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <AnimatedLogo size="sm" />
          <span className="text-zinc-700 select-none">/</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-zinc-200 truncate">
              {user?.displayName || "developer"}
            </span>
            {isOwner ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                <Shield className="w-3 h-3 text-amber-400" />
                OWNER
              </span>
            ) : (
              <span className="hidden md:inline-block text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
                {user?.email}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              type="button"
              onClick={() => router.push("/owner")}
              className="voam-btn-primary py-1.5 px-3 text-xs"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Owner Command Center</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowTokenModal((prev) => !prev)}
            className="voam-btn-secondary"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                vercelToken ? "bg-emerald-400" : "bg-zinc-500"
              }`}
            />
            <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">
              {vercelToken ? "Token Vercel Aktif" : "Token Vercel API"}
            </span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await logoutUser();
              router.replace("/");
            }}
            className="voam-btn-secondary hover:border-rose-500/40 hover:text-rose-300"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* Global Announcement Banner (Jika Diaktifkan oleh Owner) */}
      {systemConfig.globalAnnouncement && (
        <div className="border-b border-white/[0.07] bg-white/[0.03] px-4 py-2 text-center text-xs text-zinc-200 font-mono">
          <span className="text-sky-400 font-semibold mr-2">
            [BROADCAST OWNER]
          </span>
          {systemConfig.globalAnnouncement}
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Banner Eksklusif Otoritas Supreme Owner */}
        {isOwner && (
          <div className="voam-glass rounded-2xl p-4 sm:px-6 border-amber-500/30 bg-amber-500/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                  <span>Sesi Otoritas Supreme Owner Aktif</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    GOD MODE
                  </span>
                </h2>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Anda memiliki kendali penuh atas seluruh pengguna, kuota
                  database, inspeksi proyek global, dan perisai WAF Anti-SQLi.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/owner")}
              className="voam-btn-primary shrink-0"
            >
              <Shield className="w-4 h-4" />
              <span>Buka Owner Command Center</span>
            </button>
          </div>
        )}

        {/* Drawer Konfigurasi Token Vercel */}
        <AnimatePresence initial={false}>
          {showTokenModal && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="voam-glass rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-zinc-300" />
                      Konfigurasi Bearer Token Vercel REST API v13
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Opsional jika Anda sudah mengatur variabel{" "}
                      <code className="text-zinc-200 font-mono">
                        VOAM_VERCEL_TOKEN
                      </code>{" "}
                      di dashboard Environment Variables Vercel.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Tempelkan Personal Access Token Vercel..."
                    className="voam-input font-mono flex-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setVercelToken(tokenInput);
                      setShowTokenModal(false);
                      setIslandStatus(
                        "deployed",
                        tokenInput.trim()
                          ? "Token Vercel Tersimpan"
                          : "Menggunakan Token Server",
                        { autoResetMs: 2500 }
                      );
                    }}
                    className="voam-btn-primary shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan Token</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Baris Header & Ringkasan Telemetri */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.06] pb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              Deployment &amp; Cloud IDE Studio
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Unggah bundel proyek statis untuk di-deploy ke Vercel v13 atau
              buka proyek di dalam Monaco Editor.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg bg-[#0B0B0F] border border-white/[0.07] flex items-center gap-2 text-zinc-300">
              <Globe className="w-3.5 h-3.5 text-zinc-400" />
              <span>
                Kuota: {projects.length} / {isOwner ? "∞" : effectiveQuota}{" "}
                Proyek
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#0B0B0F] border border-white/[0.07] flex items-center gap-2 text-zinc-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>WAF Anti-SQLi</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#0B0B0F] border border-white/[0.07] flex items-center gap-2 text-zinc-300">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Firestore Live</span>
            </div>
          </div>
        </div>

        {/* Seksi Utama: Dropzone & Launchpad (12 Kolom Presisi) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Kolom Kiri (8 cols): Dropzone Klien */}
          <div className="lg:col-span-8 flex flex-col">
            <div className="voam-glass rounded-2xl overflow-hidden flex-1 flex flex-col">
              <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.01] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <UploadCloud className="w-4 h-4 text-zinc-300" />
                  <span className="text-xs font-semibold text-zinc-100">
                    Deploy Bundel Web atau Arsip .ZIP
                  </span>
                </div>

                <div className="w-full sm:w-60">
                  <input
                    type="text"
                    maxLength={80}
                    value={customProjectName}
                    onChange={(e) => setCustomProjectName(e.target.value)}
                    placeholder="Nama proyek (opsional)..."
                    className="w-full px-3 py-1.5 rounded-lg bg-[#050507] border border-white/[0.08] focus:border-white/[0.25] focus:outline-none text-xs font-mono text-zinc-100 placeholder-zinc-500"
                  />
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <div
                  {...getRootProps()}
                  className={`relative flex-1 rounded-xl border border-dashed p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[210px] ${
                    isDragActive
                      ? "border-white/40 bg-white/[0.04]"
                      : "border-white/[0.12] hover:border-white/[0.24] bg-[#060609]/90 hover:bg-[#08080C]"
                  } ${isDeploying ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <input {...getInputProps()} />

                  <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.09] flex items-center justify-center mb-3.5 text-zinc-200">
                    {isDragActive ? (
                      <FileArchive className="w-5 h-5" />
                    ) : (
                      <UploadCloud className="w-5 h-5" />
                    )}
                  </div>

                  <p className="text-sm font-medium text-zinc-100">
                    {isDragActive
                      ? "Lepaskan berkas untuk mengekstrak & mendeploy..."
                      : "Tarik & lepaskan arsip .ZIP atau pilih berkas web (.html, .css, .js)"}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1.5 max-w-md leading-relaxed">
                    Diekstrak langsung di memori klien menggunakan{" "}
                    <code className="text-zinc-200 font-mono">JSZip</code>.
                    Apabila berkas{" "}
                    <code className="text-zinc-200 font-mono">index.html</code>{" "}
                    tidak ditemukan, sistem otomatis menyintesis halaman induk
                    pemanggil aset.
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
                    {[".zip", ".html", ".css", ".js", ".ts", ".json", ".svg"].map(
                      (ext) => (
                        <span
                          key={ext}
                          className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-[10px] font-mono text-zinc-400"
                        >
                          {ext}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan (4 cols): Template Instan & Uji Auto-Fallback */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="voam-glass rounded-2xl overflow-hidden flex-1 flex flex-col justify-between">
              <div>
                <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100">
                    Quick Launchpad
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    Instant Template
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Belum menyiapkan arsip{" "}
                    <code className="text-zinc-200 font-mono">.zip</code>?
                    Bangkitkan proyek multi-file di bawah ini untuk langsung
                    menguji <strong className="text-zinc-200">Monaco Editor</strong>{" "}
                    dan <strong className="text-zinc-200">Re-deploy Vercel v13</strong>.
                  </p>

                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      disabled={isDeploying}
                      onClick={handleCreateStarterProject}
                      className="voam-btn-primary w-full justify-between px-4 py-2.5"
                    >
                      <span className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4" />
                        <span>Deploy Starter Web App</span>
                      </span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      disabled={isDeploying}
                      onClick={handleCreateFallbackTestProject}
                      className="voam-btn-secondary w-full justify-between px-3.5 py-2.5 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <FileWarning className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Uji Bundel Tanpa index.html</span>
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        Fallback
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-white/[0.06] bg-[#07070A] flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span>
                  Maks {systemConfig.maxFilesPerProject} file •{" "}
                  {systemConfig.maxProjectSizeKb} KB
                </span>
                <span className="text-emerald-400">● Protected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Seksi Bawah: Daftar Proyek Workspace */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FolderGit2 className="w-4 h-4 text-zinc-300" />
              <h2 className="text-sm font-semibold text-white">
                Daftar Proyek Workspace
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.07] text-zinc-300">
                {projects.length}
              </span>
            </div>
          </div>

          {loadingProjects ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="voam-glass rounded-2xl p-5 h-44 animate-pulse flex flex-col justify-between"
                >
                  <div className="h-4 w-1/2 bg-white/[0.06] rounded" />
                  <div className="h-10 w-full bg-white/[0.04] rounded-xl" />
                  <div className="h-9 w-full bg-white/[0.06] rounded-xl" />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="voam-glass rounded-2xl p-10 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-300">
                <Code2 className="w-5 h-5" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Belum Ada Proyek di Workspace
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Jatuhkan berkas{" "}
                  <code className="text-zinc-200 font-mono">.zip</code> pada
                  kotak di atas atau klik tombol{" "}
                  <strong className="text-zinc-200">
                    Deploy Starter Web App
                  </strong>{" "}
                  untuk membuat proyek pertama Anda.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((proj) => {
                const isQuarantined = proj.status === "quarantined";
                return (
                  <div
                    key={proj.id}
                    className="voam-glass-interactive rounded-2xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white truncate">
                            {proj.name}
                          </h3>
                          <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">
                            {proj.deploymentId}
                          </p>
                        </div>
                        {isQuarantined ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Quarantined
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Ready
                          </span>
                        )}
                      </div>

                      <a
                        href={proj.deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#060609] border border-white/[0.07] hover:border-white/[0.2] text-xs font-mono text-zinc-300 hover:text-white transition-colors"
                      >
                        <span className="truncate">
                          {proj.deploymentUrl.replace(/^https?:\/\//, "")}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      </a>

                      <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
                          <Layers className="w-3 h-3 text-zinc-400" />
                          {Object.keys(proj.fileSystem || {}).length ||
                            proj.fileCount}{" "}
                          file
                        </span>

                        {proj.hasAutoFallbackIndex && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Auto index.html
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 ml-auto text-[10px] text-zinc-500">
                          <Clock className="w-3 h-3" />
                          {new Date(proj.updatedAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => router.push(`/project/${proj.id}`)}
                        className="voam-btn-primary flex-1 py-2 text-xs"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Buka di Monaco IDE</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProject(proj)}
                        title="Hapus Proyek"
                        className="p-2 rounded-xl bg-white/[0.03] hover:bg-rose-500/15 text-zinc-400 hover:text-rose-400 border border-white/[0.07] hover:border-rose-500/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default withAuthGuard(DashboardContent);
