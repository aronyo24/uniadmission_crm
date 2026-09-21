import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import {
  CalendarClock, CheckCircle2, Clock, Copy, Loader2, MessageSquare, Mic, MicOff, Maximize, Minimize,
  MonitorUp, MonitorX, PhoneOff, Send, ShieldCheck, TriangleAlert, User, Video, VideoOff, Wifi, X,
} from "lucide-react"
import { toast } from "sonner"

import { useMeetingRoom, type Connection } from "@/hooks/useMeetingRoom"

/**
 * The meeting room - opened from a meeting link (/meeting/<token>) by both the
 * counselor (host) and the student (guest). Flow: pre-join lobby with camera
 * preview -> room with controls, screen share and chat -> "left"/"ended" screen.
 * Deliberately self-contained (no app-specific layout) so the same file works
 * in both the CRM and the student site.
 */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function StreamVideo({
  stream, muted = false, mirror = false, className = "",
}: { stream: MediaStream | null; muted?: boolean; mirror?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    if (stream) void el.play().catch(() => {})
  }, [stream])
  return (
    <video
      ref={ref} autoPlay playsInline muted={muted}
      className={`${className} ${mirror ? "[transform:scaleX(-1)]" : ""}`}
    />
  )
}

function AvatarCircle({ name, size = "lg" }: { name: string; size?: "sm" | "lg" }) {
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-semibold flex items-center justify-center select-none shadow-lg ${
        size === "lg" ? "w-24 h-24 text-3xl sm:w-32 sm:h-32 sm:text-4xl" : "w-12 h-12 text-base"
      }`}
    >
      {initials(name)}
    </div>
  )
}

function CircleButton({
  active = true, danger = false, onClick, label, children, badge,
}: {
  active?: boolean; danger?: boolean; onClick: () => void; label: string; children: React.ReactNode; badge?: number
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button" onClick={onClick} aria-label={label} title={label}
        className={`relative h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          danger ? "bg-red-600 hover:bg-red-500 text-white"
            : active ? "bg-white/10 hover:bg-white/20 text-white"
            : "bg-white text-neutral-900 hover:bg-white/90"
        }`}
      >
        {children}
        {!!badge && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-emerald-500 text-[11px] font-bold text-white flex items-center justify-center">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>
      <span className="hidden sm:block text-[11px] text-white/60">{label}</span>
    </div>
  )
}

const CONNECTION_LABEL: Record<Connection, { text: string; tone: string }> = {
  waiting: { text: "Waiting", tone: "bg-amber-500/20 text-amber-300" },
  connecting: { text: "Connecting…", tone: "bg-amber-500/20 text-amber-300" },
  connected: { text: "Connected", tone: "bg-emerald-500/20 text-emerald-300" },
  reconnecting: { text: "Reconnecting…", tone: "bg-red-500/20 text-red-300" },
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] w-full bg-neutral-950 text-white">{children}</div>
}

function CenterCard({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <Shell>
      <div className="min-h-[100dvh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-white/10 p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">{icon}</div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {children}
        </div>
      </div>
    </Shell>
  )
}

export default function MeetingRoom() {
  const { token = "" } = useParams()
  const room = useMeetingRoom(token)
  const { meeting, stage } = room

  const [chatOpen, setChatOpen] = useState(false)
  const [seenChat, setSeenChat] = useState(0)
  const [chatText, setChatText] = useState("")
  const [leaveMenu, setLeaveMenu] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (stage === "lobby" && meeting) void room.initMedia(meeting.meeting_type === "video")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, meeting?.id])

  useEffect(() => {
    if (chatOpen) {
      setSeenChat(room.chat.length)
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [chatOpen, room.chat.length])

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const unread = chatOpen ? 0 : room.chat.filter((m) => !m.mine).length - room.chat.slice(0, seenChat).filter((m) => !m.mine).length

  useEffect(() => {
    if (meeting) document.title = `${meeting.title} · Meeting`
  }, [meeting])

  const scheduledLabel = useMemo(
    () => meeting ? new Date(meeting.scheduled_at).toLocaleString([], { dateStyle: "full", timeStyle: "short" }) : "",
    [meeting],
  )

  if (stage === "loading") {
    return <CenterCard icon={<Loader2 className="w-6 h-6 animate-spin" />} title="Loading meeting…" />
  }

  if (stage === "error" || !meeting) {
    return (
      <CenterCard icon={<TriangleAlert className="w-6 h-6 text-amber-400" />} title="Can't open this meeting">
        <p className="text-white/60 text-sm">{room.error || "The link is invalid, or it belongs to a different account."}</p>
        <p className="text-white/40 text-xs">Make sure you're signed in with the account this invitation was sent to.</p>
      </CenterCard>
    )
  }

  const otherName = meeting.other_party_name || (room.isHost ? meeting.student_name : meeting.host_name)
  const selfName = room.isHost ? meeting.host_name : meeting.student_name

  if (stage === "ended" || stage === "left") {
    const ended = stage === "ended"
    return (
      <CenterCard
        icon={ended ? <CheckCircle2 className="w-7 h-7 text-emerald-400" /> : <PhoneOff className="w-6 h-6 text-white/70" />}
        title={ended ? "Meeting ended" : "You left the meeting"}
      >
        <p className="text-white/60 text-sm">{room.notice || (ended ? "Thanks for joining." : "You can rejoin while it's still running.")}</p>
        {!ended && (
          <button
            onClick={room.rejoin}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 font-medium transition-colors"
          >
            Rejoin meeting
          </button>
        )}
        <button
          onClick={() => window.close()}
          className="w-full rounded-xl bg-white/10 hover:bg-white/15 py-3 text-sm transition-colors"
        >
          Close this tab
        </button>
      </CenterCard>
    )
  }

  // ---------------------------------------------------------------- lobby
  if (stage === "lobby") {
    return (
      <Shell>
        <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-5xl grid lg:grid-cols-[1.4fr_1fr] gap-6 items-center">
            <div className="space-y-4">
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl">
                {room.cam && room.localStream ? (
                  <StreamVideo stream={room.localStream} muted mirror className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <AvatarCircle name={selfName} />
                    <p className="text-sm text-white/50">Camera is off</p>
                  </div>
                )}
                <div className="absolute bottom-4 inset-x-0 flex justify-center gap-4">
                  <CircleButton active={room.mic} onClick={room.toggleMic} label={room.mic ? "Mute" : "Unmute"}>
                    {room.mic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </CircleButton>
                  <CircleButton active={room.cam} onClick={() => void room.toggleCam()} label={room.cam ? "Stop video" : "Start video"}>
                    {room.cam ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </CircleButton>
                </div>
              </div>
              {room.mediaIssue && (
                <div className="flex gap-2 items-start rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm p-3">
                  <TriangleAlert className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span>{room.mediaIssue}</span>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-neutral-900 border border-white/10 p-6 sm:p-8 space-y-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-1">Ready to join?</p>
                <h1 className="text-2xl font-semibold leading-tight">{meeting.title}</h1>
              </div>
              <ul className="space-y-2.5 text-sm text-white/70">
                <li className="flex gap-2.5"><User className="w-4 h-4 mt-0.5 text-white/40" /> With {otherName}</li>
                <li className="flex gap-2.5"><CalendarClock className="w-4 h-4 mt-0.5 text-white/40" /> {scheduledLabel}</li>
                <li className="flex gap-2.5"><Clock className="w-4 h-4 mt-0.5 text-white/40" /> {meeting.duration_minutes} minutes · {meeting.meeting_type === "video" ? "Video" : "Audio"} meeting</li>
              </ul>
              {meeting.description && (
                <p className="text-sm text-white/60 border-l-2 border-white/10 pl-3 whitespace-pre-line">{meeting.description}</p>
              )}
              {room.notice && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm p-3">{room.notice}</div>
              )}
              <button
                onClick={() => void room.join()}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 font-semibold text-base transition-colors"
              >
                Join now
              </button>
              <p className="flex gap-2 text-xs text-white/40"><ShieldCheck className="w-4 h-4 flex-shrink-0" /> Only you and {otherName} can join. Your video is peer-to-peer and isn't recorded.</p>
            </div>
          </div>
        </div>
      </Shell>
    )
  }

  // ----------------------------------------------------------------- room
  const remoteHasVideo = !!room.remoteStream?.getVideoTracks().length
  const showRemoteVideo = room.connection === "connected" && remoteHasVideo && (room.peerState.cam || room.peerState.sharing)
  const conn = CONNECTION_LABEL[room.connection]

  const copyLink = () => {
    void navigator.clipboard.writeText(meeting.join_url).then(() => toast.success("Meeting link copied"))
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }
  const submitChat = (e: React.FormEvent) => {
    e.preventDefault()
    room.sendChat(chatText)
    setChatText("")
  }

  return (
    <div className="h-[100dvh] w-full bg-neutral-950 text-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-neutral-950/80 backdrop-blur">
        <div className="min-w-0">
          <h1 className="font-semibold truncate">{meeting.title}</h1>
          <p className="text-xs text-white/50 truncate">with {otherName}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${conn.tone}`}>
            <Wifi className="w-3.5 h-3.5" /> {conn.text}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs tabular-nums font-medium">{formatClock(room.elapsed)}</span>
        </div>
      </header>

      <div className="relative flex-1 min-h-0 flex">
        {/* Stage */}
        <main className="flex-1 min-w-0 relative p-3 sm:p-4">
          <div className="relative h-full w-full rounded-2xl overflow-hidden bg-neutral-900 border border-white/10">
            {/* Always mounted so remote audio plays even while showing the avatar. */}
            <StreamVideo
              stream={room.remoteStream}
              className={`absolute inset-0 w-full h-full ${room.peerState.sharing ? "object-contain bg-black" : "object-cover"} ${showRemoteVideo ? "" : "opacity-0 pointer-events-none"}`}
            />

            {!showRemoteVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
                <AvatarCircle name={otherName} />
                <div>
                  <p className="text-xl font-semibold">{otherName}</p>
                  {!room.peerPresent ? (
                    <p className="text-white/50 mt-1">Waiting for {otherName.split(" ")[0]} to join…</p>
                  ) : room.connection === "connected" ? (
                    <p className="text-white/50 mt-1 flex items-center justify-center gap-1.5"><VideoOff className="w-4 h-4" /> Camera is off</p>
                  ) : (
                    <p className="text-white/50 mt-1 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</p>
                  )}
                </div>
                {!room.peerPresent && room.isHost && (
                  <button
                    onClick={copyLink}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2 text-sm transition-colors"
                  >
                    <Copy className="w-4 h-4" /> Copy invite link
                  </button>
                )}
              </div>
            )}

            {room.connection === "connected" && !room.peerState.mic && (
              <span className="absolute left-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs">
                <MicOff className="w-3.5 h-3.5 text-red-400" /> {otherName} is muted
              </span>
            )}
            {room.connection === "reconnecting" && (
              <div className="absolute top-3 inset-x-0 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-600/90 px-4 py-1.5 text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" /> Connection interrupted — reconnecting…
                </span>
              </div>
            )}
            {room.sharing && (
              <div className="absolute top-3 inset-x-0 flex justify-center">
                <span className="inline-flex items-center gap-3 rounded-full bg-emerald-600/95 pl-4 pr-2 py-1.5 text-sm font-medium">
                  You're sharing your screen
                  <button onClick={() => void room.toggleScreenShare()} className="rounded-full bg-white/20 hover:bg-white/30 px-3 py-0.5 text-xs">Stop</button>
                </span>
              </div>
            )}

            {/* Self view */}
            <div className="absolute bottom-3 right-3 w-28 sm:w-44 aspect-video rounded-xl overflow-hidden bg-neutral-800 border border-white/20 shadow-xl">
              {room.cam && room.localStream ? (
                <StreamVideo stream={room.localStream} muted mirror className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><AvatarCircle name={selfName} size="sm" /></div>
              )}
              <span className="absolute bottom-1 left-1.5 text-[10px] bg-black/60 rounded px-1.5 py-0.5">You</span>
              {!room.mic && <MicOff className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-red-400" />}
            </div>
          </div>
        </main>

        {/* Chat panel */}
        {chatOpen && (
          <aside className="absolute inset-0 z-20 sm:static sm:inset-auto sm:w-80 flex flex-col bg-neutral-900 border-l border-white/10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 className="font-semibold">In-meeting chat</h2>
              <button onClick={() => setChatOpen(false)} aria-label="Close chat" className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {room.chat.length === 0 && (
                <p className="text-sm text-white/40 text-center mt-8">Messages are visible only to people in this meeting and disappear when it ends.</p>
              )}
              {room.chat.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap ${m.mine ? "bg-emerald-600" : "bg-white/10"}`}>
                    {m.text}
                    <div className="text-[10px] opacity-60 mt-0.5">{new Date(m.at).toLocaleTimeString([], { timeStyle: "short" })}</div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={submitChat} className="p-3 border-t border-white/10 flex gap-2">
              <input
                value={chatText} onChange={(e) => setChatText(e.target.value)}
                placeholder={room.connection === "connected" ? "Type a message" : "Chat opens once connected"}
                disabled={room.connection !== "connected"} maxLength={2000}
                className="flex-1 min-w-0 rounded-xl bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
              <button
                type="submit" disabled={!chatText.trim() || room.connection !== "connected"} aria-label="Send"
                className="h-9 w-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* Control bar */}
      <footer className="relative px-4 py-3 sm:py-4 border-t border-white/10 bg-neutral-950">
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <CircleButton active={room.mic} onClick={room.toggleMic} label={room.mic ? "Mute" : "Unmute"}>
            {room.mic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </CircleButton>
          <CircleButton active={room.cam} onClick={() => void room.toggleCam()} label={room.cam ? "Stop video" : "Start video"}>
            {room.cam ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </CircleButton>
          {room.canShareScreen && (
            <CircleButton active={!room.sharing} onClick={() => void room.toggleScreenShare()} label={room.sharing ? "Stop share" : "Share screen"}>
              {room.sharing ? <MonitorX className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
            </CircleButton>
          )}
          <CircleButton active={!chatOpen} onClick={() => setChatOpen((o) => !o)} label="Chat" badge={unread}>
            <MessageSquare className="w-5 h-5" />
          </CircleButton>
          <span className="hidden md:block">
            <CircleButton active onClick={toggleFullscreen} label={fullscreen ? "Exit full screen" : "Full screen"}>
              {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </CircleButton>
          </span>
          <div className="relative">
            <CircleButton danger onClick={() => (room.isHost ? setLeaveMenu((o) => !o) : room.leave())} label="Leave">
              <PhoneOff className="w-5 h-5" />
            </CircleButton>
            {leaveMenu && room.isHost && (
              <div className="absolute bottom-full right-0 mb-3 w-56 rounded-xl bg-neutral-800 border border-white/10 shadow-2xl overflow-hidden text-sm">
                <button
                  onClick={() => { setLeaveMenu(false); void room.endForAll() }}
                  className="w-full text-left px-4 py-3 text-red-400 font-medium hover:bg-white/5"
                >
                  End meeting for all
                </button>
                <button
                  onClick={() => { setLeaveMenu(false); room.leave() }}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 border-t border-white/10"
                >
                  Leave meeting
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
