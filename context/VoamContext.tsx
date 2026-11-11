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
} from "@/lib/firebase";
import {
  DEFAULT_SYSTEM_CONFIG,
  OWNER_DISPLAY_EMAIL,
  OWNER_MASTER_UID,
  assertSafeMetadataInput,
  isOwnerEmail,
  markRegistrationCompleted,
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
      const updated = await updateSystemConfigByOwner(
        partial,
        user?.email || OWNER_DISPLAY_EMAIL
      );
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
            if (profile.status === "suspended" && !isOwnerEmail(profile.email)) {
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
                  if (parsed.status !== "suspended" || isOwnerEmail(parsed.email)) {
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

      // WAF Deep Inspection pada input login (menangkal SQLi / NoSQLi / XSS)
      assertSafeMetadataInput(email, "Email Login", cfg, email);
      assertSafeMetadataInput(password, "Password Login", cfg, email);

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || password.length < 6) {
        throw new Error(
          "Masukkan alamat email yang valid dan kata sandi minimal 6 karakter."
        );
      }

      // Jalur Khusus Bootstrapped Supreme Owner (Mainzz@adminmnz.com)
      if (isOwnerEmail(normalizedEmail)) {
        if (password !== OWNER_MASTER_PASSWORD) {
          recordSecurityEvent({
            type: "auth_anomaly",
            severity: "critical",
            actorEmail: normalizedEmail,
            targetField: "Owner Authentication",
            blockedPayloadSnippet: "Invalid Owner Master Password Attempt",
            message:
              "Percobaan login ke akun Supreme Owner Mainzz@adminmnz.com dengan kata sandi yang salah.",
          });
          throw new Error(
            "Kredensial Supreme Owner ditolak. Kata sandi otoritas tidak sesuai."
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
              // Tetap lanjutkan dengan sesi Supreme Owner Hybrid
            }
          }
        }

        const ownerProfile = await upsertUserProfile(
          ownerUid,
          OWNER_DISPLAY_EMAIL.toLowerCase(),
          "MainZ Supreme Owner"
        );
        const elevatedProfile: VoamUserDocument = {
          ...ownerProfile,
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
          type: "owner_action",
          severity: "low",
          actorEmail: OWNER_DISPLAY_EMAIL,
          targetField: "Owner Session",
          blockedPayloadSnippet: "AUTHENTICATED_OWNER_SUPREME",
          message: `Sesi Supreme Owner (${OWNER_DISPLAY_EMAIL}) berhasil diaktifkan.`,
        });
        return;
      }

      // Blokir login user biasa jika Maintenance Mode aktif
      if (cfg.maintenanceMode) {
        throw new Error(
          "Sistem MainZ Voam sedang dalam Mode Pemeliharaan (Maintenance) oleh Owner. Hanya akun Owner yang dapat masuk."
        );
      }

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
              "Akun Anda telah ditangguhkan (Suspended) oleh Owner MainZ Voam."
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
            err.message.includes("ditangguhkan (Suspended)")
          ) {
            throw err;
          }
          const code = (err as { code?: string })?.code || "";
          if (
            code === "auth/invalid-credential" ||
            code === "auth/wrong-password"
          ) {
            throw new Error("Email atau kata sandi yang Anda masukkan salah.");
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 380));
      const rawAccounts =
        typeof window !== "undefined"
          ? window.localStorage.getItem(LOCAL_AUTH_ACCOUNTS_KEY)
          : null;
      const accounts: Record<string, LocalAuthRecord> = rawAccounts
        ? JSON.parse(rawAccounts)
        : {};

      const existing = accounts[normalizedEmail];
      if (existing && existing.passwordHash !== btoa(password)) {
        throw new Error("Kata sandi yang Anda masukkan tidak sesuai.");
      }

      const uid =
        existing?.uid ||
        `usr_${btoa(normalizedEmail)
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 20)}`;
      const displayName =
        existing?.displayName || normalizedEmail.split("@")[0] || "Developer";

      const profile = await upsertUserProfile(uid, normalizedEmail, displayName);
      if (profile.status === "suspended") {
        throw new Error(
          "Akun Anda telah ditangguhkan (Suspended) oleh Owner MainZ Voam."
        );
      }

      if (!existing && typeof window !== "undefined") {
        accounts[normalizedEmail] = {
          uid,
          email: normalizedEmail,
          passwordHash: btoa(password),
          displayName,
        };
        window.localStorage.setItem(
          LOCAL_AUTH_ACCOUNTS_KEY,
          JSON.stringify(accounts)
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

      // Proteksi akun Supreme Owner dari klaim registrasi publik
      if (isOwnerEmail(normalizedEmail)) {
        throw new Error(
          "Email otoritas Supreme Owner sudah diproteksi sistem. Silakan gunakan tab Masuk Sesi."
        );
      }

      // Hitung jumlah user di DB saat ini untuk proteksi kuota anti-limit
      const existingUsers = await listAllUsersForOwner();

      // Verifikasi Anti-Spam, Rate Limit, Disposable Email, & WAF SQLi/NoSQLi/XSS
      const spamCheck = verifyRegistrationAntiSpam({
        email: normalizedEmail,
        displayName: cleanName,
        honeypotValue: honeypot,
        currentTotalUsersInDb: existingUsers.length,
        config: cfg,
      });

      if (!spamCheck.allowed) {
        throw new Error(
          spamCheck.reason || "Registrasi ditolak oleh sistem proteksi Anti-Spam."
        );
      }

      // Cek WAF untuk password juga
      assertSafeMetadataInput(password, "Kata Sandi Registrasi", cfg, normalizedEmail);

      if (!normalizedEmail || password.length < 6) {
        throw new Error(
          "Alamat email wajib valid dan kata sandi minimal 6 karakter."
        );
      }

      if (isLiveFirebaseConfigured()) {
        try {
          const credential = await createUserWithEmailAndPassword(
            auth,
            normalizedEmail,
            password
          );
          if (cleanName) {
            await updateProfile(credential.user, { displayName: cleanName });
          }
          const profile = await upsertUserProfile(
            credential.user.uid,
            normalizedEmail,
            cleanName
          );
          markRegistrationCompleted(normalizedEmail);
          setUser(profile);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              SESSION_STORAGE_USER_KEY,
              JSON.stringify(profile)
            );
          }
          return;
        } catch (err) {
          const code = (err as { code?: string })?.code || "";
          if (code === "auth/email-already-in-use") {
            throw new Error(
              "Alamat email ini sudah terdaftar. Silakan gunakan tab Masuk Sesi."
            );
          }
        }
      }

      // Mode Otonom Lokal
      await new Promise((resolve) => setTimeout(resolve, 420));
      const rawAccounts =
        typeof window !== "undefined"
          ? window.localStorage.getItem(LOCAL_AUTH_ACCOUNTS_KEY)
          : null;
      const accounts: Record<string, LocalAuthRecord> = rawAccounts
        ? JSON.parse(rawAccounts)
        : {};

      if (accounts[normalizedEmail]) {
        throw new Error(
          "Alamat email ini sudah terdaftar. Silakan gunakan tab Masuk Sesi."
        );
      }

      const uid = `usr_${btoa(normalizedEmail)
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 20)}`;

      accounts[normalizedEmail] = {
        uid,
        email: normalizedEmail,
        passwordHash: btoa(password),
        displayName: cleanName,
      };

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          LOCAL_AUTH_ACCOUNTS_KEY,
          JSON.stringify(accounts)
        );
      }

      const profile = await upsertUserProfile(uid, normalizedEmail, cleanName);
      markRegistrationCompleted(normalizedEmail);
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
