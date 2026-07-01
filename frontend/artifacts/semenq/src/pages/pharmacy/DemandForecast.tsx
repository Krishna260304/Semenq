import { motion } from "framer-motion";
import { PharmacyLayout } from "@/layouts/PharmacyLayout";
import { TopBar } from "@/components/TopBar";
import { Zap, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, XCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetDemandForecast } from "@workspace/api-client-react";
import { toast } from "sonner";
import { samplePharmacyUser } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const mockForecast = [
  { medicineId: 7, medicineName: "Cetirizine 10mg", genericName: "Cetirizine HCl", currentStock: 280, predictedDemand: 420, reorderSuggestion: 200, confidence: 92.4, trend: "rising" as const, healthStatus: "warning" as const, aiInsight: "Monsoon season historically increases antihistamine demand by 68% in Mumbai. Order by Friday to avoid stockout.", daysUntilStockout: 9 },
  { medicineId: 2, medicineName: "Paracetamol 650mg", genericName: "Paracetamol", currentStock: 9, predictedDemand: 180, reorderSuggestion: 250, confidence: 95.1, trend: "rising" as const, healthStatus: "critical" as const, aiInsight: "Current stock will last only 1 day at current demand. Immediate reorder required. 3 nearby distributors have stock.", daysUntilStockout: 1 },
  { medicineId: 3, medicineName: "Metformin 500mg", genericName: "Metformin HCl", currentStock: 62, predictedDemand: 55, reorderSuggestion: 0, confidence: 88.7, trend: "stable" as const, healthStatus: "healthy" as const, aiInsight: "Steady demand from recurring patients. Stock sufficient for approximately 18 days. No action needed.", daysUntilStockout: 18 },
  { medicineId: 6, medicineName: "Azithromycin 500mg", genericName: "Azithromycin", currentStock: 7, predictedDemand: 95, reorderSuggestion: 80, confidence: 84.3, trend: "rising" as const, healthStatus: "warning" as const, aiInsight: "Search volume for 'Azithromycin' up 34% in your area over the past week. Possible seasonal respiratory infections.", daysUntilStockout: 2 },
  { medicineId: 5, medicineName: "Pantoprazole 40mg", genericName: "Pantoprazole", currentStock: 124, predictedDemand: 80, reorderSuggestion: 0, confidence: 91.2, trend: "stable" as const, healthStatus: "healthy" as const, aiInsight: "Demand stable. Stock levels comfortable for the next 30+ days.", daysUntilStockout: null },
  { medicineId: 9, medicineName: "Omeprazole 20mg", genericName: "Omeprazole", currentStock: 45, predictedDemand: 30, reorderSuggestion: 0, confidence: 87.6, trend: "falling" as const, healthStatus: "healthy" as const, aiInsight: "Slight demand decrease noted — possibly due to patients switching to Pantoprazole. Monitor over next 2 weeks.", daysUntilStockout: null },
];

const chartData = [
  { name: "Cetirizine", current: 280, predicted: 420 },
  { name: "Paracetamol", current: 9, predicted: 180 },
  { name: "Metformin", current: 62, predicted: 55 },
  { name: "Azithromycin", current: 7, predicted: 95 },
  { name: "Pantoprazole", current: 124, predicted: 80 },
];

const healthConfig = { healthy: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10 border-success/20" }, warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10 border-warning/20" }, critical: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" } };
const trendIcons = { rising: TrendingUp, stable: Minus, falling: TrendingDown };
const trendColors = { rising: "text-success", stable: "text-muted-foreground", falling: "text-destructive" };

export default function DemandForecast() {
  const { data, isLoading } = useGetDemandForecast({ days: 30 });
  const forecast = (Array.isArray(data) ? data : mockForecast) as typeof mockForecast;

  const criticalCount = forecast.filter(f => f.healthStatus === "critical").length;
  const warningCount = forecast.filter(f => f.healthStatus === "warning").length;

  return (
    <PharmacyLayout>
      <TopBar title="AI Demand Forecast" subtitle="30-day intelligent inventory prediction" userName={samplePharmacyUser.name} />

      <div className="p-6 max-w-6xl space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Critical Items", value: criticalCount, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", icon: XCircle },
            { label: "Needs Attention", value: warningCount, color: "text-warning", bg: "bg-warning/10 border-warning/20", icon: AlertTriangle },
            { label: "Healthy Stock", value: forecast.filter(f => f.healthStatus === "healthy").length, color: "text-success", bg: "bg-success/10 border-success/20", icon: CheckCircle2 },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className={`bg-card border rounded-[24px] p-5 ${s.bg}`}>
                <div className="flex items-center gap-3">
                  <Icon className={`w-6 h-6 ${s.color}`} />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-card-border rounded-[24px] p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-ai/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-ai" />
            </div>
            <h2 className="font-semibold text-foreground">Current Stock vs. Predicted Demand (30 days)</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(214 32% 91%)", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="current" name="Current Stock" fill="#2563EB" radius={[6, 6, 0, 0]} />
              <Bar dataKey="predicted" name="Predicted Demand" fill="#7C3AED" radius={[6, 6, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <div className="space-y-3">
          <h2 className="font-semibold text-foreground">Medicine-level Insights</h2>
          {forecast.map((item, i) => {
            const h = healthConfig[item.healthStatus];
            const HIcon = h.icon;
            const TIcon = trendIcons[item.trend];
            return (
              <motion.div key={item.medicineName} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.06 }} className={`bg-card border rounded-[20px] p-5 ${item.healthStatus !== "healthy" ? h.bg : "border-card-border"}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${h.bg}`}>
                    <HIcon className={`w-5 h-5 ${h.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{item.medicineName}</p>
                      <div className={`flex items-center gap-1 text-xs font-medium ${trendColors[item.trend]}`}>
                        <TIcon className="w-3.5 h-3.5" />
                        {item.trend}
                      </div>
                      {item.daysUntilStockout !== null && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.daysUntilStockout <= 3 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                          Stockout in {item.daysUntilStockout}d
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.aiInsight}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Current: <strong className="text-foreground">{item.currentStock}</strong></span>
                      <span>Predicted: <strong className="text-foreground">{item.predictedDemand}</strong></span>
                      <span>Confidence: <strong className={`${item.confidence >= 90 ? "text-success" : "text-warning"}`}>{item.confidence}%</strong></span>
                    </div>
                  </div>
                  {item.reorderSuggestion > 0 && (
                    <Button size="sm" className="h-8 text-xs rounded-[14px] gap-1.5 shrink-0" onClick={() => toast.success(`Reorder of ${item.reorderSuggestion} units placed`)}>
                      <Package className="w-3.5 h-3.5" /> Order {item.reorderSuggestion}
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </PharmacyLayout>
  );
}
