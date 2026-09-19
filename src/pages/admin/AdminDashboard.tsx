import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts"
import {
  Users, Globe, FileText, MessageSquare, TrendingUp,
  RefreshCw, ArrowUpRight, Clock, Zap, Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchAdminDashboard } from "@/lib/api"
import type { AdminDashboardData } from "@/lib/types"
import { useAuth } from "@/lib/auth"
import { ChartEmpty } from "@/components/admin/ChartEmpty"

const CHART_COLORS = ["#F5A623", "#6366f1", "#22C55E", "#06b6d4", "#ec4899", "#8b5cf6", "#14b8a6", "#f59e0b"]

const MOTIVATIONAL_QUOTES = [
  "Great things are built by teams that communicate and trust each other.",
  "Every data point is a story waiting to be told.",
  "Knowledge is power. Analytics is your superpower.",
]

function StatCard({ label, value, icon: Icon, trend, color = "amber" }: {
  label: string; value: string | number; icon: React.ElementType; trend?: string; color?: string
}) {
  const colorMap: Record<string, string> = {
    amber:   "from-amber-400/20 to-amber-600/10 border-amber-400/30 text-amber-500",
    indigo:  "from-indigo-400/20 to-indigo-600/10 border-indigo-400/30 text-indigo-500",
    emerald: "from-emerald-400/20 to-emerald-600/10 border-emerald-400/30 text-emerald-500",
    cyan:    "from-cyan-400/20 to-cyan-600/10 border-cyan-400/30 text-cyan-500",
  }
  const cls = colorMap[color] ?? colorMap.amber

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border bg-gradient-to-br ${cls} p-5 shadow-sm backdrop-blur-sm`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value.toLocaleString()}</p>
          {trend && (
            <div className="mt-1 flex items-center gap-1 text-emerald-500 text-xs font-medium">
              <ArrowUpRight className="w-3 h-3" />
              {trend}
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cls} border flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  )
}

function ChartCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="h-52">{children}</div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [quote] = useState(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fetchAdminDashboard())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-2xl bg-muted/60" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted/60" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          {[...Array(6)].map((_, i) => <div key={i} className="h-64 rounded-2xl bg-muted/60" />)}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Zap className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-destructive font-medium">Failed to load dashboard data.</p>
        <Button onClick={() => void load()} className="mt-4" size="sm">Retry</Button>
      </div>
    )
  }

  const { summary, visitor_countries, submission_analytics, chatbot_analytics, search_trends } = data
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const visitorChartData = visitor_countries.slice(0, 10).map((c) => ({ name: c.country || "Unknown", count: c.count }))
  const universitiesData  = submission_analytics.universities.slice(0, 8)
  const budgetData        = submission_analytics.budget_ranges
  const categoryData      = chatbot_analytics.category_breakdown.map((c) => ({ name: c.category, value: c.count }))
  const searchTrendData   = search_trends.trend
  const hourlyData        = chatbot_analytics.hourly_usage

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-r from-[#1A2B5F] via-[#1e3575] to-[#1A2B5F] p-6 text-white shadow-xl border border-white/10 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(245,166,35,0.12),transparent_60%)]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-white/60 text-sm flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              {now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-white">
              {greeting}, {user?.full_name?.split(" ")[0] || "Admin"} 👋
            </h1>
            <p className="mt-1 text-white/50 text-sm max-w-lg italic">"{quote}"</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="border-white/20 text-white hover:bg-white/10 bg-transparent w-fit"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Visitors"    value={summary.total_visitors}    icon={Globe}         color="amber"   trend="Live tracking" />
        <StatCard label="Form Submissions"  value={summary.total_submissions}  icon={FileText}      color="indigo"  trend={`Today: ${summary.today_submissions}`} />
        <StatCard label="Chat Prompts"      value={summary.total_chat_prompts} icon={MessageSquare} color="emerald" trend={`Today: ${summary.today_chat_prompts}`} />
        <StatCard label="Registered Users"  value={summary.total_users}        icon={Users}         color="cyan" />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Visitor Countries" description="Top 10 countries by visit count">
          {visitorChartData.length === 0 ? (
            <ChartEmpty message="No visitor location data yet" hint="Visitors need a public IP for geo-lookup — unavailable on localhost." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visitorChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={95} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="count" fill="#F5A623" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top Universities Submitted" description="Most submitted institutions">
          {universitiesData.length === 0 ? (
            <ChartEmpty message="No submission data yet" hint="Data appears when users complete the AI advisor chat." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={universitiesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={58} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Budget Distribution" description="Grouped by USD range">
          {budgetData.length === 0 ? (
            <ChartEmpty message="No budget data yet" hint="Populated when users provide their budget in the AI advisor chat." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="count" fill="#22C55E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Chatbot Categories" description="Prompt category breakdown">
          {categoryData.length === 0 ? (
            <ChartEmpty message="No chat data yet" hint="Data appears as users interact with the AI advisor." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                  labelLine={false}
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Search Trends" description="Daily search volume (last 30 days)">
          {searchTrendData.length === 0 ? (
            <ChartEmpty message="No search data yet" hint="Populated as users search for universities and courses." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={searchTrendData}>
                <defs>
                  <linearGradient id="searchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#F5A623" strokeWidth={2} fill="url(#searchGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Chatbot Usage by Hour" description="Peak activity hours (0–23)">
          {hourlyData.length === 0 ? (
            <ChartEmpty message="No hourly usage data yet" hint="Populated as users chat with the AI advisor." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Target countries + Keywords */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-500" />
            Most Targeted Countries
          </h3>
          {submission_analytics.countries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No submission data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {submission_analytics.countries.slice(0, 6).map((c, i) => (
                <div key={c.country} className="flex items-center gap-3">
                  <span className="text-sm font-mono w-5 text-muted-foreground">{i + 1}</span>
                  <span className="text-sm flex-1 font-medium">{c.country}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                      style={{ width: `${Math.min(100, (c.count / (submission_analytics.countries[0]?.count || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono text-muted-foreground w-12 text-right">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            Top Search Keywords
          </h3>
          {search_trends.top_queries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No search queries recorded yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {search_trends.top_queries.slice(0, 16).map((q, i) => (
                <span
                  key={q.query}
                  className="px-3 py-1 rounded-full text-xs font-medium border"
                  style={{
                    background:     `${CHART_COLORS[i % CHART_COLORS.length]}18`,
                    borderColor:    `${CHART_COLORS[i % CHART_COLORS.length]}40`,
                    color:          CHART_COLORS[i % CHART_COLORS.length],
                  }}
                >
                  {q.query} <span className="opacity-60">({q.count})</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity feed */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          Recent Activity
        </h3>
        {(!data.recent_activity || data.recent_activity.length === 0) ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No activity recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {data.recent_activity.slice(0, 8).map((event) => (
              <div key={event.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-border/50 last:border-0">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-muted-foreground capitalize">{event.event_type.replace(/_/g, " ")}</span>
                <span className="font-medium truncate flex-1">{event.page_path}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(event.created_at).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
