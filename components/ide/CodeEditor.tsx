"use client";

import React, { useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  Code2,
  Eye,
  Columns,
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
    <section className="flex-1 flex flex-col h-full min-w-0 bg-[#1e1e1e]">
      <div className="h-11 px-4 border-b border-white/[0.07] bg-[#0B0B0F] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-zinc-100">
            <FileCode2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate max-w-[200px] sm:max-w-[320px]">
              {activeFilePath}
            </span>
            {isCurrentFileModified && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </div>

          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] text-[10px] font-mono uppercase text-zinc-400">
            {detectedLanguage}
          </span>

          <span className="hidden lg:inline-block text-[11px] font-mono text-zinc-500">
            {lineCount} baris • {currentCode.length} B
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCurrentFileModified && onResetCurrentFile && (
            <button
              type="button"
              onClick={onResetCurrentFile}
              title="Kembalikan berkas ini ke versi deploy terakhir"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.07] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden md:inline">Reset</span>
            </button>
          )}

          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#050507] border border-white/[0.07]">
            <button
              type="button"
              onClick={() => setViewMode("editor")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === "editor"
                  ? "bg-white text-zinc-950 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kode</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === "split"
                  ? "bg-white text-zinc-950 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === "preview"
                  ? "bg-white text-zinc-950 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pratinjau</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 relative">
        {(viewMode === "editor" || viewMode === "split") && (
          <div
            className={`${
              viewMode === "split"
                ? "w-1/2 border-r border-white/[0.07]"
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
                <div className="flex flex-col items-center justify-center h-full gap-2.5 text-zinc-400 bg-[#08080C]">
                  <Loader2 className="w-5 h-5 text-zinc-300 animate-spin" />
                  <span className="text-xs font-mono">
                    Memuat Monaco Editor (vs-dark)...
                  </span>
                </div>
              }
              options={{
                fontSize: 13.5,
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
            } h-full flex flex-col bg-[#050507]`}
          >
            <div className="px-3 py-1.5 bg-[#08080C] border-b border-white/[0.07] flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Live Canvas Preview</span>
              <span className="text-emerald-400">● Hot Render</span>
            </div>
            <iframe
              title="MainZ Voam Live Preview"
              srcDoc={previewSrcDoc}
              sandbox="allow-scripts"
              className="w-full flex-1 border-0 bg-[#050507]"
            />
          </div>
        )}
      </div>
    </section>
  );
}
