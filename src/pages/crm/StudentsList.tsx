import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/crm/DataTable"
import { StageBadge } from "@/components/crm/StageBadge"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { QuickAddStudentDialog } from "@/components/crm/QuickAddStudentDialog"
import { SendEmailDialog } from "@/components/crm/SendEmailDialog"
import { QuickChatDialog } from "@/components/crm/QuickChatDialog"
import { useAuth } from "@/lib/auth"
import { formatScheduledTime } from "@/lib/call-reminder"
import { fetchCounselors, fetchLeadSources, fetchPipelineStages, fetchStudents } from "@/lib/crm-api"
import type { Counselor, LeadSource, PipelineStage, StudentListItem } from "@/lib/crm-types"

function CallRequestCell({ request }: { request: StudentListItem["open_call_request"] }) {
  if (!request) return <span className="text-muted-foreground">—</span>
  if (request.status === "accepted") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
        Scheduled{request.proposed_at ? `: ${formatScheduledTime(request.proposed_at)}` : ""}
      </Badge>
    )
  }
  if (request.status === "proposed") {
    return (
      <Badge className="bg-primary/15 text-primary border-primary/20">
        Proposed{request.proposed_at ? `: ${formatScheduledTime(request.proposed_at)}` : ""}
      </Badge>
    )
  }
  return <Badge variant="secondary">Requested</Badge>
}

const columns: ColumnDef<StudentListItem, unknown>[] = [
  {
    accessorKey: "full_name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <PersonAvatar name={row.original.full_name} size="sm" />
        <span className="font-medium">{row.original.full_name}</span>
      </div>
    ),
  },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "phone", header: "Phone" },
  {
    accessorKey: "stage_label",
    header: "Stage",
    cell: ({ row }) => <StageBadge stageKey={row.original.stage_key} label={row.original.stage_label} />,
  },
  { accessorKey: "counselor_name", header: "Counselor", cell: ({ row }) => row.original.counselor_name ?? "—" },
  { accessorKey: "target_country", header: "Target Country", cell: ({ row }) => row.original.target_country || "—" },
  {
    id: "open_call_request",
    header: "Call",
    cell: ({ row }) => <CallRequestCell request={row.original.open_call_request} />,
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      // Stop the click from bubbling to the row's onRowClick (which opens
      // the full profile) so these are true one-click shortcuts instead of
      // a detour through the profile page every time.
      <div onClick={(e) => e.stopPropagation()} className="flex justify-end gap-2">
        <QuickChatDialog studentId={row.original.id} studentName={row.original.full_name} />
        <SendEmailDialog studentId={row.original.id} studentEmail={row.original.email} onSent={() => {}} />
      </div>
    ),
  },
]

export default function StudentsList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isCounselor = user?.role === "counselor"
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [leadSources, setLeadSources] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState<string>("all")
  const [counselorFilter, setCounselorFilter] = useState<string>("all")
  // Counselors land on "my students" by default (the server already scopes
  // them down if they lack crm_view_all_students - this just makes the
  // default view match that instead of confusingly showing "All" and
  // silently filtering server-side).
  const [myStudentsOnly, setMyStudentsOnly] = useState(true)

  const myCounselorId = useMemo(
    () => counselors.find((c) => c.user_id === Number(user?.id))?.id,
    [counselors, user]
  )
  const effectiveCounselorFilter = isCounselor && myStudentsOnly
    ? (myCounselorId ? String(myCounselorId) : "all")
    : counselorFilter

  const loadLookups = useCallback(async () => {
    try {
      const [stagesRes, counselorsRes, sourcesRes] = await Promise.all([
        fetchPipelineStages(),
        fetchCounselors(),
        fetchLeadSources(),
      ])
      setStages(stagesRes)
      setCounselors(counselorsRes)
      setLeadSources(sourcesRes)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load filters")
    }
  }, [])

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchStudents({
        page,
        search: search || undefined,
        stage: stageFilter !== "all" ? stageFilter : undefined,
        counselor: effectiveCounselorFilter !== "all" ? effectiveCounselorFilter : undefined,
      })
      setStudents(res.data)
      setTotalPages(res.pagination.totalPages)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load students")
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [page, search, stageFilter, effectiveCounselorFilter])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  const handleCreated = () => {
    setPage(1)
    void loadStudents()
  }

  const stageOptions = useMemo(() => stages, [stages])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-sm text-muted-foreground">All leads and students in the pipeline.</p>
        </div>
        <QuickAddStudentDialog stages={stages} counselors={counselors} leadSources={leadSources} onCreated={handleCreated} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
          />
        </div>
        <Select value={stageFilter} onValueChange={(v) => { setPage(1); setStageFilter(v) }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {stageOptions.map((stage) => (
              <SelectItem key={stage.key} value={stage.key}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isCounselor ? (
          <div className="inline-flex rounded-lg border p-0.5 bg-muted/30">
            <Button
              type="button"
              size="sm"
              variant={myStudentsOnly ? "default" : "ghost"}
              className="rounded-md h-8"
              onClick={() => { setPage(1); setMyStudentsOnly(true) }}
            >
              My Students
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!myStudentsOnly ? "default" : "ghost"}
              className="rounded-md h-8"
              onClick={() => { setPage(1); setMyStudentsOnly(false) }}
            >
              All
            </Button>
          </div>
        ) : (
          <Select value={counselorFilter} onValueChange={(v) => { setPage(1); setCounselorFilter(v) }}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All counselors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All counselors</SelectItem>
              {counselors.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <DataTable
        columns={columns}
        data={students}
        isLoading={loading}
        emptyMessage="No students match these filters."
        onRowClick={(student) => navigate(`/crm/students/${student.id}`)}
        pagination={{ page, totalPages, onPageChange: setPage }}
      />
    </div>
  )
}
