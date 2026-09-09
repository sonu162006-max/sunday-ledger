import { computeWorkerSalary, type AttendanceRecordInput, type HolidayInput } from './salary';

interface TestCase {
  name: string;
  run: () => void;
}

const tests: TestCase[] = [];

function test(name: string, fn: () => void) {
  tests.push({ name, run: fn });
}

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed${message ? ` (${message})` : ''}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

// -------------------------------------------------------------
// Test 1: A normal full month with all days present
// September 2026 (30 days): 4 Sundays (6, 13, 20, 27), 26 Mon-Sat.
// Worker is PRESENT every day.
// -------------------------------------------------------------
test('1. A normal full month with all days present', () => {
  const worker = { monthlySalary: 30000 };
  const year = 2026;
  const month = 9; // September: 30 days

  const attendanceRecords: AttendanceRecordInput[] = [];
  for (let d = 1; d <= 30; d++) {
    const dayStr = String(d).padStart(2, '0');
    attendanceRecords.push({ date: `2026-09-${dayStr}`, status: 'PRESENT' });
  }

  const result = computeWorkerSalary(worker, year, month, attendanceRecords, []);

  assertEquals(result.presentDays, 26, 'presentDays should be 26');
  assertEquals(result.paidSundays, 4, 'paidSundays should be 4');
  assertEquals(result.paidHolidays, 0, 'paidHolidays should be 0');
  assertEquals(result.totalPaidDays, 30, 'totalPaidDays should be 30');
  assertEquals(result.salary, 30000, 'salary should be 30000');
});

// -------------------------------------------------------------
// Test 2: Saturday absent, Monday present → Sunday should be paid
// 2026-09-05 (Sat) ABSENT, 2026-09-07 (Mon) PRESENT
// Sunday 2026-09-06 should be paid.
// -------------------------------------------------------------
test('2. Saturday absent, Monday present → Sunday should be paid', () => {
  const worker = { monthlySalary: 30000 };
  const year = 2026;
  const month = 9;

  const attendanceRecords: AttendanceRecordInput[] = [
    { date: '2026-09-05', status: 'ABSENT' },
    { date: '2026-09-07', status: 'PRESENT' },
  ];

  const result = computeWorkerSalary(worker, year, month, attendanceRecords, []);

  // Sep 6 Sunday is paid because Monday Sep 7 is PRESENT.
  // Other Sundays (13, 20, 27) have unmarked Saturdays and Mondays, which default to PRESENT, so they are also paid.
  // Days Mon-Sat: 26 Mon-Sat total. Sep 5 is ABSENT (1 absent). Remaining 25 default to present.
  assertEquals(result.presentDays, 25, 'presentDays should be 25 (26 - 1 absent)');
  assertEquals(result.paidSundays, 4, 'all 4 Sundays should be paid');
  assertEquals(result.totalPaidDays, 29, 'totalPaidDays should be 29 (25 present + 4 Sundays)');
  assertEquals(result.salary, 29000, 'salary should be 29000');
});

// -------------------------------------------------------------
// Test 3: Saturday present, Monday absent → Sunday should be paid
// 2026-09-12 (Sat) PRESENT, 2026-09-14 (Mon) ABSENT
// Sunday 2026-09-13 should be paid.
// -------------------------------------------------------------
test('3. Saturday present, Monday absent → Sunday should be paid', () => {
  const worker = { monthlySalary: 30000 };
  const year = 2026;
  const month = 9;

  const attendanceRecords: AttendanceRecordInput[] = [
    { date: '2026-09-12', status: 'PRESENT' },
    { date: '2026-09-14', status: 'ABSENT' },
  ];

  const result = computeWorkerSalary(worker, year, month, attendanceRecords, []);

  // Sep 13 is paid (Saturday is PRESENT). Other Sundays default to paid.
  assertEquals(result.presentDays, 25, 'presentDays should be 25 (26 - 1 absent)');
  assertEquals(result.paidSundays, 4, 'all 4 Sundays should be paid');
  assertEquals(result.totalPaidDays, 29, 'totalPaidDays should be 29');
  assertEquals(result.salary, 29000, 'salary should be 29000');
});

