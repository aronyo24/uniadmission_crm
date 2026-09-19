import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/crm/DataTable"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { fetchApplications } from "@/lib/crm-api"
import type { ApplicationListItem, ApplicationStatus } from "@/lib/crm-types"

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "documents_requested", label: "Documents Requested" },
  { value: "offer_received", label: "Offer Received" },
  { value: "enrolled", label: "Enrolled" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
]

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  submitted: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  under_review: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",
  documents_requested: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  offer_received: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  enrolled: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
  rejected: "border-red-500/30 bg-red-500/10 text-red-600",
  withdrawn: "border-border bg-muted text-muted-foreground",
}

const columns: ColumnDef<ApplicationListItem, unknown>[] = [
  {
    accessorKey: "student_name",
    header: "Student",
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <PersonAvatar name={row.original.student_name} size="sm" />
        <div>
          <p className="font-medium leading-tight">{row.original.student_name}</p>
          <p className="text-xs text-muted-foreground leading-tight">{row.original.student_email}</p>
        </div>
      </div>
    ),
  },
  { accessorKey: "course_name", header: "Programme" },
  { accessorKey: "university_name", header: "University" },
  { accessorKey: "intake_term", header: "Intake", cell: ({ row }) => row.original.intake_term || "—" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline" className={STATUS_COLOR[row.original.status]}>
        {STATUS_OPTIONS.find((o) => o.value === row.original.status)?.label ?? row.original.status}
      </Badge>
    ),
  },
  { accessorKey: "counselor_name", header: "Counselor", cell: ({ row }) => row.original.counselor_name ?? "Unassigned" },
  {
    accessorKey: "submitted_at",
    header: "Submitted",
    cell: ({ row }) => new Date(row.original.submitted_at).toLocaleDateString(),
  },
]

export default function ApplicationsList() {
  const navigate = useNavigate()
  const [applications, setApplications] = useState<ApplicationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApplications({
        page,
        search: search || undefined,
        status: statusFilter !== "all" ? (statusFilter as ApplicationStatus) : undefined,
      })
      setApplications(res.data)
      setTotalPages(res.pagination.totalPages)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load applications")
      setApplications([])
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Applications</h1>
        <p className="text-sm text-muted-foreground">Every course application submitted through the student portal, across all counselors.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by student, programme, or university..."
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setPage(1); setStatusFilter(v) }}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={applications}
        isLoading={loading}
        emptyMessage="No applications match these filters."
        onRowClick={(application) => navigate(`/crm/students/${application.student}`)}
        pagination={{ page, totalPages, onPageChange: setPage }}
      />
    </div>
  )
}
