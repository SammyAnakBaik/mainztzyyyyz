import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  type Firestore,
} from "firebase/firestore";
import {
  DEFAULT_SYSTEM_CONFIG,
  OWNER_DISPLAY_EMAIL,
  OWNER_EMAIL,
  assertSafeFilePath,
  assertSafeMetadataInput,
  getLocalSystemConfig,
  isOwnerEmail,
  recordSecurityEvent,
  saveLocalSystemConfig,
  verifyProjectQuotaAndSecurity,
} from "@/lib/security-shield";
import type {
  UserAccountStatus,
  UserRole,
  VirtualFileSystem,
  VoamProject,
  VoamProjectDocument,
  VoamSystemConfig,
  VoamUserDocument,
} from "@/types/voam";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyBpqTDYLJHJ8aMDdJETloqX1ADuxnzMp44",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "mainz-voam.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mainz-voam",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "mainz-voam.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "659919046966",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:659919046966:web:34cc01e876f1e8fc0b0b97",
};

export function isLiveFirebaseConfigured(): boolean {
  const key = firebaseConfig.apiKey;
  return (
    Boolean(key) &&
    key !== "demo-mainz-voam-api-key" &&
    key !== "placeholder_will_update" &&
    !key.startsWith("YOUR_")
  );
}

const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export function isCloudSessionActive(): boolean {
  return isLiveFirebaseConfigured() && Boolean(auth.currentUser);
}

export { app, auth, db };

// ============================================================================
// Helper Normalisasi & Serialisasi Virtual FileSystem
// ============================================================================

export function normalizeFilePath(rawPath: string): string {
  const cleaned = rawPath.replace(/\\/g, "/").trim();
  if (!cleaned) return "/untitled.txt";
  const withoutRelative = cleaned.replace(/^(\.\/)+/, "");
  return withoutRelative.startsWith("/")
    ? withoutRelative
    : `/${withoutRelative}`;
}

export function serializeFileSystem(fs: VirtualFileSystem): string {
  const normalized: VirtualFileSystem = {};
  Object.entries(fs).forEach(([filePath, content]) => {
    normalized[normalizeFilePath(filePath)] = content;
  });
  return JSON.stringify(normalized);
}

export function parseFileSystem(
  raw: string | VirtualFileSystem | undefined | null
): VirtualFileSystem {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const result: VirtualFileSystem = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === "string") {
          result[normalizeFilePath(k)] = v;
        }
      });
      return result;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") {
    const result: VirtualFileSystem = {};
    Object.entries(raw).forEach(([k, v]) => {
      if (typeof v === "string") {
        result[normalizeFilePath(k)] = v;
      }
    });
    return result;
  }
  return {};
}

// ============================================================================
// Local Persistence Mirror
// ============================================================================

const LOCAL_USERS_KEY = "mainz_voam_users_v1";
const LOCAL_PROJECTS_KEY = "mainz_voam_projects_v1";

export function getLocalUsersMap(): Record<string, VoamUserDocument> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_USERS_KEY);
    const map: Record<string, VoamUserDocument> = raw ? JSON.parse(raw) : {};
    // Pastikan akun Bootstrapped Owner selalu tercatat di direktori pengguna
    const ownerUid = "usr_owner_mainzz_supreme";
    if (!map[ownerUid]) {
      map[ownerUid] = {
        uid: ownerUid,
        email: OWNER_DISPLAY_EMAIL,
        displayName: "MainZ Supreme Owner",
        role: "owner",
        status: "active",
        customMaxProjects: 500,
        createdAt: "2026-01-01T00:00:00.000Z",
        lastLoginAt: new Date().toISOString(),
      };
    }
    return map;
  } catch {
    return {};
  }
}

export function setLocalUsersMap(map: Record<string, VoamUserDocument>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(map));
  } catch {
    // Abaikan
  }
}

export function getLocalProjectsMap(): Record<string, VoamProject> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, VoamProject>) : {};
  } catch {
    return {};
  }
}

export function setLocalProjectsMap(map: Record<string, VoamProject>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(map));
  } catch {
    // Abaikan
  }
}

