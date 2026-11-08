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
import type {
  VirtualFileSystem,
  VoamProject,
  VoamProjectDocument,
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

/**
 * Mengecek apakah kredensial Firebase yang digunakan adalah kredensial Cloud produksi
 * atau masih menggunakan placeholder lokal.
 */
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

export { app, auth, db };

// ============================================================================
// Helper Normalisasi & Serialisasi Virtual FileSystem
// ============================================================================

export function normalizeFilePath(rawPath: string): string {
  const cleaned = rawPath.replace(/\\/g, "/").trim();
  if (!cleaned) return "/untitled.txt";
  const withoutRelative = cleaned.replace(/^(\.\/)+/, "");
  return withoutRelative.startsWith("/") ? withoutRelative : `/${withoutRelative}`;
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
// Local Persistence Mirror (Memastikan Zero-Downtime jika Mode Lokal / Offline)
// ============================================================================

const LOCAL_USERS_KEY = "mainz_voam_users_v1";
const LOCAL_PROJECTS_KEY = "mainz_voam_projects_v1";

function getLocalProjectsMap(): Record<string, VoamProject> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, VoamProject>) : {};
  } catch {
    return {};
  }
}

function setLocalProjectsMap(map: Record<string, VoamProject>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(map));
  } catch {
    // Abaikan jika kuota penyimpanan lokal penuh
  }
}

function saveUserToLocalMirror(userDoc: VoamUserDocument): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LOCAL_USERS_KEY);
    const map: Record<string, VoamUserDocument> = raw ? JSON.parse(raw) : {};
    map[userDoc.uid] = userDoc;
    window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(map));
  } catch {
    // Abaikan error penyimpanan lokal
  }
}

// ============================================================================
// Operasi Koleksi `users` (Sesuai Kontrak `firestore.rules`)
// ============================================================================

export async function upsertUserProfile(
  uid: string,
  email: string,
  displayName?: string
): Promise<VoamUserDocument> {
  const nowIso = new Date().toISOString();
  const cleanName = (
    displayName ||
    email.split("@")[0] ||
    "MainZ Engineer"
  ).slice(0, 80);

  const userPayload: VoamUserDocument = {
    uid,
    email,
    displayName: cleanName,
    role: "developer",
    createdAt: nowIso,
    lastLoginAt: nowIso,
  };

  saveUserToLocalMirror(userPayload);

  if (isLiveFirebaseConfigured()) {
    try {
      const userRef = doc(db, "users", uid);
      const existingSnap = await getDoc(userRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as VoamUserDocument;
        const updatedDoc: VoamUserDocument = {
          uid: existingData.uid,
          email: existingData.email,
          displayName: cleanName || existingData.displayName,
          role: "developer",
          createdAt: existingData.createdAt || nowIso,
          lastLoginAt: nowIso,
        };
        await setDoc(userRef, updatedDoc);
        saveUserToLocalMirror(updatedDoc);
        return updatedDoc;
      } else {
        await setDoc(userRef, userPayload);
        return userPayload;
      }
    } catch {
      return userPayload;
    }
  }

  return userPayload;
}

// ============================================================================
// Operasi Koleksi `projects` (Sesuai Kontrak `firestore.rules`)
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
  const nowIso = new Date().toISOString();
  const normalizedFs: VirtualFileSystem = {};
  Object.entries(params.fileSystem).forEach(([k, v]) => {
    normalizedFs[normalizeFilePath(k)] = v;
  });

  const fileCount = Math.max(1, Math.min(500, Object.keys(normalizedFs).length));
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

  if (isLiveFirebaseConfigured()) {
    try {
      const newDocRef = doc(collection(db, "projects"));
      projectId = newDocRef.id;
      await setDoc(newDocRef, firestoreDoc);
    } catch {
      // Fallback ke mirror lokal jika koneksi ke Firestore terkendala
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

  if (isLiveFirebaseConfigured()) {
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
      // Gunakan data mirror lokal apabila query memerlukan indeks atau mode offline
    }
  }

  return localProjects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getProjectById(
  projectId: string
): Promise<VoamProject | null> {
  if (isLiveFirebaseConfigured()) {
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
  const nowIso = new Date().toISOString();
  const normalizedFs: VirtualFileSystem = {};
  Object.entries(updates.fileSystem).forEach(([k, v]) => {
    normalizedFs[normalizeFilePath(k)] = v;
  });

  const fileCount = Math.max(1, Math.min(500, Object.keys(normalizedFs).length));
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

  if (isLiveFirebaseConfigured()) {
    try {
      const docRef = doc(db, "projects", projectId);
      await setDoc(docRef, updatedFirestoreDoc);
    } catch {
      // Tetap sinkronkan ke mirror lokal jika jaringan terputus
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
  if (isLiveFirebaseConfigured()) {
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
