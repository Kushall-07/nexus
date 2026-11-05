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
        <div key={groupIndex} className={groupIndex > 0 ? "mt-4" : ""}>
          {group.label ? (
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")}
              >
                {item.icon}
                {item.label}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function MobileHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
      <div className="flex items-center gap-2.5">
        <span className="text-indigo-700">
          <IconNexus className="h-7 w-7" />
        </span>
        <div>
          <p className="text-sm font-bold leading-tight tracking-tight text-slate-900">NEXUS</p>
          <p className="text-xs leading-tight text-slate-500">Career Copilot · GitHub Evidence Engine</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onMenuOpen}
        aria-label="Open navigation menu"
        className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
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
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={ref}
        className="absolute left-0 top-0 h-full w-64 overflow-y-auto bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-indigo-700">
              <IconNexus className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm font-bold leading-tight tracking-tight text-slate-900">NEXUS</p>
              <p className="text-xs leading-tight text-slate-500">Career Copilot · GitHub Evidence Engine</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
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
    <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex" style={{ position: "sticky", top: 0, height: "100vh" }}>
      <div className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <span className="text-indigo-700">
            <IconNexus className="h-7 w-7" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight tracking-tight text-slate-900">NEXUS</p>
            <p className="text-xs leading-tight text-slate-500">Career Copilot · GitHub Evidence Engine</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
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
      <DesktopSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <MobileHeader onMenuOpen={() => setDrawerOpen(true)} />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
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
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-4xl font-bold text-slate-800">404</p>
      <p className="mt-2 text-slate-600">Page not found.</p>
      <a href="/dashboard" className="mt-4 inline-block rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800">
        Go to Dashboard
      </a>
    </div>
  );
}