function saveUserToLocalMirror(userDoc: VoamUserDocument): void {
  const map = getLocalUsersMap();
  map[userDoc.uid] = userDoc;
  setLocalUsersMap(map);
}

// ============================================================================
// Operasi Koleksi `users` (Dengan Proteksi WAF & RBAC Owner)
// ============================================================================

export async function upsertUserProfile(
  uid: string,
  email: string,
  displayName?: string
): Promise<VoamUserDocument> {
  const nowIso = new Date().toISOString();
  const safeEmail = assertSafeMetadataInput(email, "Email Pengguna", email);
  const isOwner = isOwnerEmail(safeEmail);

  const rawName =
    displayName ||
    (isOwner ? "MainZ Supreme Owner" : safeEmail.split("@")[0] || "Developer");
  const cleanName = assertSafeMetadataInput(
    rawName,
    "Nama Tampilan",
    safeEmail
  ).slice(0, 80);

  const existingLocal = getLocalUsersMap()[uid];
  if (existingLocal?.status === "suspended" && !isOwner) {
    throw new Error(
      "Akun Anda telah dibekukan (Suspended) oleh Owner MainZ Voam. Hubungi administrator."
    );
  }

  const assignedRole: UserRole = isOwner ? "owner" : "developer";

  const userPayload: VoamUserDocument = {
    uid,
    email: isOwner ? OWNER_DISPLAY_EMAIL : safeEmail,
    displayName: cleanName,
    role: assignedRole,
    status: existingLocal?.status || "active",
    customMaxProjects:
      existingLocal?.customMaxProjects || (isOwner ? 500 : undefined),
    createdAt: existingLocal?.createdAt || nowIso,
    lastLoginAt: nowIso,
  };

  saveUserToLocalMirror(userPayload);

  if (isCloudSessionActive()) {
    try {
      const userRef = doc(db, "users", uid);
      const existingSnap = await getDoc(userRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as VoamUserDocument;
        if (existingData.status === "suspended" && !isOwner) {
          throw new Error(
            "Akun Anda telah dibekukan (Suspended) oleh Owner MainZ Voam."
          );
        }
        const updatedDoc: VoamUserDocument = {
          uid: existingData.uid,
          email: existingData.email,
          displayName: cleanName || existingData.displayName,
          role: isOwner ? "owner" : existingData.role || "developer",
          status: existingData.status || "active",
          ...(existingData.customMaxProjects
            ? { customMaxProjects: existingData.customMaxProjects }
            : {}),
          createdAt: existingData.createdAt || nowIso,
          lastLoginAt: nowIso,
        };
        await setDoc(userRef, updatedDoc);
        saveUserToLocalMirror(updatedDoc);
        return updatedDoc;
      } else {
        const cleanFirestoreUser: Record<string, unknown> = {
          uid: userPayload.uid,
          email: userPayload.email,
          displayName: userPayload.displayName,
          role: userPayload.role,
          status: userPayload.status || "active",
          createdAt: userPayload.createdAt,
          lastLoginAt: userPayload.lastLoginAt,
        };
        if (typeof userPayload.customMaxProjects === "number") {
          cleanFirestoreUser.customMaxProjects = userPayload.customMaxProjects;
        }
        await setDoc(userRef, cleanFirestoreUser);
        return userPayload;
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("dibekukan (Suspended)")
      ) {
        throw err;
      }
      return userPayload;
    }
  }

  return userPayload;
}

// ============================================================================
// Operasi Koleksi `projects` (Dengan Proteksi WAF, Kuota Per User & DB Limit)
// ============================================================================

