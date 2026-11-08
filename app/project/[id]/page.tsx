"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Rocket,
  ExternalLink,
  CheckCircle2,
  Loader2,
  FolderCode,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import AnimatedLogo from "@/components/animations/AnimatedLogo";
import { withAuthGuard } from "@/components/auth/withAuthGuard";
import FileTree from "@/components/ide/FileTree";
import CodeEditor from "@/components/ide/CodeEditor";
import { useVoam } from "@/context/VoamContext";
import {
  getProjectById,
  normalizeFilePath,
  syncProjectFileSystemAndDeploy,
} from "@/lib/firebase";
import { deployToVercelEngine } from "@/lib/vercel-deploy";
import type { VirtualFileSystem, VoamProject } from "@/types/voam";

function ProjectIdePageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id || "";

  const { vercelToken, setIslandStatus } = useVoam();

  const [project, setProject] = useState<VoamProject | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFoundError, setNotFoundError] = useState<string>("");

  // State lokal `fileSystem` yang terikat langsung dengan Sidebar FileTree & Monaco Editor
  const [localFileSystem, setLocalFileSystem] = useState<VirtualFileSystem>({});
  const [savedFileSystem, setSavedFileSystem] = useState<VirtualFileSystem>({});
  const [activeFilePath, setActiveFilePath] = useState<string>("/index.html");
  const [isRedeploying, setIsRedeploying] = useState<boolean>(false);

  // Tarik dokumen proyek & `fileSystem` dari Firestore saat halaman dimuat
  useEffect(() => {
    let mounted = true;

    async function loadProjectFromFirestore() {
      if (!projectId) return;
      setLoading(true);
      setNotFoundError("");

      try {
        const fetched = await getProjectById(projectId);
        if (!mounted) return;

        if (!fetched) {
          setNotFoundError(
            "Dokumen proyek tidak ditemukan di koleksi Firestore projects."
          );
          return;
        }

        setProject(fetched);
        setLocalFileSystem(fetched.fileSystem);
        setSavedFileSystem(fetched.fileSystem);

        const paths = Object.keys(fetched.fileSystem).sort();
        const defaultFile =
          paths.find((p) => p.toLowerCase() === "/index.html") ||
          paths[0] ||
          "/index.html";
        setActiveFilePath(defaultFile);
      } catch (err) {
        if (!mounted) return;
        setNotFoundError(
          err instanceof Error
            ? err.message
            : "Gagal menarik data fileSystem dari Firestore."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProjectFromFirestore();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  // Hitung daftar file yang mengalami perubahan dibanding snapshot Firestore terakhir
  const modifiedPaths = useMemo(() => {
    const allKeys = new Set([
      ...Object.keys(localFileSystem),
      ...Object.keys(savedFileSystem),
    ]);
    const changed: string[] = [];
    allKeys.forEach((key) => {
      if (localFileSystem[key] !== savedFileSystem[key]) {
        changed.push(key);
      }
    });
    return changed;
  }, [localFileSystem, savedFileSystem]);

  // Handler saat kode di Monaco Editor diubah
  const handleCodeChange = useCallback(
    (filePath: string, nextContent: string) => {
      setLocalFileSystem((prev) => ({
        ...prev,
        [filePath]: nextContent,
      }));
    },
    []
  );

  // Handler tambah file baru dari Sidebar FileTree
  const handleCreateNewFile = useCallback(
    (rawPath: string, initialContent = "") => {
      const normalized = normalizeFilePath(rawPath);
      setLocalFileSystem((prev) => ({
        ...prev,
        [normalized]: initialContent,
      }));
      setActiveFilePath(normalized);
      setIslandStatus("idle", `Berkas ditambahkan: ${normalized}`);
    },
    [setIslandStatus]
  );

  // Handler hapus file dari Sidebar FileTree
  const handleDeleteFile = useCallback(
    (targetPath: string) => {
      setLocalFileSystem((prev) => {
        const clone = { ...prev };
        delete clone[targetPath];
        const remaining = Object.keys(clone).sort();
        if (activeFilePath === targetPath && remaining.length > 0) {
          setActiveFilePath(remaining[0]);
        }
        return clone;
      });
    },
    [activeFilePath]
  );

  // Handler reset berkas yang sedang dibuka ke state tersimpan
  const handleResetActiveFile = useCallback(() => {
    if (savedFileSystem[activeFilePath] !== undefined) {
      setLocalFileSystem((prev) => ({
        ...prev,
        [activeFilePath]: savedFileSystem[activeFilePath],
      }));
    }
  }, [activeFilePath, savedFileSystem]);

  /**
   * TOMBOL BERSINAR "Deploy Changes":
   * 1. Mengubah ulang `localFileSystem` menjadi format payload JSON Vercel API v13
   * 2. Mengirim ulang ke endpoint `/api/deploy` (Re-deploy)
   * 3. Menyinkronkan `fileSystem` terbaru & URL deployment ke dokumen Firestore proyek tersebut
   * 4. Menggerakkan Dynamic Island (`redeploying` -> `building` -> `deployed` / `error`)
   */
  const handleDeployChanges = async () => {
    if (!project || isRedeploying) return;
    setIsRedeploying(true);

    try {
      setIslandStatus("redeploying", `Re-deploying ${project.name}...`, {
        subtitle: `Merakit ulang ${Object.keys(localFileSystem).length} berkas ke payload Vercel v13`,
        progress: 35,
      });

      await new Promise((resolve) => setTimeout(resolve, 420));

      const {
        response,
        finalFileSystem,
        hasAutoFallbackIndex,
      } = await deployToVercelEngine({
        projectName: project.name,
        fileSystem: localFileSystem,
        vercelToken,
        onStageChange: (stage, progress, subtitle) => {
          if (stage === "uploading") {
            setIslandStatus("redeploying", `Re-deploying ${project.name}...`, {
              subtitle,
              progress,
            });
          } else {
            setIslandStatus("building", "Vercel Edge Rebuilding...", {
              subtitle,
            });
          }
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 600));

      const updatedProject = await syncProjectFileSystemAndDeploy(
        project.id,
        project,
        {
          fileSystem: finalFileSystem,
          deploymentId: response.deploymentId,
          deploymentUrl: response.deploymentUrl,
          status: "deployed",
          hasAutoFallbackIndex,
        }
      );

      setProject(updatedProject);
      setLocalFileSystem(updatedProject.fileSystem);
      setSavedFileSystem(updatedProject.fileSystem);

      setIslandStatus("deployed", "Perubahan Berhasil Di-deploy!", {
        deploymentUrl: updatedProject.deploymentUrl,
        autoResetMs: 9000,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal melakukan Re-deploy perubahan ke Vercel API v13.";
      setIslandStatus("error", "Re-deploy Gagal", {
        errorMessage: msg,
        autoResetMs: 7000,
      });
    } finally {
      setIsRedeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-voam-bg flex flex-col items-center justify-center p-6 gap-4">
        <Loader2 className="w-8 h-8 text-voam-neon animate-spin" />
        <p className="text-xs font-mono text-voam-muted">
          Menarik struktur fileSystem dari koleksi Firestore projects...
        </p>
      </div>
    );
  }

  if (notFoundError || !project) {
    return (
      <div className="min-h-screen bg-voam-bg flex flex-col items-center justify-center p-6">
        <div className="voam-glass rounded-3xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-voam-crimson/20 border border-voam-crimson/40 text-voam-crimson flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-white">
            Proyek Tidak Ditemukan
          </h1>
          <p className="text-xs text-voam-muted">
            {notFoundError || "ID proyek tidak tersedia di Firestore."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="voam-btn-primary w-full"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-voam-bg overflow-hidden pt-16">
      {/* Top Command Bar IDE */}
      <header className="h-16 px-4 sm:px-6 bg-voam-surface/90 backdrop-blur-2xl border-y border-voam-border flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-xs font-medium text-voam-muted hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          <div className="hidden lg:block">
            <AnimatedLogo size="sm" />
          </div>

          <div className="h-5 w-px bg-voam-border hidden sm:block" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FolderCode className="w-4 h-4 text-voam-neon shrink-0" />
              <h1 className="text-sm font-bold text-white truncate">
                {project.name}
              </h1>
              {modifiedPaths.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-voam-neon/15 text-voam-neon border border-voam-neon/40 shrink-0">
                  {modifiedPaths.length} file diubah
                </span>
              ) : (
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-voam-emerald/15 text-voam-emerald border border-voam-emerald/30 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  Tersinkronisasi
                </span>
              )}
            </div>

            <a
              href={project.deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-voam-muted hover:text-voam-neon flex items-center gap-1 truncate mt-0.5"
            >
              <span className="truncate">{project.deploymentUrl}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </div>

        {/* Tombol Bersinar Elegan "Deploy Changes" */}
        <div className="flex items-center gap-3 shrink-0">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            disabled={isRedeploying}
            onClick={handleDeployChanges}
            className="relative inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm text-voam-bg bg-gradient-to-r from-voam-neon via-voam-cyan to-voam-emerald shadow-neon-cyan-lg hover:shadow-[0_0_45px_rgba(0,240,255,0.65)] disabled:opacity-50 transition-all"
          >
            {isRedeploying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deploying to Vercel v13...</span>
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                <span>Deploy Changes</span>
                <Sparkles className="w-3.5 h-3.5" />
              </>
            )}
          </motion.button>
        </div>
      </header>

      {/* Ruang Kerja Utama IDE: Sidebar FileTree + Main Monaco CodeEditor */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        <FileTree
          fileSystem={localFileSystem}
          savedFileSystem={savedFileSystem}
          activeFilePath={activeFilePath}
          onSelectFile={(path) => setActiveFilePath(path)}
          onCreateFile={handleCreateNewFile}
          onDeleteFile={handleDeleteFile}
        />

        <CodeEditor
          activeFilePath={activeFilePath}
          fileSystem={localFileSystem}
          onChangeFileContent={handleCodeChange}
          onResetCurrentFile={handleResetActiveFile}
          isCurrentFileModified={
            localFileSystem[activeFilePath] !== savedFileSystem[activeFilePath]
          }
        />
      </div>
    </div>
  );
}

export default withAuthGuard(ProjectIdePageContent);
