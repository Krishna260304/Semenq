import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, useInView } from "framer-motion";
import {
  Search, MapPin, Truck, Shield, Zap, Clock, ChevronRight,
  CheckCircle2, Star, ArrowRight, Activity, Pill, Building2,
  Users, Globe, Phone, Mail, Menu, X
} from "lucide-react";
import { Button } from "@/components/ui/button";

function AnimatedCounter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, end]);

  return <span ref={ref}>{count.toLocaleString("en-IN")}{suffix}</span>;
}

const features = [
  { icon: Search, title: "Intelligent Medicine Search", desc: "AI-powered search that expands from your neighbourhood to all of India until it finds what you need.", color: "bg-primary/10 text-primary" },
  { icon: Zap, title: "AI Prescription Parsing", desc: "Upload a photo of your prescription and our AI extracts every medicine with dosage and frequency in seconds.", color: "bg-ai/10 text-ai" },
  { icon: MapPin, title: "National Medicine Network", desc: "Access 18,000+ verified pharmacies across all 28 states and 8 UTs, all in one platform.", color: "bg-success/10 text-success" },
  { icon: Truck, title: "Doorstep Courier Delivery", desc: "Reserve medicines from pharmacies in any state and get them delivered to your address.", color: "bg-warning/10 text-warning" },
  { icon: Shield, title: "Verified & Trusted", desc: "Every pharmacy is CDSCO licensed and verified. Every medicine is genuine and expiry-checked.", color: "bg-destructive/10 text-destructive" },
  { icon: Clock, title: "Real-Time Availability", desc: "Live inventory updates ensure you're always seeing actual stock, not cached data.", color: "bg-primary/10 text-primary" },
];

const steps = [
  { step: "01", title: "Upload Prescription", desc: "Take a photo of your doctor's prescription and upload it. Our AI reads it instantly." },
  { step: "02", title: "AI Searches Near You", desc: "We check nearby pharmacies first — then city, district, state, and nationally if needed." },
  { step: "03", title: "Reserve & Pay Securely", desc: "Choose pickup or courier, reserve your medicines, and pay safely via UPI, card, or net banking." },
  { step: "04", title: "Collect or Receive", desc: "Show your QR code at the pharmacy, or wait for doorstep delivery with live tracking." },
];

const testimonials = [
  { name: "Dr. Ananya Sharma", role: "Cardiologist, Apollo Hospitals Mumbai", text: "Semenq has genuinely changed how my patients manage their medicines. For critical cardiac drugs that are often unavailable locally, this platform finds them nationally within minutes.", avatar: "AS", rating: 5 },
  { name: "Rajan Mehta", role: "Diabetes Patient, Pune", text: "I used to drive 30 km to find my Metformin when local stocks ran out. Now I just open Semenq, and it finds the nearest pharmacy with stock in under a minute.", avatar: "RM", rating: 5 },
  { name: "Priya Nair", role: "Pharmacy Owner, Bengaluru", text: "As a pharmacy, Semenq's demand forecasting has cut our dead stock by 40%. We know what to order before demand spikes.", avatar: "PN", rating: 5 },
];

const faqs = [
  { q: "Is Semenq free for patients?", a: "Yes, Semenq is completely free for patients to search, reserve, and track medicines. We charge a small service fee only on courier deliveries." },
  { q: "How does AI prescription parsing work?", a: "Our AI model, trained on millions of Indian prescriptions, reads your prescription image and extracts each medicine name, dosage, and frequency with a confidence score. You can review and edit before searching." },
  { q: "What if my medicine isn't available anywhere?", a: "Semenq searches all 18,000+ partner pharmacies across India. If your medicine is genuinely unavailable nationally, we alert you and show the nearest expected restock date." },
  { q: "Are the medicines genuine?", a: "Every pharmacy on Semenq is CDSCO licensed and has undergone our 12-point verification process. We don't allow grey-market or unverified sellers." },
  { q: "Can pharmacies join Semenq?", a: "Yes. Pharmacies can apply at semenq.in/pharmacy-signup. After CDSCO verification, you get full access to our inventory management, demand forecasting, and patient network." },
];

