import { useState } from "react";
import { motion } from "framer-motion";
import { PatientLayout } from "@/layouts/PatientLayout";
import { TopBar } from "@/components/TopBar";
import { ShoppingBag, Truck, MapPin, Clock, ChevronRight, Package, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useListOrders } from "@workspace/api-client-react";
import { SkeletonCard } from "@/components/SkeletonCard";
import { sampleUser } from "@/lib/mockData";

const mockOrders = [
  { id: 1, medicineName: "Metformin 500mg", pharmacyName: "Apollo Pharmacy, Bandra", status: "delivered", totalAmount: 84, paymentMethod: "UPI", deliveryType: "pickup", estimatedDelivery: "Collected on Jun 25", reservationId: 1, paymentStatus: "paid", deliveryAddress: null, trackingId: null, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 2, medicineName: "Amoxicillin 500mg", pharmacyName: "Netmeds Point, Bengaluru", status: "shipped", totalAmount: 197, paymentMethod: "UPI", deliveryType: "courier", estimatedDelivery: "Tomorrow by 7 PM", reservationId: 2, paymentStatus: "paid", deliveryAddress: "402, Shree Sai Apartments, Andheri West", trackingId: "NM20260628A1", createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 3, medicineName: "Atorvastatin 20mg", pharmacyName: "MedPlus, Andheri West", status: "placed", totalAmount: 85, paymentMethod: "Card", deliveryType: "pickup", estimatedDelivery: "Ready in 1 hour", reservationId: 3, paymentStatus: "paid", deliveryAddress: null, trackingId: null, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 4, medicineName: "Pantoprazole 40mg", pharmacyName: "Wellness Forever, Pune", status: "cancelled", totalAmount: 62.5, paymentMethod: "UPI", deliveryType: "pickup", estimatedDelivery: "—", reservationId: 4, paymentStatus: "refunded", deliveryAddress: null, trackingId: null, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  placed: { label: "Order Placed", color: "bg-primary/10 text-primary border-primary/20", icon: Package },
  processing: { label: "Processing", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  packed: { label: "Packed", color: "bg-primary/10 text-primary border-primary/20", icon: Package },
  shipped: { label: "Shipped", color: "bg-ai/10 text-ai border-ai/20", icon: Truck },
  delivered: { label: "Delivered", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-destructive/10 text-destructive border-destructive/20", icon: Package },
};

const tabs = ["All", "Active", "Delivered", "Cancelled"];

export default function Orders() {
  const [activeTab, setActiveTab] = useState("All");
  const { data, isLoading } = useListOrders();
  const orders = (Array.isArray(data) ? data : mockOrders) as typeof mockOrders;

  const filtered = orders.filter(o => {
    if (activeTab === "Active") return ["placed", "processing", "packed", "shipped"].includes(o.status);
    if (activeTab === "Delivered") return o.status === "delivered";
    if (activeTab === "Cancelled") return o.status === "cancelled";
    return true;
  });

  return (
    <PatientLayout>
      <TopBar title="Orders & Tracking" userName={sampleUser.name} />

      <div className="p-6 max-w-3xl">
        <div className="flex gap-2 mb-6 p-1 bg-muted rounded-xl w-fit">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {tab}
            </button>
          ))}
        </div>

        {isLoading ? <SkeletonCard count={3} /> : (
          <div className="space-y-3">
            {filtered.map((order, i) => {
              const st = statusConfig[order.status] || statusConfig.placed;
              const Icon = st.icon;
              return (
                <motion.div key={order.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <Link href={`/patient/orders/${order.id}`}>
                    <div className="bg-card border border-card-border rounded-[24px] p-5 card-lift cursor-pointer">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${order.deliveryType === "courier" ? "bg-ai/10" : "bg-primary/10"}`}>
                          {order.deliveryType === "courier" ? <Truck className="w-6 h-6 text-ai" /> : <ShoppingBag className="w-6 h-6 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-foreground">{order.medicineName}</p>
                            <p className="font-bold text-foreground shrink-0">₹{order.totalAmount}</p>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{order.pharmacyName}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${st.color}`}>
                              {st.label}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {order.deliveryType === "courier" ? <Truck className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                              {order.estimatedDelivery}
                            </span>
                          </div>
                          {order.trackingId && (
                            <p className="text-xs text-muted-foreground mt-1">Tracking: <span className="font-mono font-medium text-foreground">{order.trackingId}</span></p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <p className="font-medium text-foreground mb-1">No {activeTab.toLowerCase()} orders</p>
                <p className="text-sm text-muted-foreground">Your orders will appear here once placed</p>
                <Link href="/patient/search"><Button className="mt-4 rounded-[18px]">Find Medicines</Button></Link>
              </div>
            )}
          </div>
        )}
      </div>
    </PatientLayout>
  );
}
