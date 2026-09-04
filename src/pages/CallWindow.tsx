import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { useAuth } from "@/lib/auth"
import { useCallSession, type CallApi } from "@/hooks/useCallSession"
import type { CallType } from "@/lib/crm-types"
import {
  answerMyCall, answerStudentCall, endMyCall, endStudentCall, pollMyCall, pollStudentCall,
  sendMyCallIce, sendStudentCallIce, startMyCall, startStudentCall,
} from "@/lib/crm-api"

/**
 * A dedicated, chrome-less popup window for one call - opened via
 * window.open() from CallManager (counselor placing a call) or
 * CallOverlay (student answering one), and closes itself the moment the
 * call ends, the way a real calling app's call window does instead of a
 * modal sitting on top of the page you were just working in.
 *
 * mode=outgoing: this window places the call itself on mount.
 * mode=answer: this window's poll picks up the already-ringing call and
 * answers it automatically - the actual "incoming, accept or decline"
 * decision already happened as a banner in the tab that opened this one.
 */
export default function CallWindow() {
  const [params] = useSearchParams()
  const { loading, isAuthenticated } = useAuth()

  const mode = params.get("mode") === "answer" ? "answer" : "outgoing"
  const viewerIsCounselor = params.get("role") === "counselor"
  const studentId = params.get("studentId") || ""
  const otherPartyName = params.get("name") || "Unknown"
  const callType: CallType = params.get("callType") === "audio" ? "audio" : "video"

  const api: CallApi = useMemo(() => (
    viewerIsCounselor
      ? {
          poll: (after) => pollStudentCall(studentId, after),
          start: (type, offerSdp) => startStudentCall(studentId, { call_type: type, offer_sdp: offerSdp }),
          answer: (callId, answerSdp) => answerStudentCall(studentId, callId, answerSdp),
          end: (callId) => endStudentCall(studentId, callId),
          sendIce: (callId, candidate) => sendStudentCallIce(studentId, callId, candidate),
        }
      : {
          poll: (after) => pollMyCall(after),
          start: (type, offerSdp) => startMyCall({ call_type: type, offer_sdp: offerSdp }),
          answer: (callId, answerSdp) => answerMyCall(callId, answerSdp),
          end: (callId) => endMyCall(callId),
          sendIce: (callId, candidate) => sendMyCallIce(callId, candidate),
        }
  ), [viewerIsCounselor, studentId])

  const session = useCallSession({ viewerIsCounselor, api })
  const startedRef = useRef(false)
  const everConnectedRef = useRef(false)

  // Place the call (outgoing) or auto-answer the already-ringing one
  // (answer) - either way, no second click needed once this window opens.
  useEffect(() => {
    if (startedRef.current) return
    if (mode === "outgoing") {
      startedRef.current = true
      session.startCall(callType)
    } else if (mode === "answer" && session.phase === "incoming") {
      startedRef.current = true
      session.acceptCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, session.phase])

  useEffect(() => {
    if (session.phase !== "idle") everConnectedRef.current = true
  }, [session.phase])

  // Close this window the instant the call resolves - declined, hung up,
  // or ended by the other side. A short grace delay avoids closing before
  // the user even sees why (e.g. a permission error toast).
  useEffect(() => {
    if (session.phase === "idle" && everConnectedRef.current) {
      const timeout = setTimeout(() => window.close(), 1200)
      return () => clearTimeout(timeout)
    }
  }, [session.phase])

  const [closing, setClosing] = useState(false)
  const hangUpAndClose = () => {
    setClosing(true)
    session.hangUp()
  }

  if (loading) return <CallWindowShell>Loading...</CallWindowShell>
  if (!isAuthenticated) return <CallWindowShell>Please sign in, then reopen this call from the app.</CallWindowShell>

  const statusText = closing || session.phase === "idle"
    ? "Call ended"
    : session.phase === "connected"
    ? formatDuration(session.duration)
    : mode === "outgoing"
    ? "Calling..."
    : "Connecting..."

  return (
    <div className="h-screen w-screen bg-gradient-to-b from-neutral-900 via-neutral-950 to-black text-white flex flex-col overflow-hidden">
      <div className="flex-1 relative flex items-center justify-center">
        {session.phase === "connected" && callType === "video" ? (
          <>
            <video ref={session.remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
            <video
              ref={session.localVideoRef}
              autoPlay playsInline muted
              className="absolute bottom-6 right-6 w-32 h-44 sm:w-40 sm:h-56 object-cover rounded-2xl border-2 border-white/20 shadow-2xl"
            />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-black/50 backdrop-blur px-4 py-1.5 text-sm font-medium tabular-nums">
              {statusText}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-5 text-center px-6">
            <div className={`rounded-full p-1.5 ${session.phase === "connected" ? "ring-4 ring-emerald-500/40" : "ring-4 ring-white/10 animate-pulse"}`}>
              <PersonAvatar name={otherPartyName} size="xl" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{otherPartyName}</p>
              <p className="text-white/60 mt-1 tabular-nums">{statusText}</p>
            </div>
            {session.phase === "connected" && callType === "audio" && (
              <audio ref={session.remoteAudioRef} autoPlay />
            )}
          </div>
        )}
      </div>

      <div className="pb-10 pt-4 flex items-center justify-center gap-4">
        {session.phase !== "idle" && (
          <>
            <Button
              size="icon"
              variant={session.muted ? "secondary" : "outline"}
              className="h-14 w-14 rounded-full border-white/20 bg-white/10 hover:bg-white/20 text-white"
              onClick={session.toggleMute}
            >
              {session.muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            {callType === "video" && (
              <Button
                size="icon"
                variant={session.cameraOff ? "secondary" : "outline"}
                className="h-14 w-14 rounded-full border-white/20 bg-white/10 hover:bg-white/20 text-white"
                onClick={session.toggleCamera}
              >
                {session.cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </Button>
            )}
          </>
        )}
        <Button
          size="icon"
          variant="destructive"
          className="h-16 w-16 rounded-full shadow-lg"
          disabled={closing || session.phase === "idle"}
          onClick={hangUpAndClose}
        >
          {session.phase === "idle" ? <Phone className="w-6 h-6" /> : <PhoneOff className="w-6 h-6" />}
        </Button>
      </div>
    </div>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function CallWindowShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen bg-neutral-950 text-white flex items-center justify-center text-center px-6">
      {children}
    </div>
  )
}
