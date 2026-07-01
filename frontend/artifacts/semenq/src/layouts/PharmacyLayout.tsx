import { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "sonner";

interface PharmacyLayoutProps {
  children: ReactNode;
}

export function PharmacyLayout({ children }: PharmacyLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar role="pharmacy" unreadCount={2} />
      <main className="flex-1 ml-64 min-h-screen overflow-auto">
        {children}
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
