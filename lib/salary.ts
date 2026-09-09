export interface WorkerInput {
  monthlySalary: number;
}

export interface AttendanceRecordInput {
  date: string; // Format: "YYYY-MM-DD"
  status: 'PRESENT' | 'ABSENT';
}

export interface HolidayInput {
  date: string; // Format: "YYYY-MM-DD"
}

export interface WorkerSalaryResult {
  presentDays: number;
  paidSundays: number;
  paidHolidays: number;
  totalPaidDays: number;
  salary: number;
}

/**
 * Computes monthly salary for a worker based on attendance and holiday business rules.
 *
 * Rules:
 * - Daily rate = monthlySalary / 30
 * - If a date is in the holidays list, it's a paid day regardless of attendance,
 *   and it's not counted as a "present day" — it's counted separately as a paid holiday.
 * - An unmarked day defaults to PRESENT.
 * - If a day is a Sunday (and not a holiday), it is paid if the preceding Saturday
 *   OR following Monday is PRESENT (either explicitly or by default when unmarked within the month).
 *   A Sunday is unpaid ONLY IF both adjacent days are not present (i.e. explicitly ABSENT or outside the month boundary).
 * - For all other days (Mon-Sat, not holidays): if there's an explicit ABSENT record,
 *   it doesn't count as a paid day. If there's a PRESENT record, or no record at all (default assumption),
 *   it counts as a paid day.
 * - Month boundaries: if the preceding Saturday or following Monday falls in a different month,
 *   it cannot be verified from this month's records (treated as not present).
 */
export function computeWorkerSalary(
  worker: WorkerInput,
  year: number,
  month: number, // 1 - 12
  attendanceRecords: AttendanceRecordInput[],
  holidays: HolidayInput[]
): WorkerSalaryResult {
  const daysInMonth = new Date(year, month, 0).getDate();

  const holidaySet = new Set(holidays.map((h) => h.date));
  const attendanceMap = new Map<string, 'PRESENT' | 'ABSENT'>();
  for (const record of attendanceRecords) {
    attendanceMap.set(record.date, record.status);
  }

  let presentDays = 0;
  let paidSundays = 0;
  let paidHolidays = 0;

  const formatDate = (d: number): string =>
    `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(d);
    // Note: JS Date month index is 0-based
    const dayOfWeek = new Date(year, month - 1, d).getDay(); // 0 = Sunday, 6 = Saturday

    // 1. If date is a holiday, it counts separately as a paid holiday
    // (Overrides attendance and prevents double-counting if falling on Sunday)
    if (holidaySet.has(dateStr)) {
      paidHolidays++;
      continue;
    }

    // 2. Sunday handling (not a holiday)
    if (dayOfWeek === 0) {
      // Preceding Saturday (d - 1)
      // If within this month (d - 1 >= 1): counts as present if it is a holiday OR not explicitly marked ABSENT
      // If falls outside this month (d - 1 < 1): cannot be verified from this month, defaults to false
      const prevSatPresent =
        d - 1 >= 1 &&
        (holidaySet.has(formatDate(d - 1)) ||
          attendanceMap.get(formatDate(d - 1)) !== 'ABSENT');

      // Following Monday (d + 1)
      // If within this month (d + 1 <= daysInMonth): counts as present if it is a holiday OR not explicitly marked ABSENT
      // If falls outside this month (d + 1 > daysInMonth): cannot be verified from this month, defaults to false
      const nextMonPresent =
        d + 1 <= daysInMonth &&
        (holidaySet.has(formatDate(d + 1)) ||
          attendanceMap.get(formatDate(d + 1)) !== 'ABSENT');

      if (prevSatPresent || nextMonPresent) {
        paidSundays++;
      }
      continue;
    }

    // 3. Mon-Sat (not holiday)
    const status = attendanceMap.get(dateStr);
    if (status !== 'ABSENT') {
      // Explicit PRESENT or no record (default assumption) -> paid present day
      presentDays++;
    }
  }

  const totalPaidDays = presentDays + paidSundays + paidHolidays;
  const dailyRate = worker.monthlySalary / 30;
  const salary = Math.round(totalPaidDays * dailyRate * 100) / 100;

  return {
    presentDays,
    paidSundays,
    paidHolidays,
    totalPaidDays,
    salary,
  };
}
