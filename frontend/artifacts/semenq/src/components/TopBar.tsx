import { Bell, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useListNotifications } from "@workspace/api-client-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  userName?: string;
}

export function TopBar({ title, subtitle, userName }: TopBarProps) {
  const { data: notifications } = useListNotifications({ unreadOnly: true });
  const unreadCount = Array.isArray(notifications) ? notifications.filter((n: any) => !n.isRead).length : 0;

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <Link href="/patient/search">
          <Button variant="outline" size="sm" className="gap-2 rounded-full">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline text-muted-foreground">Search medicines...</span>
          </Button>
        </Link>
        <Button variant="ghost" size="sm" className="relative rounded-full w-9 h-9 p-0">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
        {userName && (
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{userName[0]}</span>
            </div>
            <span className="text-sm font-medium text-foreground hidden sm:block">{userName.split(" ")[0]}</span>
          </div>
        )}
      </div>
    </header>
  );
}
