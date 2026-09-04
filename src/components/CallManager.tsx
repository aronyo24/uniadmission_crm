import { Phone, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import { openCallWindow } from "@/lib/call-window"

/**
 * "Start a call" trigger buttons for the counselor side of a conversation.
 * The actual call happens in a dedicated popup window (see
 * src/pages/CallWindow.tsx), not inline on this page - clicking either
 * button opens it and places the call there, and that window closes
 * itself once the call ends. Counselors never receive calls (students
 * can't call directly - see CallRequest), so there's no incoming-call
 * state to handle here, unlike the student side's CallSessionProvider.
 */
export function CallManager({
  otherPartyName,
  studentId,
}: {
  otherPartyName: string
  studentId: number | string
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => openCallWindow({ mode: "outgoing", role: "counselor", studentId, name: otherPartyName, callType: "audio" })}
      >
        <Phone className="w-4 h-4 mr-1.5" /> Audio Call
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => openCallWindow({ mode: "outgoing", role: "counselor", studentId, name: otherPartyName, callType: "video" })}
      >
        <Video className="w-4 h-4 mr-1.5" /> Video Call
      </Button>
    </div>
  )
}
