export const stockDate = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

// Count calendar dates in Chile rather than rounding partial 24-hour periods.
export function stockDaysRemaining(expires: Date, now: Date = new Date()) {
  return Math.round(
    (Date.parse(`${stockDate(expires)}T00:00:00Z`) -
      Date.parse(`${stockDate(now)}T00:00:00Z`)) /
      86400000,
  );
}

// Preserve the full expiry day in Chile, including daylight-saving offsets.
export function stockExpiry(date: string) {
  const offset =
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Santiago",
      timeZoneName: "longOffset",
    })
      .formatToParts(new Date(`${date}T12:00:00Z`))
      .find((part) => part.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+00:00";
  return new Date(`${date}T23:59:59.999${offset}`);
}
