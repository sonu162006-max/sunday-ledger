-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE INDEX "SalaryReport_month_idx" ON "SalaryReport"("month");

-- CreateIndex
CREATE INDEX "SalaryReportLine_workerId_idx" ON "SalaryReportLine"("workerId");

-- CreateIndex
CREATE INDEX "Worker_name_idx" ON "Worker"("name");

-- CreateIndex
CREATE INDEX "Worker_isActive_idx" ON "Worker"("isActive");

-- CreateIndex
CREATE INDEX "Worker_createdAt_idx" ON "Worker"("createdAt");
