import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const PALETTE = [
  "bg-emerald-500/15 text-emerald-600",
  "bg-blue-500/15 text-blue-600",
  "bg-purple-500/15 text-purple-600",
  "bg-amber-500/15 text-amber-600",
  "bg-pink-500/15 text-pink-600",
  "bg-cyan-500/15 text-cyan-600",
  "bg-indigo-500/15 text-indigo-600",
  "bg-orange-500/15 text-orange-600",
]

function colorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function PersonAvatar({
  name,
  className,
  size = "default",
}: {
  name: string
  className?: string
  size?: "sm" | "default" | "lg" | "xl"
}) {
  const sizeClass = size === "sm" ? "h-7 w-7 text-xs"
    : size === "lg" ? "h-12 w-12 text-base"
    : size === "xl" ? "h-28 w-28 text-4xl"
    : "h-9 w-9 text-sm"
  return (
    <Avatar className={cn(sizeClass, className)}>
      <AvatarFallback className={cn("font-semibold", colorFor(name || "?"))}>
        {initialsFor(name || "?")}
      </AvatarFallback>
    </Avatar>
  )
}
