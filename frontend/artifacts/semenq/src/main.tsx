import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { auth } from "./lib/firebase";
import { AuthProvider } from "./lib/auth-context";

// Generated API clients already emit `/api/...` paths, so the transport should
// stay root-relative to avoid double-prefixing requests like `/api/api/...`.
setBaseUrl(null);

setAuthTokenGetter(async () => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
});

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
