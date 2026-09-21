import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Only let http(s) URLs (and same-site relative paths) into an href - stored
 * values like `javascript:...` would otherwise run script when clicked. */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : undefined
  } catch {
    return undefined
  }
}
