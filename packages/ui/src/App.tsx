import { useEffect, useState } from "react";
import type { LicenseStatus } from "@vyapar/api-client";
import { api, loadToken, saveToken, saveTenant, clearToken } from "./lib/api";
import { Onboarding } from "./screens/Onboarding";
import { LicenseGate } from "./screens/LicenseGate";
import { Shell } from "./screens/Shell";

type Phase =
  | { kind: "loading" }
  | { kind: "onboarding" }
  | { kind: "license-gate"; status: LicenseStatus }
  | { kind: "app"; status: LicenseStatus };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    const token = loadToken();
    if (!token) {
      setPhase({ kind: "onboarding" });
      return;
    }
    try {
      const status = await api.getLicenseStatus();
      if (status.state === "trial_expired" || status.state === "license_expired") {
        setPhase({ kind: "license-gate", status });
      } else {
        setPhase({ kind: "app", status });
      }
    } catch {
      clearToken();
      setPhase({ kind: "onboarding" });
    }
  }

  async function handleRegistered(token: string, tenant: unknown) {
    saveToken(token);
    saveTenant(tenant);
    const status = await api.getLicenseStatus();
    setPhase({ kind: "app", status });
  }

  async function handleLicenseActivated(status: LicenseStatus) {
    setPhase({ kind: "app", status });
  }

  function handleLogout() {
    clearToken();
    setPhase({ kind: "onboarding" });
  }

  if (phase.kind === "loading") return <SplashScreen />;
  if (phase.kind === "onboarding") return <Onboarding onRegistered={handleRegistered} />;
  if (phase.kind === "license-gate")
    return <LicenseGate status={phase.status} onActivated={handleLicenseActivated} onLogout={handleLogout} />;
  return (
    <Shell
      status={phase.status}
      onLogout={handleLogout}
      onLicenseActivated={handleLicenseActivated}
    />
  );
}

function SplashScreen() {
  return (
    <div className="splash">
      <div className="splash__logo">V</div>
      <p>Vyapar Pakistan</p>
    </div>
  );
}
