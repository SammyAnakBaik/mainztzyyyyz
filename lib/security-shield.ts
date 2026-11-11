/**
 * MainZ Voam — Multi-Layered Security Shield (WAF, Anti-SQLi, Anti-NoSQLi, Anti-Spam & DB Quota Guard)
 */

import type {
  SecurityEventSeverity,
  SecurityEventType,
  VoamSecurityLog,
  VoamSystemConfig,
} from "@/types/voam";

export const OWNER_EMAIL = "mainzz@adminmnz.com";
export const OWNER_DISPLAY_EMAIL = "Mainzz@adminmnz.com";

export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL;
}

const SYSTEM_CONFIG_STORAGE_KEY = "mainz_voam_system_config_v1";
const SECURITY_LOGS_STORAGE_KEY = "mainz_voam_security_logs_v1";
const RATE_LIMIT_BUCKETS_KEY = "mainz_voam_rate_buckets_v1";

export const DEFAULT_SYSTEM_CONFIG: VoamSystemConfig = {
  registrationEnabled: true,
  deploymentsEnabled: true,
  maintenanceMode: false,
  sqlInjectionShield: true,
  noSqlInjectionShield: true,
  xssSanitizerShield: true,
  requireHumanChallengeOnRegister: true,
  maxRegistrationsPerWindow: 3,
  registrationCooldownSeconds: 20,
  maxTotalUsersInDb: 500,
  maxProjectsPerUser: 10,
  maxFilesPerProject: 150,
  maxProjectSizeKb: 850,
  blockedEmailDomains: [
    "tempmail.com",
    "mailinator.com",
    "guerrillamail.com",
    "10minutemail.com",
    "yopmail.com",
    "trashmail.com",
    "sharklasers.com",
  ],
  globalAnnouncement: "",
  updatedAt: new Date().toISOString(),
  updatedBy: OWNER_DISPLAY_EMAIL,
};

// ============================================================================
// Pola Deteksi Serangan SQL Injection, NoSQL Injection, XSS, & Path Traversal
// ============================================================================

const SQL_INJECTION_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  {
    name: "SQL Tautology / Auth Bypass (OR 1=1)",
    regex: /(?:'|"|\b)\s*(?:OR|AND)\s+(?:'?[0-9a-zA-Z_]+'?)\s*=\s*(?:'?[0-9a-zA-Z_]+'?)/i,
  },
  {
    name: "SQL UNION SELECT Injection",
    regex: /\bUNION\s+(?:ALL\s+)?SELECT\b/i,
  },
  {
    name: "SQL DDL/DML Destructive Command",
    regex: /\b(?:DROP|ALTER|TRUNCATE)\s+(?:TABLE|DATABASE|USER|SCHEMA)\b/i,
  },
  {
    name: "SQL Stacked Query / Batch Execution",
    regex: /;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|EXEC|EXECUTE|DECLARE)\b/i,
  },
  {
    name: "SQL Time-Based Blind Injection (SLEEP / BENCHMARK / WAITFOR)",
    regex: /\b(?:SLEEP\s*\(\s*\d+\s*\)|BENCHMARK\s*\(|WAITFOR\s+DELAY|PG_SLEEP)\b/i,
  },
  {
    name: "SQL Comment Truncation Sequence (-- / /* */)",
    regex: /(?:'|")\s*(?:--|#|\/\*)/i,
  },
  {
    name: "SQL System Stored Procedure (xp_cmdshell / information_schema)",
    regex: /\b(?:xp_cmdshell|information_schema|sysobjects|sysusers)\b/i,
  },
];

const NOSQL_INJECTION_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  {
    name: "NoSQL Operator Injection ($where / $gt / $ne / $regex)",
    regex: /(?:\$where|\$gt|\$gte|\$lt|\$lte|\$ne|\$nin|\$regex|\$expr)\b/i,
  },
  {
    name: "Prototype Pollution (__proto__ / constructor.prototype)",
    regex: /(?:__proto__|constructor\s*\.\s*prototype|prototype\s*\[)/i,
  },
];

const XSS_METADATA_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  {
    name: "Inline Script Tag Injection",
    regex: /<\s*script\b[^>]*>[\s\S]*?(?:<\s*\/\s*script\s*>|$)/i,
  },
  {
    name: "JavaScript URI / Event Handler Injection",
    regex: /(?:javascript\s*:|onerror\s*=|onload\s*=|onmouseover\s*=|onloadstart\s*=)/i,
  },
];

