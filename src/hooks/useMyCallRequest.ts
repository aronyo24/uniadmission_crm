import { useEffect, useState } from "react"

import { fetchMyCallRequests } from "@/lib/crm-api"
import type { CallRequest } from "@/lib/crm-types"

const POLL_MS = 20000
const OPEN_STATUSES = ["pending", "proposed", "accepted"]

/** Polls the student's own open call request (if any) - shared by the
 * "Request a Call" trigger button (hidden while one is already open) and
 * the status card shown inline in the chat thread. */
export function useMyCallRequest() {
  const [request, setRequest] = useState<CallRequest | null | undefined>(undefined)

  const load = async () => {
    try {
      const all = await fetchMyCallRequests()
      setRequest(all.find((r) => OPEN_STATUSES.includes(r.status)) ?? null)
    } catch {
      // Transient poll failures aren't worth surfacing every 20s.
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount, same pattern as Messages.tsx's loadAll
    void load()
    const interval = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(interval)
  }, [])

  return { request, setRequest }
}
