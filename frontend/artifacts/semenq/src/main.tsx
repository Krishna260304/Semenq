import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { auth } from "./lib/firebase";
import { AuthProvider } from "./lib/auth-context";
import { onAuthStateChanged } from "firebase/auth";

// In development this stays same-origin and Vite proxies /api. Production can
// set VITE_API_BASE_URL without rebuilding generated clients.
setBaseUrl(import.meta.env.VITE_API_BASE_URL || null);

// Wait for Firebase to restore auth state from localStorage before resolving.
// This prevents the first API call from firing before auth.currentUser is set.
const authReady = new Promise<void>((resolve) => {
  const unsub = onAuthStateChanged(auth, () => {
    resolve();
    unsub();
  });
});

setAuthTokenGetter(async () => {
  await authReady;
  const user = auth.currentUser;
  if (!user) return null;
  // Firebase refreshes an expired token itself. Forcing a refresh for every
  // request was creating unnecessary network failures and slow navigation.
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
});

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
