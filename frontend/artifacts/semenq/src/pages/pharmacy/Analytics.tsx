import { PharmacyLayout } from "@/layouts/PharmacyLayout";
import { TopBar } from "@/components/TopBar";
import { useGetPharmacyDashboard, useGetTopMedicines } from "@workspace/api-client-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { samplePharmacyUser } from "@/lib/mockData";

const revenueData = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
  revenue: 7000 + Math.floor(Math.random() * 14000),
  orders: 10 + Math.floor(Math.random() * 20),
}));

const categoryData = [
  { name: "Antibiotics", value: 28 }, { name: "Analgesics", value: 22 }, { name: "Antidiabetics", value: 18 },
  { name: "Antihistamines", value: 14 }, { name: "Statins", value: 10 }, { name: "Others", value: 8 },
];

const COLORS = ["#2563EB", "#10B981", "#7C3AED", "#F59E0B", "#EF4444", "#64748B"];

const topMedicines = [
  { name: "Paracetamol 650mg", units: 184, revenue: 4416 },
  { name: "Metformin 500mg", units: 142, revenue: 5964 },
  { name: "Azithromycin 500mg", units: 98, revenue: 6664 },
  { name: "Cetirizine 10mg", units: 87, revenue: 1609 },
  { name: "Amoxicillin 500mg", units: 73, revenue: 7190 },
];

export default function PharmacyAnalytics() {
  const { data: dashboard } = useGetPharmacyDashboard();
  const { data: topData } = useGetTopMedicines({ limit: 5 });

  return (
    <PharmacyLayout>
      <TopBar title="Analytics" subtitle="Last 30 days" userName={samplePharmacyUser.name} />

      <div className="p-6 max-w-6xl space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[["Total Revenue", "₹3.43L", "+11.2%", "text-success"], ["Total Orders", "482", "+8.4%", "text-success"], ["Avg Order Value", "₹711", "+2.6%", "text-success"], ["New Customers", "38", "+5.1%", "text-success"]].map(([label, val, change, col]) => (
            <div key={label} className="bg-card border border-card-border rounded-[20px] p-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
              <p className="text-2xl font-bold text-foreground">{val}</p>
              <p className={`text-xs font-medium mt-0.5 ${col}`}>{change} vs last month</p>
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
                {categoryData.map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-xs text-foreground flex-1">{cat.name}</span>
                    <span className="text-xs font-semibold text-foreground">{cat.value}%</span>
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
