export function phoneKey(phone?: string | null) {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0030') && digits.length > 10) return digits.slice(4);
  if (digits.startsWith('30') && digits.length > 10) return digits.slice(2);
  return digits;
}

export function normalizePhone(phone?: string | null) {
  const key = phoneKey(phone);
  return key || null;
}
