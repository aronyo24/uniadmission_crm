import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth"

export function RequireCrm({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated || !user?.is_crm_staff) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
