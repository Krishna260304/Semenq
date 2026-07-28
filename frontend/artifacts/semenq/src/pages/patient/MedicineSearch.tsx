import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PatientLayout } from "@/layouts/PatientLayout";
import { Search, MapPin, Filter, SlidersHorizontal, ChevronDown, ArrowRight, Star, Clock, Truck, Navigation, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockBadge } from "@/components/StockBadge";
import { PharmacyMap } from "@/components/PharmacyMap";
import { Link } from "wouter";
import { useSearchMedicines, useGetSearchSuggestions } from "@workspace/api-client-react";

const expansionLevels = ["nearby", "city", "district", "state", "national"] as const;
const expansionLabels: Record<string, string> = {
  nearby: "Nearby", city: "City", district: "District", state: "State", national: "National"
};

const sortOptions = [
  { value: "bestMatch", label: "Best Match" },
  { value: "nearest", label: "Nearest First" },
  { value: "cheapest", label: "Lowest Price" },
  { value: "fastest", label: "Fastest Delivery" },
];

function _UnusedMapPlaceholder({ markers }: { markers: any[] }) {
  const statusColors: Record<string, string> = { available: "#10B981", limited: "#F59E0B", outOfStock: "#EF4444", courier: "#7C3AED" };
  return (
    <div className="relative w-full h-full bg-[#e8f0fe] rounded-2xl overflow-hidden">
      <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2563EB" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="50%" x2="100%" y2="48%" stroke="#94a3b8" strokeWidth="3" />
        <line x1="30%" y1="0" x2="35%" y2="100%" stroke="#94a3b8" strokeWidth="2" />
        <line x1="65%" y1="0" x2="60%" y2="100%" stroke="#94a3b8" strokeWidth="2" />
        <line x1="0" y1="30%" x2="100%" y2="32%" stroke="#cbd5e1" strokeWidth="1.5" />
        <line x1="0" y1="70%" x2="100%" y2="68%" stroke="#cbd5e1" strokeWidth="1.5" />
      </svg>

      <div className="absolute" style={{ left: "48%", top: "52%", transform: "translate(-50%,-50%)" }}>
        <div className="w-5 h-5 rounded-full bg-primary border-4 border-white shadow-lg" />
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-primary bg-white/90 px-2 py-0.5 rounded-full shadow">You</div>
      </div>

      {[
        { left: "62%", top: "38%", marker: markers[0] },
        { left: "32%", top: "28%", marker: markers[1] },
        { left: "54%", top: "66%", marker: markers[2] },
      ].map(({ left, top, marker }) => (
        <div key={marker.pharmacyId} className="absolute group cursor-pointer" style={{ left, top, transform: "translate(-50%,-100%)" }}>
          <div className="w-8 h-8 rounded-full border-3 border-white shadow-lg flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ backgroundColor: statusColors[marker.stockStatus] || "#10B981", borderWidth: "2px" }}>
            <Navigation className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
            <div className="bg-white rounded-xl shadow-xl p-3 min-w-[160px] border border-border">
              <p className="text-xs font-semibold text-foreground">{marker.pharmacyName}</p>
              {marker.quantity > 0 && <p className="text-xs text-muted-foreground mt-0.5">{marker.quantity} units · ₹{marker.price}</p>}
              <StockBadge status={marker.stockStatus as any} quantity={marker.quantity || undefined} className="mt-1.5" />
            </div>
          </div>
        </div>
      ))}

      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur rounded-xl p-2.5 border border-border">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Legend</p>
        {[["#10B981", "Available"], ["#F59E0B", "Limited"], ["#EF4444", "Out of Stock"], ["#7C3AED", "Courier"]].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5 mb-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MedicineSearch() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sort, setSort] = useState("bestMatch");
  const [expansionIdx, setExpansionIdx] = useState(1);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results, isLoading } = useSearchMedicines({ q: searched || "", sortBy: sort as any }, { query: { enabled: !!searched, queryKey: ["searchMedicines", searched, sort] } });
  const displayResults = (results as any)?.results || [];
  const { data: suggestionData } = useGetSearchSuggestions({ q: query }, { query: { enabled: query.length > 1, queryKey: ["searchSuggestions", query] } });
  const suggestions = (Array.isArray(suggestionData) ? suggestionData : []) as any[];
  const markers = (results as any)?.mapMarkers || [];
  const pharmacyMarkers = markers
    .filter((marker: any) => Number.isFinite(Number(marker.latitude)) && Number.isFinite(Number(marker.longitude)))
    .map((marker: any) => ({
      id: String(marker.pharmacyId || marker.pharmacy_id),
      name: marker.pharmacyName || marker.pharmacy_name || "Pharmacy",
      latitude: Number(marker.latitude),
      longitude: Number(marker.longitude),
      address: marker.address,
      distance_km: marker.distance,
      medicines: marker.medicines,
    }));

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setSearched(q);
    setShowSuggestions(false);
    setExpansionIdx(1);
    setSearching(false);
  };

  return (
    <PatientLayout>
      <div className="flex flex-col h-screen">
        <div className="bg-card border-b border-border px-6 py-4">
          <div className="max-w-2xl">
            <h1 className="text-xl font-bold text-foreground mb-4">Find Medicines</h1>
            <div className="relative">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    value={query}
                    onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={e => { if (e.key === "Enter") doSearch(query); if (e.key === "Escape") setShowSuggestions(false); }}
                    placeholder="Search medicine name, composition, or brand..."
                    className="h-12 pl-11 pr-4 rounded-[28px] text-sm border-2 focus:border-primary shadow-sm"
                  />
                  <AnimatePresence>
                    {showSuggestions && query.length > 1 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-border z-50 overflow-hidden"
                      >
                        {suggestions.map((s: any) => (
                          <button key={s.text || s} className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40 text-left" onClick={() => { const text = s.text || s; setQuery(text); doSearch(text); }}>
                            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span>{s.text || s}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Button onClick={() => doSearch(query)} disabled={searching} className="h-12 px-6 rounded-[28px] shrink-0">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                </Button>
              </div>
            </div>

            {searched && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3">
                <div className="flex items-center gap-2">
                  {expansionLevels.map((level, i) => (
                    <div key={level} className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${i < expansionIdx ? "bg-success/10 text-success border-success/20" : i === expansionIdx ? "bg-primary/10 text-primary border-primary/20 animate-pulse" : "bg-muted text-muted-foreground border-transparent"}`}>
                        {i < expansionIdx && <CheckCircle className="w-3 h-3" />}
                        {expansionLabels[level]}
                      </div>
                      {i < expansionLevels.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {searched ? (
          <div className="flex flex-1 overflow-hidden">
            <div className="w-[420px] shrink-0 border-r border-border overflow-y-auto">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{displayResults.length} results for "<span className="text-foreground">{searched}</span>"</p>
                <select value={sort} onChange={e => setSort(e.target.value)} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background">
                  {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="p-3 space-y-3">
                {displayResults.map((r: any, i: number) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="bg-card border border-card-border rounded-[20px] p-4 card-lift">
                    <div className="flex items-start gap-3">
                      <img src={r.medicine.imageUrl} alt={r.medicine.name} className="w-12 h-12 rounded-xl object-cover bg-muted shrink-0" onError={e => { e.currentTarget.src = ""; e.currentTarget.className = "w-12 h-12 rounded-xl bg-muted shrink-0"; }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm leading-tight">{r.medicine.name}</p>
                        <p className="text-xs text-muted-foreground">{r.medicine.genericName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StockBadge status={r.stockStatus as any} quantity={r.quantity} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-foreground">₹{r.price}</p>
                        <p className="text-xs text-muted-foreground line-through">₹{r.medicine.mrp}</p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span className="font-medium text-foreground truncate max-w-[180px]">{r.pharmacy.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{r.distance} {r.distanceUnit}</span>
                          <span className="flex items-center gap-1">
                            {r.deliveryType === "courier" ? <Truck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {r.estimatedDelivery}
                          </span>
                        </div>
                      </div>
                      <Link href={`/patient/reserve/${r.medicine.id}`}>
                        <Button size="sm" className="rounded-[18px] h-8 text-xs px-4">Reserve</Button>
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="flex-1 p-4">
              <PharmacyMap className="h-full rounded-2xl" pharmacies={pharmacyMarkers} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md p-8">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Search className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Search for any medicine</h2>
              <p className="text-muted-foreground text-sm mb-6">Search the live medicine catalog and nearby pharmacy inventory.</p>
            </div>
          </div>
        )}
      </div>
    </PatientLayout>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
