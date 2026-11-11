"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Rocket,
  ExternalLink,
  CheckCircle2,
  Loader2,
  FolderCode,
  AlertCircle,
  Shield,
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

  const { isOwner, vercelToken, setIslandStatus } = useVoam();

  const [project, setProject] = useState<VoamProject | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFoundError, setNotFoundError] = useState<string>("");

  const [localFileSystem, setLocalFileSystem] = useState<VirtualFileSystem>({});
  const [savedFileSystem, setSavedFileSystem] = useState<VirtualFileSystem>({});
  const [activeFilePath, setActiveFilePath] = useState<string>("/index.html");
  const [isRedeploying, setIsRedeploying] = useState<boolean>(false);

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

  const handleCodeChange = useCallback(
    (filePath: string, nextContent: string) => {
      setLocalFileSystem((prev) => ({
        ...prev,
        [filePath]: nextContent,
      }));
    },
    []
  );

  const handleCreateNewFile = useCallback((rawPath: string, initialContent = "") => {
    const normalized = normalizeFilePath(rawPath);
    setLocalFileSystem((prev) => ({
      ...prev,
      [normalized]: initialContent,
    }));
    setActiveFilePath(normalized);
  }, []);

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

  const handleResetActiveFile = useCallback(() => {
    if (savedFileSystem[activeFilePath] !== undefined) {
      setLocalFileSystem((prev) => ({
        ...prev,
        [activeFilePath]: savedFileSystem[activeFilePath],
      }));
    }
  }, [activeFilePath, savedFileSystem]);

  const handleDeployChanges = async () => {
    if (!project || isRedeploying) return;
    if (project.status === "quarantined" && !isOwner) {
      setIslandStatus("error", "Proyek Dalam Karantina", {
        errorMessage:
          "Proyek ini sedang dikarantina oleh Owner MainZ Voam dan tidak dapat di-redeploy.",
        autoResetMs: 5000,
      });
      return;
    }
    setIsRedeploying(true);

    try {
      setIslandStatus("redeploying", `Re-deploying ${project.name}...`, {
        subtitle: `Merakit ulang ${
          Object.keys(localFileSystem).length
        } berkas ke payload Vercel v13`,
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

      setIslandStatus("deployed", "Perubahan Berhasil Di-deploy", {
        deploymentUrl: updatedProject.deploymentUrl,
        autoResetMs: 8000,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal melakukan Re-deploy perubahan ke Vercel API v13.";
      setIslandStatus("error", "Re-deploy Gagal", {
        errorMessage: msg,
        autoResetMs: 6500,
      });
    } finally {
      setIsRedeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-6 gap-3">
        <Loader2 className="w-6 h-6 text-zinc-300 animate-spin" />
        <p className="text-xs font-mono text-zinc-400">
          Memuat virtual fileSystem dari koleksi Firestore...
        </p>
      </div>
    );
  }

  if (notFoundError || !project) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-6">
        <div className="voam-glass rounded-2xl p-7 max-w-md w-full text-center space-y-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h1 className="text-base font-semibold text-white">
            Proyek Tidak Ditemukan
          </h1>
          <p className="text-xs text-zinc-400">
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
    <div className="h-screen flex flex-col bg-[#050507] overflow-hidden">
      {/* Top Command Bar IDE Bergaya Cursor / Zed */}
      <header className="h-14 px-4 sm:px-6 bg-[#08080C] border-b border-white/[0.07] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="voam-btn-secondary py-1.5 px-2.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => router.push("/owner")}
              className="voam-btn-secondary py-1.5 px-2.5 border-amber-500/30 text-amber-300"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Owner Center</span>
            </button>
          )}

          <div className="hidden lg:block">
            <AnimatedLogo size="sm" />
          </div>

          <span className="text-zinc-700 hidden sm:inline">/</span>

          <div className="min-w-0 flex items-center gap-2.5">
            <FolderCode className="w-4 h-4 text-zinc-400 shrink-0" />
            <h1 className="text-xs sm:text-sm font-semibold text-white truncate">
              {project.name}
            </h1>

            {modifiedPaths.length > 0 ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/25 shrink-0">
                {modifiedPaths.length} diubah
              </span>
            ) : (
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0">
                <CheckCircle2 className="w-3 h-3" />
                Synced
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <a
            href={project.deploymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] text-xs font-mono text-zinc-300 transition-colors"
          >
            <span className="truncate max-w-[180px]">
              {project.deploymentUrl.replace(/^https?:\/\//, "")}
            </span>
            <ExternalLink className="w-3 h-3 text-zinc-400 shrink-0" />
          </a>

          <button
            type="button"
            disabled={isRedeploying}
            onClick={handleDeployChanges}
            className="voam-btn-primary py-2 px-4 text-xs"
          >
            {isRedeploying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deploying...</span>
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5" />
                <span>Deploy Changes</span>
              </>
            )}
          </button>
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
