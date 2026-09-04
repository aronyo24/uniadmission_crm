import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import type { CallType, CrmCall, CrmCallPollResponse } from "@/lib/crm-types"

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

const POLL_INTERVAL_MS = 2500

export interface CallApi {
  poll: (after?: number) => Promise<CrmCallPollResponse>
  start: (callType: CallType, offerSdp: string) => Promise<CrmCall>
  answer: (callId: number, answerSdp: string) => Promise<CrmCall>
  end: (callId: number) => Promise<CrmCall>
  sendIce: (callId: number, candidate: RTCIceCandidateInit) => Promise<void>
}

export type CallPhase = "idle" | "outgoing" | "incoming" | "connected"

export interface CallSession {
  phase: CallPhase
  call: CrmCall | null
  muted: boolean
  cameraOff: boolean
  duration: number
  connecting: boolean
  localVideoRef: React.RefObject<HTMLVideoElement | null>
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>
  startCall: (callType: CallType) => void
  acceptCall: () => void
  declineCall: () => void
  hangUp: () => void
  toggleMute: () => void
  toggleCamera: () => void
  /** Reset local state back to idle without touching the call on the
   * server - e.g. after handing an incoming call off to the dedicated
   * call-window popup (see CallOverlay), where a *different* session
   * instance now owns answering it. */
  dismiss: () => void
}

/**
 * All the state, WebRTC plumbing, and signaling-poll logic behind one side
 * of one call - no UI. Call it once per conversation (the `api` param is a
 * pre-bound set of signaling calls scoped to a specific student) and hand
 * the result to <CallOverlay/> plus whatever trigger buttons start a call.
 * Living as a hook (rather than bundled into a component, as it used to be)
 * lets a single instance be mounted globally - e.g. in DashboardLayout for
 * the student side - so incoming calls ring no matter what page you're on,
 * instead of only while you happen to have the messages page open.
 */
