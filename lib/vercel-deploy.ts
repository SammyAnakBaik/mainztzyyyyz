import JSZip from "jszip";
import { normalizeFilePath } from "@/lib/firebase";
import type {
  VercelDeployApiResponse,
  VercelV13DeployRequestPayload,
  VercelV13FileEntry,
  VirtualFileSystem,
} from "@/types/voam";

const TEXT_EXTENSIONS = new Set([
  "html",
  "htm",
  "css",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "json",
  "svg",
  "md",
  "txt",
  "xml",
  "webmanifest",
  "yaml",
  "yml",
]);

const IGNORED_PATTERNS = [
  "__MACOSX",
  ".DS_Store",
  "Thumbs.db",
  "node_modules/",
  ".git/",
  ".next/",
];

function isIgnoredPath(pathStr: string): boolean {
  return IGNORED_PATTERNS.some((pattern) => pathStr.includes(pattern));
}

function isSupportedTextFile(filename: string): boolean {
  const parts = filename.toLowerCase().split(".");
  if (parts.length < 2) return true;
  const ext = parts[parts.length - 1];
  return TEXT_EXTENSIONS.has(ext);
}

/**
 * Menghasilkan slug proyek yang valid untuk Vercel REST API v13
 */
export function sanitizeProjectSlug(rawName: string): string {
  const cleaned = rawName
    .toLowerCase()
    .replace(/\.zip$/i, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (cleaned || `voam-app-${Date.now().toString(36)}`).slice(0, 52);
}

/**
 * Menghapus prefix folder induk tunggal pada hasil ekstraksi ZIP
 * (Contoh: "my-site/index.html" -> "/index.html")
 */
function stripCommonRootFolder(rawFs: VirtualFileSystem): VirtualFileSystem {
  const paths = Object.keys(rawFs);
  if (paths.length === 0) return {};

  const hasRootIndex = paths.some(
    (p) => p.toLowerCase() === "/index.html" || p.toLowerCase() === "/index.htm"
  );
  if (hasRootIndex) return rawFs;

  const firstSegments = paths.map((p) => {
    const trimmed = p.replace(/^\//, "");
    const slashIdx = trimmed.indexOf("/");
    return slashIdx > 0 ? trimmed.slice(0, slashIdx) : null;
  });

  const firstCandidate = firstSegments[0];
  if (
    firstCandidate &&
    firstSegments.every((seg) => seg === firstCandidate)
  ) {
    const stripped: VirtualFileSystem = {};
    const prefix = `/${firstCandidate}`;
    Object.entries(rawFs).forEach(([filePath, content]) => {
      const nextPath = filePath.startsWith(prefix)
        ? filePath.slice(prefix.length) || "/index.html"
        : filePath;
      stripped[normalizeFilePath(nextPath)] = content;
    });
    return stripped;
  }

  return rawFs;
}

/**
 * Ekstraksi file di sisi klien dari Dropzone (mendukung file .zip via JSZip maupun kumpulan file mentah)
 */
export async function extractFilesFromDrop(acceptedFiles: File[]): Promise<{
  fileSystem: VirtualFileSystem;
  suggestedName: string;
}> {
  if (!acceptedFiles || acceptedFiles.length === 0) {
    throw new Error("Tidak ada file yang dipilih untuk diekstraksi.");
  }

  const rawFs: VirtualFileSystem = {};
  let suggestedName = "mainz-voam-project";

  const zipFile = acceptedFiles.find((f) =>
    f.name.toLowerCase().endsWith(".zip")
  );

  if (zipFile) {
    suggestedName = zipFile.name.replace(/\.zip$/i, "") || "mainz-voam-zip";
    const zipBuffer = await zipFile.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    const entryPromises: Promise<void>[] = [];

    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;
      if (isIgnoredPath(relativePath)) return;
      if (!isSupportedTextFile(relativePath)) return;

      const task = zipEntry.async("string").then((content) => {
        const normalized = normalizeFilePath(relativePath);
        rawFs[normalized] = content;
      });
      entryPromises.push(task);
    });

    await Promise.all(entryPromises);
  } else {
    const firstFile = acceptedFiles[0];
    suggestedName =
      firstFile.name.replace(/\.[^/.]+$/, "") || "mainz-voam-web";

    for (const file of acceptedFiles) {
      const relPath =
        (file as File & { path?: string }).path ||
        file.webkitRelativePath ||
        file.name;
      if (isIgnoredPath(relPath)) continue;
      if (!isSupportedTextFile(relPath)) continue;

      const textContent = await file.text();
      rawFs[normalizeFilePath(relPath)] = textContent;
    }
  }

  const cleanedFs = stripCommonRootFolder(rawFs);
  if (Object.keys(cleanedFs).length === 0) {
    throw new Error(
      "Arsip atau file yang diunggah tidak mengandung file teks web yang valid (.html, .css, .js, .json, .svg)."
    );
  }

  return {
    fileSystem: cleanedFs,
    suggestedName,
  };
}

