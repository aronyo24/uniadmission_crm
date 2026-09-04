import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { Users, UserCheck, UserX, ListChecks, AlertTriangle, RefreshCw, TrendingUp, Activity } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SummaryCards } from "@/components/admin/SummaryCards"
import { ChartCard } from "@/components/admin/ChartCard"
import { ActivityTimeline } from "@/components/crm/ActivityTimeline"
import { fetchCrmDashboard } from "@/lib/crm-api"
import type { CrmDashboardStats } from "@/lib/crm-types"
import { useAuth } from "@/lib/auth"

export default function CrmDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<CrmDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fetchCrmDashboard())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted/60" />)}
        </div>
        <div className="h-72 rounded-2xl bg-muted/60" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-destructive font-medium">Failed to load CRM dashboard.</p>
        <Button onClick={() => void load()} className="mt-4" size="sm">Retry</Button>
      </div>
    )
  }

  const stageChartData = data.by_stage.map((s) => ({ name: s.label, count: s.student_count }))

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.full_name?.split(" ")[0] || "there"} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">Here's what's happening across the pipeline today.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </motion.div>

      <SummaryCards
        cards={[
          { label: "Total Leads", value: data.total_students, icon: Users },
          { label: "Active", value: data.active_students, icon: UserCheck },
          { label: "Lost", value: data.lost_students, icon: UserX },
          { label: "New This Week", value: data.new_leads_this_week, icon: TrendingUp },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-400/15 flex items-center justify-center">
            <ListChecks className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{data.tasks_due_today}</p>
            <p className="text-sm text-muted-foreground">Tasks due today</p>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-400/15 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{data.tasks_overdue}</p>
            <p className="text-sm text-muted-foreground">Overdue tasks</p>
          </div>
        </div>
      </div>

      <ChartCard title="Pipeline by Stage" description="Active leads in each pipeline stage">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stageChartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
            <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Recent Activity
        </h3>
        <ActivityTimeline limit={10} />
      </div>
    </div>
  )
}
