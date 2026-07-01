import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Search, Upload, BookMarked, ShoppingBag, User, LayoutDashboard,
  Package, CalendarCheck, TrendingUp, BarChart3, Users, Building2,
  Pill, Shield, Bell, LogOut, ChevronRight, Activity, Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  role: "patient" | "pharmacy" | "admin";
  unreadCount?: number;
}

const patientLinks = [
  { href: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patient/search", label: "Find Medicines", icon: Search },
  { href: "/patient/prescription", label: "Upload Prescription", icon: Upload },
  { href: "/patient/prescriptions", label: "My Prescriptions", icon: BookMarked },
  { href: "/patient/orders", label: "Orders & Tracking", icon: ShoppingBag },
  { href: "/patient/profile", label: "Profile", icon: User },
];

const pharmacyLinks = [
  { href: "/pharmacy/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pharmacy/inventory", label: "Inventory", icon: Package },
  { href: "/pharmacy/reservations", label: "Reservations", icon: CalendarCheck },
  { href: "/pharmacy/demand", label: "Demand Forecast", icon: Zap, badge: "AI" },
  { href: "/pharmacy/analytics", label: "Analytics", icon: BarChart3 },
];

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/pharmacies", label: "Pharmacies", icon: Building2 },
  { href: "/admin/medicines", label: "Medicines", icon: Pill },
];

export function AppSidebar({ role, unreadCount = 0 }: SidebarProps) {
  const [location] = useLocation();

  const links = role === "patient" ? patientLinks : role === "pharmacy" ? pharmacyLinks : adminLinks;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-white font-bold text-lg tracking-tight">Semenq</span>
          <p className="text-xs text-sidebar-foreground/50 capitalize">{role} Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || location.startsWith(link.href + "/");
            return (
              <Link key={link.href} href={link.href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}>
                  <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground")} />
                  <span className="flex-1">{link.label}</span>
                  {'badge' in link && (link as any).badge && (
                    <span className="px-1.5 py-0.5 text-xs font-semibold bg-ai/20 text-ai rounded-md">
                      {(link as any).badge as string}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        <Link href="/notifications">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all cursor-pointer">
            <Bell className="w-4 h-4 text-sidebar-foreground/70" />
            <span className="flex-1">Notifications</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-bold bg-destructive text-white rounded-full min-w-[20px] text-center">
                {unreadCount}
              </span>
            )}
          </div>
        </Link>
        <Link href="/">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all cursor-pointer">
            <LogOut className="w-4 h-4 text-sidebar-foreground/70" />
            <span>Log Out</span>
          </div>
        </Link>
      </div>
    </aside>
  );
}
