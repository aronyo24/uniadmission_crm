import { useEffect, useState } from "react"
import { CalendarClock, Check, Phone, Video, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatScheduledTime, isReminderDue } from "@/lib/call-reminder"
import { useCountdown } from "@/hooks/useCountdown"
import { cancelStudentCallRequest, fetchStudentCallRequests, proposeCallRequestTime } from "@/lib/crm-api"
import type { CallRequest } from "@/lib/crm-types"

const POLL_MS = 20000

/**
 * The counselor side of the call-request booking flow, rendered as a
 * system-style card inside the chat thread (see MessageThread's
 * `trailingContent`) so it shows up right where the counselor is already
 * looking, instead of a separate panel they might never notice. Accept
 * reveals the scheduling form; Reject cancels the request outright. The
 * counterpart to CallRequestPanel (student side). Sits alongside
 * CallManager, which still places the actual call - this only manages
 * the booking.
 */
export function CallRequestManager({ studentId }: { studentId: number | string }) {
  const [request, setRequest] = useState<CallRequest | null | undefined>(undefined)
  const [accepting, setAccepting] = useState(false)
  const [proposedAt, setProposedAt] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const countdown = useCountdown(request?.status === "accepted" ? request.proposed_at : null)

  const load = async () => {
    try {
      const all = await fetchStudentCallRequests(studentId)
      setRequest(all.find((r) => ["pending", "proposed", "accepted"].includes(r.status)) ?? null)
    } catch {
      // Transient poll failures aren't worth surfacing every 20s.
    }
  }

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  const propose = async () => {
    if (!request || !proposedAt) return
    setBusy(true)
    try {
      // The <input type="datetime-local"> value has no timezone info and
      // means "this wall-clock time in the counselor's own timezone" - hand
      // it to Date (which reads it as local time) and send UTC, since the
      // server (TIME_ZONE='UTC') would otherwise take the bare string
      // literally as UTC and shift the actual call time.
      const proposedAtUtc = new Date(proposedAt).toISOString()
      setRequest(await proposeCallRequestTime(studentId, request.id, { proposed_at: proposedAtUtc, note }))
      toast.success("Proposed time sent to student")
      setProposedAt("")
      setNote("")
      setAccepting(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to propose a time")
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    if (!request) return
    setBusy(true)
    try {
      await cancelStudentCallRequest(studentId, request.id)
      setRequest(null)
      toast.success("Call request declined")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decline")
    } finally {
      setBusy(false)
    }
  }

  if (!request) return null

  const dueSoon = request.status === "accepted" && isReminderDue(request.proposed_at)

  return (
    <div className="flex justify-center py-1">
      <div className={`w-full max-w-md rounded-xl border p-3 text-sm space-y-2 ${dueSoon ? "border-emerald-400 bg-emerald-500/10" : "bg-muted/40"}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {request.call_type === "video" ? <Video className="w-4 h-4 text-primary" /> : <Phone className="w-4 h-4 text-primary" />}
            <span className="font-medium">
              {request.call_type === "video" ? "Video" : "Audio"} call requested
            </span>
          </div>
          {request.status === "pending" && !accepting && (
            <button onClick={() => void reject()} disabled={busy} className="text-muted-foreground hover:text-destructive" title="Reject">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {request.note && <p className="text-muted-foreground">"{request.note}"</p>}

        {request.status === "pending" && !accepting && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => setAccepting(true)} disabled={busy}>
              <Check className="w-4 h-4 mr-1.5" /> Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => void reject()} disabled={busy}>
              <X className="w-4 h-4 mr-1.5" /> Reject
            </Button>
          </div>
        )}

        {(accepting || request.status === "proposed") && (
          <div className="space-y-2 pt-1">
            {request.status === "proposed" && (
              <Badge variant="secondary" className="mb-1">
                Waiting on student — proposed {request.proposed_at && formatScheduledTime(request.proposed_at)}
              </Badge>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="datetime-local"
                value={proposedAt}
                onChange={(e) => setProposedAt(e.target.value)}
                className="sm:w-56"
              />
              <Textarea
                rows={1}
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-9 resize-none"
              />
              <Button size="sm" disabled={busy || !proposedAt} onClick={() => void propose()} className="flex-shrink-0">
                <CalendarClock className="w-4 h-4 mr-1.5" /> {request.status === "proposed" ? "Re-propose" : "Send Time"}
              </Button>
            </div>
          </div>
        )}

        {request.status === "accepted" && (
          <div>
            <p className={dueSoon ? "font-semibold text-emerald-700 dark:text-emerald-400" : ""}>
              {dueSoon
                ? "Scheduled call is due now — start it above."
                : `Confirmed for ${request.proposed_at ? formatScheduledTime(request.proposed_at) : "soon"}.`}
            </p>
            {countdown && (
              <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">Starts in {countdown}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
