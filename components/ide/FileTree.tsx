"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder,
  FolderOpen,
  FileCode2,
  FileJson,
  FileText,
  Palette,
  Braces,
  Plus,
  ChevronRight,
  ChevronDown,
  Search,
  Trash2,
  Check,
  X,
  FilePlus2,
} from "lucide-react";
import { normalizeFilePath } from "@/lib/firebase";
import type { FileTreeNode, VirtualFileSystem } from "@/types/voam";

interface FileTreeProps {
  fileSystem: VirtualFileSystem;
  savedFileSystem: VirtualFileSystem;
  activeFilePath: string;
  onSelectFile: (filePath: string) => void;
  onCreateFile: (filePath: string, initialContent?: string) => void;
  onDeleteFile: (filePath: string) => void;
}

/**
 * Mengubah map flat VirtualFileSystem menjadi struktur pohon direktori rekursif
 */
function buildHierarchicalTree(fs: VirtualFileSystem, filterQuery: string): FileTreeNode[] {
  const rootNodes: FileTreeNode[] = [];
  const paths = Object.keys(fs)
    .map(normalizeFilePath)
    .filter((p) =>
      filterQuery.trim()
        ? p.toLowerCase().includes(filterQuery.trim().toLowerCase())
        : true
    )
    .sort();

  for (const fullPath of paths) {
    const segments = fullPath.replace(/^\/+/, "").split("/").filter(Boolean);
    let currentLevel = rootNodes;
    let accumulatedPath = "";

    segments.forEach((segment, idx) => {
      accumulatedPath += `/${segment}`;
      const isLast = idx === segments.length - 1;

      if (isLast) {
        const extParts = segment.toLowerCase().split(".");
        const extension = extParts.length > 1 ? extParts[extParts.length - 1] : "";
        currentLevel.push({
          name: segment,
          path: accumulatedPath,
          type: "file",
          extension,
        });
      } else {
        let existingFolder = currentLevel.find(
          (node) => node.type === "folder" && node.name === segment
        );
        if (!existingFolder) {
          existingFolder = {
            name: segment,
            path: accumulatedPath,
            type: "folder",
            children: [],
          };
          currentLevel.push(existingFolder);
        }
        currentLevel = existingFolder.children!;
      }
    });
  }

  const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map((node) =>
        node.children ? { ...node, children: sortNodes(node.children) } : node
      );
  };

  return sortNodes(rootNodes);
}

function getFileIcon(extension?: string) {
  switch (extension) {
    case "html":
    case "htm":
      return <FileCode2 className="w-4 h-4 text-orange-400 shrink-0" />;
    case "css":
      return <Palette className="w-4 h-4 text-voam-neon shrink-0" />;
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
      return <Braces className="w-4 h-4 text-amber-300 shrink-0" />;
    case "ts":
    case "tsx":
      return <Braces className="w-4 h-4 text-sky-400 shrink-0" />;
    case "json":
      return <FileJson className="w-4 h-4 text-voam-emerald shrink-0" />;
    default:
      return <FileText className="w-4 h-4 text-voam-muted shrink-0" />;
  }
}

