import { useCallback, useEffect, useState } from "react"
import { CalendarClock, Copy, ExternalLink, Mail, Phone, Video, X, Zap } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatScheduledTime } from "@/lib/call-reminder"
import {
  cancelStudentMeeting, createStudentMeeting, fetchStudentMeetings,
  type Meeting, type MeetingType,
} from "@/lib/meetings"

const POLL_MS = 20000

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** Default the picker to the next quarter-hour, in local time, formatted for <input type="datetime-local">. */
function defaultStart(): string {
  const d = new Date(Date.now() + 30 * 60_000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function statusBadge(m: Meeting) {
  if (m.status === "live") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Live</Badge>
  if (m.status === "scheduled") return <Badge variant="secondary">Scheduled</Badge>
  if (m.status === "ended") return <Badge variant="outline">Ended</Badge>
  return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>
}

/**
 * The counselor's meeting controls for one student: start an instant meeting,
 * schedule one (the student gets an emailed + in-app join link), and see /
 * join / copy / cancel existing ones. Replaces ringing the student directly.
 */
export function MeetingsPanel({
  studentId, studentName, canMeet,
}: { studentId: number | string; studentName: string; canMeet: boolean }) {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [startsAt, setStartsAt] = useState(defaultStart)
  const [duration, setDuration] = useState(30)
  const [type, setType] = useState<MeetingType>("video")
  const [sendEmail, setSendEmail] = useState(true)

  const load = useCallback(async () => {
    try {
      setMeetings(await fetchStudentMeetings(studentId))
    } catch {
      setMeetings((prev) => prev ?? [])
    }
  }, [studentId])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const openRoom = (token: string) => window.open(`/meeting/${token}`, "_blank", "noopener")

  const startInstant = async (meetingType: MeetingType) => {
    // Open the tab synchronously (popup blockers only allow it inside the click), then point it at the room.
    const tab = window.open("", "_blank")
    setBusy(true)
    try {
      const m = await createStudentMeeting(studentId, {
        meeting_type: meetingType, duration_minutes: 30, send_email: true,
        title: `Instant ${meetingType} meeting`,
      })
      if (tab) tab.location.href = `/meeting/${m.token}`
      toast.success(m.email_sent ? "Meeting started — invite emailed to the student" : "Meeting started — student notified")
      void load()
    } catch (err) {
      tab?.close()
      toast.error(err instanceof Error ? err.message : "Couldn't start the meeting")
    } finally {
      setBusy(false)
    }
  }

  const schedule = async () => {
    if (!startsAt) return
    setBusy(true)
    try {
      const m = await createStudentMeeting(studentId, {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        meeting_type: type,
        // datetime-local has no timezone: Date reads it as local time, and we send UTC.
        scheduled_at: new Date(startsAt).toISOString(),
        duration_minutes: duration,
        send_email: sendEmail,
      })
      toast.success(
        sendEmail
          ? m.email_sent ? "Meeting scheduled — invitation emailed" : "Meeting scheduled — email failed, copy the link instead"
          : "Meeting scheduled",
      )
      setDialogOpen(false)
      setTitle("")
      setDescription("")
      setStartsAt(defaultStart())
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't schedule the meeting")
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (m: Meeting) => {
    try {
      await cancelStudentMeeting(studentId, m.id)
      toast.success("Meeting cancelled")
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel")
    }
  }

  const copy = (m: Meeting) => {
    void navigator.clipboard.writeText(m.join_url).then(() => toast.success("Meeting link copied"))
  }

  const upcoming = (meetings ?? []).filter((m) => m.status === "scheduled" || m.status === "live")
  const past = (meetings ?? []).filter((m) => m.status === "ended" || m.status === "cancelled").slice(0, 3)

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" /> Meetings
        </h3>
        {canMeet && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void startInstant("video")}>
              <Zap className="w-4 h-4 mr-1.5" /> Instant meeting
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <CalendarClock className="w-4 h-4 mr-1.5" /> Schedule meeting
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {canMeet
          ? `Meetings run on a private link that ${studentName.split(" ")[0]} receives by email and in their portal.`
          : `Meetings are unavailable until ${studentName.split(" ")[0]} registers a student account.`}
      </p>

      {meetings === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : upcoming.length === 0 && past.length === 0 ? (
        <p className="text-sm text-muted-foreground">No meetings yet.</p>
      ) : (
        <ul className="space-y-2">
          {[...upcoming, ...past].map((m) => {
            const active = m.status === "scheduled" || m.status === "live"
            return (
              <li key={m.id} className="rounded-xl border p-3 flex items-center gap-3 flex-wrap">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  {m.meeting_type === "video" ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatScheduledTime(m.scheduled_at)} · {m.duration_minutes} min
                  </p>
                </div>
                {statusBadge(m)}
                {active && (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" onClick={() => openRoom(m.token)}>
                      <ExternalLink className="w-4 h-4 mr-1.5" /> {m.status === "live" ? "Join" : "Open room"}
                    </Button>
                    <Button size="icon" variant="outline" className="h-8 w-8" title="Copy link" onClick={() => copy(m)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Cancel meeting" onClick={() => void cancel(m)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule a meeting with {studentName}</DialogTitle>
            <DialogDescription>
              A private join link is created. The student can enter 15 minutes before the start time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="meeting-title">Topic</Label>
              <Input
                id="meeting-title" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={`Counseling session with ${studentName}`} maxLength={200}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="meeting-start">Date &amp; time</Label>
                <Input id="meeting-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meeting-duration">Duration</Label>
                <select id="meeting-duration" className={selectClass} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {[15, 30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d} minutes</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meeting-type">Type</Label>
              <select id="meeting-type" className={selectClass} value={type} onChange={(e) => setType(e.target.value as MeetingType)}>
                <option value="video">Video meeting</option>
                <option value="audio">Audio only</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meeting-desc">Agenda (optional)</Label>
              <Textarea
                id="meeting-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="What will you cover? The student sees this in the invitation."
              />
            </div>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 accent-primary" />
              <Mail className="w-4 h-4 text-muted-foreground" /> Email the invitation link to the student
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button disabled={busy || !startsAt} onClick={() => void schedule()}>
              <CalendarClock className="w-4 h-4 mr-1.5" /> Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