// -------------------------------------------------------------
// Test 4: Both Saturday and Monday absent → Sunday should be unpaid
// 2026-09-19 (Sat) ABSENT, 2026-09-21 (Mon) ABSENT
// Sunday 2026-09-20 should be unpaid.
// -------------------------------------------------------------
test('4. Both Saturday and Monday absent → Sunday should be unpaid', () => {
  const worker = { monthlySalary: 30000 };
  const year = 2026;
  const month = 9;

  const attendanceRecords: AttendanceRecordInput[] = [
    { date: '2026-09-19', status: 'ABSENT' },
    { date: '2026-09-21', status: 'ABSENT' },
  ];

  const result = computeWorkerSalary(worker, year, month, attendanceRecords, []);

  // Both Saturday and Monday absent -> Sunday Sep 20 is unpaid.
  // Other 3 Sundays (6, 13, 27) have unmarked adjacents and default to paid.
  // 26 Mon-Sat - 2 absent = 24 present.
  assertEquals(result.presentDays, 24, 'presentDays should be 24');
  assertEquals(result.paidSundays, 3, '3 Sundays should be paid (Sep 20 unpaid)');
  assertEquals(result.totalPaidDays, 27, 'totalPaidDays should be 27');
  assertEquals(result.salary, 27000, 'salary should be 27000');
});

// -------------------------------------------------------------
// Test 5: A holiday that falls on a normal weekday, worker absent that day → still paid (holiday overrides absence)
// 2026-09-15 is Tuesday (holiday). Worker marked ABSENT.
// -------------------------------------------------------------
test('5. A holiday that falls on a normal weekday, worker absent that day → still paid (holiday overrides absence)', () => {
  const worker = { monthlySalary: 30000 };
  const year = 2026;
  const month = 9;

  const holidays: HolidayInput[] = [{ date: '2026-09-15' }];
  const attendanceRecords: AttendanceRecordInput[] = [
    { date: '2026-09-15', status: 'ABSENT' },
  ];

  const result = computeWorkerSalary(worker, year, month, attendanceRecords, holidays);

  // 1 holiday, 4 paid Sundays (all unmarked Sundays default to paid)
  // Mon-Sat: 26 days total. 1 holiday (Sep 15) -> 25 regular Mon-Sat days. All default to present.
  assertEquals(result.paidHolidays, 1, 'paidHolidays should be 1');
  assertEquals(result.presentDays, 25, 'presentDays should be 25');
  assertEquals(result.paidSundays, 4, 'all 4 Sundays should be paid');
  assertEquals(result.totalPaidDays, 30, 'totalPaidDays should be 30 (25 present + 4 Sundays + 1 holiday)');
  assertEquals(result.salary, 30000, 'salary should be 30000');
});

// -------------------------------------------------------------
// Test 6: A holiday that falls on a Sunday → counted once as a paid holiday, not double-counted as a paid Sunday
// 2026-09-20 is Sunday (and a holiday). Saturday 19 and Monday 21 are PRESENT.
// -------------------------------------------------------------
test('6. A holiday that falls on a Sunday → counted once as a paid holiday, not double-counted as a paid Sunday', () => {
  const worker = { monthlySalary: 30000 };
  const year = 2026;
  const month = 9;

  const holidays: HolidayInput[] = [{ date: '2026-09-20' }];
  const attendanceRecords: AttendanceRecordInput[] = [
    { date: '2026-09-19', status: 'PRESENT' },
    { date: '2026-09-21', status: 'PRESENT' },
  ];

  const result = computeWorkerSalary(worker, year, month, attendanceRecords, holidays);

  // Sunday Sep 20 is a holiday, so it counts as 1 paid holiday and NOT as a paid Sunday.
  // The other 3 Sundays (6, 13, 27) default to paid.
  assertEquals(result.paidHolidays, 1, 'paidHolidays should be 1');
  assertEquals(result.paidSundays, 3, 'other 3 Sundays should be paid');
  assertEquals(result.presentDays, 26, 'presentDays should be 26 (all Mon-Sat)');
  assertEquals(result.totalPaidDays, 30, 'totalPaidDays should be 30 (26 present + 3 Sundays + 1 holiday)');
  assertEquals(result.salary, 30000, 'salary should be 30000');
});

