import type { CallType } from "@/lib/crm-types"

const WIDTH = 420
const HEIGHT = 720

/**
 * Opens the dedicated call popup (see src/pages/CallWindow.tsx) - a
 * separate, chrome-less browser window/tab just for one call, closing
 * itself when the call ends. Must be called from a direct user gesture
 * (a click handler) or the browser's popup blocker will silently eat it.
 */
export function openCallWindow(params: {
  mode: "outgoing" | "answer"
  role: "counselor" | "student"
  studentId?: number | string
  name: string
  callType: CallType
}) {
  const qs = new URLSearchParams({
    mode: params.mode,
    role: params.role,
    name: params.name,
    callType: params.callType,
  })
  if (params.studentId != null) qs.set("studentId", String(params.studentId))

  const left = Math.max(0, Math.round((window.screen.width - WIDTH) / 2))
  const top = Math.max(0, Math.round((window.screen.height - HEIGHT) / 2))
  // No `noopener`/`noreferrer` here: this is a same-origin, same-app route,
  // and `window.open` is spec'd to always return null when either is set -
  // which broke the popup-blocked fallback below (it fired unconditionally,
  // navigating this tab away to the call window even when the popup opened
  // fine). Dropping them lets `win` reflect the real outcome.
  const features = `width=${WIDTH},height=${HEIGHT},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no,resizable=yes`

  const win = window.open(`/call-window?${qs.toString()}`, "_blank", features)
  if (!win) {
    // Popup blocked - fall back to a same-tab navigation so the call still
    // goes through rather than silently doing nothing.
    window.location.href = `/call-window?${qs.toString()}`
  }
}
