/**
 * Safe Redirect Utility
 * 
 * Validates URLs to prevent open redirect attacks and XSS via malicious URLs.
 * Only allows internal relative paths that start with "/" and blocks:
 * - Protocol-relative URLs (//example.com)
 * - Absolute URLs with protocols (http:, https:, javascript:, data:, vbscript:, etc.)
 * - URLs with embedded credentials or unusual characters
 */

// Dangerous protocols that could lead to XSS or phishing
const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'blob:',
  'about:',
];

// External protocols that indicate an external redirect
const EXTERNAL_PROTOCOLS = [
  'http:',
  'https:',
  'ftp:',
  'mailto:',
  'tel:',
];

/**
 * Validates that a URL path is a safe internal path.
 * 
 * Rules:
 * 1. Must start with "/" (relative path)
 * 2. Must NOT start with "//" (protocol-relative URL)
 * 3. Must NOT contain dangerous protocols
 * 4. Must NOT be an external URL
 * 
 * @param path - The path to validate
 * @returns true if the path is safe for internal navigation
 */
export function isInternalPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Trim whitespace
  const trimmedPath = path.trim();

  // Must start with a single forward slash
  if (!trimmedPath.startsWith('/')) {
    return false;
  }

  // Must NOT start with // (protocol-relative URL that could redirect externally)
  if (trimmedPath.startsWith('//')) {
    return false;
  }

  // Convert to lowercase for protocol checking
  const lowerPath = trimmedPath.toLowerCase();

  // Check for dangerous protocols embedded in the path
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (lowerPath.includes(protocol)) {
      return false;
    }
  }

  // Check for external protocols
  for (const protocol of EXTERNAL_PROTOCOLS) {
    if (lowerPath.includes(protocol)) {
      return false;
    }
  }

  // Check for encoded characters that might bypass checks
  // Decode and re-check (handles %2F%2F for //)
  try {
    const decoded = decodeURIComponent(trimmedPath);
    if (decoded.startsWith('//') || decoded !== trimmedPath) {
      // If decoded version differs significantly, be cautious
      const decodedLower = decoded.toLowerCase();
      for (const protocol of [...DANGEROUS_PROTOCOLS, ...EXTERNAL_PROTOCOLS]) {
        if (decodedLower.includes(protocol)) {
          return false;
        }
      }
      // Re-check for protocol-relative after decoding
      if (decoded.startsWith('//')) {
        return false;
      }
    }
  } catch {
    // If decoding fails, the URL might be malformed - reject it
    return false;
  }

  // Check for backslash (some browsers treat \ as /)
  if (trimmedPath.includes('\\')) {
    return false;
  }

  return true;
}

/**
 * Sanitizes a path for safe internal navigation.
 * Returns the path if valid, or a fallback path if invalid.
 * 
 * @param path - The path to sanitize
 * @param fallback - The fallback path if validation fails (default: "/")
 * @returns A safe path for navigation
 */
export function getSafeRedirectPath(path: string, fallback: string = '/'): string {
  if (isInternalPath(path)) {
    return path.trim();
  }
  return fallback;
}

/**
 * Safely constructs an absolute URL for the current origin.
 * Only allows paths that pass internal validation.
 * 
 * @param path - The path to append to the origin
 * @param fallback - The fallback path if validation fails
 * @returns A safe absolute URL
 */
export function getSafeOriginUrl(path: string, fallback: string = '/'): string {
  const safePath = getSafeRedirectPath(path, fallback);
  return `${window.location.origin}${safePath}`;
}

/**
 * Validates and returns a path from URL search params.
 * Useful for processing ?returnTo=, ?next=, ?redirect= parameters.
 * 
 * @param searchParams - URLSearchParams or a single string value
 * @param paramName - The parameter name to extract (e.g., "returnTo", "next")
 * @param fallback - The fallback path if validation fails
 * @returns A safe path for navigation
 */
export function getSafeRedirectFromParams(
  searchParams: URLSearchParams | string | null,
  paramName: string = 'returnTo',
  fallback: string = '/'
): string {
  let value: string | null = null;
  
  if (typeof searchParams === 'string') {
    value = searchParams;
  } else if (searchParams instanceof URLSearchParams) {
    value = searchParams.get(paramName);
  }
  
  if (!value) {
    return fallback;
  }
  
  return getSafeRedirectPath(value, fallback);
}
