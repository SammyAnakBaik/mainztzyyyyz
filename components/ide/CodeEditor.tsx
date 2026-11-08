"use client";

import React, { useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  Code2,
  Eye,
  Columns,
  Sparkles,
  FileCode2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type { VirtualFileSystem } from "@/types/voam";

interface CodeEditorProps {
  activeFilePath: string;
  fileSystem: VirtualFileSystem;
  onChangeFileContent: (filePath: string, nextContent: string) => void;
  onResetCurrentFile?: () => void;
  isCurrentFileModified?: boolean;
}

/**
 * Mendeteksi bahasa Monaco Editor secara dinamis berdasarkan ekstensi path berkas yang sedang dibuka
 */
export function detectMonacoLanguage(filePath: string): string {
  const clean = filePath.toLowerCase().trim();
  const ext = clean.includes(".") ? clean.split(".").pop() || "" : "";

  switch (ext) {
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "svg":
    case "xml":
      return "xml";
    default:
      return "plaintext";
  }
}

/**
 * Merakit dokumen HTML komposit untuk Live Preview di dalam IDE
 * Menggabungkan `/index.html` (atau file HTML aktif) dengan seluruh file CSS & JS di `fileSystem` lokal.
 */
function buildLivePreviewSrcDoc(
  fileSystem: VirtualFileSystem,
  activeFilePath: string
): string {
  const htmlCandidate =
    activeFilePath.toLowerCase().endsWith(".html") && fileSystem[activeFilePath]
      ? fileSystem[activeFilePath]
      : fileSystem["/index.html"] ||
        Object.entries(fileSystem).find(([k]) =>
          k.toLowerCase().endsWith(".html")
        )?.[1] ||
        "<h1>Tidak ada berkas HTML untuk dipratinjau</h1>";

  let resultHtml = htmlCandidate;

  // Injeksi inline seluruh CSS lokal yang ada di dalam VirtualFileSystem
  const cssEntries = Object.entries(fileSystem).filter(([k]) =>
    k.toLowerCase().endsWith(".css")
  );
  if (cssEntries.length > 0) {
    const combinedCss = cssEntries
      .map(([path, css]) => `/* ${path} */\n${css}`)
      .join("\n\n");
    const styleTag = `<style data-voam-live-css>\n${combinedCss}\n</style>`;
    if (resultHtml.includes("</head>")) {
      resultHtml = resultHtml.replace("</head>", `${styleTag}\n</head>`);
    } else {
      resultHtml = `${styleTag}\n${resultHtml}`;
    }
  }

  // Injeksi inline seluruh JS lokal yang ada di dalam VirtualFileSystem
  const jsEntries = Object.entries(fileSystem).filter(([k]) =>
    k.toLowerCase().endsWith(".js")
  );
  if (jsEntries.length > 0) {
    const combinedJs = jsEntries
      .map(([path, js]) => `// ${path}\n${js}`)
      .join("\n\n");
    const scriptTag = `<script data-voam-live-js>\ntry {\n${combinedJs}\n} catch (e) { console.error(e); }\n</script>`;
    if (resultHtml.includes("</body>")) {
      resultHtml = resultHtml.replace("</body>", `${scriptTag}\n</body>`);
    } else {
      resultHtml = `${resultHtml}\n${scriptTag}`;
    }
  }

  return resultHtml;
}

export default function CodeEditor({
  activeFilePath,
  fileSystem,
  onChangeFileContent,
  onResetCurrentFile,
  isCurrentFileModified = false,
}: CodeEditorProps) {
  const [viewMode, setViewMode] = useState<"editor" | "split" | "preview">(
    "editor"
  );

  const currentCode = fileSystem[activeFilePath] ?? "";
  const detectedLanguage = useMemo(
    () => detectMonacoLanguage(activeFilePath),
    [activeFilePath]
  );

  const lineCount = useMemo(
    () => (currentCode ? currentCode.split("\n").length : 1),
    [currentCode]
  );

  const previewSrcDoc = useMemo(
    () =>
      viewMode === "editor"
        ? ""
        : buildLivePreviewSrcDoc(fileSystem, activeFilePath),
    [fileSystem, activeFilePath, viewMode]
  );

  return (
    <section className="flex-1 flex flex-col h-full min-w-0 bg-[#080B12]">
      {/* Tab Bar & Telemetry Header Editor */}
      <div className="h-12 px-4 border-b border-voam-border bg-voam-surface/80 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-voam-elevated border border-voam-neon/30 text-xs font-mono text-white shadow-[0_0_15px_rgba(0,240,255,0.08)]">
            <FileCode2 className="w-3.5 h-3.5 text-voam-neon shrink-0" />
            <span className="truncate max-w-[220px] sm:max-w-[340px]">
              {activeFilePath}
            </span>
            {isCurrentFileModified && (
              <span className="px-1.5 py-0.2 rounded-full bg-voam-neon/20 text-voam-neon text-[10px] font-sans font-semibold">
                Edited
              </span>
            )}
          </div>

          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono uppercase text-voam-neon">
            <Sparkles className="w-3 h-3" />
            {detectedLanguage}
          </span>

          <span className="hidden lg:inline-block text-[11px] font-mono text-voam-muted">
            {lineCount} baris • {currentCode.length} byte
          </span>
        </div>

        {/* Kontrol Mode Tampilan (Monaco Editor / Split / Live Preview) */}
        <div className="flex items-center gap-2 shrink-0">
          {isCurrentFileModified && onResetCurrentFile && (
            <button
              type="button"
              onClick={onResetCurrentFile}
              title="Kembalikan berkas ini ke versi deploy terakhir"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-voam-muted hover:text-white border border-white/10 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reset File</span>
            </button>
          )}

          <div className="inline-flex items-center p-0.5 rounded-xl bg-voam-bg border border-voam-border">
            <button
              type="button"
              onClick={() => setViewMode("editor")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === "editor"
                  ? "bg-voam-neon text-voam-bg font-semibold shadow-neon-cyan"
                  : "text-voam-muted hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kode</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === "split"
                  ? "bg-voam-neon text-voam-bg font-semibold shadow-neon-cyan"
                  : "text-voam-muted hover:text-white"
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === "preview"
                  ? "bg-voam-neon text-voam-bg font-semibold shadow-neon-cyan"
                  : "text-voam-muted hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pratinjau</span>
            </button>
          </div>
        </div>
      </div>

      {/* Area Kerja Utama (Monaco Editor & Live Preview) */}
      <div className="flex-1 flex min-h-0 relative">
        {(viewMode === "editor" || viewMode === "split") && (
          <div
            className={`${
              viewMode === "split"
                ? "w-1/2 border-r border-voam-border"
                : "w-full"
            } h-full min-h-[420px]`}
          >
            <Editor
              height="100%"
              path={activeFilePath}
              theme="vs-dark"
              language={detectedLanguage}
              value={currentCode}
              onChange={(val) =>
                onChangeFileContent(activeFilePath, val ?? "")
              }
              loading={
                <div className="flex flex-col items-center justify-center h-full gap-3 text-voam-muted bg-[#080B12]">
                  <Loader2 className="w-6 h-6 text-voam-neon animate-spin" />
                  <span className="text-xs font-mono">
                    Memuat Mesin Inti Monaco Editor (vs-dark)...
                  </span>
                </div>
              }
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                minimap: { enabled: viewMode === "editor" },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                wordWrap: "on",
                padding: { top: 16, bottom: 16 },
                automaticLayout: true,
                tabSize: 2,
                formatOnPaste: true,
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>
        )}

        {(viewMode === "split" || viewMode === "preview") && (
          <div
            className={`${
              viewMode === "split" ? "w-1/2" : "w-full"
            } h-full flex flex-col bg-[#05070E]`}
          >
            <div className="px-3 py-1.5 bg-voam-surface border-b border-voam-border flex items-center justify-between text-[11px] font-mono text-voam-muted">
              <span>Live In-Memory Canvas Preview</span>
              <span className="text-voam-emerald">● Real-time Hot Render</span>
            </div>
            <iframe
              title="MainZ Voam Live Preview"
              srcDoc={previewSrcDoc}
              sandbox="allow-scripts"
              className="w-full flex-1 border-0 bg-[#05070E]"
            />
          </div>
        )}
      </div>
    </section>
  );
}
