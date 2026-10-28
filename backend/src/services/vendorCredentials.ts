/** Validate an explicitly supplied vendor password before bcrypt hashes it. */
export function getVendorPasswordError(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length < 12) {
    return 'Vendor login password must contain at least 12 characters.'
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    return 'Vendor login password must not exceed 72 UTF-8 bytes.'
  }
  return null
}