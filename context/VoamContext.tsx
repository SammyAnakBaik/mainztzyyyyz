"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  auth,
  isLiveFirebaseConfigured,
  upsertUserProfile,
  fetchSystemConfig,
  updateSystemConfigByOwner,
  listAllUsersForOwner,
  updateUserByOwner,
} from "@/lib/firebase";
import {
  DEFAULT_SYSTEM_CONFIG,
  OWNER_DISPLAY_EMAIL,
  OWNER_MASTER_UID,
  assertSafeMetadataInput,
  isOwnerEmail,
  recordSecurityEvent,
  verifyRegistrationAntiSpam,
} from "@/lib/security-shield";
import type {
  IslandNotification,
  IslandState,
  VoamSystemConfig,
  VoamUserDocument,
} from "@/types/voam";

const OWNER_MASTER_PASSWORD =
  process.env.NEXT_PUBLIC_VOAM_OWNER_PASSWORD || "mainz1201";

interface VoamContextValue {
  user: VoamUserDocument | null;
  isOwner: boolean;
  loadingAuth: boolean;
  systemConfig: VoamSystemConfig;
  refreshSystemConfig: () => Promise<void>;
  updateSystemConfig: (
    partial: Partial<VoamSystemConfig>
  ) => Promise<VoamSystemConfig>;
  provisionUserByOwner: (params: {
    email: string;
    password: string;
    displayName: string;
    customMaxProjects: number;
  }) => Promise<VoamUserDocument>;
  island: IslandNotification;
  vercelToken: string;
  setVercelToken: (token: string) => void;
  setIsland: React.Dispatch<React.SetStateAction<IslandNotification>>;
  setIslandStatus: (
    state: IslandState,
    title: string,
    options?: {
      subtitle?: string;
      deploymentUrl?: string;
      errorMessage?: string;
      progress?: number;
      autoResetMs?: number;
    }
  ) => void;
  resetIsland: () => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (
    email: string,
    password: string,
    displayName: string,
    honeypot?: string
  ) => Promise<void>;
  logoutUser: () => Promise<void>;
}

const DEFAULT_ISLAND: IslandNotification = {
  state: "idle",
  title: "MainZ Voam Engine Ready",
  subtitle: "Vercel API v13 • Cloud IDE",
};

const SESSION_STORAGE_USER_KEY = "mainz_voam_active_session_v1";
const LOCAL_AUTH_ACCOUNTS_KEY = "mainz_voam_auth_accounts_v1";
const LOCAL_VERCEL_TOKEN_KEY = "mainz_voam_vercel_token_v1";

interface LocalAuthRecord {
  uid: string;
  email: string;
  passwordHash: string;
  displayName: string;
}

function getRegisteredAccountsMap(): Record<string, LocalAuthRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_AUTH_ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalAuthRecord>) : {};
  } catch {
    return {};
  }
}

function saveRegisteredAccountsMap(map: Record<string, LocalAuthRecord>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_AUTH_ACCOUNTS_KEY, JSON.stringify(map));
  } catch {
    // Abaikan
  }
}

const VoamContext = createContext<VoamContextValue | undefined>(undefined);

