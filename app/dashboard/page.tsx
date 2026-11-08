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
  Sparkles,
  KeyRound,
  LogOut,
  FileArchive,
  CheckCircle2,
  Layers,
  Clock,
  Wand2,
  FileWarning,
  Plus,
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
    logoutUser,
    vercelToken,
    setVercelToken,
    setIslandStatus,
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

  /**
   * Pipeline Utama: Deploy VirtualFileSystem ke Vercel API v13 + Simpan ke Firestore `projects`
   */
  const executeFullDeployPipeline = useCallback(
    async (rawProjectName: string, initialFs: VirtualFileSystem) => {
      if (!user) return;
      setIsDeploying(true);

      try {
        setIslandStatus("uploading", `Mengunggah ${rawProjectName}...`, {
          subtitle: "Mengekstrak aset & merakit payload JSON Vercel v13",
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

        // Beri waktu transisi visual kapsul `building` sebelum `deployed`
        await new Promise((resolve) => setTimeout(resolve, 650));

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
          autoResetMs: 9000,
        });
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Terjadi kegagalan saat mendeploy ke Vercel API v13.";
        setIslandStatus("error", "Deployment Gagal", {
          errorMessage: msg,
          autoResetMs: 7000,
        });
      } finally {
        setIsDeploying(false);
      }
    },
    [user, vercelToken, setIslandStatus]
  );

  // Konfigurasi React-Dropzone
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

  // Handler Deploy Template Starter Lengkap (HTML + CSS + JS)
  const handleCreateStarterProject = async () => {
    if (isDeploying) return;
    const title =
      customProjectName.trim() ||
      `MainZ Quantum UI ${projects.length + 1}`;
    const starterFs = createStarterProjectFiles(title);
    await executeFullDeployPipeline(title, starterFs);
  };

  // Handler Uji Coba Auto-Fallback (Bundel Tanpa index.html -> memicu mesin fallback)
  const handleCreateFallbackTestProject = async () => {
    if (isDeploying) return;
    const title =
      customProjectName.trim() ||
      `Voam Asset Bundle ${projects.length + 1}`;
    const bundleWithoutIndex: VirtualFileSystem = {
      "/css/neon.css": `/* Stylesheet Tanpa index.html Asli */\nbody {\n  border-top: 3px solid #00f0ff;\n}\n`,
      "/js/runtime.js": `console.log("Auto-Fallback index.html berhasil memanggil /js/runtime.js!");\n`,
    };
    await executeFullDeployPipeline(title, bundleWithoutIndex);
  };

  const handleDeleteProject = async (project: VoamProject) => {
    await deleteProjectDocument(project.id);
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
    setIslandStatus("idle", `Proyek "${project.name}" dihapus`);
  };

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-10 max-w-7xl mx-auto">
      {/* Header Navigasi Dashboard */}
      <header className="voam-glass rounded-3xl px-6 py-4 mb-8 flex flex-wrap items-center justify-between gap-4 shadow-island">
        <div className="flex items-center gap-4">
          <AnimatedLogo size="sm" />
          <div className="hidden sm:block h-6 w-px bg-voam-border" />
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-white">
              {user?.displayName}
            </p>
            <p className="text-[11px] font-mono text-voam-muted">
              {user?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowTokenModal((prev) => !prev)}
            className="voam-btn-secondary"
          >
            <KeyRound className="w-3.5 h-3.5 text-voam-neon" />
            <span>
              {vercelToken
                ? "Token Vercel Aktif"
                : "Set Token Vercel API"}
            </span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await logoutUser();
              router.replace("/");
            }}
            className="voam-btn-secondary hover:border-voam-crimson/50 hover:text-voam-crimson"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* Panel Konfigurasi Token Vercel REST API v13 */}
      <AnimatePresence initial={false}>
        {showTokenModal && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="overflow-hidden mb-8"
          >
            <div className="voam-glass rounded-3xl p-6 border-voam-neon/40 shadow-neon-cyan space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-voam-neon" />
                    Konfigurasi Bearer Token Vercel REST API v13
                  </h3>
                  <p className="text-xs text-voam-muted mt-1">
                    Masukkan Personal Access Token Vercel Anda untuk mendeploy ke
                    akun Vercel produksi secara langsung, atau kosongkan jika
                    menggunakan variabel server <code className="text-voam-neon">VERCEL_TOKEN</code> di <code className="text-voam-neon">.env.local</code>.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Masukkan Vercel Token (contoh: vcp_...)"
                  className="voam-input font-mono flex-1"
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
                        : "Mode Server / Simulator Aktif",
                      { autoResetMs: 3000 }
                    );
                  }}
                  className="voam-btn-primary shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Konfigurasi</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seksi Atas: Dropzone & Generator Proyek */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
        {/* Dropzone Klien (JSZip & Multi-File) */}
        <div className="lg:col-span-8">
          <div className="voam-glass rounded-3xl p-6 sm:p-8 h-full flex flex-col justify-between space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-voam-neon">
                  <Sparkles className="w-3.5 h-3.5" />
                  Vercel v13 Payload Engine
                </span>
                <h1 className="text-2xl font-bold text-white mt-1">
                  Deploy Bundel Web atau Arsip ZIP
                </h1>
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  value={customProjectName}
                  onChange={(e) => setCustomProjectName(e.target.value)}
                  placeholder="Nama Proyek (Opsional)"
                  className="voam-input py-2 text-xs font-mono"
                />
              </div>
            </div>

            {/* Area Drag & Drop */}
            <div
              {...getRootProps()}
              className={`relative rounded-3xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[230px] ${
                isDragActive
                  ? "border-voam-neon bg-voam-neon/10 shadow-neon-cyan scale-[1.01]"
                  : "border-voam-border hover:border-voam-neon/50 bg-voam-bg/60 hover:bg-voam-bg/90"
              } ${isDeploying ? "opacity-60 pointer-events-none" : ""}`}
            >
              <input {...getInputProps()} />

              <motion.div
                animate={{
                  y: isDragActive ? -6 : [0, -4, 0],
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-voam-neon/20 to-voam-violet/20 border border-voam-neon/40 flex items-center justify-center mb-4 shadow-neon-cyan"
              >
                {isDragActive ? (
                  <FileArchive className="w-8 h-8 text-voam-neon" />
                ) : (
                  <UploadCloud className="w-8 h-8 text-voam-neon" />
                )}
              </motion.div>

              <p className="text-base font-bold text-white">
                {isDragActive
                  ? "Lepaskan Berkas untuk Mengekstrak & Mendeploy ke Vercel..."
                  : "Tarik & Lepaskan File .ZIP atau Kumpulan Berkas Web (.html, .css, .js)"}
              </p>
              <p className="text-xs text-voam-muted mt-2 max-w-md">
                Ekstraksi dilakukan 100% di memori klien via{" "}
                <span className="text-voam-neon font-mono">JSZip</span>. Jika tidak
                ditemukan <span className="text-voam-neon font-mono">index.html</span>,
                mesin fallback otomatis merakit halaman pemanggil aset sebelum
                dikirim ke Vercel API v13.
              </p>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Quick Launchpad & Uji Fallback */}
        <div className="lg:col-span-4">
          <div className="voam-glass rounded-3xl p-6 sm:p-7 h-full flex flex-col justify-between space-y-5">
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-voam-violet">
                Instant Cloud Launchpad
              </span>
              <h2 className="text-xl font-bold text-white">
                Belum Menyiapkan File ZIP?
              </h2>
              <p className="text-xs text-voam-muted leading-relaxed">
                Buat proyek multi-file secara instan untuk langsung menguji{" "}
                <strong className="text-white">In-Browser File Manager</strong>,{" "}
                <strong className="text-white">Monaco Editor</strong>, dan fitur{" "}
                <strong className="text-white">Re-deploy Vercel v13</strong>.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                disabled={isDeploying}
                onClick={handleCreateStarterProject}
                className="voam-btn-primary w-full justify-between px-5 py-3.5"
              >
                <span className="flex items-center gap-2.5">
                  <Wand2 className="w-4 h-4" />
                  <span>Buat &amp; Deploy Starter App</span>
                </span>
                <Plus className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={isDeploying}
                onClick={handleCreateFallbackTestProject}
                className="voam-btn-secondary w-full justify-between px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2.5">
                  <FileWarning className="w-4 h-4 text-voam-amber shrink-0" />
                  <span>
                    Uji Bundel Tanpa <code className="text-voam-neon">index.html</code> (Auto-Fallback)
                  </span>
                </span>
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-voam-bg/80 border border-voam-border text-[11px] text-voam-muted space-y-1 font-mono">
              <div className="flex items-center justify-between">
                <span>Koleksi Firestore:</span>
                <span className="text-voam-neon">projects/{`{id}`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Payload Target:</span>
                <span className="text-voam-emerald">Vercel API v13</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seksi Bawah: Daftar Proyek Tersimpan di Firestore */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <FolderGit2 className="w-5 h-5 text-voam-neon" />
              <span>Workspace Proyek Anda</span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-voam-neon/10 text-voam-neon border border-voam-neon/30">
                {projects.length}
              </span>
            </h2>
            <p className="text-xs text-voam-muted mt-0.5">
              Klik &ldquo;Buka di Monaco IDE&rdquo; untuk mengedit kode, menambah file baru, dan melakukan Re-deploy.
            </p>
          </div>
        </div>

        {loadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="voam-glass rounded-3xl p-6 h-52 animate-pulse flex flex-col justify-between"
              >
                <div className="h-5 w-1/2 bg-white/10 rounded-lg" />
                <div className="h-16 w-full bg-white/5 rounded-2xl" />
                <div className="h-9 w-full bg-white/10 rounded-xl" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="voam-glass rounded-3xl p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-voam-neon/10 border border-voam-neon/30 flex items-center justify-center mx-auto text-voam-neon">
              <Code2 className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-base font-bold text-white">
                Belum Ada Proyek yang Di-deploy
              </h3>
              <p className="text-xs text-voam-muted mt-1 leading-relaxed">
                Unggah file ZIP pada Dropzone di atas atau tekan tombol{" "}
                <strong className="text-voam-neon">Buat &amp; Deploy Starter App</strong>{" "}
                untuk memulai proyek pertama Anda.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((proj, index) => (
              <motion.div
                key={proj.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 28,
                  delay: index * 0.04,
                }}
                className="voam-glass-interactive rounded-3xl p-6 flex flex-col justify-between gap-5 group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white truncate group-hover:text-voam-neon transition-colors">
                        {proj.name}
                      </h3>
                      <p className="text-[11px] font-mono text-voam-muted truncate">
                        ID: {proj.deploymentId}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-voam-emerald/15 text-voam-emerald border border-voam-emerald/40 shrink-0">
                      {proj.status}
                    </span>
                  </div>

                  {/* URL Deployment Live */}
                  <a
                    href={proj.deploymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-voam-bg/80 border border-voam-border hover:border-voam-neon/50 text-xs font-mono text-voam-neon transition-colors"
                  >
                    <span className="truncate">{proj.deploymentUrl}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  {/* Metadata FileSystem */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-voam-muted">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5">
                      <Layers className="w-3 h-3 text-voam-neon" />
                      {Object.keys(proj.fileSystem || {}).length || proj.fileCount}{" "}
                      file
                    </span>

                    {proj.hasAutoFallbackIndex && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-voam-amber/15 text-voam-amber border border-voam-amber/30">
                        Auto index.html
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 ml-auto text-[10px]">
                      <Clock className="w-3 h-3" />
                      {new Date(proj.updatedAt).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Tombol Aksi Buka di IDE & Hapus */}
                <div className="flex items-center gap-2 pt-2 border-t border-voam-border/60">
                  <button
                    type="button"
                    onClick={() => router.push(`/project/${proj.id}`)}
                    className="voam-btn-primary flex-1 py-2.5 text-xs"
                  >
                    <Code2 className="w-4 h-4" />
                    <span>Buka di Monaco IDE</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteProject(proj)}
                    title="Hapus Proyek"
                    className="p-2.5 rounded-2xl bg-white/[0.04] hover:bg-voam-crimson/20 text-voam-muted hover:text-voam-crimson border border-white/10 hover:border-voam-crimson/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default withAuthGuard(DashboardContent);
