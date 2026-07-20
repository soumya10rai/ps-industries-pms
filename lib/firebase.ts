import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import {
  isAllowedEmailDomain,
  isUserRole,
  type UserProfile,
  type UserRole,
} from "@/lib/types";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function assertClientConfig(): void {
  const required = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ] as const;

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(
        `Missing Firebase config: ${key}. Copy .env.example to .env.local and fill in your project values.`
      );
    }
  }
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase client SDK must only be used in the browser.");
  }
  if (!app) {
    assertClientConfig();
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export interface AuthResult {
  user: User;
  credential: UserCredential;
}

/**
 * Sign in with email and password.
 * Firebase hashes and verifies passwords server-side.
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const credential = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email.trim().toLowerCase(),
    password
  );
  return { user: credential.user, credential };
}

/**
 * Register a new user. Enforces company email domain before calling Firebase.
 * Role is NOT set here — Admin assigns roles in Firestore (or via seed).
 * New users get `approved: false` until an admin assigns a role.
 */
export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isAllowedEmailDomain(normalizedEmail)) {
    throw new Error(
      "Registration is restricted to @psindustriesindia.in and @psindustries.in email addresses."
    );
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const credential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    normalizedEmail,
    password
  );

  if (displayName.trim()) {
    await updateProfile(credential.user, {
      displayName: displayName.trim(),
    });
  }

  // Create Firestore profile without a privileged role.
  // Admin must assign role via Firestore or the secure seed endpoint.
  await setDoc(
    doc(getFirebaseDb(), "users", credential.user.uid),
    {
      email: normalizedEmail,
      displayName: displayName.trim() || normalizedEmail.split("@")[0],
      role: null,
      approved: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { user: credential.user, credential };
}

/**
 * Google Sign-In. Rejects accounts whose email domain is not company-approved.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  const credential = await signInWithPopup(getFirebaseAuth(), googleProvider);
  const email = credential.user.email;

  if (!email || !isAllowedEmailDomain(email)) {
    await signOut(getFirebaseAuth());
    throw new Error(
      "Only @psindustriesindia.in or @psindustries.in Google accounts may sign in."
    );
  }

  const userRef = doc(getFirebaseDb(), "users", credential.user.uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    await setDoc(userRef, {
      email: email.toLowerCase(),
      displayName:
        credential.user.displayName || email.split("@")[0] || "User",
      role: null,
      approved: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return { user: credential.user, credential };
}

/**
 * Sign out of Firebase Auth on the client.
 * Call the /api/auth/logout route as well to clear the httpOnly session cookie.
 */
export async function logout(): Promise<void> {
  await signOut(getFirebaseAuth());
}

/**
 * Resolve the current Firebase user, or null if signed out.
 */
export function getCurrentUser(): Promise<User | null> {
  const authInstance = getFirebaseAuth();
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Fetch the Firestore user profile including role at /users/{uid}.
 * Role lives on the document as the `role` field (path: users/{uid} → role).
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "users", uid));
  if (!snap.exists()) return null;

  const data = snap.data();
  const role = data.role;

  const resolvedRole = isUserRole(role) ? role : null;

  return {
    uid,
    email: String(data.email ?? ""),
    role: resolvedRole,
    displayName: String(data.displayName ?? ""),
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? "",
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? "",
    approved: Boolean(data.approved) && resolvedRole !== null,
  };
}

/**
 * Read only the role field from /users/{uid}.
 * Returns null if the user has no assigned role yet.
 */
export async function getUserRole(uid: string): Promise<UserRole | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "users", uid));
  if (!snap.exists()) return null;
  const role = snap.data()?.role;
  return isUserRole(role) ? role : null;
}

export { onAuthStateChanged };
export type { User, UserCredential };
