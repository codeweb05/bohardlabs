/**
 * The page's headers. Its scripts come from the package's build on this origin and may call this
 * origin only. Styles are allowed inline because the email's frame is written through `srcdoc`,
 * which inherits this policy, and an email is inline styles throughout; a style runs no code. The
 * frame is sandboxed without scripts, so nothing in a rendered email runs, and with no other
 * source allowed, a font or image a template names on another host is not fetched. `srcdoc` is
 * not a fetch, so `frame-src` (left at `default-src 'none'`) does not block the frame itself.
 */
export function pageHeaders(): Readonly<Record<string, string>> {
  return {
    'Content-Security-Policy': [
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "form-action 'none'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
    ].join('; '),
    // A cached page would outlive a deploy and ask for asset names that no longer exist.
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  };
}

/** A hashed asset's headers: its name changes with its content, so it is cached for good. */
export function assetHeaders(): Readonly<Record<string, string>> {
  return {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  };
}
