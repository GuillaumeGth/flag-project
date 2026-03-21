/**
 * Masks an email address for display purposes.
 * Example: "john.doe@example.com" → "j***@example.com"
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return '***';
  const masked = email[0] + '***';
  return `${masked}${email.slice(atIndex)}`;
}