export default function FileTree({
  fileSystem,
  savedFileSystem,
  activeFilePath,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    "/css": true,
    "/js": true,
    "/assets": true,
    "/src": true,
  });
  const [isAddingFile, setIsAddingFile] = useState<boolean>(false);
  const [newFilePathInput, setNewFilePathInput] = useState<string>("/js/script.js");
  const [formError, setFormError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const treeNodes = useMemo(
    () => buildHierarchicalTree(fileSystem, searchQuery),
    [fileSystem, searchQuery]
  );

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !(prev[folderPath] ?? true),
    }));
  };

  const handleAddFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const raw = newFilePathInput.trim();
    if (!raw) {
      setFormError("Path berkas tidak boleh kosong.");
      return;
    }

    const normalized = normalizeFilePath(raw);
    if (normalized.endsWith("/")) {
      setFormError("Masukkan nama berkas beserta ekstensinya (misal /js/app.js).");
      return;
    }

    if (fileSystem[normalized] !== undefined) {
      setFormError("Berkas dengan path tersebut sudah ada di dalam proyek.");
      return;
    }

    // Pastikan semua folder induk otomatis terbuka di pohon direktori
    const segments = normalized.replace(/^\/+/, "").split("/");
    if (segments.length > 1) {
      let acc = "";
      const nextExpanded = { ...expandedFolders };
      for (let i = 0; i < segments.length - 1; i++) {
        acc += `/${segments[i]}`;
        nextExpanded[acc] = true;
      }
      setExpandedFolders(nextExpanded);
    }

    const ext = normalized.split(".").pop()?.toLowerCase() || "";
    let defaultTemplate = "";
    if (ext === "html") {
      defaultTemplate = `<!DOCTYPE html>\n<html lang="id">\n<head>\n  <meta charset="UTF-8" />\n  <title>Halaman Baru</title>\n</head>\n<body>\n  <h1>Dibuat di MainZ Voam IDE</h1>\n</body>\n</html>\n`;
    } else if (ext === "css") {
      defaultTemplate = `/* Stylesheet Baru: ${normalized} */\nbody {\n  margin: 0;\n  box-sizing: border-box;\n}\n`;
    } else if (ext === "js" || ext === "ts") {
      defaultTemplate = `// Modul Script: ${normalized}\nconsole.log("MainZ Voam Modul Aktif:", "${normalized}");\n`;
    } else if (ext === "json") {
      defaultTemplate = `{\n  "name": "mainz-voam-module",\n  "version": "1.0.0"\n}\n`;
    }

    onCreateFile(normalized, defaultTemplate);
    setIsAddingFile(false);
    setNewFilePathInput("");
  };

  const renderTreeNode = (node: FileTreeNode, depth = 0): React.ReactNode => {
    if (node.type === "folder") {
      const isExpanded = expandedFolders[node.path] ?? true;
      return (
        <div key={node.path} className="select-none">
          <button
            type="button"
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            className="w-full flex items-center gap-2 py-1.5 pr-3 rounded-xl text-xs font-medium text-voam-muted hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-voam-muted shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-voam-muted shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-voam-neon/90 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-voam-neon/60 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </button>

          <AnimatePresence initial={false}>
            {isExpanded && node.children && node.children.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="overflow-hidden"
              >
                {node.children.map((child) => renderTreeNode(child, depth + 1))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    const isSelected = activeFilePath === node.path;
    const isDirty = savedFileSystem[node.path] !== fileSystem[node.path];

    return (
      <div
        key={node.path}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={`group relative flex items-center justify-between py-1.5 pr-2 rounded-xl text-xs transition-all cursor-pointer ${
          isSelected
            ? "bg-voam-neon/15 text-white font-semibold border border-voam-neon/35 shadow-[0_0_15px_rgba(0,240,255,0.12)]"
            : "text-voam-muted hover:text-white hover:bg-white/[0.04] border border-transparent"
        }`}
        onClick={() => onSelectFile(node.path)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getFileIcon(node.extension)}
          <span className="font-mono truncate">{node.name}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isDirty && (
            <span
              title="Perubahan belum di-deploy"
              className="w-2 h-2 rounded-full bg-voam-neon shadow-[0_0_8px_#00F0FF]"
            />
          )}
          {Object.keys(fileSystem).length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFile(node.path);
              }}
              title={`Hapus ${node.path}`}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-voam-crimson/20 text-voam-muted hover:text-voam-crimson transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-full md:w-72 lg:w-80 shrink-0 bg-voam-surface/90 backdrop-blur-2xl border-r border-voam-border flex flex-col h-full select-none">
      {/* Header Explorer */}
      <div className="p-4 border-b border-voam-border flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-voam-text flex items-center gap-2">
            <span>File Manager</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-voam-neon/10 text-voam-neon border border-voam-neon/25">
              {Object.keys(fileSystem).length} file
            </span>
          </h2>
          <p className="text-[11px] text-voam-muted mt-0.5">
            Virtual FileSystem Explorer
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsAddingFile((prev) => !prev);
            setFormError("");
            if (!newFilePathInput) {
              setNewFilePathInput("/js/script.js");
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-voam-neon/15 hover:bg-voam-neon/25 text-voam-neon border border-voam-neon/35 transition-all shadow-neon-cyan"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New File</span>
        </button>
      </div>

      {/* Form Input Add New File */}
      <AnimatePresence initial={false}>
        {isAddingFile && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onSubmit={handleAddFileSubmit}
            className="overflow-hidden border-b border-voam-border bg-voam-elevated/80 px-4 py-3 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-voam-neon flex items-center gap-1.5">
                <FilePlus2 className="w-3.5 h-3.5" />
                Buat Path File Baru
              </span>
              <button
                type="button"
                onClick={() => setIsAddingFile(false)}
                className="text-voam-muted hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newFilePathInput}
                onChange={(e) => setNewFilePathInput(e.target.value)}
                placeholder="/js/script.js"
                autoFocus
                className="w-full px-3 py-1.5 rounded-xl bg-voam-bg border border-voam-border focus:border-voam-neon/60 focus:outline-none text-xs font-mono text-white placeholder-voam-muted/50"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-voam-neon text-voam-bg hover:bg-voam-neon/90 transition-colors shrink-0"
                title="Simpan File Baru"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            {/* Preset Cepat */}
            <div className="flex flex-wrap gap-1">
              {["/js/script.js", "/css/theme.css", "/about.html", "/config.json"].map(
                (preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewFilePathInput(preset)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-voam-muted hover:text-voam-neon border border-white/5 transition-colors"
                  >
                    {preset}
                  </button>
                )
              )}
            </div>

            {formError && (
              <p className="text-[11px] text-voam-crimson font-medium">
                {formError}
              </p>
            )}
          </motion.form>
        )}
      </AnimatePresence>

      {/* Kotak Pencarian Cepat */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-voam-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter berkas..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-voam-bg/70 border border-voam-border/70 focus:border-voam-neon/50 focus:outline-none text-xs text-white placeholder-voam-muted/60 font-mono"
          />
        </div>
      </div>

      {/* Daftar Pohon Direktori */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-0.5">
        {treeNodes.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-xs text-voam-muted">
              Tidak ada berkas yang cocok dengan pencarian.
            </p>
          </div>
        ) : (
          treeNodes.map((node) => renderTreeNode(node, 0))
        )}
      </div>
    </aside>
  );
}
