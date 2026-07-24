"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getCurrentUser,
  getFirebaseAuth,
  getUserProfile,
  logout as firebaseLogout,
  onAuthStateChanged,
  type User,
} from "@/lib/firebase";
import { getHomeForRole } from "@/lib/auth";
import type { UserProfile, UserRole } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  establishSession: () => Promise<{ redirectTo: string; role: UserRole }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const next = await getUserProfile(uid);
      setProfile(next);
    } catch {
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const current = await getCurrentUser();
    if (current) {
      await loadProfile(current.uid);
    } else {
      setProfile(null);
    }
  }, [loadProfile]);

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onAuthStateChanged(getFirebaseAuth(), async (nextUser) => {
        setUser(nextUser);
        if (nextUser) {
          await loadProfile(nextUser.uid);
        } else {
          setProfile(null);
        }
        setLoading(false);
      });
    } catch {
      setLoading(false);
    }
    return () => unsub();
  }, [loadProfile]);

  const establishSession = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (!current) {
      throw new Error("No authenticated user.");
    }
    const idToken = await current.getIdToken(true);

    // Prefer pages API signin, fall back to app router session route
    let res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (res.status === 404) {
      res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to create session.");
    }
    return data as { redirectTo: string; role: UserRole };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Cookie clear is best-effort; still sign out of Firebase.
    }
    await firebaseLogout();
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      refreshProfile,
      establishSession,
      logout,
    }),
    [user, profile, loading, refreshProfile, establishSession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export function useRoleHome(): string {
  const { role } = useAuth();
  return getHomeForRole(role);
}
