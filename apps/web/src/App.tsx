import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthGate } from "./AuthGate";
import { AuthProvider } from "./auth/AuthContext";
import { CommandPalette } from "./components/CommandPalette";
import { NexusDock } from "./features/nexus/NexusDock";
import { NexusProvider } from "./features/nexus/NexusProvider";
import { DesktopSidebar, MobileTopBar, SidebarProvider } from "./components/sidebar/AppSidebar";
import { ToastProvider } from "./context/ToastContext";
import { ApplicationsPage } from "./features/career/ApplicationsPage";
import { CopilotPage } from "./features/career/CopilotPage";
import { DashboardPage } from "./features/career/DashboardPage";
import { DevelopmentPage } from "./features/career/DevelopmentPage";
import { OpportunitiesRoute } from "./features/career/OpportunitiesRoute";
import { PreferencesPage } from "./features/career/PreferencesPage";
import { ResumePage } from "./features/career/ResumePage";
import { SavedOpportunitiesPage } from "./features/career/SavedOpportunitiesPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { RepositoriesPage } from "./features/repositories/RepositoriesPage";
import { RolesPage } from "./features/roles/RolesPage";
import { SkillDetailPage } from "./features/skills/SkillDetailPage";
import { SkillOverviewPage } from "./features/skills/SkillOverviewPage";
import { LandingPage } from "./pages/landing/LandingPage";
import { SignInPage } from "./pages/signin/SignInPage";

// ── Root App component ─────────────────────────────────────────────────────────

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SidebarProvider>
          <AppShell />
        </SidebarProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <Routes>
      {/* ── Public pages ─────────────────────────────────────────────────────── */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SignInPage />} />

      {/* ── Authenticated application shell ─────────────────────────────────── */}
      <Route
        path="/*"
        element={
          <div className="flex min-h-screen bg-slate-50 text-slate-900 lg:flex-row">
            <a href="#main-content" className="skip-to-main">
              Skip to main content
            </a>

            <DesktopSidebar onCommandOpen={() => setPaletteOpen(true)} />

            <div className="flex flex-1 flex-col min-w-0">
              <MobileTopBar onCommandOpen={() => setPaletteOpen(true)} />

              <main
                id="main-content"
                className="mx-auto w-full max-w-5xl flex-1 overflow-x-clip px-4 py-6 sm:px-6 lg:py-8"
              >
                <AuthGate>
                  <NexusProvider>
                  <Routes>
                    <Route path="/skills"              element={<SkillOverviewPage />} />
                    <Route path="/skills/:skillId"     element={<SkillDetailPage />} />
                    <Route path="/repositories"        element={<RepositoriesPage />} />
                    <Route path="/roles"               element={<RolesPage />} />
                    <Route path="/dashboard"           element={<DashboardPage />} />
                    <Route path="/opportunities"       element={<OpportunitiesRoute />} />
                    <Route path="/saved"               element={<SavedOpportunitiesPage />} />
                    <Route path="/copilot"             element={<CopilotPage />} />
                    <Route path="/applications"        element={<ApplicationsPage />} />
                    <Route path="/resume"              element={<ResumePage />} />
                    <Route path="/development"         element={<DevelopmentPage />} />
                    <Route path="/settings"            element={<SettingsPage />} />
                    <Route path="/preferences"         element={<PreferencesPage />} />
                    <Route path="/"                    element={<Navigate to="/dashboard" replace />} />
                    <Route path="*"                    element={<NotFound />} />
                  </Routes>
                  <NexusDock />
                  </NexusProvider>
                </AuthGate>
              </main>
            </div>

            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
          </div>
        }
      />
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p
        className="font-display text-slate-200 tabular-nums"
        style={{ fontSize: "8rem", lineHeight: 1, letterSpacing: "-0.025em" }}
        aria-hidden="true"
      >
        404
      </p>
      <p
        className="font-display text-slate-800 -mt-2 tabular-nums"
        style={{ fontSize: "2rem", lineHeight: 1, letterSpacing: "-0.025em" }}
      >
        Page not found.
      </p>
      <p className="mt-3 text-sm text-slate-500">The page you're looking for doesn't exist.</p>
      <Link
        to="/dashboard"
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-6 py-3 text-sm font-semibold transition-all hover:bg-indigo-600 hover:shadow-[0_4px_14px_oklch(30%_0.065_192_/_0.22)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
        style={{ color: "var(--color-indigo-950)" }}
      >
        Go to Overview
      </Link>
    </div>
  );
}
