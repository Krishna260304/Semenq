import { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "sonner";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar role="admin" unreadCount={1} />
      <main className="flex-1 ml-64 min-h-screen overflow-auto">
        {children}
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
