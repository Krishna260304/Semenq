import { Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import PatientDashboard from "@/pages/patient/Dashboard";
import MedicineSearch from "@/pages/patient/MedicineSearch";
import PrescriptionUpload from "@/pages/patient/PrescriptionUpload";
import Reserve from "@/pages/patient/Reserve";
import Orders from "@/pages/patient/Orders";
import OrderDetail from "@/pages/patient/OrderDetail";
import Prescriptions from "@/pages/patient/Prescriptions";
import Profile from "@/pages/patient/Profile";
import PharmacyDashboard from "@/pages/pharmacy/Dashboard";
import Inventory from "@/pages/pharmacy/Inventory";
import PharmacyReservations from "@/pages/pharmacy/Reservations";
import DemandForecast from "@/pages/pharmacy/DemandForecast";
import PharmacyAnalytics from "@/pages/pharmacy/Analytics";
import PharmacyProfile from "@/pages/pharmacy/Profile";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminPharmacies from "@/pages/admin/Pharmacies";
import AdminMedicines from "@/pages/admin/Medicines";
import AdminProfile from "@/pages/admin/Profile";
import { Toaster } from "@/components/ui/sonner";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useAuth } from "@/lib/auth-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      // Exponential backoff: 300 ms → 600 ms → 1.2 s — avoids hammering the API on errors
      retryDelay: (attempt) => Math.min(300 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: false,
      // 5 minutes — prevents redundant re-fetches on every navigation
      staleTime: 5 * 60 * 1000,
      // Keep data in memory for 10 minutes after component unmounts
      gcTime: 10 * 60 * 1000,
      networkMode: "always",
    },
    mutations: {
      retry: 1,
      retryDelay: 500,
    },
  },
});

function Router() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
          Loading Semenq...
        </div>
      }
    >
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />

        <Route path="/patient/dashboard" component={PatientDashboard} />
        <Route path="/patient/search" component={MedicineSearch} />
        <Route path="/patient/prescription" component={PrescriptionUpload} />
        <Route path="/patient/prescriptions" component={Prescriptions} />
        <Route path="/patient/reserve/:medicineId" component={Reserve} />
        <Route path="/patient/orders" component={Orders} />
        <Route path="/patient/orders/:id" component={OrderDetail} />
        <Route path="/patient/profile" component={Profile} />

        <Route path="/pharmacy/dashboard" component={PharmacyDashboard} />
        <Route path="/pharmacy/inventory" component={Inventory} />
        <Route path="/pharmacy/reservations" component={PharmacyReservations} />
        <Route path="/pharmacy/demand" component={DemandForecast} />
        <Route path="/pharmacy/analytics" component={PharmacyAnalytics} />
        <Route path="/pharmacy/profile" component={PharmacyProfile} />

        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/pharmacies" component={AdminPharmacies} />
        <Route path="/admin/medicines" component={AdminMedicines} />
        <Route path="/admin/profile" component={AdminProfile} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const { loading: authLoading } = useAuth();
  useRealtimeRefresh(queryClient);

  useEffect(() => {
    if (!authLoading) {
      queryClient.invalidateQueries();
    }
  }, [authLoading]);

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
