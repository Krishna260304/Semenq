import { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "sonner";

interface PatientLayoutProps {
  children: ReactNode;
}

export function PatientLayout({ children }: PatientLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar role="patient" unreadCount={3} />
      <main className="flex-1 ml-64 min-h-screen overflow-auto">
        {children}
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
