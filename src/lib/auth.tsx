/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { ensureCsrfToken, fetchCurrentUser, loginUser, logoutUser, registerUser } from "@/lib/api"
import type { AuthSummary, AuthUser, CurrentAuthSession, ResumeHistoryItem } from "@/lib/types"

interface RegisterPayload {
  full_name: string
  country: string
  email: string
  phone?: string
  phone_country_code?: string
  password1: string
  password2: string
  agree_terms: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  summary: AuthSummary | null
  resumeHistory: ResumeHistoryItem[]
  profile: Record<string, unknown> | null
  loading: boolean
  isAuthenticated: boolean
  refreshAuth: () => Promise<void>
  login: (payload: { email: string; password: string; remember_me?: boolean }) => Promise<{ user: AuthUser; redirect_url?: string }>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
}

const defaultAuthContext: AuthContextValue = {
  user: null,
  summary: null,
  resumeHistory: [],
  profile: null,
  loading: true,
  isAuthenticated: false,
  refreshAuth: async () => {},
  login: async () => ({ user: {} as AuthUser }),
  register: async () => {},
  logout: async () => {},
}

const AuthContext = createContext<AuthContextValue>(defaultAuthContext)

function setLegacyAuthHints(user: AuthUser | null) {
  if (typeof window === "undefined") {
    return
  }

  if (user) {
    localStorage.setItem("userEmail", user.email || "")
    localStorage.setItem("userFullName", user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim())
  } else {
    localStorage.removeItem("userEmail")
    localStorage.removeItem("userFullName")
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CurrentAuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshAuth = async () => {
    try {
      const current = await fetchCurrentUser()
      setSession(current)
      setLegacyAuthHints(current.user)
    } catch {
      setSession(null)
      setLegacyAuthHints(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // CSRF_COOKIE_HTTPONLY on the backend means the csrftoken cookie can't be
    // read from JS, so the in-memory cache set by ensureCsrfToken() is the
    // only source for the X-CSRFToken header - and it resets on every hard
    // page load/reload. Prime it here so mutating requests (POST/PATCH/
    // DELETE) work immediately after a reload, not just right after login.
    void ensureCsrfToken()
    void refreshAuth()
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    summary: session?.summary ?? null,
    resumeHistory: session?.resume_history ?? [],
    profile: session?.profile ?? null,
    loading,
    isAuthenticated: Boolean(session?.authenticated),
    refreshAuth,
    login: async (payload) => {
      const result = await loginUser(payload)
      await refreshAuth()
      return result
    },
    register: async (payload) => {
      await registerUser(payload)
      await refreshAuth()
    },
    logout: async () => {
      try {
        await logoutUser()
      } finally {
        setSession(null)
        setLegacyAuthHints(null)
        setLoading(false)
      }
    },
  }), [loading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}