export function VoamProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<VoamUserDocument | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [systemConfig, setSystemConfig] = useState<VoamSystemConfig>(
    DEFAULT_SYSTEM_CONFIG
  );
  const [island, setIsland] = useState<IslandNotification>(DEFAULT_ISLAND);
  const [vercelToken, setVercelTokenState] = useState<string>("");

  const isOwner = Boolean(
    user && (user.role === "owner" || isOwnerEmail(user.email))
  );

  const refreshSystemConfig = useCallback(async () => {
    const cfg = await fetchSystemConfig();
    setSystemConfig(cfg);
  }, []);

  const updateSystemConfig = useCallback(
    async (partial: Partial<VoamSystemConfig>): Promise<VoamSystemConfig> => {
      const currentCfg = await fetchSystemConfig();
      const merged: VoamSystemConfig = {
        ...currentCfg,
        ...partial,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || OWNER_DISPLAY_EMAIL,
      };
      const updated = await updateSystemConfigByOwner(merged);
      setSystemConfig(updated);
      return updated;
    },
    [user]
  );

  useEffect(() => {
    refreshSystemConfig();
  }, [refreshSystemConfig]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken =
        window.localStorage.getItem(LOCAL_VERCEL_TOKEN_KEY) || "";
      setVercelTokenState(savedToken);
    }
  }, []);

  const setVercelToken = useCallback((token: string) => {
    setVercelTokenState(token);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_VERCEL_TOKEN_KEY, token.trim());
    }
  }, []);

  const resetIsland = useCallback(() => {
    setIsland(DEFAULT_ISLAND);
  }, []);

  const setIslandStatus = useCallback(
    (
      state: IslandState,
      title: string,
      options?: {
        subtitle?: string;
        deploymentUrl?: string;
        errorMessage?: string;
        progress?: number;
        autoResetMs?: number;
      }
    ) => {
      setIsland({
        state,
        title,
        subtitle: options?.subtitle,
        deploymentUrl: options?.deploymentUrl,
        errorMessage: options?.errorMessage,
        progress: options?.progress,
      });

      if (options?.autoResetMs && options.autoResetMs > 0) {
        window.setTimeout(() => {
          setIsland((prev) => (prev.state === state ? DEFAULT_ISLAND : prev));
        }, options.autoResetMs);
      }
    },
    []
  );

  // Sinkronisasi sesi autentikasi Firebase & sesi lokal
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (isLiveFirebaseConfigured()) {
      unsubscribe = onAuthStateChanged(
        auth,
        async (fbUser: FirebaseUser | null) => {
          if (fbUser && fbUser.email) {
            const profile = await upsertUserProfile(
              fbUser.uid,
              fbUser.email,
              fbUser.displayName || undefined
            );
            if (
              profile.status === "suspended" &&
              !isOwnerEmail(profile.email)
            ) {
              await firebaseSignOut(auth);
              setUser(null);
              if (typeof window !== "undefined") {
                window.localStorage.removeItem(SESSION_STORAGE_USER_KEY);
              }
              setLoadingAuth(false);
              return;
            }
            setUser(profile);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(
                SESSION_STORAGE_USER_KEY,
                JSON.stringify(profile)
              );
            }
          } else {
            if (typeof window !== "undefined") {
              try {
                const cached = window.localStorage.getItem(
                  SESSION_STORAGE_USER_KEY
                );
                if (cached) {
                  const parsed = JSON.parse(cached) as VoamUserDocument;
                  if (
                    parsed.status !== "suspended" ||
                    isOwnerEmail(parsed.email)
                  ) {
                    setUser(parsed);
                    setLoadingAuth(false);
                    return;
                  }
                }
              } catch {
                // Abaikan cache tidak valid
              }
            }
            setUser(null);
          }
          setLoadingAuth(false);
        }
      );
    } else {
      if (typeof window !== "undefined") {
        try {
          const cached = window.localStorage.getItem(SESSION_STORAGE_USER_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as VoamUserDocument;
            if (parsed.status !== "suspended" || isOwnerEmail(parsed.email)) {
              setUser(parsed);
            }
          }
        } catch {
          // Abaikan sesi rusak
        }
      }
      setLoadingAuth(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<void> => {
      const cfg = await fetchSystemConfig();
      setSystemConfig(cfg);

      // 1. WAF Deep Inspection pada input login (menangkal SQLi / NoSQLi / XSS)
      assertSafeMetadataInput(email, "Email Login", email);
      assertSafeMetadataInput(password, "Password Login", email);

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        throw new Error("Masukkan format alamat email yang valid.");
      }
      if (password.length < 6) {
        throw new Error("Kata sandi wajib minimal 6 karakter.");
      }

      // 2. Jalur Khusus Bootstrapped Supreme Owner (Mainzz@adminmnz.com)
      if (isOwnerEmail(normalizedEmail)) {
        if (password !== OWNER_MASTER_PASSWORD) {
          recordSecurityEvent({
            type: "SPAM_REGISTRATION_BLOCKED",
            severity: "critical",
            actorEmail: normalizedEmail,
            targetResource: "auth/owner-login",
            details:
              "Percobaan login ke akun Supreme Owner Mainzz@adminmnz.com dengan kata sandi yang salah.",
          });
          throw new Error(
            "Kata sandi untuk akun Supreme Owner (Mainzz@adminmnz.com) salah!"
          );
        }

        let ownerUid = OWNER_MASTER_UID;

        if (isLiveFirebaseConfigured()) {
          try {
            const credential = await signInWithEmailAndPassword(
              auth,
              normalizedEmail,
              password
            );
            ownerUid = credential.user.uid;
          } catch {
            try {
              const created = await createUserWithEmailAndPassword(
                auth,
                normalizedEmail,
                password
              );
              await updateProfile(created.user, {
                displayName: "MainZ Supreme Owner",
              });
              ownerUid = created.user.uid;
            } catch {
              // Gunakan UID Master Supreme Owner
            }
          }
        }

        const ownerProfile = await upsertUserProfile(
          ownerUid,
          OWNER_DISPLAY_EMAIL,
          "MainZ Supreme Owner"
        );
        const elevatedProfile: VoamUserDocument = {
          ...ownerProfile,
          email: OWNER_DISPLAY_EMAIL,
          role: "owner",
          status: "active",
          customMaxProjects: 9999,
        };

        setUser(elevatedProfile);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            SESSION_STORAGE_USER_KEY,
            JSON.stringify(elevatedProfile)
          );
        }

        recordSecurityEvent({
          type: "OWNER_CONFIG_UPDATED",
          severity: "info",
          actorEmail: OWNER_DISPLAY_EMAIL,
          targetResource: "auth/owner-session",
          details: `Sesi Supreme Owner (${OWNER_DISPLAY_EMAIL}) berhasil diaktifkan.`,
        });
        return;
      }

      // 3. Tolak email salah ketik domain @adminmnz.com (misal mainnnzz@adminmnz.com)
      const localAccounts = getRegisteredAccountsMap();
      if (
        normalizedEmail.endsWith("@adminmnz.com") &&
        !localAccounts[normalizedEmail]
      ) {
        recordSecurityEvent({
          type: "SPAM_REGISTRATION_BLOCKED",
          severity: "warning",
          actorEmail: normalizedEmail,
          targetResource: "auth/login",
          details: `Percobaan login menggunakan email domain admin tidak dikenal (${normalizedEmail}).`,
        });
        throw new Error(
          `Akun "${normalizedEmail}" tidak terdaftar! Jika Anda ingin masuk sebagai Owner, gunakan email resmi: Mainzz@adminmnz.com`
        );
      }

      // 4. Blokir login user biasa jika Maintenance Mode aktif
      if (cfg.maintenanceMode) {
        throw new Error(
          "Sistem MainZ Voam sedang dalam Mode Lockdown (Maintenance) oleh Owner. Hanya akun Owner yang dapat masuk."
        );
      }

      // 5. Coba autentikasi via Firebase Auth jika provider aktif
      if (isLiveFirebaseConfigured()) {
        try {
          const credential = await signInWithEmailAndPassword(
            auth,
            normalizedEmail,
            password
          );
          const profile = await upsertUserProfile(
            credential.user.uid,
            credential.user.email || normalizedEmail,
            credential.user.displayName || undefined
          );
          if (profile.status === "suspended") {
            await firebaseSignOut(auth);
            throw new Error(
              "Akun Anda telah dibekukan (Suspended) oleh Owner MainZ Voam."
            );
          }
          setUser(profile);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              SESSION_STORAGE_USER_KEY,
              JSON.stringify(profile)
            );
          }
          return;
        } catch (err) {
          if (
            err instanceof Error &&
            err.message.includes("dibekukan (Suspended)")
          ) {
            throw err;
          }
          const code = (err as { code?: string })?.code || "";
          if (code === "auth/wrong-password") {
            throw new Error("Kata sandi yang Anda masukkan salah.");
          }
          if (code === "auth/user-not-found") {
            throw new Error(
              `Akun dengan email "${normalizedEmail}" belum terdaftar! Silakan daftar terlebih dahulu pada tab Daftar Akun.`
            );
          }
          if (code === "auth/invalid-credential") {
            // Cek apakah ada di registri lokal, jika tidak ada berarti belum terdaftar
            if (!localAccounts[normalizedEmail]) {
              throw new Error(
                `Akun "${normalizedEmail}" belum terdaftar atau kata sandi salah! Silakan daftar terlebih dahulu pada tab Daftar Akun.`
              );
            }
          }
        }
      }

      // 6. Pengecekan Ketat Registri Akun Terdaftar (TIDAK BOLEH Auto-Create saat Login!)
      await new Promise((resolve) => setTimeout(resolve, 320));
      const existingAccount = localAccounts[normalizedEmail];

      if (!existingAccount) {
        throw new Error(
          `Akun dengan email "${normalizedEmail}" belum terdaftar! Silakan buat akun terlebih dahulu melalui tab Daftar Akun.`
        );
      }

      if (existingAccount.passwordHash !== btoa(password)) {
        throw new Error(
          "Kata sandi yang Anda masukkan salah. Periksa kembali kata sandi Anda."
        );
      }

      const profile = await upsertUserProfile(
        existingAccount.uid,
        normalizedEmail,
        existingAccount.displayName
      );
      if (profile.status === "suspended") {
        throw new Error(
          "Akun Anda telah dibekukan (Suspended) oleh Owner MainZ Voam."
        );
      }

      setUser(profile);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          SESSION_STORAGE_USER_KEY,
          JSON.stringify(profile)
        );
      }
    },
    []
  );

  const registerWithEmail = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      honeypot?: string
    ): Promise<void> => {
      const cfg = await fetchSystemConfig();
      setSystemConfig(cfg);

      const normalizedEmail = email.trim().toLowerCase();
      const cleanName = displayName.trim() || normalizedEmail.split("@")[0];

      // Proteksi domain @adminmnz.com & akun Supreme Owner dari klaim registrasi publik
      if (
        isOwnerEmail(normalizedEmail) ||
        normalizedEmail.endsWith("@adminmnz.com")
      ) {
        throw new Error(
          "Domain @adminmnz.com merupakan domain otoritas khusus Owner dan tidak dapat didaftarkan oleh publik."
        );
      }

      const existingUsers = await listAllUsersForOwner();

      // Verifikasi Anti-Spam, Rate Limit, Disposable Email, & WAF SQLi/NoSQLi/XSS
      verifyRegistrationAntiSpam({
        email: normalizedEmail,
        displayName: cleanName,
        currentTotalUsers: existingUsers.length,
        honeypotValue: honeypot,
      });

      // Cek WAF untuk password juga
      assertSafeMetadataInput(
        password,
        "Kata Sandi Registrasi",
        normalizedEmail
      );

      if (!normalizedEmail || password.length < 6) {
        throw new Error(
          "Alamat email wajib valid dan kata sandi minimal 6 karakter."
        );
      }

      const accounts = getRegisteredAccountsMap();
      if (accounts[normalizedEmail]) {
        throw new Error(
          "Alamat email ini sudah terdaftar! Silakan masuk melalui tab Masuk Sesi."
        );
      }

      let uid = `usr_${btoa(normalizedEmail)
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 20)}`;

      if (isLiveFirebaseConfigured()) {
        try {
          const credential = await createUserWithEmailAndPassword(
            auth,
            normalizedEmail,
            password
          );
          uid = credential.user.uid;
          if (cleanName) {
            await updateProfile(credential.user, { displayName: cleanName });
          }
        } catch (err) {
          const code = (err as { code?: string })?.code || "";
          if (code === "auth/email-already-in-use") {
            throw new Error(
              "Alamat email ini sudah terdaftar. Silakan gunakan tab Masuk Sesi."
            );
          }
        }
      }

      // Simpan kredensial terdaftar agar bisa diverifikasi saat Login
      accounts[normalizedEmail] = {
        uid,
        email: normalizedEmail,
        passwordHash: btoa(password),
        displayName: cleanName,
      };
      saveRegisteredAccountsMap(accounts);

      const profile = await upsertUserProfile(uid, normalizedEmail, cleanName);
      setUser(profile);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          SESSION_STORAGE_USER_KEY,
          JSON.stringify(profile)
        );
      }
    },
    []
  );

  // Fungsi khusus Owner untuk membuat akun baru lengkap dengan password dari /owner
  const provisionUserByOwner = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName: string;
      customMaxProjects: number;
    }): Promise<VoamUserDocument> => {
      const normalizedEmail = params.email.trim().toLowerCase();
      assertSafeMetadataInput(
        normalizedEmail,
        "Email Provisioning",
        OWNER_DISPLAY_EMAIL
      );
      const cleanName =
        assertSafeMetadataInput(
          params.displayName || normalizedEmail.split("@")[0] || "Developer",
          "Nama Provisioning",
          OWNER_DISPLAY_EMAIL
        ) || "Developer";

      if (params.password.length < 6) {
        throw new Error("Kata sandi akun baru minimal 6 karakter.");
      }

      const uid = `usr_prov_${btoa(normalizedEmail)
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 18)}`;

      const accounts = getRegisteredAccountsMap();
      accounts[normalizedEmail] = {
        uid,
        email: normalizedEmail,
        passwordHash: btoa(params.password),
        displayName: cleanName,
      };
      saveRegisteredAccountsMap(accounts);

      await upsertUserProfile(uid, normalizedEmail, cleanName);
      const updated = await updateUserByOwner(uid, {
        displayName: cleanName,
        status: "active",
        customMaxProjects: params.customMaxProjects,
      });

      return updated;
    },
    []
  );

  const logoutUser = useCallback(async (): Promise<void> => {
    if (isLiveFirebaseConfigured()) {
      await firebaseSignOut(auth);
    }
    setUser(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_STORAGE_USER_KEY);
    }
    resetIsland();
  }, [resetIsland]);

  return (
    <VoamContext.Provider
      value={{
        user,
        isOwner,
        loadingAuth,
        systemConfig,
        refreshSystemConfig,
        updateSystemConfig,
        provisionUserByOwner,
        island,
        vercelToken,
        setVercelToken,
        setIsland,
        setIslandStatus,
        resetIsland,
        loginWithEmail,
        registerWithEmail,
        logoutUser,
      }}
    >
      {children}
    </VoamContext.Provider>
  );
}

export function useVoam(): VoamContextValue {
  const ctx = useContext(VoamContext);
  if (!ctx) {
    throw new Error("useVoam wajib digunakan di dalam <VoamProvider />");
  }
  return ctx;
}