/**
 * WAJIB FALLBACK ENGINE:
 * Jika tidak ditemukan `/index.html` di dalam fileSystem, fungsi ini secara otomatis
 * membangun objek `/index.html` sintetis di memori yang memanggil seluruh aset CSS & JS
 * proyek sebelum payload dikirim ke Vercel API v13.
 */
export function ensureIndexHtmlFallback(
  inputFs: VirtualFileSystem,
  projectName: string
): {
  fileSystem: VirtualFileSystem;
  hasAutoFallbackIndex: boolean;
} {
  const normalizedFs: VirtualFileSystem = {};
  Object.entries(inputFs).forEach(([k, v]) => {
    normalizedFs[normalizeFilePath(k)] = v;
  });

  const existingIndexKey = Object.keys(normalizedFs).find(
    (k) => k.toLowerCase() === "/index.html"
  );

  if (existingIndexKey) {
    if (existingIndexKey !== "/index.html") {
      normalizedFs["/index.html"] = normalizedFs[existingIndexKey];
      delete normalizedFs[existingIndexKey];
    }
    return {
      fileSystem: normalizedFs,
      hasAutoFallbackIndex: false,
    };
  }

  const allPaths = Object.keys(normalizedFs).sort();
  const cssFiles = allPaths.filter((p) => p.toLowerCase().endsWith(".css"));
  const jsFiles = allPaths.filter((p) => p.toLowerCase().endsWith(".js"));

  const cssLinksMarkup =
    cssFiles.length > 0
      ? cssFiles
          .map((cssPath) => `  <link rel="stylesheet" href="${cssPath}" />`)
          .join("\n")
      : "  <!-- Tidak ada stylesheet eksternal terdeteksi -->";

  const jsScriptsMarkup =
    jsFiles.length > 0
      ? jsFiles
          .map((jsPath) => `  <script src="${jsPath}" defer></script>`)
          .join("\n")
      : "  <!-- Tidak ada script eksternal terdeteksi -->";

  const assetListItems = allPaths
    .map(
      (filePath) =>
        `        <li><a href="${filePath}" style="color:#00F0FF;text-decoration:none;font-family:monospace;">${filePath}</a></li>`
    )
    .join("\n");

  const fallbackHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName} — MainZ Voam Auto-Fallback</title>
