import { NextRequest, NextResponse } from "next/server";
import type {
  VercelDeployApiResponse,
  VercelV13DeployRequestPayload,
} from "@/types/voam";

/**
 * Route Backend Next.js App Router — `/api/deploy`
 * Meneruskan payload standar Vercel REST API v13 ke `https://api.vercel.com/v13/deployments`
 * menggunakan Bearer Token dari header `x-vercel-token` atau environment `VERCEL_TOKEN`.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<VercelDeployApiResponse>> {
  try {
    const body = (await request.json()) as VercelV13DeployRequestPayload;

    if (!body || !body.name || !Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          deploymentId: "",
          deploymentUrl: "",
          readyState: "ERROR",
          projectName: body?.name || "unknown",
          error: "Payload Vercel v13 tidak valid: properti name dan files wajib diisi.",
        },
        { status: 400 }
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
    const envToken = process.env.VERCEL_TOKEN?.trim();
    const activeToken = headerToken || envToken || "";
    const teamId = process.env.VERCEL_TEAM_ID?.trim();

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
          `Vercel API menolak permintaan (HTTP ${vercelResponse.status}). Periksa kembali VERCEL_TOKEN Anda.`;
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

    // Jika VERCEL_TOKEN belum disetel di .env.local maupun di Vault UI,
    // jalankan Edge Deployment Simulator berkecepatan tinggi agar pipeline & Firestore tetap berjalan utuh
    await new Promise((resolve) => setTimeout(resolve, 650));
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
