import { motion } from "framer-motion";
import { PatientLayout } from "@/layouts/PatientLayout";
import { TopBar } from "@/components/TopBar";
import { SkeletonCard, SkeletonStats } from "@/components/SkeletonCard";
import { StockBadge } from "@/components/StockBadge";
import { Link } from "wouter";
import {
  Search, Upload, ShoppingBag, Zap, Clock, CheckCircle2,
  AlertTriangle, ArrowRight, Package, TrendingUp, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

async function apiFetch(path: string) {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { headers });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

const quickActions = [
  { href: "/patient/search", icon: Search, label: "Find Medicines", desc: "Search across India", color: "bg-primary text-white" },
  { href: "/patient/prescription", icon: Upload, label: "Upload Prescription", desc: "AI-powered parsing", color: "bg-ai text-white" },
  { href: "/patient/orders", icon: ShoppingBag, label: "Track Orders", desc: "Live updates", color: "bg-success text-white" },
];

const getHour = () => new Date().getHours();
const greeting = getHour() < 12 ? "Good morning" : getHour() < 17 ? "Good afternoon" : "Good evening";

const statuses: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-warning bg-warning/10 border-warning/20" },
  confirmed: { label: "Confirmed", color: "text-success bg-success/10 border-success/20" },
  ready: { label: "Ready", color: "text-primary bg-primary/10 border-primary/20" },
  cancelled: { label: "Cancelled", color: "text-destructive bg-destructive/10 border-destructive/20" },
  placed: { label: "Placed", color: "text-primary bg-primary/10 border-primary/20" },
  shipped: { label: "Shipped", color: "text-ai bg-ai/10 border-ai/20" },
  delivered: { label: "Delivered", color: "text-success bg-success/10 border-success/20" },
};

const aiColors = { refill: "border-ai/20 bg-ai/5", saving: "border-success/20 bg-success/5", alert: "border-warning/20 bg-warning/5", alternative: "border-primary/20 bg-primary/5" };
const aiIcons = { refill: TrendingUp, saving: TrendingUp, alert: AlertTriangle, alternative: Package };

function TimeAgo({ dateStr }: { dateStr: string }) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (hours > 24) return <span>{Math.floor(hours / 24)}d ago</span>;
  if (hours > 0) return <span>{hours}h ago</span>;
  return <span>{mins}m ago</span>;
}

function ExpiresIn({ dateStr }: { dateStr: string }) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const isUrgent = diff < 2 * 60 * 60 * 1000;
  return (
    <span className={`text-xs font-medium ${isUrgent ? "text-destructive" : "text-warning"}`}>
      Expires in {hours > 0 ? `${hours}h ` : ""}{mins}m
    </span>
  );
}

export default function PatientDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { data: profileData } = useQuery({ queryKey: ["my-profile"], queryFn: () => apiFetch("/api/users/me"), enabled: !authLoading && !!user, retry: 1 });
  const { data: dashboardData, isLoading } = useQuery({ queryKey: ["patient-dashboard"], queryFn: () => apiFetch("/api/users/me/dashboard"), enabled: !authLoading && !!user, retry: 1 });
  const profile = (profileData as any)?.data;
  const dashboard = (dashboardData as any)?.data || {
    pendingReservations: 0,
    activeOrders: 0,
    totalOrders: 0,
    upcomingReservations: [],
    recentOrders: [],
    recentPrescriptions: [],
    aiRecommendations: [],
  };

  return (
    <PatientLayout>
      <TopBar title={`${greeting}, ${profile?.name?.split(" ")[0] || user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "Account"}`} subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} userName={profile?.name || user?.displayName || user?.email?.split("@")[0] || "Account"} />

      <div className="p-6 space-y-6 max-w-6xl">
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.href}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Link href={action.href}>
                  <div className={`${action.color} rounded-[24px] p-5 cursor-pointer card-lift shadow-md flex items-center gap-4`}>
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{action.label}</p>
                      <p className="text-xs text-white/70">{action.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/60 ml-auto" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {isLoading ? <SkeletonStats count={3} /> : [
            { label: "Pending Reservations", value: dashboard.pendingReservations, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
            { label: "Active Orders", value: dashboard.activeOrders, icon: Package, color: "text-primary", bg: "bg-primary/10" },
            { label: "Total Orders", value: dashboard.totalOrders, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }} className="bg-card border border-card-border rounded-[24px] p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                  <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-card-border rounded-[24px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Upcoming Reservations</h2>
              <Link href="/patient/orders">
                <Button variant="ghost" size="sm" className="text-primary h-7 px-2 text-xs">View all <ChevronRight className="w-3 h-3 ml-1" /></Button>
              </Link>
            </div>
            {isLoading ? <SkeletonCard count={2} /> : (
              <div className="space-y-3">
                {dashboard.upcomingReservations?.map((r: any) => {
                  const st = statuses[r.status] || statuses.pending;
                  return (
                    <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{r.medicineName}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.pharmacyName}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${st.color}`}>{st.label}</span>
                          <ExpiresIn dateStr={r.expiresAt} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-foreground text-sm">₹{r.totalAmount}</p>
                        <p className="text-xs text-muted-foreground">Qty: {r.quantity}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card border border-card-border rounded-[24px] p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-ai/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-ai" />
              </div>
              <h2 className="font-semibold text-foreground">AI Recommendations</h2>
            </div>
            {isLoading ? <SkeletonCard count={2} /> : (
              <div className="space-y-3">
                {dashboard.aiRecommendations?.map((rec: any) => {
                  const Icon = aiIcons[rec.type as keyof typeof aiIcons] || TrendingUp;
                  const colorClass = aiColors[rec.type as keyof typeof aiColors] || aiColors.alternative;
                  return (
                    <div key={rec.id} className={`p-4 rounded-xl border ${colorClass}`}>
                      <div className="flex items-start gap-3">
                        <Icon className="w-4 h-4 text-ai mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{rec.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rec.description}</p>
                        </div>
                      </div>
                      {rec.actionLabel && (
                        <Link href="/patient/search">
                          <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs text-ai px-0 hover:bg-transparent">
                            {rec.actionLabel} <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-card-border rounded-[24px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent Orders</h2>
            <Link href="/patient/orders">
              <Button variant="ghost" size="sm" className="text-primary h-7 px-2 text-xs">View all <ChevronRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </div>
          {isLoading ? <SkeletonCard count={1} /> : (
            <div className="space-y-3">
              {dashboard.recentOrders?.map((order: any) => {
                const st = statuses[order.status] || statuses.placed;
                return (
                  <Link key={order.id} href={`/patient/orders/${order.id}`}>
                    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer">
                      <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-5 h-5 text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{order.medicineName}</p>
                        <p className="text-xs text-muted-foreground">{order.pharmacyName} · {order.deliveryType === "courier" ? "Courier" : "Pickup"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground text-sm">₹{order.totalAmount}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${st.color}`}>{st.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </PatientLayout>
  );
}