export default function Landing() {
  const [navOpen, setNavOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "glass shadow-lg py-3" : "py-5 bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-xl text-foreground">Semenq</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {["Features", "How it Works", "Pricing", "For Pharmacies"].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {item}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="rounded-[18px] px-5">Get Started</Button>
            </Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setNavOpen(!navOpen)}>
            {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {navOpen && (
          <div className="md:hidden glass mt-2 mx-4 rounded-2xl p-4 space-y-3">
            {["Features", "How it Works", "For Pharmacies"].map(item => (
              <a key={item} href="#" className="block text-sm font-medium py-1.5 text-muted-foreground" onClick={() => setNavOpen(false)}>{item}</a>
            ))}
            <div className="flex gap-2 pt-2">
              <Link href="/login"><Button variant="outline" size="sm" className="flex-1">Log in</Button></Link>
              <Link href="/register"><Button size="sm" className="flex-1 rounded-[18px]">Get Started</Button></Link>
            </div>
          </div>
        )}
      </nav>

      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-ai/8 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20">
                <Zap className="w-3.5 h-3.5" />
                AI-Powered Medicine Accessibility
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6"
            >
              No patient should{" "}
              <span className="gradient-text">struggle to find</span>{" "}
              prescribed medicines.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Semenq intelligently searches 18,000+ pharmacies — from your street to all of India — to find your medicines. Upload a prescription, find stock, reserve, and get delivered.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/register">
                <Button size="lg" className="rounded-[18px] px-8 h-14 text-base font-semibold gap-2 shadow-lg shadow-primary/25">
                  Find My Medicines
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/register?role=pharmacy">
                <Button variant="outline" size="lg" className="rounded-[18px] px-8 h-14 text-base font-semibold">
                  Join as Pharmacy
                </Button>
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-20 max-w-2xl mx-auto"
          >
            <div className="bg-card border border-card-border rounded-[28px] p-8 shadow-2xl">
              <p className="text-center text-sm font-medium text-muted-foreground mb-6">Searching for Metformin 500mg...</p>
              <div className="space-y-3">
                {[
                  { label: "Nearby (2 km)", status: "checking", color: "bg-primary" },
                  { label: "Andheri West", status: "found", color: "bg-success" },
                  { label: "Mumbai City", status: "standby", color: "bg-muted" },
                  { label: "Maharashtra", status: "standby", color: "bg-muted" },
                  { label: "All India", status: "standby", color: "bg-muted" },
                ].map((zone, i) => (
                  <div key={zone.label} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${zone.status === "found" ? "bg-success" : zone.status === "checking" ? "bg-primary animate-pulse" : "bg-border"}`} />
                    <div className={`flex-1 h-9 rounded-xl flex items-center px-4 text-sm font-medium transition-all ${zone.status === "found" ? "bg-success/10 text-success border border-success/20" : zone.status === "checking" ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted/40 text-muted-foreground"}`}>
                      {zone.label}
                      {zone.status === "found" && <span className="ml-auto text-success font-semibold">3 pharmacies found</span>}
                      {zone.status === "checking" && <span className="ml-auto text-primary">Searching...</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 bg-foreground/[0.02] border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { label: "Patients Helped", end: 2400000, suffix: "+" },
              { label: "Partner Pharmacies", end: 18000, suffix: "+" },
              { label: "Medicine Availability", end: 99, suffix: ".2%" },
              { label: "Average Rating", end: 4, suffix: ".8/5" },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-4xl font-bold text-foreground mb-1">
                  <AnimatedCounter end={stat.end} suffix={stat.suffix} />
                </div>
                <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl font-bold text-foreground mb-4"
            >
              Everything you need to find and get your medicines
            </motion.h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From AI-powered search to national courier delivery — Semenq handles every step of the medicine access journey.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-card border border-card-border rounded-[24px] p-6 card-lift"
                >
                  <div className={`w-12 h-12 rounded-2xl ${feature.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 bg-foreground/[0.02]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">From prescription to medicine in minutes</h2>
            <p className="text-lg text-muted-foreground">Four simple steps, completely guided by Semenq.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-primary/30 to-transparent z-0" />
                )}
                <div className="relative bg-card border border-card-border rounded-[24px] p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold text-primary">{step.step}</span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">Trusted by patients and pharmacies</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-card-border rounded-[24px] p-6 card-lift"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{t.avatar}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-foreground/[0.02]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-4">Frequently asked questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-card border border-card-border rounded-[20px] overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-foreground">{faq.q}</span>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="relative bg-gradient-to-br from-primary via-primary to-ai rounded-[28px] p-16 overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full blur-2xl" />
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full blur-2xl" />
            </div>
            <h2 className="text-4xl font-bold text-white mb-4 relative">Start finding your medicines today</h2>
            <p className="text-white/80 mb-8 text-lg relative">Join 2.4 million patients who never worry about medicine availability again.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center relative">
              <Link href="/register">
                <Button size="lg" variant="secondary" className="rounded-[18px] px-8 h-12 font-semibold">
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/register?role=pharmacy">
                <Button size="lg" variant="outline" className="rounded-[18px] px-8 h-12 font-semibold border-white/30 text-white hover:bg-white/10">
                  Register Your Pharmacy
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-foreground">Semenq</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">Connecting patients with medicines through intelligent technology.</p>
            </div>
            {[
              { title: "Platform", links: ["Find Medicines", "Upload Prescription", "Courier Delivery", "QR Pickup"] },
              { title: "For Pharmacies", links: ["Join Network", "Demand Forecasting", "Inventory Management", "Analytics"] },
              { title: "Company", links: ["About Semenq", "Careers", "Privacy Policy", "Terms of Service"] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="font-semibold text-foreground mb-3 text-sm">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map(link => (
                    <li key={link}><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-border gap-4">
            <p className="text-sm text-muted-foreground">© 2026 Semenq Technologies Pvt. Ltd. All rights reserved.</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>CDSCO Registered Platform</span>
              <span>·</span>
              <span>ISO 27001 Certified</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
