export type Role = "ADMIN" | "VIEWER";

export type AttendanceStatus = "PRESENT" | "ABSENT";

export interface WorkerDTO {
  id: string;
  name: string;
  monthlySalary: number;
  joinDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface AttendanceRecordDTO {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
}

export interface HolidayDTO {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
}

export interface SalaryReportDTO {
  id: string;
  month: string; // YYYY-MM
  generatedAt: string;
  totalPayroll: number;
  lines: SalaryReportLineDTO[];
}

export interface SalaryReportLineDTO {
  id: string;
  salaryReportId: string;
  workerId: string;
  workerName?: string;
  presentDays: number;
  paidSundays: number;
  paidHolidays: number;
  totalPaidDays: number;
  salaryAmount: number;
}
