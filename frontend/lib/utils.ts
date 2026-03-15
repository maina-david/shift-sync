import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as dateFnsFormat } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safe wrapper around date-fns format(). Returns fallback (default '—') if the
 * date string is missing, empty, or produces an Invalid Date rather than throwing.
 */
export function safeFormat(
  dateInput: string | Date | null | undefined,
  fmt: string,
  fallback = "—",
): string {
  if (!dateInput) return fallback;
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return fallback;
    return dateFnsFormat(d, fmt);
  } catch {
    return fallback;
  }
}

/**
 * Parse a "HH:MM" time string into total minutes. Returns null if malformed.
 */
export function parseTimeMinutes(
  time: string | null | undefined,
): number | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}
