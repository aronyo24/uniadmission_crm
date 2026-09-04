import { useEffect, useRef, useState, type ReactNode } from "react"
import { Check, CheckCheck, File as FileIcon, Paperclip, Phone, PhoneMissed, Send, Video, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import type { CrmMessage } from "@/lib/crm-types"

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageAttachment(type: string): boolean {
  return type.startsWith("image/")
}

function dayLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString([], { month: "long", day: "numeric", year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined })
}

function AttachmentBubble({ message }: { message: CrmMessage }) {
  if (!message.attachment_url) return null
  if (isImageAttachment(message.attachment_type)) {
    return (
      <a href={message.attachment_url} target="_blank" rel="noopener noreferrer" className="block mt-1.5 -mx-1">
        <img
          src={message.attachment_url}
          alt={message.attachment_name}
          className="max-h-56 rounded-lg object-cover border border-black/5"
        />
      </a>
    )
  }
  return (
    <a
      href={message.attachment_url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex items-center gap-2 rounded-lg bg-black/5 dark:bg-white/10 px-2.5 py-2 hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
    >
      <FileIcon className="w-4 h-4 flex-shrink-0 opacity-70" />
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{message.attachment_name}</p>
        {message.attachment_size != null && (
          <p className="text-[10px] opacity-60">{formatFileSize(message.attachment_size)}</p>
        )}
      </div>
    </a>
  )
}

function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/** A call-history entry - a system-style row (not a regular bubble), the
 * same way a real calling app logs "call ended" straight into the thread. */
function CallLogEntry({ message }: { message: CrmMessage }) {
  const completed = message.call_log_outcome === "completed"
  const Icon = message.call_log_type === "video" ? Video : completed ? Phone : PhoneMissed
  const label = completed
    ? `${message.call_log_type === "video" ? "Video" : "Audio"} call · ${formatCallDuration(message.call_log_duration ?? 0)}`
    : `${message.call_log_outcome === "declined" ? "Declined" : "Missed"} ${message.call_log_type === "video" ? "video" : "audio"} call`

  return (
    <div className="flex items-center justify-center py-1">
      <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
        completed ? "text-muted-foreground bg-muted/40" : "text-destructive bg-destructive/10 border-destructive/20"
      }`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="font-medium">{label}</span>
        <span className="opacity-60">
          {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  )
}

/**
 * Shared chat-thread UI for the counselor <-> student direct messaging
 * feature. Used from both sides of the conversation - the CRM student
 * profile (viewerIsCounselor=true) and the student portal
 * (viewerIsCounselor=false) - with each side supplying its own fetch/send
 * functions since the underlying API routes and auth scoping differ.
 */
export function MessageThread({
  messages,
  loading,
  viewerIsCounselor,
  onSend,
  placeholder = "Write a message...",
  emptyLabel = "No messages yet. Say hello!",
  trailingContent,
}: {
  messages: CrmMessage[] | null
  loading: boolean
  viewerIsCounselor: boolean
  onSend: (body: string, attachment?: File) => Promise<void>
  placeholder?: string
  emptyLabel?: string
  /** Rendered as the last item in the scrollable thread, after all
   * messages - e.g. the live call-request status card, so it shows up
   * right in the conversation instead of a separate panel. */
  trailingContent?: ReactNode
}) {
  const [draft, setDraft] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages?.length, trailingContent])

  const handleSend = async () => {
    const body = draft.trim()
    if ((!body && !attachment) || sending) return
    setSending(true)
    try {
      await onSend(body, attachment ?? undefined)
      setDraft("")
      setAttachment(null)
    } finally {
      setSending(false)
    }
  }

  const handleFilePick = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("File is too large — the limit is 10MB.")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    setAttachment(file)
  }

  let lastDay = ""

  return (
    <div className="flex flex-col rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="flex-1 max-h-96 min-h-[16rem] overflow-y-auto p-4 space-y-1">
        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted/60 animate-pulse" />)}
          </div>
        )}

        {!loading && messages?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">{emptyLabel}</p>
        )}

        {!loading && messages?.map((m) => {
          const mine = m.is_from_counselor === viewerIsCounselor
          const day = dayLabel(m.created_at)
          const showDaySeparator = day !== lastDay
          lastDay = day
          return (
            <div key={m.id}>
              {showDaySeparator && (
                <div className="flex items-center justify-center my-3">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1">
                    {day}
                  </span>
                </div>
              )}
              {m.call_log_type ? (
                <CallLogEntry message={m} />
              ) : (
                <div className={`flex items-end gap-2 py-1 ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine && <PersonAvatar name={m.sender_name} size="sm" className="mb-0.5" />}
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"
                  }`}>
                    {!mine && <p className="text-xs font-semibold mb-0.5 opacity-70">{m.sender_name}</p>}
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    <AttachmentBubble message={m} />
                    <div className={`mt-1 flex items-center gap-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {mine && (m.is_read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {trailingContent}
        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-muted/20">
        {attachment && (
          <div className="flex items-center gap-2 px-3 pt-2.5">
            <div className="flex items-center gap-2 rounded-lg bg-background border px-2.5 py-1.5 text-xs">
              <FileIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="max-w-40 truncate font-medium">{attachment.name}</span>
              <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span>
              <button
                type="button"
                onClick={() => {
                  setAttachment(null)
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        <div className="p-3 flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFilePick(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="flex-shrink-0 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder={placeholder}
            rows={1}
            className="min-h-10 max-h-32 resize-none"
          />
          <Button
            size="icon"
            onClick={() => void handleSend()}
            disabled={sending || (!draft.trim() && !attachment)}
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
