/**
 * Escape a string for safe interpolation into an HTML context (e.g. email
 * bodies). Prevents HTML/script injection from user-supplied values.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Return the value only if it is a safe http(s) URL, otherwise an empty string.
 * Blocks javascript:, data:, and other dangerous schemes from link hrefs.
 */
export function safeHttpUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") return raw;
  } catch {
    // not a valid absolute URL
  }
  return "";
}
