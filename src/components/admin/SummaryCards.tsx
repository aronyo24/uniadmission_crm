import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

interface Card {
  label: string
  value: string | number
  icon: LucideIcon
}

export function SummaryCards({ cards }: { cards: Card[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-2xl border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">{card.label}</span>
            <card.icon className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{card.value}</div>
        </motion.div>
      ))}
    </div>
  )
}
