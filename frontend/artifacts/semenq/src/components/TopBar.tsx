import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";

interface TopBarProps {
  title: string;
  subtitle?: string;
  userName?: string;
}

export function TopBar({ title, subtitle, userName }: TopBarProps) {
  const { user, loading } = useAuth();
  const placeholderNames = new Set(["Guest", "User", "Patient", "Pharmacy", "Account"]);
  const resolvedName = userName && !placeholderNames.has(userName)
    ? userName
    : user?.displayName || user?.email?.split("@")[0] || "";

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
        {!loading && resolvedName && (
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{resolvedName[0].toUpperCase()}</span>
            </div>
            <span className="text-sm font-medium text-foreground hidden sm:block">{resolvedName.split(" ")[0]}</span>
          </div>
        )}
      </div>
    </header>
  );
}
