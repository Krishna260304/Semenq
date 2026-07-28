import { PharmacyLayout } from "@/layouts/PharmacyLayout";
import { TopBar } from "@/components/TopBar";
import { useGetPharmacyDashboard, useGetTopMedicines } from "@workspace/api-client-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useGetMyProfile } from "@workspace/api-client-react";

const COLORS = ["#2563EB", "#10B981", "#7C3AED", "#F59E0B", "#EF4444", "#64748B"];

export default function PharmacyAnalytics() {
  const { data: profile } = useGetMyProfile();
  const { data: dashboard } = useGetPharmacyDashboard();
  const { data: topData } = useGetTopMedicines({ limit: 5 });
  const liveDashboard = (dashboard as any) || {};
  const revenueData = (dashboard as any)?.revenueByDay ?? [];
  const topMedicines = (Array.isArray(topData) ? topData : []) as any[];
  const categoryData = Object.entries((Array.isArray(topData) ? topData : []).reduce<Record<string, number>>((acc, item: any) => {
    const key = item.category || "Others";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})).map(([name, value]) => ({ name, value }));
  const analyticsStats = [
    ["Total Revenue", `₹${((liveDashboard.monthlyRevenue || 0) / 100000).toFixed(1)}L`, "Live total", "text-muted-foreground"],
    ["Total Orders", "—", "Unavailable", "text-muted-foreground"],
    ["Avg Order Value", "—", "Unavailable", "text-muted-foreground"],
    ["New Customers", "—", "Unavailable", "text-muted-foreground"],
  ];

  return (
    <PharmacyLayout>
      <TopBar title="Analytics" subtitle="Last 30 days" userName={(profile as any)?.name || "Pharmacy"} />

      <div className="p-6 max-w-6xl space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {analyticsStats.map(([label, val, change, col]) => (
            <div key={label} className="bg-card border border-card-border rounded-[20px] p-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
              <p className="text-2xl font-bold text-foreground">{val}</p>
              <p className={`text-xs font-medium mt-0.5 ${col}`}>{change}</p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-card-border rounded-[24px] p-6">
          <h2 className="font-semibold text-foreground mb-5">Daily Revenue — Last 30 Days</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} contentStyle={{ borderRadius: "12px", border: "1px solid hsl(214 32% 91%)", fontSize: "12px" }} />
              <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fill="url(#revArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card border border-card-border rounded-[24px] p-6">
            <h2 className="font-semibold text-foreground mb-5">Top Medicines by Revenue</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topMedicines} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(1)}K`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} width={110} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(214 32% 91%)", fontSize: "12px" }} formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="#2563EB" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-card-border rounded-[24px] p-6">
            <h2 className="font-semibold text-foreground mb-5">Sales by Category</h2>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                    {categoryData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(214 32% 91%)", fontSize: "12px" }} formatter={(v: number) => [`${v}%`, "Share"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {categoryData.map(({ name, value }, i) => (
                  <div key={name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-foreground flex-1">{name}</span>
                    <span className="text-xs font-semibold text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PharmacyLayout>
  );
}
