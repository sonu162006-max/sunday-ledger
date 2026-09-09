import { Suspense } from "react";
import { LoginForm } from "@/src/components/modules/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-100/60 dark:bg-slate-950">
      <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
            SL
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Sunday Ledger
            </h1>
            <p className="text-xs text-slate-500">Attendance & Payroll System</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Sign In
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Enter your credentials to access the administrative portal
          </p>
        </div>

        <Suspense fallback={<div className="text-xs text-slate-400">Loading form...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
