import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthGate } from "./AuthGate";
import { AuthProvider } from "./auth/AuthContext";
import { AccountMenu } from "./components/AccountMenu";
import { CommandPalette } from "./components/CommandPalette";
import {
  IconBookmark,
  IconBriefcase,
  IconChat,
  IconChevronLeft,
  IconChevronRight,
  IconClipboard,
  IconClose,
  IconCode,
  IconDashboard,
  IconDocument,
  IconGear,
  IconMenu,
  IconNexus,
  IconSearch,
  IconStar,
  IconTarget,
} from "./components/Icons";
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

// ── Sidebar Context ────────────────────────────────────────────────────────────

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({ collapsed: false, toggle: () => {} });

function useSidebar() { return useContext(SidebarContext); }

function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("nexus:sidebar:collapsed") === "true"; } catch { return false; }
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("nexus:sidebar:collapsed", String(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

// ── Navigation structure ───────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Overview", icon: <IconDashboard className="h-4 w-4 shrink-0" />, end: true },
    ],
  },
  {
    label: "Career Discovery",
    items: [
      { to: "/opportunities", label: "Job Discovery",         icon: <IconBriefcase className="h-4 w-4 shrink-0" /> },
      { to: "/saved",         label: "Saved Opportunities",   icon: <IconBookmark  className="h-4 w-4 shrink-0" /> },
      { to: "/applications",  label: "Applications",          icon: <IconClipboard className="h-4 w-4 shrink-0" /> },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/repositories", label: "GitHub Evidence",        icon: <IconCode   className="h-4 w-4 shrink-0" /> },
      { to: "/development",  label: "Role & Gap Analysis",    icon: <IconTarget className="h-4 w-4 shrink-0" /> },
      { to: "/skills",       label: "Skill Intelligence",     icon: <IconStar   className="h-4 w-4 shrink-0" /> },
    ],
  },
  {
    label: "AI & Personalization",
    items: [
      { to: "/copilot",    label: "Career Copilot",    icon: <IconChat     className="h-4 w-4 shrink-0" /> },
      { to: "/resume",     label: "My Career Profile", icon: <IconDocument className="h-4 w-4 shrink-0" /> },
      { to: "/settings",   label: "Settings",          icon: <IconGear     className="h-4 w-4 shrink-0" /> },
    ],
  },
];

// ── Sidebar navigation ─────────────────────────────────────────────────────────

