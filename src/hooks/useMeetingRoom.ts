import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  endMeeting, fetchMeeting, leaveMeeting, sendMeetingSignal, syncMeeting,
  type Meeting, type MeetingSignal,
} from "@/lib/meetings"

// STUN alone can't connect peers behind symmetric NAT / strict firewalls
// (common on mobile data and corporate wifi). Set VITE_TURN_URL (+ _USERNAME /
// _CREDENTIAL) to a TURN relay to make those meetings connect too.
const TURN_URL = import.meta.env.VITE_TURN_URL as string | undefined
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  ...(TURN_URL
    ? [{
        urls: TURN_URL.split(",").map((u) => u.trim()),
        username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
        credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
      }]
    : []),
]

const FAST_POLL_MS = 1000   // while negotiating a connection
const SLOW_POLL_MS = 3000   // presence-only once connected

export type RoomStage = "loading" | "error" | "lobby" | "joined" | "left" | "ended"
export type Connection = "waiting" | "connecting" | "connected" | "reconnecting"

export interface PeerState {
  mic: boolean
  cam: boolean
  sharing: boolean
}

export interface ChatMessage {
  id: number
  mine: boolean
  text: string
  at: number
}

const newClientId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`)
    .replace(/-/g, "")
    .slice(0, 24)

export function useMeetingRoom(token: string) {
  const [clientId] = useState(newClientId)

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [stage, setStage] = useState<RoomStage>("loading")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [mediaIssue, setMediaIssue] = useState<string | null>(null)
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(true)
  const [connection, setConnection] = useState<Connection>("waiting")
  const [peerPresent, setPeerPresent] = useState(false)
  const [peerState, setPeerState] = useState<PeerState>({ mic: true, cam: true, sharing: false })
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [elapsed, setElapsed] = useState(0)

  const isHost = meeting?.role === "host"
  const isHostRef = useRef(false)

  const stageRef = useRef<RoomStage>("loading")
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const sessionRef = useRef<string | null>(null)
  const attemptRef = useRef(0)
  const attemptPeerRef = useRef("")
  const lastSignalIdRef = useRef<number | undefined>(undefined)
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([])
  const remoteTracksRef = useRef<MediaStreamTrack[]>([])
  const chatIdRef = useRef(0)
  const stateRef = useRef({ mic: true, cam: true, sharing: false })

  // Mirror render values into refs for the async handlers (updated after commit, not during render).
  useEffect(() => {
    isHostRef.current = isHost
    stageRef.current = stage
    stateRef.current = { mic, cam: cam && !!localStream?.getVideoTracks().length, sharing: !!screenStream }
  })

  // ---- load meeting details ------------------------------------------------
  useEffect(() => {
    let cancelled = false
    fetchMeeting(token)
      .then((m) => {
        if (cancelled) return
        setMeeting(m)
        if (m.status === "cancelled") { setStage("ended"); setNotice("This meeting was cancelled.") }
        else if (m.status === "ended") { setStage("ended"); setNotice("This meeting has already ended.") }
        else setStage("lobby")
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "This meeting link isn't valid for your account.")
        setStage("error")
      })
    return () => { cancelled = true }
  }, [token])

  // ---- local media ---------------------------------------------------------
  const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop())

  /** Get mic (+ camera when wanted), degrading gracefully: no camera -> audio
   * only; no mic either -> join listen-only rather than blocking entry. */
  const initMedia = useCallback(async (wantVideo: boolean) => {
    if (localStreamRef.current) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaIssue("Your browser can't access a camera or microphone (HTTPS is required).")
      setCam(false)
      setMic(false)
      return
    }
    const attempts: MediaStreamConstraints[] = wantVideo
      ? [{ audio: true, video: true }, { audio: true }]
      : [{ audio: true }]
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        localStreamRef.current = stream
        setLocalStream(stream)
        setMic(true)
        setCam(stream.getVideoTracks().length > 0)
        setMediaIssue(
          wantVideo && !stream.getVideoTracks().length
            ? "Camera unavailable — joining with audio only."
            : null,
        )
        return
      } catch (err) {
        const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError")
        if (denied) {
          setMediaIssue("Camera/microphone access is blocked. Allow it in your browser's address bar, then reload.")
          setMic(false)
          setCam(false)
          return
        }
      }
    }
    setMediaIssue("No microphone or camera found — you can still listen and use chat.")
    setMic(false)
    setCam(false)
  }, [])

  const outgoingVideoTrack = () =>
    screenStreamRef.current?.getVideoTracks()[0] ?? localStreamRef.current?.getVideoTracks()[0] ?? null

  /** Push whatever tracks we currently have into the peer connection. */
  const applyLocalTracks = useCallback(() => {
    const pc = pcRef.current
    if (!pc) return
    const audio = localStreamRef.current?.getAudioTracks()[0] ?? null
    const video = outgoingVideoTrack()
    for (const t of pc.getTransceivers()) {
      const kind = t.receiver.track.kind
      const track = kind === "audio" ? audio : video
      if (t.sender.track !== track) void t.sender.replaceTrack(track).catch(() => {})
    }
  }, [])

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setMic(track.enabled)
  }, [])

  const toggleCam = useCallback(async () => {
    const existing = localStreamRef.current?.getVideoTracks()[0]
    if (existing) {
      existing.enabled = !existing.enabled
      setCam(existing.enabled)
      return
    }
    // No camera track yet (denied/unavailable earlier, or audio-only meeting) - try to get one now.
    try {
      const cameraOnly = await navigator.mediaDevices.getUserMedia({ video: true })
      const track = cameraOnly.getVideoTracks()[0]
      const base = localStreamRef.current ?? new MediaStream()
      base.addTrack(track)
      localStreamRef.current = base
      setLocalStream(new MediaStream(base.getTracks()))
      setCam(true)
      setMediaIssue(null)
      applyLocalTracks()
    } catch {
      toast.error("Couldn't turn the camera on — check your browser's camera permission.")
    }
  }, [applyLocalTracks])

  const canShareScreen = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia

  const stopScreenShare = useCallback(() => {
    stopStream(screenStreamRef.current)
    screenStreamRef.current = null
    setScreenStream(null)
    applyLocalTracks()
  }, [applyLocalTracks])

  const toggleScreenShare = useCallback(async () => {
    if (screenStreamRef.current) return stopScreenShare()
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      screenStreamRef.current = stream
      setScreenStream(stream)
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (screenStreamRef.current === stream) stopScreenShare()
      })
      applyLocalTracks()
    } catch {
      // User dismissed the picker - nothing to do.
    }
  }, [applyLocalTracks, stopScreenShare])

  // ---- data channel: chat + mic/cam/share state -----------------------------
  const sendDc = useCallback((payload: object) => {
    const dc = dcRef.current
    if (dc?.readyState === "open") dc.send(JSON.stringify(payload))
  }, [])

  const bindDataChannel = useCallback((dc: RTCDataChannel) => {
    dcRef.current = dc
    dc.onopen = () => dc.send(JSON.stringify({ t: "state", ...stateRef.current }))
    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.t === "chat" && typeof msg.text === "string") {
          setChat((prev) => [...prev, { id: ++chatIdRef.current, mine: false, text: msg.text.slice(0, 2000), at: Date.now() }])
        } else if (msg.t === "state") {
          setPeerState({ mic: !!msg.mic, cam: !!msg.cam, sharing: !!msg.sharing })
        }
      } catch {
        // Ignore malformed peer messages.
      }
    }
  }, [])

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    sendDc({ t: "chat", text: trimmed })
    setChat((prev) => [...prev, { id: ++chatIdRef.current, mine: true, text: trimmed, at: Date.now() }])
  }, [sendDc])

  // Tell the peer whenever our mic/cam/share state changes.
  useEffect(() => {
    sendDc({ t: "state", ...stateRef.current })
  }, [mic, cam, screenStream, localStream, sendDc])

  // ---- peer connection -----------------------------------------------------
  const closePc = useCallback(() => {
    const pc = pcRef.current
    if (pc) {
      pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = pc.ondatachannel = null
      pc.close()
    }
    pcRef.current = null
    dcRef.current = null
    sessionRef.current = null
    pendingIceRef.current = []
    remoteTracksRef.current = []
    setRemoteStream(null)
    setPeerState({ mic: true, cam: true, sharing: false })
  }, [])

  const signal = useCallback((kind: MeetingSignal["kind"], session: string, payload: unknown) => {
    void sendMeetingSignal(token, { kind, session, payload }).catch(() => {})
  }, [token])

  const createPc = useCallback((session: string, asHost: boolean) => {
    closePc()
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcRef.current = pc
    sessionRef.current = session

    pc.onicecandidate = (event) => {
      if (event.candidate && pcRef.current === pc) signal("ice", session, event.candidate.toJSON())
    }
    pc.ontrack = (event) => {
      remoteTracksRef.current = [...remoteTracksRef.current.filter((t) => t.id !== event.track.id), event.track]
      setRemoteStream(new MediaStream(remoteTracksRef.current))
    }
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return
      const state = pc.connectionState
      if (state === "connected") setConnection("connected")
      else if (state === "connecting" || state === "new") setConnection((c) => (c === "connected" ? c : "connecting"))
      else if (state === "disconnected") setConnection("reconnecting")
      else if (state === "failed") {
        setConnection("reconnecting")
        // Host renegotiates with a fresh session id; the guest adopts it from the new offer.
        if (isHostRef.current) {
          attemptRef.current += 1
          closePc()
        }
      }
    }

    if (asHost) {
      // Fixed audio+video m-lines up front so tracks can be swapped in later
      // (camera turned on mid-meeting, screen share) without renegotiating.
      pc.addTransceiver("audio", { direction: "sendrecv" })
      pc.addTransceiver("video", { direction: "sendrecv" })
      bindDataChannel(pc.createDataChannel("meet"))
    } else {
      pc.ondatachannel = (event) => bindDataChannel(event.channel)
    }
    return pc
  }, [bindDataChannel, closePc, signal])

  const flushIce = useCallback(async () => {
    const pc = pcRef.current
    if (!pc?.remoteDescription) return
    for (const c of pendingIceRef.current.splice(0)) {
      try { await pc.addIceCandidate(c) } catch { /* stale candidate */ }
    }
  }, [])

  const hostStartOffer = useCallback(async (peerClient: string) => {
    if (attemptPeerRef.current !== peerClient) {
      attemptPeerRef.current = peerClient
      attemptRef.current = 0
    }
    const session = `${clientId}:${peerClient}:${attemptRef.current}`
    const pc = createPc(session, true)
    setConnection("connecting")
    applyLocalTracks()
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    signal("offer", session, { type: "offer", sdp: offer.sdp })
  }, [applyLocalTracks, clientId, createPc, signal])

  const guestAnswer = useCallback(async (session: string, sdp: string) => {
    const pc = createPc(session, false)
    setConnection("connecting")
    await pc.setRemoteDescription({ type: "offer", sdp })
    // Adopt the host's audio/video m-lines as send+receive and attach our tracks.
    for (const t of pc.getTransceivers()) t.direction = "sendrecv"
    applyLocalTracks()
    await flushIce()
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    signal("answer", session, { type: "answer", sdp: answer.sdp })
  }, [applyLocalTracks, createPc, flushIce, signal])

  const handleSignals = useCallback(async (signals: MeetingSignal[], peerClient: string) => {
    for (const s of signals) {
      lastSignalIdRef.current = s.id
      if (isHostRef.current) {
        if (s.session !== sessionRef.current) continue
        const pc = pcRef.current
        if (!pc) continue
        if (s.kind === "answer" && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(s.payload)
          await flushIce()
        } else if (s.kind === "ice") {
          if (pc.remoteDescription) { try { await pc.addIceCandidate(s.payload) } catch { /* stale */ } }
          else pendingIceRef.current.push(s.payload)
        }
      } else {
        if (!s.session.startsWith(`${peerClient}:${clientId}:`)) continue
        if (s.kind === "offer" && s.session !== sessionRef.current && s.payload.sdp) {
          await guestAnswer(s.session, s.payload.sdp)
        } else if (s.kind === "ice" && s.session === sessionRef.current) {
          if (pcRef.current?.remoteDescription) { try { await pcRef.current.addIceCandidate(s.payload) } catch { /* stale */ } }
          else pendingIceRef.current.push(s.payload)
        }
      }
    }
  }, [clientId, flushIce, guestAnswer])

  // ---- presence / signaling loop ------------------------------------------
  const teardownMedia = useCallback(() => {
    closePc()
    stopStream(localStreamRef.current)
    stopStream(screenStreamRef.current)
    localStreamRef.current = null
    screenStreamRef.current = null
    setLocalStream(null)
    setScreenStream(null)
  }, [closePc])

  const finish = useCallback((reason: string) => {
    teardownMedia()
    setNotice(reason)
    setConnection("waiting")
    setPeerPresent(false)
    setStage("ended")
  }, [teardownMedia])

  const tick = useCallback(async (): Promise<number> => {
    const res = await syncMeeting(token, clientId, lastSignalIdRef.current)

    if (res.status === "ended" || res.status === "cancelled" || res.blocked === "ended" || res.blocked === "cancelled") {
      finish(res.status === "cancelled" ? "This meeting was cancelled." : "The host ended the meeting.")
      return SLOW_POLL_MS
    }
    if (res.blocked) {
      finish(res.blocked === "too_early" ? "This meeting hasn't opened yet." : "This meeting link has expired.")
      return SLOW_POLL_MS
    }

    setPeerPresent(res.peer_present)
    if (!res.peer_present || !res.peer_client_id) {
      if (pcRef.current) closePc()
      setConnection("waiting")
      return FAST_POLL_MS
    }

    const peerClient = res.peer_client_id
    if (isHostRef.current) {
      // Wrong peer (they rejoined with a new client id) -> drop the old connection.
      if (pcRef.current && !sessionRef.current?.startsWith(`${clientId}:${peerClient}:`)) closePc()
      if (!pcRef.current) await hostStartOffer(peerClient)
    } else if (pcRef.current && !sessionRef.current?.startsWith(`${peerClient}:${clientId}:`)) {
      closePc() // host rejoined; wait for its fresh offer
      setConnection("connecting")
    }
    await handleSignals(res.signals, peerClient)

    return pcRef.current?.connectionState === "connected" ? SLOW_POLL_MS : FAST_POLL_MS
  }, [clientId, closePc, finish, handleSignals, hostStartOffer, token])

  useEffect(() => {
    if (stage !== "joined") return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let failures = 0
    const loop = async () => {
      let next = FAST_POLL_MS
      try {
        next = await tick()
        failures = 0
      } catch {
        // Transient network error - keep trying; presence expires server-side if we stay away.
        if (++failures === 5) toast.error("Connection to the meeting server is unstable…")
        next = 2000
      }
      if (!stopped && stageRef.current === "joined") timer = setTimeout(loop, next)
    }
    void loop()
    return () => { stopped = true; clearTimeout(timer) }
  }, [stage, tick])

  // Meeting clock.
  useEffect(() => {
    if (stage !== "joined") { setElapsed(0); return }
    const start = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [stage])

  // ---- actions -------------------------------------------------------------
  const join = useCallback(async () => {
    setNotice(null)
    try {
      const res = await syncMeeting(token, clientId)
      if (res.blocked === "too_early") {
        setNotice(`This meeting opens ${meeting ? new Date(meeting.join_opens_at).toLocaleString() : "soon"}.`)
        return
      }
      if (res.blocked || res.status === "ended" || res.status === "cancelled") {
        finish(res.status === "cancelled" ? "This meeting was cancelled." : "This meeting has ended.")
        return
      }
      lastSignalIdRef.current = undefined
      setStage("joined")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join the meeting.")
    }
  }, [clientId, finish, meeting, token])

  const leave = useCallback(() => {
    teardownMedia()
    setConnection("waiting")
    setPeerPresent(false)
    setChat([])
    setStage("left")
    void leaveMeeting(token, clientId).catch(() => {})
  }, [clientId, teardownMedia, token])

  const endForAll = useCallback(async () => {
    try {
      await endMeeting(token)
      finish("You ended the meeting for everyone.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't end the meeting.")
    }
  }, [finish, token])

  const rejoin = useCallback(() => {
    setNotice(null)
    setStage("lobby")
  }, [])

  // Release camera/mic when the page goes away.
  useEffect(() => {
    const onHide = () => { void leaveMeeting(token, clientId).catch(() => {}) }
    window.addEventListener("pagehide", onHide)
    return () => {
      window.removeEventListener("pagehide", onHide)
      pcRef.current?.close()
      stopStream(localStreamRef.current)
      stopStream(screenStreamRef.current)
    }
  }, [clientId, token])

  // Keep the outgoing tracks in sync if a camera track appears/changes.
  useEffect(() => { applyLocalTracks() }, [applyLocalTracks, localStream, screenStream])

  return {
    meeting, stage, error, notice, isHost,
    localStream, screenStream, remoteStream, mediaIssue,
    mic, cam: cam && !!localStream?.getVideoTracks().length, sharing: !!screenStream, canShareScreen,
    connection, peerPresent, peerState, chat, elapsed,
    initMedia, toggleMic, toggleCam, toggleScreenShare,
    join, leave, endForAll, rejoin, sendChat,
  }
}
