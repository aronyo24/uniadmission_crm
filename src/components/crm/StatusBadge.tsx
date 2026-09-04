import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-500/15 text-slate-500 border-slate-500/30",
  in_progress: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-500 border-red-500/30",
  low: "bg-slate-500/15 text-slate-500 border-slate-500/30",
  medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  high: "bg-red-500/15 text-red-500 border-red-500/30",
}

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", STATUS_COLORS[value] ?? "bg-muted text-muted-foreground")}>
      {(label ?? value).replace(/_/g, " ")}
    </Badge>
  )
}
