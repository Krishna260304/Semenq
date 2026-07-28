import { motion } from "framer-motion";
import { PharmacyLayout } from "@/layouts/PharmacyLayout";
import { TopBar } from "@/components/TopBar";
import { SkeletonCard, SkeletonStats } from "@/components/SkeletonCard";
import { Package, TrendingUp, Clock, IndianRupee, CheckCircle2, XCircle, ChevronRight, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useGetDemandForecast, useGetPharmacyDashboard, useUpdateReservation } from "@workspace/api-client-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { useGetMyProfile } from "@workspace/api-client-react";

export default function PharmacyDashboard() {
  const { data: profile } = useGetMyProfile();
  const { data, isLoading } = useGetPharmacyDashboard();
  const { data: forecastData } = useGetDemandForecast({ days: 30 });
  const forecast = (Array.isArray(forecastData) ? forecastData : []) as any[];
  const rawDashboard = (data as any) || {};
  const dashboard = {
    totalInventory: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    todayReservations: 0,
    pendingReservations: 0,
    confirmedReservations: 0,
    todayRevenue: 0,
    monthlyRevenue: 0,
    courierRequests: 0,
    topSellingMedicines: [],
    revenueByDay: [],
    ...rawDashboard,
    recentReservations: (rawDashboard.recentReservations || []).map((item: any) => ({
      ...item,
      medicineName: item.medicineName || item.medicine_name || "Reservation",
      quantity: item.quantity ?? item.medicine_count ?? 0,
      totalAmount: item.totalAmount ?? item.grand_total ?? 0,
      deliveryType: item.deliveryType || item.pickup_method || "pickup",
    })),
  };
  const updateReservation = useUpdateReservation();

  const handleReservation = async (id: number, action: "confirmed" | "cancelled") => {
    updateReservation.mutate({ id, data: { status: action } });
    toast.success(`Reservation ${action === "confirmed" ? "approved" : "rejected"}`);
  };

  const stats = [
    { label: "Total Inventory", value: dashboard.totalInventory.toLocaleString(), icon: Package, color: "text-primary", bg: "bg-primary/10", sub: `${dashboard.lowStockCount} low stock` },
    { label: "Today's Reservations", value: dashboard.todayReservations, icon: Clock, color: "text-ai", bg: "bg-ai/10", sub: `${dashboard.pendingReservations} pending` },
    { label: "Today's Revenue", value: `₹${(dashboard.todayRevenue / 1000).toFixed(1)}K`, icon: IndianRupee, color: "text-success", bg: "bg-success/10", sub: `₹${(dashboard.monthlyRevenue / 100000).toFixed(1)}L this month` },
    { label: "Courier Requests", value: dashboard.courierRequests, icon: TrendingUp, color: "text-warning", bg: "bg-warning/10", sub: "Awaiting dispatch" },
  ];

  return (
    <PharmacyLayout>
      <TopBar title={`Good day, ${(profile as any)?.name?.split(" ")[0] || "Pharmacy"}`} subtitle="Live pharmacy dashboard" userName={(profile as any)?.name || "Pharmacy"} />

      <div className="p-6 space-y-6 max-w-6xl">
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
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-card-border rounded-[24px] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-foreground">Revenue (Last 14 days)</h2>
              <p className="text-2xl font-bold text-foreground">₹{(dashboard.monthlyRevenue / 100000).toFixed(1)}L</p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={dashboard.revenueByDay}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} contentStyle={{ borderRadius: "12px", border: "1px solid hsl(214 32% 91%)", fontSize: "12px" }} />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card border border-card-border rounded-[24px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Pending Reservations</h2>
              <Link href="/pharmacy/reservations">
                <Button variant="ghost" size="sm" className="text-primary h-7 px-2 text-xs">View all <ChevronRight className="w-3 h-3 ml-1" /></Button>
              </Link>
            </div>
            {isLoading ? <SkeletonCard count={2} /> : (
              <div className="space-y-3">
                {dashboard.recentReservations?.filter((r: any) => r.status === "pending").map((r: any) => (
                  <div key={r.id} className="p-3 rounded-xl border border-border bg-muted/20">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div>
                        <p className="font-medium text-foreground text-sm">{r.medicineName}</p>
                        <p className="text-xs text-muted-foreground">Qty: {r.quantity} · ₹{r.totalAmount} · {r.deliveryType}</p>
                      </div>
                      <span className="text-xs text-warning font-medium shrink-0">Pending</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-7 text-xs rounded-[12px] gap-1 bg-success hover:bg-success/90" onClick={() => handleReservation(r.id, "confirmed")}>
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs rounded-[12px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => handleReservation(r.id, "cancelled")}>
                        <XCircle className="w-3 h-3" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
                {dashboard.recentReservations?.filter((r: any) => r.status === "confirmed").map((r: any) => (
                  <div key={r.id} className="p-3 rounded-xl border border-success/20 bg-success/5">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-medium text-foreground text-sm">{r.medicineName}</p>
                        <p className="text-xs text-muted-foreground">Qty: {r.quantity} · ₹{r.totalAmount}</p>
                      </div>
                      <span className="text-xs text-success font-medium">Confirmed</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-card-border rounded-[24px] p-6">
            <h2 className="font-semibold text-foreground mb-4">Top Selling Medicines</h2>
            <div className="space-y-3">
              {dashboard.topSellingMedicines?.map((m: any, i: number) => (
                <div key={m.medicineName} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.medicineName}</p>
                    <p className="text-xs text-muted-foreground">{m.count} units</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">₹{m.revenue.toLocaleString("en-IN")}</p>
                    <p className={`text-xs font-medium ${m.trend === "up" ? "text-success" : m.trend === "down" ? "text-destructive" : "text-muted-foreground"}`}>
                      {m.trend === "up" ? "+" : m.trend === "down" ? "" : "±"}{m.percentChange}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="bg-card border border-card-border rounded-[24px] p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-ai/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-ai" />
              </div>
              <h2 className="font-semibold text-foreground">AI Demand Forecast</h2>
              <span className="ml-auto text-xs font-medium text-ai bg-ai/10 px-2 py-0.5 rounded-full">Preview</span>
            </div>
            <div className="space-y-3">
              {forecast.slice(0, 3).map((item: any) => {
                const isWarning = item.healthStatus !== "healthy";
                return (
                <div key={item.medicineId || item.medicineName} className={`p-3 rounded-xl border ${isWarning ? "border-warning/20 bg-warning/5" : "border-success/20 bg-success/5"}`}>
                  <div className="flex items-start gap-2">
                    {isWarning ? <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.medicineName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.aiInsight || "Inventory-based forecast available."}</p>
                    </div>
                  </div>
                </div>
                );
              })}
              {forecast.length === 0 && <p className="text-sm text-muted-foreground">No forecast data available yet.</p>}
            </div>
            <Link href="/pharmacy/demand">
              <Button variant="outline" className="w-full mt-4 rounded-[18px] h-9 text-sm gap-1.5">
                <Zap className="w-3.5 h-3.5 text-ai" /> View Full Forecast
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </PharmacyLayout>
  );
}
