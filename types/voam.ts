/**
 * Definisi Tipe Data Inti — MainZ Voam
 * Strict TypeScript Mode (Tanpa `any`)
 */

export type IslandState =
  | "idle"
  | "uploading"
  | "redeploying"
  | "building"
  | "deployed"
  | "error";

export interface IslandNotification {
  state: IslandState;
  title: string;
  subtitle?: string;
  deploymentUrl?: string;
  errorMessage?: string;
  progress?: number;
}

/**
 * Representasi Virtual File System di memori dan Firestore.
 * Key adalah path ternormalisasi (contoh: "/index.html", "/css/style.css", "/js/app.js")
 * Value adalah isi teks mentah (raw UTF-8 source code) dari file tersebut.
 */
export type VirtualFileSystem = Record<string, string>;

export interface VoamUserDocument {
  uid: string;
  email: string;
  displayName: string;
  role: "developer";
  createdAt: string;
  lastLoginAt: string;
}

export type ProjectDeployStatus = "deployed" | "building" | "error" | "redeploying";

export interface VoamProjectDocument {
  uid: string;
  ownerEmail: string;
  name: string;
  slug: string;
  deploymentId: string;
  deploymentUrl: string;
  status: ProjectDeployStatus;
  fileCount: number;
  hasAutoFallbackIndex: boolean;
  /**
   * Disimpan sebagai JSON stringified atau objek Map di Firestore.
   * Saat ditarik ke aplikasi, dinormalisasi menjadi VirtualFileSystem.
   */
  fileSystem: string | VirtualFileSystem;
  createdAt: string;
  updatedAt: string;
}

export interface VoamProject {
  id: string;
  uid: string;
  ownerEmail: string;
  name: string;
  slug: string;
  deploymentId: string;
  deploymentUrl: string;
  status: ProjectDeployStatus;
  fileCount: number;
  hasAutoFallbackIndex: boolean;
  fileSystem: VirtualFileSystem;
  createdAt: string;
  updatedAt: string;
}

/**
 * Struktur Payload Standar Vercel REST API v13
 */
export interface VercelV13FileEntry {
  file: string;
  data: string;
  encoding?: "utf-8" | "base64";
}

export interface VercelV13DeployRequestPayload {
  name: string;
  files: VercelV13FileEntry[];
  projectSettings: {
    framework: null;
    buildCommand: null;
    outputDirectory: null;
    installCommand: null;
  };
  target?: "production" | "staging";
}

export interface VercelDeployApiResponse {
  success: boolean;
  deploymentId: string;
  deploymentUrl: string;
  readyState: string;
  projectName: string;
  simulated?: boolean;
  error?: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  extension?: string;
  children?: FileTreeNode[];
}