// -------------------------------------------------------------
// Test 7: First day of the month is a Sunday (no preceding Saturday in this month)
// February 2026 starts on Sunday (2026-02-01).
// Case 7a: Monday Feb 2 is PRESENT → Sunday should be paid.
// Case 7b: Monday Feb 2 is ABSENT → Sunday should be unpaid.
// -------------------------------------------------------------
test('7. First day of the month is a Sunday (no preceding Saturday in this month)', () => {
  const worker = { monthlySalary: 30000 };
  const year = 2026;
  const month = 2; // Feb 2026: 28 days. Sundays: Feb 1, 8, 15, 22. Mon-Sat: 24 days.

  // Case 7a: Monday Feb 2 is PRESENT
  const recordsWithPresentMonday: AttendanceRecordInput[] = [
    { date: '2026-02-02', status: 'PRESENT' },
  ];
  const resultPaid = computeWorkerSalary(worker, year, month, recordsWithPresentMonday, []);
  assertEquals(resultPaid.paidSundays, 4, 'all 4 Sundays should be paid (Feb 1 paid via Monday, others default to paid)');

  // Case 7b: Monday Feb 2 is ABSENT
  const recordsWithAbsentMonday: AttendanceRecordInput[] = [
    { date: '2026-02-02', status: 'ABSENT' },
  ];
  const resultUnpaid = computeWorkerSalary(worker, year, month, recordsWithAbsentMonday, []);
  assertEquals(resultUnpaid.paidSundays, 3, '3 Sundays paid (Feb 1 unpaid because preceding Sat is out-of-month and Monday is ABSENT)');
});

// -------------------------------------------------------------
// Test 8: Last day of the month is a Sunday (no following Monday in this month)
// May 2026 ends on Sunday (2026-05-31).
// Case 8a: Saturday May 30 is PRESENT → Sunday should be paid.
// Case 8b: Saturday May 30 is ABSENT → Sunday should be unpaid.
// -------------------------------------------------------------
test('8. Last day of the month is a Sunday (no following Monday in this month)', () => {
  const worker = { monthlySalary: 30000 };
  const year = 2026;
  const month = 5; // May 2026: 31 days. May 31 is Sunday (5 Sundays total).

  // Case 8a: Saturday May 30 is PRESENT
  const recordsWithPresentSaturday: AttendanceRecordInput[] = [
    { date: '2026-05-30', status: 'PRESENT' },
  ];
  const resultPaid = computeWorkerSalary(worker, year, month, recordsWithPresentSaturday, []);
  assertEquals(resultPaid.paidSundays, 5, 'all 5 Sundays should be paid');

  // Case 8b: Saturday May 30 is ABSENT
  const recordsWithAbsentSaturday: AttendanceRecordInput[] = [
    { date: '2026-05-30', status: 'ABSENT' },
  ];
  const resultUnpaid = computeWorkerSalary(worker, year, month, recordsWithAbsentSaturday, []);
  assertEquals(resultUnpaid.paidSundays, 4, '4 Sundays should be paid (May 31 unpaid because following Monday is out-of-month and Saturday is ABSENT)');
});

// -------------------------------------------------------------
// Test 9: A worker with no attendance records at all for the month (should default to fully present, all paid)
// September 2026 (30 days): all 30 days must be paid.
// -------------------------------------------------------------
test('9. A worker with no attendance records at all for the month (should default to fully present, all paid)', () => {
  const worker = { monthlySalary: 30000 };
  const year = 2026;
  const month = 9; // 30 days, 4 Sundays, 26 Mon-Sat

  const result = computeWorkerSalary(worker, year, month, [], []);

  assertEquals(result.presentDays, 26, 'presentDays should default to all 26 Mon-Sat days');
  assertEquals(result.paidSundays, 4, 'paidSundays should default to all 4 Sundays');
  assertEquals(result.paidHolidays, 0, 'paidHolidays should be 0');
  assertEquals(result.totalPaidDays, 30, 'totalPaidDays should be all 30 days');
  assertEquals(result.salary, 30000, 'salary should be full 30000');
});

