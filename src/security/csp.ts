export const FLIGHT_IFRAME_SANDBOX = "allow-scripts" as const;

export const FLIGHT_CSP_DIRECTIVES = Object.freeze({
  "default-src": ["'none'"],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:"],
  "font-src": ["'self'"],
  "connect-src": ["'none'"],
  "media-src": ["'none'"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
  "frame-ancestors": ["'self'"],
} as const);

export function serializeCsp(
  directives: Readonly<Record<string, readonly string[]>>,
): string {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export const FLIGHT_CONTENT_SECURITY_POLICY = serializeCsp(
  FLIGHT_CSP_DIRECTIVES,
);