${cssLinksMarkup}
  <style>
    :root {
      color-scheme: dark;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(circle at 20% 20%, rgba(0, 240, 255, 0.12), transparent 50%), #05070e;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .voam-fallback-shell {
      max-width: 680px;
      width: 100%;
      background: rgba(16, 21, 36, 0.85);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 240, 255, 0.3);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }
    .voam-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-family: monospace;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(0, 240, 255, 0.14);
      color: #00f0ff;
      border: 1px solid rgba(0, 240, 255, 0.35);
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 26px;
      letter-spacing: -0.02em;
    }
    p {
      margin: 0 0 20px;
      color: #94a3b8;
      line-height: 1.6;
      font-size: 14px;
    }
    .voam-assets {
      background: rgba(4, 5, 9, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px 20px;
    }
    .voam-assets h2 {
      margin: 0 0 10px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #cbd5e1;
    }
    .voam-assets ul {
      margin: 0;
      padding-left: 18px;
      line-height: 1.8;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <main id="app" class="voam-fallback-shell">
    <span class="voam-badge">MainZ Voam • Auto-Generated index.html Fallback</span>
    <h1>${projectName}</h1>
    <p>
      Halaman <code>/index.html</code> ini dibangkitkan secara otomatis di memori oleh mesin
      <strong>MainZ Voam</strong> karena bundel asli tidak menyertakan berkas induk HTML. Seluruh aset
      stylesheet dan script Anda telah ditautkan secara otomatis di bawah ini.
    </p>
    <section class="voam-assets">
      <h2>Daftar Aset Terhubung (${allPaths.length} File)</h2>
      <ul>
${assetListItems}
      </ul>
    </section>
  </main>
${jsScriptsMarkup}
</body>
</html>`;

  normalizedFs["/index.html"] = fallbackHtml;

  return {
    fileSystem: normalizedFs,
    hasAutoFallbackIndex: true,
  };
}

/**
 * Membangun payload JSON sesuai spesifikasi ketat Vercel REST API v13 (`/v13/deployments`)
 */
export function buildVercelV13Payload(
  projectName: string,
  fileSystem: VirtualFileSystem
): {
  payload: VercelV13DeployRequestPayload;
  finalFileSystem: VirtualFileSystem;
  hasAutoFallbackIndex: boolean;
  slug: string;
} {
  const slug = sanitizeProjectSlug(projectName);
  const { fileSystem: finalFileSystem, hasAutoFallbackIndex } =
    ensureIndexHtmlFallback(fileSystem, projectName);

  const files: VercelV13FileEntry[] = Object.entries(finalFileSystem).map(
    ([filePath, content]) => {
      const relativeFile = normalizeFilePath(filePath).replace(/^\/+/, "");
      return {
        file: relativeFile || "index.html",
        data: content,
        encoding: "utf-8",
      };
    }
  );

  const payload: VercelV13DeployRequestPayload = {
    name: slug,
    files,
    projectSettings: {
      framework: null,
      buildCommand: null,
      outputDirectory: null,
      installCommand: null,
    },
    target: "production",
  };

  return {
    payload,
    finalFileSystem,
    hasAutoFallbackIndex,
    slug,
  };
}

/**
 * Mengirimkan payload Vercel v13 ke Route Backend Next.js (`/api/deploy`)
 */
export async function deployToVercelEngine(params: {
  projectName: string;
  fileSystem: VirtualFileSystem;
  vercelToken?: string;
  onStageChange?: (
    stage: "uploading" | "building",
    progress: number,
    subtitle: string
  ) => void;
}): Promise<{
  response: VercelDeployApiResponse;
  finalFileSystem: VirtualFileSystem;
  hasAutoFallbackIndex: boolean;
  slug: string;
}> {
  const { payload, finalFileSystem, hasAutoFallbackIndex, slug } =
    buildVercelV13Payload(params.projectName, params.fileSystem);

  if (params.onStageChange) {
    params.onStageChange(
      "uploading",
      45,
      `Mengunggah ${payload.files.length} berkas ke Vercel v13 API...`
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (params.vercelToken && params.vercelToken.trim().length > 0) {
    headers["x-vercel-token"] = params.vercelToken.trim();
  }

  const apiRes = await fetch("/api/deploy", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (params.onStageChange) {
    params.onStageChange(
      "building",
      85,
      "Menjalankan kompilasi Edge & alokasi domain..."
    );
  }

  const data = (await apiRes.json()) as VercelDeployApiResponse;

  if (!apiRes.ok || !data.success) {
    throw new Error(
      data.error ||
        `Gagal melakukan deployment ke Vercel (HTTP ${apiRes.status}).`
    );
  }

  return {
    response: data,
    finalFileSystem,
    hasAutoFallbackIndex,
    slug,
  };
}

/**
 * Generator template starter proyek multi-file untuk pengujian instan di Dashboard
 */
export function createStarterProjectFiles(projectTitle: string): VirtualFileSystem {
  return {
    "/index.html": `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectTitle} — Powered by MainZ Voam</title>
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
  <div class="orb orb-cyan"></div>
  <div class="orb orb-violet"></div>

  <main class="glass-container">
    <div class="pill-badge">LIVE ON VERCEL EDGE v13</div>
    <h1 id="hero-title">${projectTitle}</h1>
    <p class="subtitle">
      Aplikasi ini di-deploy secara instan dan dikelola langsung melalui
      <strong>MainZ Voam In-Browser Monaco IDE</strong>.
    </p>

    <div class="interactive-panel">
      <button id="pulse-btn" class="neon-button">
        Picu Gelombang Telemetri
      </button>
      <div id="telemetry-output" class="telemetry-box">
        Status Mesin: Siap Menerima Instruksi...
      </div>
    </div>
  </main>

  <script src="/js/script.js" defer></script>
</body>
</html>`,
    "/css/style.css": `:root {
  --bg-dark: #040509;
  --neon-cyan: #00f0ff;
  --neon-violet: #8b5cf6;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  min-height: 100vh;
  background-color: var(--bg-dark);
  color: var(--text-main);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(110px);
  opacity: 0.35;
  pointer-events: none;
}

.orb-cyan {
  width: 360px;
  height: 360px;
  background: var(--neon-cyan);
  top: -80px;
  left: -80px;
}

.orb-violet {
  width: 360px;
  height: 360px;
  background: var(--neon-violet);
  bottom: -80px;
  right: -80px;
}

.glass-container {
  position: relative;
  z-index: 10;
  max-width: 560px;
  width: 92%;
  padding: 44px;
  border-radius: 28px;
  background: rgba(10, 13, 22, 0.78);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(0, 240, 255, 0.25);
  box-shadow: 0 25px 70px rgba(0, 0, 0, 0.75);
  text-align: center;
}

.pill-badge {
  display: inline-block;
  font-family: monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--neon-cyan);
  background: rgba(0, 240, 255, 0.12);
  border: 1px solid rgba(0, 240, 255, 0.35);
  padding: 6px 14px;
  border-radius: 999px;
  margin-bottom: 18px;
}

h1 {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 12px;
}

.subtitle {
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: 28px;
}

.neon-button {
  background: linear-gradient(135deg, #00f0ff 0%, #8b5cf6 100%);
  color: #040509;
  font-weight: 700;
  font-size: 14px;
  border: none;
  padding: 14px 28px;
  border-radius: 14px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 0 25px rgba(0, 240, 255, 0.4);
}

.neon-button:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 0 35px rgba(0, 240, 255, 0.65);
}

.telemetry-box {
  margin-top: 20px;
  padding: 14px;
  border-radius: 12px;
  background: rgba(4, 5, 9, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-family: monospace;
  font-size: 12px;
  color: #10b981;
}`,
    "/js/script.js": `document.addEventListener("DOMContentLoaded", () => {
  const pulseBtn = document.getElementById("pulse-btn");
  const output = document.getElementById("telemetry-output");
  let counter = 0;

  if (pulseBtn && output) {
    pulseBtn.addEventListener("click", () => {
      counter += 1;
      const timestamp = new Date().toLocaleTimeString("id-ID");
      output.textContent = \`[PING #\${counter} • \${timestamp}] Sinkronisasi Edge 120fps Aktif!\`;
    });
  }
});`,
  };
}
