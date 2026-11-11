import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_SYSTEM_CONFIG,
  inspectInputWithWaf,
} from "@/lib/security-shield";
import type {
  VercelDeployApiResponse,
  VercelV13DeployRequestPayload,
} from "@/types/voam";

/**
 * In-memory Sliding Window Rate Limiter untuk endpoint `/api/deploy`
 * Mencegah DDoS / spam deployment dari satu alamat IP.
 */
const ipDeployHistory = new Map<string, number[]>();
const DEPLOY_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 menit
const MAX_DEPLOYS_PER_IP_WINDOW = 25;

function checkIpDeployRateLimit(ip: string): boolean {
  const now = Date.now();
  const prev = (ipDeployHistory.get(ip) || []).filter(
    (ts) => now - ts < DEPLOY_RATE_WINDOW_MS
  );
  if (prev.length >= MAX_DEPLOYS_PER_IP_WINDOW) {
    return false;
  }
  prev.push(now);
  ipDeployHistory.set(ip, prev);
  return true;
}

/**
 * Route Backend Next.js App Router — `/api/deploy`
 * Dilengkapi WAF Server-Side (Anti-SQLi, Anti-NoSQLi, Anti-Path-Traversal, & Rate Limiter)
 * sebelum meneruskan payload ke `https://api.vercel.com/v13/deployments`.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<VercelDeployApiResponse>> {
  try {
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "local-client";

    if (!checkIpDeployRateLimit(clientIp)) {
      return NextResponse.json(
        {
          success: false,
          deploymentId: "",
          deploymentUrl: "",
          readyState: "ERROR",
          projectName: "rate-limited",
          error:
            "Rate Limit Aktif: Terlalu banyak permintaan deployment dalam 5 menit terakhir. Silakan tunggu sejenak.",
        },
        { status: 429 }
      );
    }

    const body = (await request.json()) as VercelV13DeployRequestPayload;

    if (
      !body ||
      !body.name ||
      !Array.isArray(body.files) ||
      body.files.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          deploymentId: "",
          deploymentUrl: "",
          readyState: "ERROR",
          projectName: body?.name || "unknown",
          error:
            "Payload Vercel v13 tidak valid: properti name dan files wajib diisi.",
        },
        { status: 400 }
      );
    }

    // 1. Server-Side WAF Check pada Nama Proyek
    const nameWaf = inspectInputWithWaf(
      body.name,
      "Nama Proyek API Deploy",
      "api-deploy@server",
      { config: DEFAULT_SYSTEM_CONFIG }
    );
    if (!nameWaf.safe) {
      return NextResponse.json(
        {
          success: false,
          deploymentId: "",
          deploymentUrl: "",
          readyState: "ERROR",
          projectName: "blocked-by-waf",
          error: nameWaf.reason || "Nama proyek diblokir oleh WAF Server.",
        },
        { status: 403 }
      );
    }

    // 2. Proteksi Kuota Jumlah File & Ukuran Payload
    if (body.files.length > 80) {
      return NextResponse.json(
        {
          success: false,
          deploymentId: "",
          deploymentUrl: "",
          readyState: "ERROR",
          projectName: body.name,
          error: `Jumlah file (${body.files.length}) melebihi batas keamanan maksimum server (80 file per proyek).`,
        },
        { status: 413 }
      );
    }

    let totalBytes = 0;
    for (const fileEntry of body.files) {
      if (
        !fileEntry.file ||
        fileEntry.file.includes("..") ||
        fileEntry.file.includes("\0") ||
        fileEntry.file.includes("\\")
      ) {
        return NextResponse.json(
          {
            success: false,
            deploymentId: "",
            deploymentUrl: "",
            readyState: "ERROR",
            projectName: body.name,
            error: `WAF Path Traversal Shield: Path berkas tidak aman terdeteksi (${fileEntry.file}).`,
          },
          { status: 403 }
        );
      }
      totalBytes += (fileEntry.data || "").length;
    }

    if (totalBytes > 900 * 1024) {
      return NextResponse.json(
        {
          success: false,
          deploymentId: "",
          deploymentUrl: "",
          readyState: "ERROR",
          projectName: body.name,
          error:
            "Ukuran total bundel melebihi batas kuota keamanan database (maksimum 900 KB).",
        },
        { status: 413 }
      );
    }

    // Pastikan index.html selalu ada di level backend juga
    const hasIndexHtml = body.files.some(
      (f) => f.file.toLowerCase() === "index.html"
    );
    if (!hasIndexHtml) {
      body.files.push({
        file: "index.html",
        data: `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>${body.name}</title></head><body><h1>${body.name}</h1></body></html>`,
        encoding: "utf-8",
      });
    }

    const headerToken = request.headers.get("x-vercel-token")?.trim();
    const envToken = (
      process.env.VOAM_VERCEL_TOKEN ||
      process.env.MAINZ_VERCEL_TOKEN ||
      process.env.VERCEL_TOKEN ||
      ""
    ).trim();
    const activeToken = headerToken || envToken || "";
    const teamId = (
      process.env.VOAM_VERCEL_TEAM_ID ||
      process.env.VERCEL_TEAM_ID ||
      ""
    ).trim();

    // Jika Token Vercel tersedia, panggil langsung Vercel REST API v13 produksi
    if (activeToken.length > 0) {
      const vercelEndpoint = new URL("https://api.vercel.com/v13/deployments");
      if (teamId) {
        vercelEndpoint.searchParams.set("teamId", teamId);
      }

      const vercelResponse = await fetch(vercelEndpoint.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: body.name,
          files: body.files,
          projectSettings: body.projectSettings || {
            framework: null,
            buildCommand: null,
            outputDirectory: null,
            installCommand: null,
          },
          target: body.target || "production",
        }),
      });

      const vercelData = (await vercelResponse.json()) as {
        id?: string;
        url?: string;
        readyState?: string;
        name?: string;
        error?: { message?: string; code?: string };
      };

      if (!vercelResponse.ok) {
        const errMessage =
          vercelData?.error?.message ||
          `Vercel API menolak permintaan (HTTP ${vercelResponse.status}). Periksa kembali VOAM_VERCEL_TOKEN Anda.`;
        return NextResponse.json(
          {
            success: false,
            deploymentId: "",
            deploymentUrl: "",
            readyState: "ERROR",
            projectName: body.name,
            error: errMessage,
          },
          { status: vercelResponse.status }
        );
      }

      const rawUrl = vercelData.url || `${body.name}.vercel.app`;
      const formattedUrl = rawUrl.startsWith("http")
        ? rawUrl
        : `https://${rawUrl}`;

      return NextResponse.json({
        success: true,
        deploymentId: vercelData.id || `dpl_${Date.now().toString(36)}`,
        deploymentUrl: formattedUrl,
        readyState: vercelData.readyState || "READY",
        projectName: vercelData.name || body.name,
        simulated: false,
      });
    }

    // Jika VOAM_VERCEL_TOKEN belum disetel di .env.local maupun di Vault UI,
    // jalankan Edge Deployment Simulator berkecepatan tinggi agar pipeline & Firestore tetap berjalan utuh
    await new Promise((resolve) => setTimeout(resolve, 550));
    const hashSuffix = Math.random().toString(36).substring(2, 8);
    const simulatedId = `dpl_voam_${Date.now().toString(36)}_${hashSuffix}`;
    const simulatedUrl = `https://${body.name}-${hashSuffix}.vercel.app`;

    return NextResponse.json({
      success: true,
      deploymentId: simulatedId,
      deploymentUrl: simulatedUrl,
      readyState: "READY",
      projectName: body.name,
      simulated: true,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Kesalahan internal pada mesin deployment MainZ Voam.";
    return NextResponse.json(
      {
        success: false,
        deploymentId: "",
        deploymentUrl: "",
        readyState: "ERROR",
        projectName: "unknown",
        error: message,
      },
      { status: 500 }
    );
  }
}
