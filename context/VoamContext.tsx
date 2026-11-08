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
} from "@/lib/firebase";
import type {
  IslandNotification,
  IslandState,
  VoamUserDocument,
} from "@/types/voam";

interface VoamContextValue {
  user: VoamUserDocument | null;
  loadingAuth: boolean;
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
    displayName: string
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
  const [island, setIsland] = useState<IslandNotification>(DEFAULT_ISLAND);
  const [vercelToken, setVercelTokenState] = useState<string>("");

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
                  setUser(JSON.parse(cached) as VoamUserDocument);
                  setLoadingAuth(false);
                  return;
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
            setUser(parsed);
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
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || password.length < 6) {
        throw new Error(
          "Masukkan alamat email yang valid dan kata sandi minimal 6 karakter."
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
          if (
            code === "auth/invalid-credential" ||
            code === "auth/wrong-password"
          ) {
            throw new Error("Email atau kata sandi yang Anda masukkan salah.");
          }
          // Jika provider Auth belum diaktifkan di Console (auth/configuration-not-found), lanjutkan ke sesi Hybrid Otonom
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 450));
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

      const profile = await upsertUserProfile(uid, normalizedEmail, displayName);
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
      displayName: string
    ): Promise<void> => {
      const normalizedEmail = email.trim().toLowerCase();
      const cleanName = displayName.trim() || normalizedEmail.split("@")[0];

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
          // Jika provider Auth belum diaktifkan di Console (auth/configuration-not-found), lanjutkan ke sesi Hybrid Otonom
        }
      }

      // Mode Otonom Lokal
      await new Promise((resolve) => setTimeout(resolve, 500));
      const rawAccounts =
        typeof window !== "undefined"
          ? window.localStorage.getItem(LOCAL_AUTH_ACCOUNTS_KEY)
          : null;
      const accounts: Record<string, LocalAuthRecord> = rawAccounts
        ? JSON.parse(rawAccounts)
        : {};

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
        loadingAuth,
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