function NavTooltip({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (!collapsed) return null;
  return (
    <span
      role="tooltip"
      className={[
        "pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50",
        "whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1",
        "text-xs font-medium text-slate-800 shadow-lg",
        "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        "transition-opacity duration-100",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function SidebarNav({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { collapsed } = useSidebar();

  return (
    <nav aria-label="Primary navigation" className="flex flex-col gap-0.5 px-2 py-2">
      {NAV_GROUPS.map((group, groupIndex) => (
        <div key={groupIndex} className={groupIndex > 0 ? "mt-4" : ""}>
          {/* Group label — hidden when collapsed */}
          {group.label && !collapsed ? (
            <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
              {group.label}
            </p>
          ) : group.label && collapsed ? (
            <div className="mb-1 mx-auto h-px w-6 bg-slate-200" aria-hidden="true" />
          ) : null}

          {group.items.map((item) => {
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname === item.to ||
                location.pathname.startsWith(item.to + "/");

            return (
              <div key={item.to} className="relative group">
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  aria-label={collapsed ? item.label : undefined}
                  className={[
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700",
                    collapsed ? "justify-center px-2" : "px-3",
                    isActive
                      ? "bg-indigo-100 text-indigo-900 shadow-[inset_3px_0_0_oklch(81%_0.195_86)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")}
                >
                  <span className={isActive ? "text-indigo-700" : "text-slate-400"}>
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
                <NavTooltip label={item.label} collapsed={collapsed} />
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// ── Brand mark ─────────────────────────────────────────────────────────────────

function NexusBrand({ compact = false }: { compact?: boolean }) {
  const { collapsed } = useSidebar();
  if (collapsed) {
    return (
      <span className="text-indigo-700 shrink-0">
        <IconNexus className="h-6 w-6" />
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-indigo-700 shrink-0">
        <IconNexus className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </span>
      <div>
        <p
          className="font-display text-slate-900 leading-tight"
          style={{ fontSize: compact ? "0.9rem" : "1rem", letterSpacing: "-0.02em" }}
        >
          NEXUS
        </p>
        <p className="text-[9px] leading-tight text-slate-500">
          GitHub Evidence Engine
        </p>
      </div>
    </div>
  );
}

// ── Mobile header ──────────────────────────────────────────────────────────────

function MobileHeader({
  onMenuOpen,
  onCommandOpen,
}: {
  onMenuOpen: () => void;
  onCommandOpen: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
      <div className="flex items-center gap-2.5">
        <span className="text-indigo-700 shrink-0">
          <IconNexus className="h-5 w-5" />
        </span>
        <p className="font-display text-slate-900" style={{ fontSize: "0.95rem", letterSpacing: "-0.02em" }}>
          NEXUS
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onCommandOpen}
          aria-label="Open command palette"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 transition-colors"
        >
          <IconSearch className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label="Open navigation menu"
          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 transition-colors"
        >
          <IconMenu className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

// ── Mobile drawer ──────────────────────────────────────────────────────────────

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
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute left-0 top-0 h-full w-64 overflow-y-auto bg-white shadow-2xl border-r border-slate-200"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <span className="text-indigo-700 shrink-0">
              <IconNexus className="h-5 w-5" />
            </span>
            <p className="font-display text-slate-900" style={{ fontSize: "0.95rem", letterSpacing: "-0.02em" }}>
              NEXUS
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 transition-colors"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        {/* Nav (never collapsed in mobile drawer) */}
        <SidebarContextOverride collapsed={false}>
          <SidebarNav onClose={onClose} />
        </SidebarContextOverride>
        <div className="border-t border-slate-200 px-3 py-3">
          <AccountMenu />
        </div>
      </div>
    </div>
  );
}

// Helper: override the sidebar context for mobile drawer (always expanded)
function SidebarContextOverride({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  const { toggle } = useSidebar();
  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

// ── Desktop sidebar ────────────────────────────────────────────────────────────

function DesktopSidebar({ onCommandOpen }: { onCommandOpen: () => void }) {
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      aria-label="Sidebar"
      style={{ position: "sticky", top: 0, height: "100vh" }}
      className={[
        "hidden shrink-0 flex-col border-r border-slate-200 bg-white lg:flex",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-14" : "w-56",
      ].join(" ")}
    >
      {/* Brand */}
      <div
        className={[
          "border-b border-slate-200 py-4",
          collapsed ? "flex justify-center px-2" : "px-4",
        ].join(" ")}
      >
        <NexusBrand />
      </div>

      {/* Command palette trigger */}
      {!collapsed ? (
        <div className="px-2 pt-2 pb-0">
          <button
            type="button"
            onClick={onCommandOpen}
            aria-label="Open command palette (Ctrl+K)"
            className={[
              "flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-left",
              "text-xs text-slate-400 hover:border-slate-300 hover:bg-slate-50",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 transition-colors",
            ].join(" ")}
          >
            <IconSearch className="h-3 w-3 shrink-0" />
            <span className="flex-1">Go to…</span>
            <kbd className="rounded border border-slate-200 px-1 py-px text-[10px] font-mono">⌘K</kbd>
          </button>
        </div>
      ) : (
        <div className="relative group pt-2 pb-0 flex justify-center">
          <button
            type="button"
            onClick={onCommandOpen}
            aria-label="Open command palette"
            className={[
              "flex items-center justify-center rounded-lg p-2 text-slate-400",
              "hover:bg-slate-100 hover:text-slate-600 focus:outline-none",
              "focus-visible:ring-2 focus-visible:ring-indigo-700 transition-colors",
            ].join(" ")}
          >
            <IconSearch className="h-4 w-4" />
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-100"
          >
            Command palette
          </span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-1">
        <SidebarNav />
      </div>

      {/* Account footer */}
      <div className={`border-t border-slate-200 ${collapsed ? "px-1 py-2" : "px-3 py-3"}`}>
        {collapsed ? (
          <div className="relative group flex justify-center">
            <div className="w-8 h-8">
              <AccountMenu compact />
            </div>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-100"
            >
              Account
            </span>
          </div>
        ) : (
          <AccountMenu />
        )}
      </div>

      {/* Collapse toggle */}
      <div className={`border-t border-slate-100 ${collapsed ? "flex justify-center py-2" : "px-3 py-2"}`}>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={[
            "flex items-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-slate-400",
            "hover:bg-slate-100 hover:text-slate-600 focus:outline-none",
            "focus-visible:ring-2 focus-visible:ring-indigo-700 transition-colors",
            collapsed ? "px-2 justify-center" : "px-3",
          ].join(" ")}
        >
          {collapsed ? (
            <IconChevronRight className="h-3.5 w-3.5" />
          ) : (
            <>
              <IconChevronLeft className="h-3.5 w-3.5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global keyboard shortcut for command palette
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
      {/* ── Public landing page ──────────────────────────────────────────────── */}
      <Route path="/" element={<LandingPage />} />

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
              <MobileHeader
                onMenuOpen={() => setDrawerOpen(true)}
                onCommandOpen={() => setPaletteOpen(true)}
              />
              <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

              <main
                id="main-content"
                className="mx-auto w-full max-w-5xl flex-1 overflow-x-clip px-4 py-6 sm:px-6"
              >
                <AuthGate>
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
                </AuthGate>
              </main>
            </div>

            {/* Global command palette — rendered outside the sidebar/main split */}
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
        className="font-display text-slate-800 tabular-nums"
        style={{ fontSize: "5rem", lineHeight: 1, letterSpacing: "-0.025em" }}
      >
        404
      </p>
      <p className="mt-3 text-base text-slate-600">Page not found.</p>
      <Link
        to="/dashboard"
        className="mt-6 inline-flex items-center rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
        style={{ color: "var(--color-indigo-950)" }}
      >
        Go to Overview
      </Link>
    </div>
  );
}