export function useCallSession({
  viewerIsCounselor,
  api,
  enabled = true,
}: {
  viewerIsCounselor: boolean
  api: CallApi
  /** Skip the signaling poll entirely - e.g. while we don't yet know if this
   * viewer even has a CRM record to poll for. Defaults to on. */
  enabled?: boolean
}): CallSession {
  const [phase, setPhase] = useState<CallPhase>("idle")
  const [call, setCall] = useState<CrmCall | null>(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [duration, setDuration] = useState(0)
  const [connecting, setConnecting] = useState(false)

  const phaseRef = useRef<CallPhase>("idle")
  phaseRef.current = phase
  const callRef = useRef<CrmCall | null>(null)
  callRef.current = call
  // A call id handed off to the call-window popup via dismiss() - the poll
  // loop won't re-open the incoming banner for it while it's still the same
  // ringing call, so accepting doesn't cause a one-beat re-ring in this tab
  // while the popup is off getting camera/mic permission and answering.
  const dismissedCallIdRef = useRef<number | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const lastCandidateIdRef = useRef<number | undefined>(undefined)
  const ringtoneRef = useRef<{ ctx: AudioContext; interval: ReturnType<typeof setInterval> } | null>(null)

  const stopRingtone = useCallback(() => {
    const ringing = ringtoneRef.current
    if (!ringing) return
    clearInterval(ringing.interval)
    void ringing.ctx.close().catch(() => {})
    ringtoneRef.current = null
  }, [])

  // Classic dual-tone phone ring (440Hz + 480Hz), synthesized so no audio
  // asset is needed - repeats a short burst every 3s while a call rings in.
  const startRingtone = useCallback(() => {
    if (ringtoneRef.current) return
    const ctx = new AudioContext()
    void ctx.resume().catch(() => {})

    const playBurst = () => {
      const now = ctx.currentTime
      ;[440, 480].forEach((freq) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05)
        gain.gain.setValueAtTime(0.15, now + 0.9)
        gain.gain.linearRampToValueAtTime(0, now + 1)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 1)
      })
    }

    playBurst()
    const interval = setInterval(playBurst, 3000)
    ringtoneRef.current = { ctx, interval }
  }, [])

  const teardown = useCallback(() => {
    stopRingtone()
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    lastCandidateIdRef.current = undefined
    setPhase("idle")
    setCall(null)
    setMuted(false)
    setCameraOff(false)
    setDuration(0)
    setConnecting(false)
  }, [stopRingtone])

  // Call-duration ticker while connected.
  useEffect(() => {
    if (phase !== "connected") return
    const start = Date.now()
    const interval = setInterval(() => setDuration(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [phase])

  const attachRemoteTrack = useCallback((pc: RTCPeerConnection) => {
    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream
    }
  }, [])

  const startCall = useCallback((callType: CallType) => {
    if (phaseRef.current !== "idle") return
    void (async () => {
      setPhase("outgoing")
      setConnecting(true)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" })
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        pcRef.current = pc
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))
        attachRemoteTrack(pc)

        let callId: number | null = null
        const pending: RTCIceCandidateInit[] = []
        pc.onicecandidate = (event) => {
          if (!event.candidate) return
          const c = event.candidate.toJSON()
          if (callId) void api.sendIce(callId, c)
          else pending.push(c)
        }

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        const created = await api.start(callType, offer.sdp || "")
        callId = created.id
        pending.forEach((c) => void api.sendIce(created.id, c))
        setCall(created)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't start the call — check microphone/camera permissions.")
        teardown()
      } finally {
        setConnecting(false)
      }
    })()
  }, [api, attachRemoteTrack, teardown])

  // Ring while a call is coming in; stop the instant it stops being "incoming"
  // (answered, declined, or the caller hung up before we picked up).
  useEffect(() => {
    if (phase === "incoming") startRingtone()
    else stopRingtone()
    return () => stopRingtone()
  }, [phase, startRingtone, stopRingtone])

  const acceptCall = useCallback(() => {
    if (!call) return
    void (async () => {
      setConnecting(true)
      stopRingtone()
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.call_type === "video" })
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        pcRef.current = pc
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))
        attachRemoteTrack(pc)
        pc.onicecandidate = (event) => {
          if (event.candidate) void api.sendIce(call.id, event.candidate.toJSON())
        }

        await pc.setRemoteDescription({ type: "offer", sdp: call.offer_sdp })
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        const updated = await api.answer(call.id, answer.sdp || "")
        setCall(updated)
        setPhase("connected")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't join the call — check microphone/camera permissions.")
        void api.end(call.id).catch(() => {})
        teardown()
      } finally {
        setConnecting(false)
      }
    })()
  }, [call, api, attachRemoteTrack, stopRingtone, teardown])

  const hangUp = useCallback(() => {
    const current = call
    teardown()
    if (current) void api.end(current.id).catch(() => {})
  }, [call, api, teardown])

  const declineCall = useCallback(() => {
    const current = call
    teardown()
    if (current) void api.end(current.id).catch(() => {})
  }, [call, api, teardown])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    setMuted((prev) => {
      const next = !prev
      stream.getAudioTracks().forEach((t) => (t.enabled = !next))
      return next
    })
  }, [])

  const dismiss = useCallback(() => {
    dismissedCallIdRef.current = callRef.current?.id ?? null
    teardown()
  }, [teardown])

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    setCameraOff((prev) => {
      const next = !prev
      stream.getVideoTracks().forEach((t) => (t.enabled = !next))
      return next
    })
  }, [])

  // Poll loop - drives every state transition once a call exists on the
  // server: discovering an incoming call, seeing my outgoing call get
  // accepted (and applying the answer SDP), picking up remote ICE
  // candidates, and noticing the other side hung up.
  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(async () => {
      try {
        const { call: serverCall, candidates } = await api.poll(lastCandidateIdRef.current)

        for (const c of candidates) {
          lastCandidateIdRef.current = c.id
          if (pcRef.current?.remoteDescription) {
            try {
              await pcRef.current.addIceCandidate(c.candidate)
            } catch {
              // Late/duplicate candidates are harmless to drop.
            }
          }
        }

        if (!serverCall) {
          dismissedCallIdRef.current = null
          if (phaseRef.current !== "idle") teardown()
          return
        }
        if (serverCall.status !== "ringing" && dismissedCallIdRef.current === serverCall.id) {
          dismissedCallIdRef.current = null
        }

        const iAmCaller = serverCall.is_from_counselor === viewerIsCounselor
        const handedOff = dismissedCallIdRef.current === serverCall.id

        if (serverCall.status === "ringing" && !iAmCaller && !handedOff && phaseRef.current === "idle") {
          setCall(serverCall)
          setPhase("incoming")
        } else if (serverCall.status === "accepted" && iAmCaller && phaseRef.current === "outgoing") {
          if (pcRef.current && !pcRef.current.currentRemoteDescription && serverCall.answer_sdp) {
            await pcRef.current.setRemoteDescription({ type: "answer", sdp: serverCall.answer_sdp })
          }
          setCall(serverCall)
          setPhase("connected")
        } else if ((serverCall.status === "rejected" || serverCall.status === "ended") && phaseRef.current !== "idle") {
          teardown()
        }
      } catch {
        // Transient poll failures aren't worth surfacing every 2.5s.
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [api, viewerIsCounselor, teardown, enabled])

  // Best-effort hangup if this component unmounts mid-call (e.g. navigating away).
  useEffect(() => {
    return () => {
      pcRef.current?.close()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return {
    phase, call, muted, cameraOff, duration, connecting,
    localVideoRef, remoteVideoRef, remoteAudioRef,
    startCall, acceptCall, declineCall, hangUp, toggleMute, toggleCamera, dismiss,
  }
}
