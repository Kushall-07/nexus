import { useEffect, useRef, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AuthGate } from "./AuthGate";
import { AuthProvider } from "./auth/AuthContext";
import { AccountMenu } from "./components/AccountMenu";
import {
  IconBriefcase,
  IconChat,
  IconClipboard,
  IconClose,
  IconCode,
  IconDashboard,
  IconDocument,
  IconGear,
  IconMenu,
  IconNexus,
  IconSliders,
  IconStar,
  IconTarget,
  IconTrendingUp,
} from "./components/Icons";
import { ApplicationsPage } from "./features/career/ApplicationsPage";
import { CopilotPage } from "./features/career/CopilotPage";
import { DashboardPage } from "./features/career/DashboardPage";
import { DevelopmentPage } from "./features/career/DevelopmentPage";
import { OpportunitiesRoute } from "./features/career/OpportunitiesRoute";
import { PreferencesPage } from "./features/career/PreferencesPage";
import { ResumePage } from "./features/career/ResumePage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { RepositoriesPage } from "./features/repositories/RepositoriesPage";
import { RolesPage } from "./features/roles/RolesPage";
import { SkillDetailPage } from "./features/skills/SkillDetailPage";
import { SkillOverviewPage } from "./features/skills/SkillOverviewPage";

interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", icon: <IconDashboard className="h-4 w-4 shrink-0" /> },
    ],
  },
  {
    label: "Career",
    items: [
      { to: "/opportunities", label: "Opportunities", icon: <IconBriefcase className="h-4 w-4 shrink-0" /> },
      { to: "/applications", label: "Applications", icon: <IconClipboard className="h-4 w-4 shrink-0" /> },
      { to: "/development", label: "Development", icon: <IconTrendingUp className="h-4 w-4 shrink-0" /> },
      { to: "/copilot", label: "Copilot", icon: <IconChat className="h-4 w-4 shrink-0" /> },
    ],
  },
  {
    label: "Profile",
    items: [
      { to: "/", label: "Skills", icon: <IconStar className="h-4 w-4 shrink-0" />, end: true },
      { to: "/resume", label: "Resume", icon: <IconDocument className="h-4 w-4 shrink-0" /> },
      { to: "/repositories", label: "Repositories", icon: <IconCode className="h-4 w-4 shrink-0" /> },
      { to: "/roles", label: "Target role", icon: <IconTarget className="h-4 w-4 shrink-0" /> },
      { to: "/preferences", label: "Preferences", icon: <IconSliders className="h-4 w-4 shrink-0" /> },
    ],
  },
  {
    items: [
      { to: "/settings", label: "Settings", icon: <IconGear className="h-4 w-4 shrink-0" /> },
    ],
  },
];

function SidebarNav({ onClose }: { onClose?: () => void }) {
  const location = useLocation();

  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5 px-2 py-2">
      {NAV_GROUPS.map((group, groupIndex) => (
        <div key={groupIndex} className={groupIndex > 0 ? "mt-5" : ""}>
          {group.label ? (
            <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => {
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(item.to + "/");

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={[
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-100",
                  isActive
                    ? "bg-indigo-100 text-indigo-900"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800",
                ].join(" ")}
              >
                <span className={isActive ? "text-indigo-700" : "text-slate-400"}>
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function NexusBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-indigo-700 shrink-0">
        <IconNexus className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </span>
      <div>
        <p
          className="font-display text-slate-900 leading-tight"
          style={{
            fontSize: compact ? "0.9rem" : "1rem",
            letterSpacing: "-0.02em",
          }}
        >
          NEXUS
        </p>
        <p className="text-[9px] leading-tight text-slate-500">
          Career Copilot · GitHub Evidence Engine
        </p>
      </div>
    </div>
  );
}

function MobileHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
      <NexusBrand />
      <button
        type="button"
        onClick={onMenuOpen}
        aria-label="Open navigation menu"
        className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 transition-colors"
      >
        <IconMenu className="h-5 w-5" />
      </button>
    </header>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const container = ref.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handler);
    const firstFocusable = ref.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled])',
    );
    firstFocusable?.focus();
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute left-0 top-0 h-full w-64 overflow-y-auto bg-white shadow-2xl border-r border-slate-200"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
          <NexusBrand />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 transition-colors"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        <SidebarNav onClose={onClose} />
        <div className="border-t border-slate-200 px-3 py-3">
          <AccountMenu />
        </div>
      </div>
    </div>
  );
}

function DesktopSidebar() {
  return (
    <aside
      className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex"
      style={{ position: "sticky", top: 0, height: "100vh" }}
    >
      {/* Brand mark */}
      <div className="px-4 py-5 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <span className="text-indigo-700 shrink-0">
            <IconNexus className="h-6 w-6" />
          </span>
          <div>
            <p
              className="font-display text-slate-900 leading-tight"
              style={{ fontSize: "1.05rem", letterSpacing: "-0.02em" }}
            >
              NEXUS
            </p>
            <p className="text-[9px] leading-tight text-slate-500">
              Career Copilot · GitHub Evidence Engine
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-1">
        <SidebarNav />
      </div>

      {/* Account footer */}
      <div className="border-t border-slate-200 px-3 py-3">
        <AccountMenu />
      </div>
    </aside>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 lg:flex-row">
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      <DesktopSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <MobileHeader onMenuOpen={() => setDrawerOpen(true)} />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <main
          id="main-content"
          className="mx-auto w-full max-w-5xl flex-1 overflow-x-clip px-4 py-6 sm:px-6"
        >
          <AuthGate>
            <Routes>
              <Route path="/" element={<SkillOverviewPage />} />
              <Route path="/skills/:skillId" element={<SkillDetailPage />} />
              <Route path="/repositories" element={<RepositoriesPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/opportunities" element={<OpportunitiesRoute />} />
              <Route path="/copilot" element={<CopilotPage />} />
              <Route path="/applications" element={<ApplicationsPage />} />
              <Route path="/resume" element={<ResumePage />} />
              <Route path="/development" element={<DevelopmentPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/preferences" element={<PreferencesPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthGate>
        </main>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p
        className="font-display text-slate-800 tabular-nums"
        style={{ fontSize: "5rem", lineHeight: 1, letterSpacing: "-0.025em" }}
      >
        404
      </p>
      <p className="mt-3 text-base text-slate-600">Page not found.</p>
      <a
        href="/dashboard"
        className="mt-6 inline-flex items-center rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
        style={{ color: "oklch(5.5% 0.009 265)" }}
      >
        Go to Dashboard
      </a>
    </div>
  );
}
