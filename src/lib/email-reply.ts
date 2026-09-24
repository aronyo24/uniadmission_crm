// Parses the plain-text body of an inbound email reply (as stored by
// poll_inbound_emails in CommunicationLog.summary) into the student's new
// text and the quoted thread their mail client appended below it, so the CRM
// can show a reply the way an inbox does instead of one flat blob.

export interface QuoteAttribution {
  /** Raw attribution line(s) joined into one, e.g. "On Sat, ... wrote:" */
  raw: string
  sender: string | null
  senderEmail: string | null
  date: string | null
}

export interface ParsedReply {
  reply: string
  quoted: { attribution: QuoteAttribution | null; body: string } | null
}

// Gmail/Apple Mail wrap long "On <date> <who> wrote:" lines, so the
// attribution can span up to three physical lines.
const MAX_ATTRIBUTION_LINES = 3

function joinedAttribution(lines: string[], start: number): { text: string; length: number } | null {
  if (!/^on\s/i.test(lines[start].trim())) return null
  let text = ""
  for (let i = 0; i < MAX_ATTRIBUTION_LINES && start + i < lines.length; i++) {
    text = `${text} ${lines[start + i].trim()}`.trim()
    if (/wrote:\s*$/i.test(text)) return { text, length: i + 1 }
  }
  return null
}

function isOutlookHeader(lines: string[], start: number): boolean {
  if (!/^from:\s*\S/i.test(lines[start].trim())) return false
  // Only treat "From:" as a header block when the usual companions follow,
  // so a student writing "From: my school..." isn't cut off.
  return lines.slice(start + 1, start + 5).some((l) => /^(sent|date|to|subject):\s*/i.test(l.trim()))
}

function parseAttribution(raw: string): QuoteAttribution {
  const m = raw.match(/^on\s+(.+?\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?)[,\s]+(?:at\s+)?(.+?)\s*wrote:\s*$/i)
  if (!m) return { raw, sender: null, senderEmail: null, date: null }
  const who = m[2].trim()
  const emailMatch = who.match(/<([^>]+)>/)
  const name = who.replace(/<[^>]*>/, "").replace(/^["']|["']$/g, "").trim()
  return {
    raw,
    date: m[1].trim(),
    sender: name || emailMatch?.[1] || null,
    senderEmail: emailMatch?.[1] ?? (who.includes("@") ? who : null),
  }
}

/** Removes one level of "> " quoting from each line. */
function unquote(lines: string[]): string {
  return lines.map((l) => l.replace(/^>\s?/, "")).join("\n").trim()
}

export function parseEmailReply(text: string): ParsedReply {
  const lines = (text || "").replace(/\r\n?/g, "\n").split("\n")

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()

    const attr = joinedAttribution(lines, i)
    if (attr) {
      const rest = lines.slice(i + attr.length)
      const allQuoted = rest.filter((l) => l.trim()).every((l) => l.trimStart().startsWith(">"))
      return {
        reply: lines.slice(0, i).join("\n").trim(),
        quoted: {
          attribution: parseAttribution(attr.text),
          body: allQuoted ? unquote(rest) : rest.join("\n").trim(),
        },
      }
    }

    if (
      /^-{2,}\s*original message\s*-{2,}$/i.test(trimmed) ||
      /^_{10,}$/.test(trimmed) ||
      isOutlookHeader(lines, i)
    ) {
      const skip = /^from:/i.test(trimmed) ? 0 : 1
      return {
        reply: lines.slice(0, i).join("\n").trim(),
        quoted: { attribution: null, body: lines.slice(i + skip).join("\n").trim() },
      }
    }

    if (trimmed.startsWith(">")) {
      return {
        reply: lines.slice(0, i).join("\n").trim(),
        quoted: { attribution: null, body: unquote(lines.slice(i)) },
      }
    }
  }

  return { reply: lines.join("\n").trim(), quoted: null }
}

/** One-line preview of just the new text, for list rows and timelines. */
export function replyPreview(text: string): string {
  const { reply } = parseEmailReply(text)
  return reply.replace(/\s+/g, " ").trim()
}