const PATH_TRAVERSAL_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  {
    name: "Directory Traversal Sequence (../)",
    regex: /(?:^|[\\/])\.\.(?:[\\/]|$)/,
  },
  {
    name: "Null Byte / System Path Injection",
    regex: /(?:\0|^\/etc\/|^\/proc\/|^[a-zA-Z]:\\Windows)/i,
  },
];

// ============================================================================
// Manajemen Konfigurasi Sistem & Audit Log Keamanan
// ============================================================================

export function getLocalSystemConfig(): VoamSystemConfig {
  if (typeof window === "undefined") return DEFAULT_SYSTEM_CONFIG;
  try {
    const raw = window.localStorage.getItem(SYSTEM_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_SYSTEM_CONFIG;
    const parsed = JSON.parse(raw) as Partial<VoamSystemConfig>;
    return {
      ...DEFAULT_SYSTEM_CONFIG,
      ...parsed,
      blockedEmailDomains: Array.isArray(parsed.blockedEmailDomains)
        ? parsed.blockedEmailDomains
        : DEFAULT_SYSTEM_CONFIG.blockedEmailDomains,
    };
  } catch {
    return DEFAULT_SYSTEM_CONFIG;
  }
}

export function saveLocalSystemConfig(config: VoamSystemConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SYSTEM_CONFIG_STORAGE_KEY,
      JSON.stringify(config)
    );
  } catch {
    // Abaikan jika penyimpanan penuh
  }
}

export function getSecurityLogs(): VoamSecurityLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SECURITY_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const logs = JSON.parse(raw) as VoamSecurityLog[];
    return Array.isArray(logs) ? logs : [];
  } catch {
    return [];
  }
}

