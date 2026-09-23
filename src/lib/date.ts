/** Today's date as YYYY-MM-DD in the browser's local timezone (not UTC). */
export function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a bare YYYY-MM-DD `date` column value using its literal calendar
 * date, instead of parsing it as UTC midnight (which shifts the displayed
 * day for any user in a negative UTC offset).
 */
export function formatLocalDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions,
  locale = "en-PH",
): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, options);
}
