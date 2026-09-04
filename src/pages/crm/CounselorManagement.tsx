import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { createCounselor, fetchCounselorPerformance, fetchCounselors, updateCounselor } from "@/lib/crm-api"
import type { Counselor, CounselorPerformance } from "@/lib/crm-types"
import { useAuth } from "@/lib/auth"

export default function CounselorManagement() {
  const { user } = useAuth()
  // Provisioning counselor accounts is admin-only - a counselor (or a
  // sub-admin without it explicitly granted) can view this directory but
  // shouldn't see controls that only a full admin can actually use.
  const isFullAdmin = user?.role === "admin"
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ new_user_full_name: "", new_user_email: "", new_user_password: "", employee_code: "" })
  const [performance, setPerformance] = useState<Record<number, CounselorPerformance>>({})

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchCounselors()
      setCounselors(data)
      const entries = await Promise.all(
        data.map(async (c) => [c.id, await fetchCounselorPerformance(c.id).catch(() => null)] as const)
      )
      setPerformance(Object.fromEntries(entries.filter(([, v]) => v)) as Record<number, CounselorPerformance>)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load counselors")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleCreate = async () => {
    if (!form.new_user_email || !form.new_user_password) return
    try {
      await createCounselor(form)
      toast.success("Counselor added")
      setForm({ new_user_full_name: "", new_user_email: "", new_user_password: "", employee_code: "" })
      setShowForm(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add counselor")
    }
  }

  const toggleActive = async (counselor: Counselor) => {
    try {
      await updateCounselor(counselor.id, { is_active: !counselor.is_active })
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update counselor")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Counselors</h1>
          <p className="text-sm text-muted-foreground">Manage counselor accounts and caseloads.</p>
        </div>
        {isFullAdmin && (
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Counselor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Counselor</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Full name" value={form.new_user_full_name} onChange={(e) => setForm({ ...form, new_user_full_name: e.target.value })} />
                <Input placeholder="Email" type="email" value={form.new_user_email} onChange={(e) => setForm({ ...form, new_user_email: e.target.value })} />
                <Input placeholder="Password" type="password" value={form.new_user_password} onChange={(e) => setForm({ ...form, new_user_password: e.target.value })} />
                <Input placeholder="Employee code (optional)" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />
              </div>
              <DialogFooter>
                <Button onClick={() => void handleCreate()}>Create Account</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-muted-foreground animate-pulse">Loading...</div>
        ) : counselors.map((counselor) => {
          const perf = performance[counselor.id]
          return (
            <div key={counselor.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <PersonAvatar name={counselor.full_name} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{counselor.full_name}</span>
                      <Badge variant={counselor.is_active ? "default" : "secondary"}>
                        {counselor.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{counselor.email}</p>
                  </div>
                </div>
                {isFullAdmin && (
                  <Button variant="outline" size="sm" onClick={() => void toggleActive(counselor)}>
                    {counselor.is_active ? "Deactivate" : "Activate"}
                  </Button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Stat label="Caseload" value={`${counselor.active_student_count} / ${counselor.max_active_students}`} />
                <Stat label="Total Students" value={perf?.total_students ?? "—"} />
                <Stat label="Conversion Rate" value={perf ? `${perf.conversion_rate}%` : "—"} />
                <Stat label="Open Tasks" value={perf?.open_tasks ?? "—"} />
              </div>
            </div>
          )
        })}
        {!loading && counselors.length === 0 && (
          <div className="text-center text-muted-foreground py-12 border border-dashed rounded-2xl">
            No counselors yet. Add one to start assigning leads.
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  )
}