export function recordSecurityEvent(params: {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  actorEmail?: string;
  targetResource: string;
  details: string;
  blockedPayload?: string;
}): VoamSecurityLog {
  const newLog: VoamSecurityLog = {
    id: `sec_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    type: params.type,
    severity: params.severity,
    actorEmail: params.actorEmail || "anonymous@client",
    targetResource: params.targetResource,
    details: params.details,
    blockedPayload: params.blockedPayload
      ? params.blockedPayload.slice(0, 240)
      : undefined,
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getSecurityLogs();
      const updated = [newLog, ...existing].slice(0, 250);
      window.localStorage.setItem(
        SECURITY_LOGS_STORAGE_KEY,
        JSON.stringify(updated)
      );
    } catch {
      // Abaikan jika gagal menyimpan log
    }
  }

  return newLog;
}

export function clearSecurityLogs(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SECURITY_LOGS_STORAGE_KEY);
  } catch {
    // Abaikan
  }
}

// ============================================================================
// Inspeksi WAF: Anti-SQLi, Anti-NoSQLi, Anti-XSS & Path Traversal
// ============================================================================

export interface WafInspectionResult {
  safe: boolean;
  threatType?: SecurityEventType;
  ruleTriggered?: string;
  sanitizedValue: string;
}

export function inspectInputWithWaf(
  rawInput: string,
  fieldName: string,
  actorEmail = "anonymous@client",
  options?: { allowHtmlCode?: boolean; config?: VoamSystemConfig }
): WafInspectionResult {
  const cfg = options?.config || getLocalSystemConfig();
  const value = rawInput ?? "";

  // 1. Cek SQL Injection
  if (cfg.sqlInjectionShield) {
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.regex.test(value)) {
        recordSecurityEvent({
          type: "SQL_INJECTION_BLOCKED",
          severity: "critical",
          actorEmail,
          targetResource: fieldName,
          details: `WAF memblokir pola serangan ${pattern.name} pada field "${fieldName}".`,
          blockedPayload: value,
        });
        return {
          safe: false,
          threatType: "SQL_INJECTION_BLOCKED",
          ruleTriggered: pattern.name,
          sanitizedValue: "",
        };
      }
    }
  }

  // 2. Cek NoSQL / Firestore Operator Injection
  if (cfg.noSqlInjectionShield) {
    for (const pattern of NOSQL_INJECTION_PATTERNS) {
      if (pattern.regex.test(value)) {
        recordSecurityEvent({
          type: "NOSQL_INJECTION_BLOCKED",
          severity: "critical",
          actorEmail,
          targetResource: fieldName,
          details: `WAF memblokir pola serangan ${pattern.name} pada field "${fieldName}".`,
          blockedPayload: value,
        });
        return {
          safe: false,
          threatType: "NOSQL_INJECTION_BLOCKED",
          ruleTriggered: pattern.name,
          sanitizedValue: "",
        };
      }
    }
  }

  // 3. Cek XSS pada field metadata (nama user, email, nama proyek, path)
  if (cfg.xssSanitizerShield && !options?.allowHtmlCode) {
    for (const pattern of XSS_METADATA_PATTERNS) {
      if (pattern.regex.test(value)) {
        recordSecurityEvent({
          type: "XSS_PAYLOAD_BLOCKED",
          severity: "critical",
          actorEmail,
          targetResource: fieldName,
          details: `WAF memblokir injeksi skrip (${pattern.name}) pada field "${fieldName}".`,
          blockedPayload: value,
        });
        return {
          safe: false,
          threatType: "XSS_PAYLOAD_BLOCKED",
          ruleTriggered: pattern.name,
          sanitizedValue: "",
        };
      }
    }
  }

  return {
    safe: true,
    sanitizedValue: value.trim(),
  };
}

export function assertSafeMetadataInput(
  rawInput: string,
  fieldName: string,
  actorEmail = "anonymous@client"
): string {
  const res = inspectInputWithWaf(rawInput, fieldName, actorEmail);
  if (!res.safe) {
    throw new Error(
      `[WAF Security Shield] Input pada "${fieldName}" ditolak karena terdeteksi mengandung pola berbahaya (${res.ruleTriggered}).`
    );
  }
  return res.sanitizedValue;
}

export function assertSafeFilePath(
  rawPath: string,
  actorEmail = "anonymous@client"
): string {
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.regex.test(rawPath)) {
      recordSecurityEvent({
        type: "PATH_TRAVERSAL_BLOCKED",
        severity: "critical",
        actorEmail,
        targetResource: "fileSystem.path",
        details: `Percobaan Path Traversal (${pattern.name}) diblokir.`,
        blockedPayload: rawPath,
      });
      throw new Error(
        `[WAF Security Shield] Path berkas "${rawPath}" tidak diizinkan (${pattern.name}).`
      );
    }
  }
  return assertSafeMetadataInput(rawPath, "Path Berkas", actorEmail);
}

// ============================================================================
// Anti-Spam Account Creation & Sliding-Window Rate Limiter
// ============================================================================

interface RateBucket {
  timestamps: number[];
  lastAttemptAt: number;
}

function getRateBuckets(): Record<string, RateBucket> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RATE_LIMIT_BUCKETS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, RateBucket>) : {};
  } catch {
    return {};
  }
}

function saveRateBuckets(buckets: Record<string, RateBucket>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RATE_LIMIT_BUCKETS_KEY,
      JSON.stringify(buckets)
    );
  } catch {
    // Abaikan
  }
}

export function verifyRegistrationAntiSpam(params: {
  email: string;
  displayName: string;
  currentTotalUsers: number;
  honeypotValue?: string;
}): void {
  const cfg = getLocalSystemConfig();
  const normalizedEmail = params.email.trim().toLowerCase();

  // Owner selalu diizinkan melewati batas publik
  if (isOwnerEmail(normalizedEmail)) {
    return;
  }

  // 1. Cek Honeypot Bot Trap
  if (params.honeypotValue && params.honeypotValue.trim().length > 0) {
    recordSecurityEvent({
      type: "SPAM_REGISTRATION_BLOCKED",
      severity: "critical",
      actorEmail: normalizedEmail,
      targetResource: "auth/register",
      details: "Bot terdeteksi mengisi field honeypot tersembunyi.",
    });
    throw new Error("Sistem keamanan mendeteksi aktivitas bot otomatis.");
  }

  // 2. Cek apakah pendaftaran publik sedang dikunci oleh Owner
  if (!cfg.registrationEnabled) {
    recordSecurityEvent({
      type: "SPAM_REGISTRATION_BLOCKED",
      severity: "warning",
      actorEmail: normalizedEmail,
      targetResource: "auth/register",
      details:
        "Pendaftaran akun ditolak karena fitur registrasi publik sedang dikunci oleh Owner.",
    });
    throw new Error(
      "Pendaftaran akun baru saat ini sedang ditutup sementara oleh Administrator Utama (Owner)."
    );
  }

  // 3. Cek Kuota Maksimum Total Akun di Database
  if (params.currentTotalUsers >= cfg.maxTotalUsersInDb) {
    recordSecurityEvent({
      type: "DB_QUOTA_ENFORCED",
      severity: "critical",
      actorEmail: normalizedEmail,
      targetResource: "users/quota",
      details: `Batas kuota database tercapai (${params.currentTotalUsers}/${cfg.maxTotalUsersInDb} akun). Pendaftaran baru ditahan otomatis.`,
    });
    throw new Error(
      `Kuota maksimum pengguna database (${cfg.maxTotalUsersInDb} akun) telah tercapai. Hubungi Owner untuk menaikkan limit DB.`
    );
  }

  // 4. Inspeksi WAF terhadap Email & Display Name
  assertSafeMetadataInput(normalizedEmail, "Alamat Email", normalizedEmail);
  assertSafeMetadataInput(
    params.displayName,
    "Nama Tampilan Developer",
    normalizedEmail
  );

  // 5. Cek Domain Email Sekali Pakai (Disposable / Spam Email Blacklist)
  const emailParts = normalizedEmail.split("@");
  if (emailParts.length !== 2 || !emailParts[1].includes(".")) {
    throw new Error("Format alamat email tidak valid.");
  }
  const domain = emailParts[1];
  if (
    cfg.blockedEmailDomains.some(
      (blocked) =>
        domain === blocked.toLowerCase() ||
        domain.endsWith(`.${blocked.toLowerCase()}`)
    )
  ) {
    recordSecurityEvent({
      type: "SPAM_REGISTRATION_BLOCKED",
      severity: "warning",
      actorEmail: normalizedEmail,
      targetResource: "auth/register",
      details: `Domain email sekali pakai / spam (${domain}) diblokir oleh daftar hitam.`,
    });
    throw new Error(
      `Domain email "${domain}" tidak diizinkan oleh kebijakan Anti-Spam MainZ Voam. Gunakan email resmi.`
    );
  }

  // 6. Cek Sliding-Window Rate Limit & Cooldown Pendaftaran Akun
  const buckets = getRateBuckets();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // Jendela 15 menit
  const regBucket = buckets["register_account"] || {
    timestamps: [],
    lastAttemptAt: 0,
  };

  const recentTimestamps = regBucket.timestamps.filter(
    (ts) => now - ts < windowMs
  );

  const cooldownMs = cfg.registrationCooldownSeconds * 1000;
  if (
    regBucket.lastAttemptAt > 0 &&
    now - regBucket.lastAttemptAt < cooldownMs
  ) {
    const remainingSec = Math.ceil(
      (cooldownMs - (now - regBucket.lastAttemptAt)) / 1000
    );
    recordSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      severity: "warning",
      actorEmail: normalizedEmail,
      targetResource: "auth/register",
      details: `Cooldown pendaftaran aktif (${remainingSec} detik tersisa).`,
    });
    throw new Error(
      `Terlalu cepat membuat akun baru. Harap tunggu ${remainingSec} detik sebelum mencoba kembali.`
    );
  }

  if (recentTimestamps.length >= cfg.maxRegistrationsPerWindow) {
    recordSecurityEvent({
      type: "RATE_LIMIT_TRIGGERED",
      severity: "critical",
      actorEmail: normalizedEmail,
      targetResource: "auth/register",
      details: `Melebihi batas maksimum pembuatan akun (${cfg.maxRegistrationsPerWindow} akun / 15 menit).`,
    });
    throw new Error(
      `Batas keamanan Anti-Spam tercapai (maksimal ${cfg.maxRegistrationsPerWindow} pembuatan akun dalam 15 menit).`
    );
  }

  // Catat percobaan yang lolos
  buckets["register_account"] = {
    timestamps: [...recentTimestamps, now],
    lastAttemptAt: now,
  };
  saveRateBuckets(buckets);
}

/**
 * Validasi Kuota Proyek & Ukuran FileSystem sebelum disimpan ke Firestore
 */
export function verifyProjectQuotaAndSecurity(params: {
  actorEmail: string;
  actorRole: "developer" | "owner";
  projectName: string;
  fileSystem: Record<string, string>;
  currentUserProjectCount: number;
  customUserMaxProjects?: number;
  isNewProject: boolean;
}): void {
  const cfg = getLocalSystemConfig();
  const isOwner = params.actorRole === "owner" || isOwnerEmail(params.actorEmail);

  if (!isOwner && cfg.maintenanceMode) {
    throw new Error(
      "Sistem sedang dalam Mode Pemeliharaan (Maintenance Mode) oleh Owner. Operasi tulis dihentikan sementara."
    );
  }

  if (!isOwner && !cfg.deploymentsEnabled) {
    throw new Error(
      "Pipeline deployment sedang dibekukan sementara oleh Owner."
    );
  }

  // 1. WAF Check pada Nama Proyek
  assertSafeMetadataInput(
    params.projectName,
    "Nama Proyek",
    params.actorEmail
  );

  // 2. Cek batas jumlah proyek per pengguna (untuk proyek baru)
  const effectiveMaxProjects =
    params.customUserMaxProjects ?? cfg.maxProjectsPerUser;
  if (
    !isOwner &&
    params.isNewProject &&
    params.currentUserProjectCount >= effectiveMaxProjects
  ) {
    recordSecurityEvent({
      type: "DB_QUOTA_ENFORCED",
      severity: "warning",
      actorEmail: params.actorEmail,
      targetResource: "projects/create",
      details: `Pengguna mencapai batas maksimum proyek (${params.currentUserProjectCount}/${effectiveMaxProjects}).`,
    });
    throw new Error(
      `Anda telah mencapai batas kuota maksimum (${effectiveMaxProjects} proyek per akun). Hapus proyek lama atau hubungi Owner.`
    );
  }

  // 3. Cek jumlah file & Path Traversal pada seluruh entri fileSystem
  const entries = Object.entries(params.fileSystem);
  if (entries.length === 0) {
    throw new Error("Virtual FileSystem tidak boleh kosong.");
  }

  if (!isOwner && entries.length > cfg.maxFilesPerProject) {
    recordSecurityEvent({
      type: "DB_QUOTA_ENFORCED",
      severity: "warning",
      actorEmail: params.actorEmail,
      targetResource: "projects/fileCount",
      details: `Jumlah berkas (${entries.length}) melebihi batas ${cfg.maxFilesPerProject} berkas/proyek.`,
    });
    throw new Error(
      `Jumlah berkas (${entries.length}) melebihi batas kuota (${cfg.maxFilesPerProject} berkas per proyek).`
    );
  }

  let totalBytes = 0;
  for (const [filePath, content] of entries) {
    assertSafeFilePath(filePath, params.actorEmail);
    totalBytes += filePath.length + content.length;
  }

  const totalKb = Math.ceil(totalBytes / 1024);
  if (!isOwner && totalKb > cfg.maxProjectSizeKb) {
    recordSecurityEvent({
      type: "DB_QUOTA_ENFORCED",
      severity: "critical",
      actorEmail: params.actorEmail,
      targetResource: "projects/sizeLimit",
      details: `Ukuran bundel (${totalKb} KB) melebihi batas kuota DB (${cfg.maxProjectSizeKb} KB).`,
    });
    throw new Error(
      `Ukuran bundel proyek (${totalKb} KB) melebihi batas keamanan database (${cfg.maxProjectSizeKb} KB).`
    );
  }
}
