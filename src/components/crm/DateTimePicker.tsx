import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = [0, 15, 30, 45]

function to12Hour(hour24: number): { hour12: number; period: "AM" | "PM" } {
  const period = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return { hour12, period }
}

function to24Hour(hour12: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12
  return hour12 === 12 ? 12 : hour12 + 12
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date & time",
  className,
}: {
  value: Date | undefined
  onChange: (date: Date) => void
  placeholder?: string
  className?: string
}) {
  const { hour12, period } = to12Hour(value?.getHours() ?? 9)
  const minute = value ? Math.round(value.getMinutes() / 15) * 15 : 0

  const updateTime = (nextHour12: number, nextMinute: number, nextPeriod: "AM" | "PM") => {
    const base = value ? new Date(value) : new Date()
    base.setHours(to24Hour(nextHour12, nextPeriod), nextMinute === 60 ? 0 : nextMinute, 0, 0)
    onChange(base)
  }

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return
    const next = new Date(day)
    next.setHours(value?.getHours() ?? 9, value?.getMinutes() ?? 0, 0, 0)
    onChange(next)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value
            ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={handleDaySelect} />
        <div className="flex items-center gap-2 border-t p-3">
          <Select value={String(hour12)} onValueChange={(v) => updateTime(Number(v), minute, period)}>
            <SelectTrigger className="w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select value={String(minute)} onValueChange={(v) => updateTime(hour12, Number(v), period)}>
            <SelectTrigger className="w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTES.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {String(m).padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => updateTime(hour12, minute, v as "AM" | "PM")}>
            <SelectTrigger className="w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  )
}
