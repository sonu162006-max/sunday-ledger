/**
 * Standardized date and currency formatting utilities for Sunday Ledger.
 */

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Formats a date string or Date object into standardized human-readable format: "01 Oct 2026".
 * Handles pure YYYY-MM-DD strings safely without timezone drift.
 */
export function formatDisplayDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";

  if (typeof dateInput === "string") {
    const cleanStr = dateInput.trim();
    // Check for YYYY-MM-DD or ISO pattern
    const match = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const monthIdx = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return `${String(day).padStart(2, "0")} ${MONTHS_SHORT[monthIdx] || ""} ${year}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}
