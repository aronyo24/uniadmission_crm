/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard, KanbanSquare, Users, UserCog, ListChecks, MessagesSquare, GraduationCap,
  LogOut, Menu, ChevronRight, Bell, Settings, Briefcase, FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/lib/auth"
import { Toaster } from "@/components/ui/sonner"
import type { AdminPermissions } from "@/lib/types"

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  exact?: boolean
  permissionKey?: keyof AdminPermissions
}

const navItems: NavItem[] = [
  { to: "/crm",             label: "Dashboard",  icon: LayoutDashboard, exact: true },
  { to: "/crm/pipeline",    label: "Pipeline",   icon: KanbanSquare,    permissionKey: "crm_view_own_students" },
  { to: "/crm/students",    label: "Students",   icon: Users,           permissionKey: "crm_view_own_students" },
  { to: "/crm/applications", label: "Applications", icon: FileText,     permissionKey: "crm_view_own_students" },
  { to: "/crm/communications", label: "Communications", icon: MessagesSquare, permissionKey: "crm_view_own_students" },
  { to: "/crm/universities", label: "Universities", icon: GraduationCap },
  { to: "/crm/counselors",  label: "Counselors", icon: UserCog },
  { to: "/crm/tasks",       label: "Tasks",      icon: ListChecks },
]

interface SidebarContentProps {
  user: { full_name?: string | null; email?: string | null; role?: string | null; permissions?: AdminPermissions; is_admin?: boolean } | null
  isFullAdmin: boolean
  visibleItems: NavItem[]
  location: { pathname: string }
  setSidebarOpen: (open: boolean) => void
  handleLogout: () => void
}

const SidebarContent = ({ user, isFullAdmin, visibleItems, location, setSidebarOpen, handleLogout }: SidebarContentProps) => (
  <div className="flex flex-col h-full">
    <div className="px-5 py-5 border-b border-white/10">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">Admission CRM</p>
          <p className="text-[10px] text-white/50 capitalize">
            {isFullAdmin ? "Master Admin" : (user?.role?.replace("_", " ") ?? "Counselor")}
          </p>
        </div>
      </div>
    </div>

    <div className="mx-3 mt-3 p-3 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-[#0f2318] font-bold text-xs flex-shrink-0">
          {(user?.full_name || user?.email || "C")[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{user?.full_name || user?.email}</p>
          <p className="text-[10px] text-white/50 truncate">{user?.email}</p>
        </div>
      </div>
    </div>

    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">Navigation</p>
      {visibleItems.map((item) => {
        const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to)
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              active
                ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/20"
                : "text-white/60 hover:text-white hover:bg-white/8"
            }`}
          >
            <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-emerald-400" : "group-hover:text-white/80"}`} />
            <span className="flex-1">{item.label}</span>
            {active && <ChevronRight className="w-3 h-3 text-emerald-400/60" />}
          </Link>
        )
      })}
    </nav>

    <div className="px-3 pb-4 border-t border-white/10 pt-3 space-y-1">
      {/* Only admins/sub-admins can actually open /admin (see RequireAdmin) -
          hide the cross-link entirely for counselors instead of showing a
          button that would just bounce them back out. */}
      {user?.is_admin && (
        <Link
          to="/admin"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/8 transition-all"
        >
          <Settings className="w-4 h-4" />
          Admin Dashboard
        </Link>
      )}
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400/70 hover:text-red-300 hover:bg-red-500/10 transition-all"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="text-[10px] text-white/30">Theme</span>
        <ThemeToggle />
      </div>
    </div>
  </div>
)

export function CrmLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isFullAdmin = user?.role === "admin"
  const perms = user?.permissions || {}

  const visibleItems = navItems.filter((item) => {
    if (item.permissionKey && !isFullAdmin && !perms[item.permissionKey]) return false
    return true
  })

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  return (
    <div className="min-h-screen pt-16 bg-background">
      <Toaster position="top-right" richColors />
      <div className="flex">
        <aside className="hidden lg:flex w-64 flex-col border-r border-border/40 bg-[#0f2318] min-h-[calc(100vh-4rem)] sticky top-16 overflow-hidden">
          <SidebarContent user={user} isFullAdmin={isFullAdmin} visibleItems={visibleItems} location={location} setSidebarOpen={setSidebarOpen} handleLogout={handleLogout} />
        </aside>

        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed inset-y-0 left-0 z-50 w-72 bg-[#0f2318] lg:hidden flex flex-col overflow-hidden pt-16"
              >
                <SidebarContent user={user} isFullAdmin={isFullAdmin} visibleItems={visibleItems} location={location} setSidebarOpen={setSidebarOpen} handleLogout={handleLogout} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="flex-1 min-w-0">
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-card/80 sticky top-16 z-30 backdrop-blur">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="h-8 w-8">
              <Menu className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-sm">Admission CRM</span>
            <div className="ml-auto flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
