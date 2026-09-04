import { BarChart2 } from "lucide-react"

interface ChartEmptyProps {
  message?: string
  hint?: string
}

export function ChartEmpty({ message = "No data yet", hint }: ChartEmptyProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground select-none">
      <BarChart2 className="w-9 h-9 opacity-20" />
      <p className="text-sm font-medium opacity-60">{message}</p>
      {hint && <p className="text-xs opacity-40 max-w-xs text-center">{hint}</p>}
    </div>
  )
}
