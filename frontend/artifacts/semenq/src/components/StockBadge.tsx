import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type StockStatus = "available" | "limited" | "outOfStock" | "inStock" | "lowStock";

interface StockBadgeProps {
  status: StockStatus;
  quantity?: number;
  className?: string;
}

export function StockBadge({ status, quantity, className }: StockBadgeProps) {
  const config = {
    available: { label: "Available", icon: CheckCircle2, color: "bg-success/10 text-success border-success/20" },
    inStock: { label: "In Stock", icon: CheckCircle2, color: "bg-success/10 text-success border-success/20" },
    limited: { label: "Limited", icon: AlertTriangle, color: "bg-warning/10 text-warning border-warning/20" },
    lowStock: { label: "Low Stock", icon: AlertTriangle, color: "bg-warning/10 text-warning border-warning/20" },
    outOfStock: { label: "Out of Stock", icon: XCircle, color: "bg-destructive/10 text-destructive border-destructive/20" },
  };

  const c = config[status] || config.outOfStock;
  const Icon = c.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border", c.color, className)}>
      <Icon className="w-3 h-3" />
      {quantity !== undefined && status !== "outOfStock" ? `${quantity} left` : c.label}
    </span>
  );
}
