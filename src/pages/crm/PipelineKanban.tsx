import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { PipelineKanbanBoard } from "@/components/crm/PipelineKanbanBoard"
import { QuickAddStudentDialog } from "@/components/crm/QuickAddStudentDialog"
import { fetchCounselors, fetchLeadSources, fetchPipelineStages, fetchStudents, changeStudentStage } from "@/lib/crm-api"
import type { Counselor, LeadSource, PipelineStage, StudentListItem } from "@/lib/crm-types"

export default function PipelineKanban() {
  const navigate = useNavigate()
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [leadSources, setLeadSources] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [stagesRes, studentsRes, counselorsRes, sourcesRes] = await Promise.all([
        fetchPipelineStages(),
        fetchStudents({ is_lost: false, limit: 200 }),
        fetchCounselors(),
        fetchLeadSources(),
      ])
      setStages(stagesRes)
      setStudents(studentsRes.data)
      setCounselors(counselorsRes)
      setLeadSources(sourcesRes)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load pipeline")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const studentsByStage = useMemo(() => {
    const map: Record<string, StudentListItem[]> = {}
    for (const student of students) {
      map[student.stage_key] = map[student.stage_key] ?? []
      map[student.stage_key].push(student)
    }
    return map
  }, [students])

  const handleDrop = async (studentId: number, stageKey: string) => {
    const student = students.find((s) => s.id === studentId)
    if (!student || student.stage_key === stageKey) return

    // Optimistic update
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, stage_key: stageKey } : s))
    )

    try {
      await changeStudentStage(studentId, stageKey)
      toast.success(`Moved ${student.full_name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move lead")
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, stage_key: student.stage_key } : s))
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Drag leads between stages to update their status.</p>
        </div>
        <QuickAddStudentDialog stages={stages} counselors={counselors} leadSources={leadSources} onCreated={load} />
      </div>

      {loading ? (
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-72 h-96 rounded-2xl bg-muted/60 animate-pulse flex-shrink-0" />
          ))}
        </div>
      ) : (
        <PipelineKanbanBoard
          stages={stages}
          studentsByStage={studentsByStage}
          onCardClick={(student) => navigate(`/crm/students/${student.id}`)}
          onDrop={(studentId, stageKey) => void handleDrop(studentId, stageKey)}
        />
      )}
    </div>
  )
}
