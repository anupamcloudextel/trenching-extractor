"use client";
import { useEffect, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import msalConfig from "@/msalConfig";

export default function MsalProviderWrapper({ children }: { children: React.ReactNode }) {
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
  const [redirectHandled, setRedirectHandled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const init = async () => {
      const instance = new PublicClientApplication(msalConfig);
      await instance.initialize();

      // Critical: handle OAuth redirect when popup returns with #code=...
      // Without this, the popup shows the login page again instead of completing login
      try {
        const result = await instance.handleRedirectPromise();
        if (result && window.opener) {
          setRedirectHandled(true);
          setMsalInstance(instance);
          // Close popup so opener's loginPopup() resolves and app shows logged-in state
          window.close();
          return;
        }
      } catch (err) {
        console.error("[MSAL] handleRedirectPromise error", err);
      } finally {
        setRedirectHandled(true);
      }

      setMsalInstance(instance);
    };

    init();
  }, []);

  if (!msalInstance || !redirectHandled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
