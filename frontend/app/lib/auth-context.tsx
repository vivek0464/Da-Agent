"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { auth } from "./firebase";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  clinicId: string | null;
  doctorId: string | null;
  staffId: string | null;
  isPlatformAdmin: boolean;
  role: "platform_admin" | "doctor" | "staff" | null;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  clinicId: null,
  doctorId: null,
  staffId: null,
  isPlatformAdmin: false,
  role: null,
  authError: null,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [role, setRole] = useState<"platform_admin" | "doctor" | "staff" | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        let idTokenResult = await firebaseUser.getIdTokenResult();
        let claims = idTokenResult.claims as Record<string, unknown>;

        // If no clinic claims yet, try auto-link (e.g. first Google sign-in)
        if (!claims.platform_admin && !claims.clinicId) {
          try {
            const token = await firebaseUser.getIdToken();
            const res = await fetch(`${API}/api/auth/link`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              // Force token refresh to pull in new claims
              idTokenResult = await firebaseUser.getIdTokenResult(true);
              claims = idTokenResult.claims as Record<string, unknown>;
            } else {
              // Email not registered in any clinic — reject
              const body = await res.json().catch(() => ({}));
              const msg = (body as { detail?: string }).detail
                ?? "This Google account is not registered with any clinic. Contact your platform admin.";
              await firebaseSignOut(auth!);
              setAuthError(msg);
              setLoading(false);
              return;
            }
          } catch {
            // Network error — allow through, will show no-role state
          }
        }

        // After linking, if still no role, reject
        const isAdmin = Boolean(claims.platform_admin);
        const hasRole = isAdmin || Boolean(claims.clinicId);
        if (!hasRole) {
          await firebaseSignOut(auth!);
          setAuthError("This Google account is not registered with any clinic. Contact your platform admin.");
          setLoading(false);
          return;
        }

        setClinicId((claims.clinicId as string) ?? null);
        setDoctorId((claims.doctorId as string) ?? null);
        setStaffId((claims.staffId as string) ?? null);
        setIsPlatformAdmin(isAdmin);
        if (isAdmin) setRole("platform_admin");
        else if (claims.doctorId) setRole("doctor");
        else if (claims.staffId) setRole("staff");
        else setRole(null);
        document.cookie = `firebaseToken=${await firebaseUser.getIdToken()}; path=/; max-age=3600; SameSite=Strict`;
      } else {
        setUser(null);
        setClinicId(null);
        setDoctorId(null);
        setStaffId(null);
        setIsPlatformAdmin(false);
        setRole(null);
        document.cookie =
          "firebaseToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase not configured");
    setAuthError(null);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error("Firebase not configured");
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, clinicId, doctorId, staffId, isPlatformAdmin, role, authError, signIn, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
