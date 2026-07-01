import { motion } from "framer-motion";
import { PatientLayout } from "@/layouts/PatientLayout";
import { TopBar } from "@/components/TopBar";
import { ArrowLeft, MapPin, Truck, CheckCircle2, Clock, Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { useGetOrder, useGetOrderTracking } from "@workspace/api-client-react";
import { QRCode } from "@/components/QRCode";
import { sampleUser } from "@/lib/mockData";

const mockOrder = {
  id: 1,
  medicineName: "Metformin 500mg",
  pharmacyName: "Apollo Pharmacy, Bandra",
  status: "shipped",
  deliveryType: "courier",
  totalAmount: "84.00",
  paymentMethod: "upi",
  paymentStatus: "paid",
  deliveryAddress: "402, Shree Sai Apartments, Andheri West, Mumbai - 400053",
  trackingId: "SQ20260629A1",
  estimatedDelivery: "Tomorrow by 7 PM",
  reservationId: 1,
  createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockTracking = {
  orderId: 1,
  currentStatus: "shipped",
  estimatedDelivery: "Tomorrow by 7 PM",
  timeline: [
    { stage: "placed", label: "Order Placed", description: "Your order was placed and payment confirmed", timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), completed: true },
    { stage: "processing", label: "Processing", description: "Pharmacy is preparing your order", timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(), completed: true },
    { stage: "packed", label: "Packed & Ready", description: "Your medicines are packed and sealed", timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), completed: true },
    { stage: "shipped", label: "Out for Delivery", description: "Order dispatched via BlueDart courier", timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), completed: true },
    { stage: "delivered", label: "Delivered", description: "Package delivered to your doorstep", timestamp: null, completed: false },
  ],
};

const statusConfig: Record<string, { label: string; color: string }> = {
  placed: { label: "Order Placed", color: "bg-primary/10 text-primary border-primary/20" },
  processing: { label: "Processing", color: "bg-warning/10 text-warning border-warning/20" },
  packed: { label: "Packed", color: "bg-primary/10 text-primary border-primary/20" },
  shipped: { label: "Shipped", color: "bg-ai/10 text-ai border-ai/20" },
  delivered: { label: "Delivered", color: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Cancelled", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: order } = useGetOrder(Number(id));
  const { data: tracking } = useGetOrderTracking(Number(id));

  const o = (order as any) || mockOrder;
  const t = (tracking as any) || mockTracking;
  const st = statusConfig[o.status] || statusConfig.placed;
  const qrValue = `SEMENQ:ORDER:${o.id}:${o.trackingId || "PICKUP"}:${o.reservationId}`;

  return (
    <PatientLayout>
      <TopBar title="Order Details" userName={sampleUser.name} />

      <div className="p-6 max-w-4xl">
        <Link href="/patient/orders">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Orders
          </Button>
        </Link>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-card border border-card-border rounded-[24px] p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-bold text-foreground text-lg">{o.medicineName}</h2>
                  <p className="text-sm text-muted-foreground">{o.pharmacyName}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${st.color}`}>{st.label}</span>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Order ID", value: `#SQ${String(o.id).padStart(6, "0")}` },
                  { label: "Tracking ID", value: o.trackingId || "—" },
                  { label: "Payment", value: `${(o.paymentMethod || "UPI").toUpperCase()} · ${o.paymentStatus || "paid"}` },
                  { label: "Delivery Type", value: o.deliveryType === "courier" ? "Courier Delivery" : "Pharmacy Pickup" },
                  { label: "Amount", value: `₹${o.totalAmount}` },
                  { label: "Estimated Delivery", value: o.estimatedDelivery || "—" },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-foreground text-right">{item.value}</span>
                  </div>
                ))}
              </div>

              {o.deliveryAddress && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Delivery Address</p>
                  <p className="text-sm text-foreground flex gap-2">
                    <MapPin className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />
                    {o.deliveryAddress}
                  </p>
                </div>
              )}
            </div>

            {o.deliveryType !== "courier" && (
              <div className="bg-card border border-card-border rounded-[24px] p-6 text-center">
                <h3 className="font-semibold text-foreground mb-1">Pickup QR Code</h3>
                <p className="text-xs text-muted-foreground mb-4">Show this at the pharmacy counter</p>
                <div className="inline-block p-4 bg-white border-2 border-muted rounded-2xl shadow-sm">
                  <QRCode value={qrValue} size={140} />
                </div>
                <p className="text-xs text-muted-foreground/60 mt-3 font-mono">{qrValue}</p>
                <Button variant="outline" size="sm" className="gap-2 rounded-full mt-4">
                  <Download className="w-3.5 h-3.5" /> Download QR
                </Button>
              </div>
            )}

            {o.deliveryType === "courier" && o.trackingId && (
              <div className="bg-card border border-card-border rounded-[24px] p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-ai/10 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-ai" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">Courier Tracking</p>
                    <p className="text-xs text-muted-foreground">BlueDart Express</p>
                  </div>
                </div>
                <div className="bg-muted rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Tracking Number</p>
                  <p className="font-mono font-bold text-foreground text-lg">{o.trackingId}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-card border border-card-border rounded-[24px] p-6">
            <h3 className="font-semibold text-foreground mb-5">Order Timeline</h3>
            <div className="relative">
              {t.timeline?.map((event: typeof mockTracking.timeline[0], i: number) => (
                <motion.div key={event.stage} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex gap-4 relative">
                  {i < t.timeline.length - 1 && (
                    <div className={`absolute left-4 top-8 bottom-0 w-0.5 ${event.completed && t.timeline[i + 1]?.completed ? "bg-success" : "bg-border"}`} />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${event.completed ? "bg-success text-white" : "bg-muted text-muted-foreground border-2 border-border"}`}>
                    {event.completed ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-muted-foreground" />}
                  </div>
                  <div className="flex-1 pb-6">
                    <p className={`font-medium text-sm ${event.completed ? "text-foreground" : "text-muted-foreground"}`}>{event.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                    {event.timestamp && (
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {new Date(event.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    {!event.completed && i === t.timeline.findIndex((e: any) => !e.completed) && (
                      <p className="text-xs text-primary font-medium mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Est: {t.estimatedDelivery}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PatientLayout>
  );
}
