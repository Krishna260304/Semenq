import { motion } from "framer-motion";
import { AdminLayout } from "@/layouts/AdminLayout";
import { TopBar } from "@/components/TopBar";
import { Users, Building2, Pill, ShoppingBag, Activity, CheckCircle2, AlertTriangle, XCircle, TrendingUp, Clock } from "lucide-react";
import { useGetAdminDashboard } from "@workspace/api-client-react";
import { SkeletonStats } from "@/components/SkeletonCard";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const activityIcons: Record<string, any> = {
  userRegistered: Users,
  pharmacyVerified: Building2,
  orderPlaced: ShoppingBag,
  paymentReceived: TrendingUp,
  alert: AlertTriangle,
};
const activityColors: Record<string, string> = {
  userRegistered: "bg-primary/10 text-primary",
  pharmacyVerified: "bg-success/10 text-success",
  orderPlaced: "bg-ai/10 text-ai",
  paymentReceived: "bg-success/10 text-success",
  alert: "bg-warning/10 text-warning",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status === "healthy" ? "bg-success/10 text-success" : status === "degraded" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "healthy" ? "bg-success" : status === "degraded" ? "bg-warning" : "bg-destructive"}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TimeAgo({ dateStr }: { dateStr: string }) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (hours > 0) return <span>{hours}h ago</span>;
  return <span>{mins}m ago</span>;
}

export default function AdminDashboard() {
  const { data, isLoading } = useGetAdminDashboard();
  const d = (data as any) || {
    totalUsers: 0,
    totalPharmacies: 0,
    totalMedicines: 0,
    totalOrders: 0,
    monthlyRevenue: 0,
    activeReservations: 0,
    pendingVerifications: 0,
    platformHealth: { serverStatus: "degraded", dbStatus: "degraded", apiStatus: "degraded", apiResponseTime: 0, uptime: 0, errorRate: 0 },
    recentActivity: [],
    userGrowth: [],
  };

  const stats = [
    { label: "Total Users", value: d.totalUsers.toLocaleString("en-IN"), icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Partner Pharmacies", value: d.totalPharmacies.toLocaleString("en-IN"), icon: Building2, color: "text-success", bg: "bg-success/10" },
    { label: "Medicine Catalog", value: d.totalMedicines.toLocaleString("en-IN"), icon: Pill, color: "text-ai", bg: "bg-ai/10" },
    { label: "Total Orders", value: d.totalOrders.toLocaleString("en-IN"), icon: ShoppingBag, color: "text-warning", bg: "bg-warning/10" },
  ];

  return (
    <AdminLayout>
      <TopBar title="Admin Dashboard" subtitle="Platform overview" />

      <div className="p-6 max-w-6xl space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? <SkeletonStats count={4} /> : stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-card border border-card-border rounded-[24px] p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-card-border rounded-[24px] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Platform Health</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "API Server", value: d.platformHealth.serverStatus },
              { label: "Database", value: d.platformHealth.dbStatus },
              { label: "API Status", value: d.platformHealth.apiStatus },
              { label: "Response Time", value: `${d.platformHealth.apiResponseTime}ms`, raw: true, good: d.platformHealth.apiResponseTime < 300 },
              { label: "Uptime", value: `${d.platformHealth.uptime}%`, raw: true, good: d.platformHealth.uptime > 99 },
            ].map(item => (
              <div key={item.label} className="text-center p-3 bg-muted/30 rounded-xl">
                <p className="text-xs text-muted-foreground mb-2">{item.label}</p>
                {(item as any).raw ? (
                  <span className={`text-sm font-bold ${(item as any).good ? "text-success" : "text-warning"}`}>{item.value}</span>
                ) : (
                  <StatusDot status={item.value} />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card border border-card-border rounded-[24px] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-foreground">Revenue Growth</h2>
              <p className="text-2xl font-bold text-foreground">₹{(d.monthlyRevenue / 100000).toFixed(1)}L</p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={d.userGrowth}>
                <defs>
                  <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(214 32% 91%)", fontSize: "12px" }} formatter={(v: number) => [`₹${(v/100000).toFixed(2)}L`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2} fill="url(#adminGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-card-border rounded-[24px] p-6">
            <h2 className="font-semibold text-foreground mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {d.recentActivity?.map((event: any) => {
                const Icon = activityIcons[event.type] || Clock;
                const color = activityColors[event.type] || "bg-muted text-muted-foreground";
                return (
                  <div key={event.id} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-relaxed">{event.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5"><TimeAgo dateStr={event.timestamp} /></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Reservations", value: d.activeReservations.toLocaleString("en-IN"), icon: Clock, color: "text-primary", sub: "Right now" },
            { label: "Monthly Revenue", value: `₹${(d.monthlyRevenue / 100000).toFixed(1)}L`, icon: TrendingUp, color: "text-success", sub: "Live total" },
            { label: "Pending Verifications", value: d.pendingVerifications, icon: AlertTriangle, color: "text-warning", sub: "Pharmacies awaiting review" },
          ].map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div key={m.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.08 }} className="bg-card border border-card-border rounded-[24px] p-5">
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${m.color}`} />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{m.value}</p>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-xs font-medium text-muted-foreground/60 mt-0.5">{m.sub}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