// -------------------------------------------------------------
// Test 10: Partial attendance — only some weekdays marked, all Saturdays/Mondays unmarked — every Sunday should default to paid.
// -------------------------------------------------------------
test('10. Partial attendance — only some weekdays marked, all Saturdays/Mondays unmarked — every Sunday should default to paid.', () => {
  const worker = { monthlySalary: 28000 };
  const year = 2026;
  const month = 9; // September: 30 days (26 Mon-Sat, 4 Sundays)

  // Two weekdays marked PRESENT, with every other day unmarked
  const attendanceRecords: AttendanceRecordInput[] = [
    { date: '2026-09-01', status: 'PRESENT' },
    { date: '2026-09-02', status: 'PRESENT' },
  ];

  const result = computeWorkerSalary(worker, year, month, attendanceRecords, []);

  assertEquals(result.presentDays, 26, 'all 26 Mon-Sat days should default to present');
  assertEquals(result.paidSundays, 4, 'all 4 Sundays should default to paid since adjacent days default to present');
  assertEquals(result.paidHolidays, 0, 'paidHolidays should be 0');
  assertEquals(result.totalPaidDays, 30, 'totalPaidDays should be 30');
  assertEquals(result.salary, 28000, 'salary should be full 28000');
});

// -------------------------------------------------------------
// Test 11: Saturday is a holiday, Monday is explicitly ABSENT — Sunday should still be paid because the holiday Saturday counts as present.
// -------------------------------------------------------------
test('11. Saturday is a holiday, Monday is explicitly ABSENT — Sunday should still be paid because the holiday Saturday counts as present.', () => {
  const worker = { monthlySalary: 30000 };
  const year = 2026;
  const month = 9; // September 2026: 30 days (26 Mon-Sat, 4 Sundays: Sep 6, 13, 20, 27)

  // Saturday Sep 12 is a holiday
  const holidays: HolidayInput[] = [{ date: '2026-09-12' }];

  // Monday Sep 14 has an explicit ABSENT record, with no other attendance data that month
  const attendanceRecords: AttendanceRecordInput[] = [
    { date: '2026-09-14', status: 'ABSENT' },
  ];

  const result = computeWorkerSalary(worker, year, month, attendanceRecords, holidays);

  // Sep 12 is a holiday -> paidHolidays: 1
  // Mon-Sat: 26 total - 1 holiday = 25 regular Mon-Sat days.
  // 1 explicitly ABSENT (Sep 14) -> presentDays: 24
  // Sundays: 4 Sundays. Sep 13 is paid because Saturday Sep 12 is a holiday (counts as present).
  // Other Sundays (Sep 6, 20, 27) default to paid. -> paidSundays: 4
  // Total paid days: 24 (present) + 4 (Sundays) + 1 (holiday) = 29 days
  // Salary: 29 * (30000 / 30) = 29000
  assertEquals(result.paidHolidays, 1, 'paidHolidays should be 1');
  assertEquals(result.presentDays, 24, 'presentDays should be 24 (25 regular - 1 absent)');
  assertEquals(result.paidSundays, 4, 'all 4 Sundays should be paid (Sep 13 paid via holiday Saturday)');
  assertEquals(result.totalPaidDays, 29, 'totalPaidDays should be 29 (24 present + 4 Sundays + 1 holiday)');
  assertEquals(result.salary, 29000, 'salary should be 29000');
});

// -------------------------------------------------------------
// Runner
// -------------------------------------------------------------
console.log('================================================================');
console.log('SUNDAY LEDGER - SALARY ENGINE TEST SUITE');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    t.run();
    console.log(`PASS: ${t.name}`);
    passed++;
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`FAIL: ${t.name}`);
    console.error(`      ${error.message}\n`);
    failed++;
  }
}

console.log('\n----------------------------------------------------------------');
console.log(`TOTAL: ${tests.length} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('----------------------------------------------------------------');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\nAll salary calculation test assertions passed successfully!');
}
