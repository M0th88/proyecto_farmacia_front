export function formatRut(value: string) {
  const raw = value
    .replace(/[^\dkK]/g, "")
    .toUpperCase()
    .slice(0, 9);
  if (raw.length < 2) return raw;
  const body = raw.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${raw.at(-1)}`;
}

export function mobilePhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  const local =
    value.trim().startsWith("+569") ||
    (digits.startsWith("569") && digits.length >= 11)
      ? digits.slice(3)
      : digits.startsWith("9") && digits.length === 9
        ? digits.slice(1)
        : digits;
  return local.slice(0, 8);
}
