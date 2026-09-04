import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/crm/StatusBadge"
import { TaskFormDialog } from "@/components/crm/TaskFormDialog"
import { completeTask, fetchTasks } from "@/lib/crm-api"
import type { Task } from "@/lib/crm-types"

export default function TasksBoard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"me" | "all">("me")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchTasks(filter === "me" ? { assigned_to: "me" } : {})
      setTasks(res.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tasks")
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const handleComplete = async (taskId: number) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "completed" } : t)))
    try {
      await completeTask(taskId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete task")
      void load()
    }
  }

  const pending = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled")
  const done = tasks.filter((t) => t.status === "completed" || t.status === "cancelled")

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">Follow-ups, reminders, appointments, and calls.</p>
        </div>
        <TaskFormDialog onCreated={load} />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as "me" | "all")}>
        <TabsList>
          <TabsTrigger value="me">My Tasks</TabsTrigger>
          <TabsTrigger value="all">All Tasks</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/60 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-6">
          <TaskGroup title="Open" tasks={pending} onComplete={handleComplete} />
          <TaskGroup title="Completed / Cancelled" tasks={done} onComplete={handleComplete} />
        </div>
      )}
    </div>
  )
}

function TaskGroup({ title, tasks, onComplete }: { title: string; tasks: Task[]; onComplete: (id: number) => void }) {
  if (tasks.length === 0) return null
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">{title} ({tasks.length})</h3>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
            <button
              onClick={() => onComplete(task.id)}
              disabled={task.status === "completed" || task.status === "cancelled"}
              className="mt-0.5 flex-shrink-0"
            >
              <CheckCircle2
                className={`w-5 h-5 ${task.status === "completed" ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500"}`}
              />
            </button>
            <div className="min-w-0 flex-1">
              <p className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </p>
              <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <StatusBadge value={task.status} />
                <StatusBadge value={task.priority} />
                <span>Due {new Date(task.due_at).toLocaleString()}</span>
                {task.student && (
                  <Link to={`/crm/students/${task.student}`} className="text-primary hover:underline">
                    {task.student_name}
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
