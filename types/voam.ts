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
 */
export type VirtualFileSystem = Record<string, string>;

export type UserRole = "developer" | "owner";
export type UserAccountStatus = "active" | "suspended";

export interface VoamUserDocument {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status?: UserAccountStatus;
  customMaxProjects?: number;
  createdAt: string;
  lastLoginAt: string;
}

export type ProjectDeployStatus =
  | "deployed"
  | "building"
  | "error"
  | "redeploying"
  | "quarantined";

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
 * Konfigurasi Global Sistem, WAF Anti-SQLi, Anti-Spam & Limitasi Kuota DB
 * Dikelola penuh oleh Akun Owner (Mainzz@adminmnz.com)
 */
export interface VoamSystemConfig {
  registrationEnabled: boolean;
  deploymentsEnabled: boolean;
  maintenanceMode: boolean;
  sqlInjectionShield: boolean;
  noSqlInjectionShield: boolean;
  xssSanitizerShield: boolean;
  requireHumanChallengeOnRegister: boolean;
  maxRegistrationsPerWindow: number;
  registrationCooldownSeconds: number;
  maxTotalUsersInDb: number;
  maxProjectsPerUser: number;
  maxFilesPerProject: number;
  maxProjectSizeKb: number;
  blockedEmailDomains: string[];
  globalAnnouncement: string;
  updatedAt: string;
  updatedBy: string;
}

export type SecurityEventSeverity = "critical" | "warning" | "info";

export type SecurityEventType =
  | "SQL_INJECTION_BLOCKED"
  | "NOSQL_INJECTION_BLOCKED"
  | "XSS_PAYLOAD_BLOCKED"
  | "PATH_TRAVERSAL_BLOCKED"
  | "SPAM_REGISTRATION_BLOCKED"
  | "RATE_LIMIT_TRIGGERED"
  | "DB_QUOTA_ENFORCED"
  | "OWNER_CONFIG_UPDATED"
  | "USER_STATUS_CHANGED";

export interface VoamSecurityLog {
  id: string;
  timestamp: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  actorEmail: string;
  targetResource: string;
  details: string;
  blockedPayload?: string;
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
