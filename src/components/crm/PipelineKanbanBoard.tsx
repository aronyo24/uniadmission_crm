import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { GraduationCap, Mail, Phone } from "lucide-react"

import { PersonAvatar } from "@/components/crm/PersonAvatar"
import type { PipelineStage, StudentListItem } from "@/lib/crm-types"

function StudentCard({ student, onClick }: { student: StudentListItem; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: student.id,
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : undefined }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`rounded-xl border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <PersonAvatar name={student.full_name} size="sm" />
        <p className="font-medium text-sm truncate">{student.full_name}</p>
      </div>
      <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate">
          <Mail className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{student.email}</span>
        </div>
        {student.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 flex-shrink-0" />
            {student.phone}
          </div>
        )}
        {student.target_country && (
          <div className="flex items-center gap-1.5">
            <GraduationCap className="w-3 h-3 flex-shrink-0" />
            {student.target_country}
            {student.target_degree ? ` · ${student.target_degree}` : ""}
          </div>
        )}
      </div>
      {student.counselor_name && (
        <p className="mt-2 text-[10px] text-muted-foreground/80">Assigned: {student.counselor_name}</p>
      )}
    </div>
  )
}

function StageColumn({
  stage,
  students,
  onCardClick,
}: {
  stage: PipelineStage
  students: StudentListItem[]
  onCardClick: (student: StudentListItem) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 flex-shrink-0 rounded-2xl border bg-muted/30 transition-colors ${
        isOver ? "border-primary bg-primary/5" : ""
      }`}
    >
      <div className="px-3 py-2.5 border-b flex items-center justify-between">
        <span className="font-semibold text-sm">{stage.label}</span>
        <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{students.length}</span>
      </div>
      <div className="flex-1 p-2.5 space-y-2 min-h-[120px] max-h-[65vh] overflow-y-auto">
        {students.map((student) => (
          <StudentCard key={student.id} student={student} onClick={() => onCardClick(student)} />
        ))}
        {students.length === 0 && (
          <p className="text-xs text-muted-foreground/60 text-center py-6">No leads</p>
        )}
      </div>
    </div>
  )
}

export function PipelineKanbanBoard({
  stages,
  studentsByStage,
  onCardClick,
  onDrop,
}: {
  stages: PipelineStage[]
  studentsByStage: Record<string, StudentListItem[]>
  onCardClick: (student: StudentListItem) => void
  onDrop: (studentId: number, stageKey: string) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const studentId = Number(active.id)
    const stageKey = String(over.id)
    onDrop(studentId, stageKey)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <StageColumn
            key={stage.key}
            stage={stage}
            students={studentsByStage[stage.key] ?? []}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </DndContext>
  )
}
