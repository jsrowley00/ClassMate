import { createRoot } from "react-dom/client";
import { ClerkProvider, ClerkLoaded, ClerkLoading } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider 
    publishableKey={PUBLISHABLE_KEY}
    signInFallbackRedirectUrl="/"
    signUpFallbackRedirectUrl="/"
  >
    <ClerkLoading>
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    </ClerkLoading>
    <ClerkLoaded>
      <App />
    </ClerkLoaded>
  </ClerkProvider>
);
