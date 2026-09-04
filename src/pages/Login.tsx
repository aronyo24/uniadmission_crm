import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth"

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If we got bounced here from a specific protected route (e.g. /crm or
  // /admin), honor that on success. Otherwise fall back to the backend's
  // role-aware redirect_url (counselor -> /crm, admin/sub-admin -> /admin,
  // everyone else -> /dashboard), extracted from the full URL it returns.
  const explicitFrom = (location.state as { from?: { pathname?: string } | string } | null)?.from
  const explicitPath = typeof explicitFrom === "string" ? explicitFrom : explicitFrom?.pathname

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { redirect_url } = await login({ email, password, remember_me: rememberMe })
      const roleBasedPath = redirect_url ? new URL(redirect_url).pathname : "/dashboard"
      navigate(explicitPath || roleBasedPath, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr] items-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="inline-flex items-center rounded-full border bg-background/80 px-4 py-2 text-sm text-muted-foreground shadow-sm">
            Secure account access
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Sign in to your student workspace.</h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Continue to your dashboard, saved resume history, and AI recommendations with one authenticated session.
          </p>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">Resume history syncs automatically after analysis.</div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">Protected access keeps recommendations and course views private.</div>
          </div>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="rounded-3xl border bg-card/95 p-6 shadow-xl backdrop-blur sm:p-8"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Use your email and password to continue.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-10" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-10" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
              Remember me for 30 days
            </label>

            {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Sign in
            </Button>
          </div>

          <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <Link className="text-primary hover:underline" to="/password-reset">Forgot password?</Link>
            <Link className="text-muted-foreground hover:text-foreground" to="/register">Create an account</Link>
          </div>
        </motion.form>
      </div>
    </div>
  )
}