export async function createProjectDocument(params: {
  uid: string;
  ownerEmail: string;
  name: string;
  slug: string;
  deploymentId: string;
  deploymentUrl: string;
  status: VoamProject["status"];
  hasAutoFallbackIndex: boolean;
  fileSystem: VirtualFileSystem;
}): Promise<VoamProject> {
  const localUsers = getLocalUsersMap();
  const actorDoc = localUsers[params.uid];
  const actorRole: UserRole =
    isOwnerEmail(params.ownerEmail) || actorDoc?.role === "owner"
      ? "owner"
      : "developer";

  const existingUserProjects = await listUserProjects(params.uid);

  // Verifikasi WAF Anti-SQLi, Path Traversal, dan Kuota Database sebelum simpan
  verifyProjectQuotaAndSecurity({
    actorEmail: params.ownerEmail,
    actorRole,
    projectName: params.name,
    fileSystem: params.fileSystem,
    currentUserProjectCount: existingUserProjects.length,
    customUserMaxProjects: actorDoc?.customMaxProjects,
    isNewProject: true,
  });

  const nowIso = new Date().toISOString();
  const normalizedFs: VirtualFileSystem = {};
  Object.entries(params.fileSystem).forEach(([k, v]) => {
    const safePath = assertSafeFilePath(k, params.ownerEmail);
    normalizedFs[normalizeFilePath(safePath)] = v;
  });

  const fileCount = Math.max(
    1,
    Math.min(500, Object.keys(normalizedFs).length)
  );
  const serializedFs = serializeFileSystem(normalizedFs);

  const firestoreDoc: VoamProjectDocument = {
    uid: params.uid,
    ownerEmail: params.ownerEmail,
    name: params.name.slice(0, 100),
    slug: params.slug.slice(0, 120),
    deploymentId: params.deploymentId.slice(0, 160),
    deploymentUrl: params.deploymentUrl.slice(0, 500),
    status: params.status,
    fileCount,
    hasAutoFallbackIndex: params.hasAutoFallbackIndex,
    fileSystem: serializedFs,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  let projectId = `proj_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  if (isCloudSessionActive()) {
    try {
      const newDocRef = doc(collection(db, "projects"));
      projectId = newDocRef.id;
      await setDoc(newDocRef, firestoreDoc);
    } catch {
      // Fallback ke mirror lokal
    }
  }

  const projectRecord: VoamProject = {
    id: projectId,
    ...firestoreDoc,
    fileSystem: normalizedFs,
  };

  const localMap = getLocalProjectsMap();
  localMap[projectId] = projectRecord;
  setLocalProjectsMap(localMap);

  return projectRecord;
}

export async function listUserProjects(uid: string): Promise<VoamProject[]> {
  const localMap = getLocalProjectsMap();
  const localProjects = Object.values(localMap).filter((p) => p.uid === uid);

  if (isCloudSessionActive()) {
    try {
      const projectsQuery = query(
        collection(db, "projects"),
        where("uid", "==", uid),
        orderBy("updatedAt", "desc")
      );
      const snapshot = await getDocs(projectsQuery);
      const remoteProjects: VoamProject[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as VoamProjectDocument;
        const parsedFs = parseFileSystem(data.fileSystem);
        const item: VoamProject = {
          id: docSnap.id,
          uid: data.uid,
          ownerEmail: data.ownerEmail,
          name: data.name,
          slug: data.slug,
          deploymentId: data.deploymentId,
          deploymentUrl: data.deploymentUrl,
          status: data.status,
          fileCount:
            typeof data.fileCount === "number"
              ? data.fileCount
              : Object.keys(parsedFs).length,
          hasAutoFallbackIndex: Boolean(data.hasAutoFallbackIndex),
          fileSystem: parsedFs,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
        remoteProjects.push(item);
        localMap[item.id] = item;
      });

      setLocalProjectsMap(localMap);

      if (remoteProjects.length > 0) {
        return remoteProjects;
      }
    } catch {
      // Gunakan data mirror lokal
    }
  }

  return localProjects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getProjectById(
  projectId: string
): Promise<VoamProject | null> {
  if (isCloudSessionActive()) {
    try {
      const docRef = doc(db, "projects", projectId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as VoamProjectDocument;
        const parsedFs = parseFileSystem(data.fileSystem);
        const project: VoamProject = {
          id: snap.id,
          uid: data.uid,
          ownerEmail: data.ownerEmail,
          name: data.name,
          slug: data.slug,
          deploymentId: data.deploymentId,
          deploymentUrl: data.deploymentUrl,
          status: data.status,
          fileCount:
            typeof data.fileCount === "number"
              ? data.fileCount
              : Object.keys(parsedFs).length,
          hasAutoFallbackIndex: Boolean(data.hasAutoFallbackIndex),
          fileSystem: parsedFs,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
        const localMap = getLocalProjectsMap();
        localMap[project.id] = project;
        setLocalProjectsMap(localMap);
        return project;
      }
    } catch {
      // Fallback ke mirror lokal
    }
  }

  const localMap = getLocalProjectsMap();
  return localMap[projectId] || null;
}

export async function syncProjectFileSystemAndDeploy(
  projectId: string,
  currentProject: VoamProject,
  updates: {
    fileSystem: VirtualFileSystem;
    deploymentId?: string;
    deploymentUrl?: string;
    status?: VoamProject["status"];
    hasAutoFallbackIndex?: boolean;
  }
): Promise<VoamProject> {
  const localUsers = getLocalUsersMap();
  const actorDoc = localUsers[currentProject.uid];
  const actorRole: UserRole =
    isOwnerEmail(currentProject.ownerEmail) || actorDoc?.role === "owner"
      ? "owner"
      : "developer";

  verifyProjectQuotaAndSecurity({
    actorEmail: currentProject.ownerEmail,
    actorRole,
    projectName: currentProject.name,
    fileSystem: updates.fileSystem,
    currentUserProjectCount: 1,
    customUserMaxProjects: actorDoc?.customMaxProjects,
    isNewProject: false,
  });

  const nowIso = new Date().toISOString();
  const normalizedFs: VirtualFileSystem = {};
  Object.entries(updates.fileSystem).forEach(([k, v]) => {
    const safePath = assertSafeFilePath(k, currentProject.ownerEmail);
    normalizedFs[normalizeFilePath(safePath)] = v;
  });

  const fileCount = Math.max(
    1,
    Math.min(500, Object.keys(normalizedFs).length)
  );
  const serializedFs = serializeFileSystem(normalizedFs);

  const updatedFirestoreDoc: VoamProjectDocument = {
    uid: currentProject.uid,
    ownerEmail: currentProject.ownerEmail,
    name: currentProject.name.slice(0, 100),
    slug: currentProject.slug.slice(0, 120),
    deploymentId: (updates.deploymentId || currentProject.deploymentId).slice(
      0,
      160
    ),
    deploymentUrl: (
      updates.deploymentUrl || currentProject.deploymentUrl
    ).slice(0, 500),
    status: updates.status || currentProject.status,
    fileCount,
    hasAutoFallbackIndex:
      typeof updates.hasAutoFallbackIndex === "boolean"
        ? updates.hasAutoFallbackIndex
        : currentProject.hasAutoFallbackIndex,
    fileSystem: serializedFs,
    createdAt: currentProject.createdAt,
    updatedAt: nowIso,
  };

  if (isCloudSessionActive()) {
    try {
      const docRef = doc(db, "projects", projectId);
      await setDoc(docRef, updatedFirestoreDoc);
    } catch {
      // Tetap sinkronkan ke mirror lokal
    }
  }

  const updatedProject: VoamProject = {
    id: projectId,
    ...updatedFirestoreDoc,
    fileSystem: normalizedFs,
  };

  const localMap = getLocalProjectsMap();
  localMap[projectId] = updatedProject;
  setLocalProjectsMap(localMap);

  return updatedProject;
}

export async function deleteProjectDocument(projectId: string): Promise<void> {
  if (isCloudSessionActive()) {
    try {
      await deleteDoc(doc(db, "projects", projectId));
    } catch {
      // Lanjutkan penghapusan pada mirror lokal
    }
  }
  const localMap = getLocalProjectsMap();
  delete localMap[projectId];
  setLocalProjectsMap(localMap);
}

// ============================================================================
// FUNGSI EKSKLUSIF SUPREME OWNER (Mainzz@adminmnz.com)
// ============================================================================

export async function listAllUsersForOwner(): Promise<VoamUserDocument[]> {
  const localMap = getLocalUsersMap();

  if (isCloudSessionActive()) {
    try {
      const snap = await getDocs(collection(db, "users"));
      snap.forEach((docSnap) => {
        const data = docSnap.data() as VoamUserDocument;
        localMap[docSnap.id] = {
          ...data,
          uid: docSnap.id,
          role: isOwnerEmail(data.email) ? "owner" : data.role || "developer",
          status: data.status || "active",
        };
      });
      setLocalUsersMap(localMap);
    } catch {
      // Gunakan mirror lokal
    }
  }

  return Object.values(localMap).sort(
    (a, b) =>
      new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime()
  );
}

export async function listAllProjectsForOwner(): Promise<VoamProject[]> {
  const localMap = getLocalProjectsMap();

  if (isCloudSessionActive()) {
    try {
      const snap = await getDocs(collection(db, "projects"));
      snap.forEach((docSnap) => {
        const data = docSnap.data() as VoamProjectDocument;
        const parsedFs = parseFileSystem(data.fileSystem);
        localMap[docSnap.id] = {
          id: docSnap.id,
          uid: data.uid,
          ownerEmail: data.ownerEmail,
          name: data.name,
          slug: data.slug,
          deploymentId: data.deploymentId,
          deploymentUrl: data.deploymentUrl,
          status: data.status,
          fileCount:
            typeof data.fileCount === "number"
              ? data.fileCount
              : Object.keys(parsedFs).length,
          hasAutoFallbackIndex: Boolean(data.hasAutoFallbackIndex),
          fileSystem: parsedFs,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });
      setLocalProjectsMap(localMap);
    } catch {
      // Gunakan mirror lokal
    }
  }

  return Object.values(localMap).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function updateUserByOwner(
  targetUid: string,
  updates: {
    displayName?: string;
    status?: UserAccountStatus;
    customMaxProjects?: number;
  }
): Promise<VoamUserDocument> {
  const usersMap = getLocalUsersMap();
  const target = usersMap[targetUid];
  if (!target) {
    throw new Error("Pengguna tidak ditemukan.");
  }

  if (isOwnerEmail(target.email) && updates.status === "suspended") {
    throw new Error("Akun Supreme Owner utama tidak dapat dibekukan.");
  }

  const updatedUser: VoamUserDocument = {
    ...target,
    displayName: updates.displayName
      ? assertSafeMetadataInput(
          updates.displayName,
          "Nama Tampilan",
          OWNER_EMAIL
        ).slice(0, 80)
      : target.displayName,
    status: updates.status || target.status || "active",
    customMaxProjects:
      typeof updates.customMaxProjects === "number"
        ? Math.max(1, Math.min(500, updates.customMaxProjects))
        : target.customMaxProjects,
  };

  usersMap[targetUid] = updatedUser;
  setLocalUsersMap(usersMap);

  if (isCloudSessionActive()) {
    try {
      await setDoc(doc(db, "users", targetUid), updatedUser);
    } catch {
      // Tetap tersimpan di mirror
    }
  }

  recordSecurityEvent({
    type: "USER_STATUS_CHANGED",
    severity: "info",
    actorEmail: OWNER_DISPLAY_EMAIL,
    targetResource: `users/${targetUid}`,
    details: `Owner memperbarui pengguna ${updatedUser.email} (status=${updatedUser.status}, maxProjects=${updatedUser.customMaxProjects ?? "default"}).`,
  });

  return updatedUser;
}

export async function deleteUserAndProjectsByOwner(
  targetUid: string
): Promise<void> {
  const usersMap = getLocalUsersMap();
  const target = usersMap[targetUid];
  if (target && isOwnerEmail(target.email)) {
    throw new Error("Akun Supreme Owner utama tidak dapat dihapus.");
  }

  delete usersMap[targetUid];
  setLocalUsersMap(usersMap);

  const projectsMap = getLocalProjectsMap();
  Object.values(projectsMap).forEach((proj) => {
    if (proj.uid === targetUid) {
      delete projectsMap[proj.id];
    }
  });
  setLocalProjectsMap(projectsMap);

  if (isCloudSessionActive()) {
    try {
      await deleteDoc(doc(db, "users", targetUid));
    } catch {
      // Abaikan
    }
  }

  recordSecurityEvent({
    type: "USER_STATUS_CHANGED",
    severity: "warning",
    actorEmail: OWNER_DISPLAY_EMAIL,
    targetResource: `users/${targetUid}`,
    details: `Owner menghapus akun ${target?.email || targetUid} beserta seluruh proyek terkait.`,
  });
}

export async function setProjectStatusByOwner(
  projectId: string,
  status: VoamProject["status"]
): Promise<VoamProject | null> {
  const projectsMap = getLocalProjectsMap();
  const proj = projectsMap[projectId];
  if (!proj) return null;

  const updated: VoamProject = {
    ...proj,
    status,
    updatedAt: new Date().toISOString(),
  };
  projectsMap[projectId] = updated;
  setLocalProjectsMap(projectsMap);

  if (isCloudSessionActive()) {
    try {
      const firestoreDoc: VoamProjectDocument = {
        ...updated,
        fileSystem: serializeFileSystem(updated.fileSystem),
      };
      await setDoc(doc(db, "projects", projectId), firestoreDoc);
    } catch {
      // Abaikan
    }
  }

  return updated;
}

export async function fetchSystemConfig(): Promise<VoamSystemConfig> {
  const localCfg = getLocalSystemConfig();

  if (isCloudSessionActive()) {
    try {
      const snap = await getDoc(doc(db, "system_settings", "global"));
      if (snap.exists()) {
        const remote = snap.data() as VoamSystemConfig;
        const merged: VoamSystemConfig = {
          ...DEFAULT_SYSTEM_CONFIG,
          ...remote,
        };
        saveLocalSystemConfig(merged);
        return merged;
      }
    } catch {
      // Gunakan konfigurasi lokal
    }
  }

  return localCfg;
}

export async function updateSystemConfigByOwner(
  nextConfig: VoamSystemConfig
): Promise<VoamSystemConfig> {
  const sanitizedAnnouncement = assertSafeMetadataInput(
    nextConfig.globalAnnouncement || "",
    "Pengumuman Global",
    OWNER_DISPLAY_EMAIL
  ).slice(0, 500);

  const finalConfig: VoamSystemConfig = {
    ...nextConfig,
    globalAnnouncement: sanitizedAnnouncement,
    maxRegistrationsPerWindow: Math.max(
      1,
      Math.min(100, Number(nextConfig.maxRegistrationsPerWindow) || 3)
    ),
    registrationCooldownSeconds: Math.max(
      0,
      Math.min(3600, Number(nextConfig.registrationCooldownSeconds) || 20)
    ),
    maxTotalUsersInDb: Math.max(
      1,
      Math.min(100000, Number(nextConfig.maxTotalUsersInDb) || 500)
    ),
    maxProjectsPerUser: Math.max(
      1,
      Math.min(500, Number(nextConfig.maxProjectsPerUser) || 10)
    ),
    maxFilesPerProject: Math.max(
      1,
      Math.min(500, Number(nextConfig.maxFilesPerProject) || 150)
    ),
    maxProjectSizeKb: Math.max(
      10,
      Math.min(900, Number(nextConfig.maxProjectSizeKb) || 850)
    ),
    updatedAt: new Date().toISOString(),
    updatedBy: OWNER_DISPLAY_EMAIL,
  };

  saveLocalSystemConfig(finalConfig);

  if (isCloudSessionActive()) {
    try {
      await setDoc(doc(db, "system_settings", "global"), finalConfig);
    } catch {
      // Tetap tersimpan di mirror lokal
    }
  }

  recordSecurityEvent({
    type: "OWNER_CONFIG_UPDATED",
    severity: "info",
    actorEmail: OWNER_DISPLAY_EMAIL,
    targetResource: "system_settings/global",
    details: `Owner memperbarui konfigurasi sistem & WAF (reg=${finalConfig.registrationEnabled}, deploy=${finalConfig.deploymentsEnabled}, maxUsers=${finalConfig.maxTotalUsersInDb}, maxProjPerUser=${finalConfig.maxProjectsPerUser}).`,
  });

  return finalConfig;
}
