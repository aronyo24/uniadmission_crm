const REMINDER_LEAD_MINUTES = 10
const REMINDER_GRACE_MINUTES = 30

/** True once a scheduled call is within its reminder window - from
 * REMINDER_LEAD_MINUTES before the scheduled time up to REMINDER_GRACE_MINUTES
 * after, so a missed/late reminder doesn't just vanish the moment the clock
 * ticks past the scheduled minute. */
export function isReminderDue(proposedAt: string | null): boolean {
  if (!proposedAt) return false
  const target = new Date(proposedAt).getTime()
  const now = Date.now()
  const minutesUntil = (target - now) / 60000
  return minutesUntil <= REMINDER_LEAD_MINUTES && minutesUntil >= -REMINDER_GRACE_MINUTES
}

export function formatScheduledTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  })
}
