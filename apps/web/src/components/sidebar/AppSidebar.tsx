/**
 * App sidebar — built from the shadcn "Sidenavbar" + "Navbar" patterns:
 *   - Desktop: collapsible rail (w-64 ⇄ w-[4.5rem]) with a ScrollArea and Collapsible nav groups
 *   - Mobile / tablet: a Sheet (slide-over) opened from the top bar
 * Styled with the NEXUS palette. The accessibility contract the tests rely on is unchanged:
 * a "Primary navigation" landmark, links named exactly by their label, "Open/Close navigation menu".
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bookmark,
  Briefcase,
  ChevronDown,
  ClipboardList,
  FileText,
  GitBranch,
  LayoutDashboard,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";

import { AccountMenu } from "@/components/AccountMenu";
import { IconNexus } from "@/components/Icons";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// ── Collapsed state (persisted) ───────────────────────────────────────────────

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({ collapsed: false, toggle: () => {} });

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("nexus:sidebar:collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("nexus:sidebar:collapsed", String(next));
      } catch {
        /* storage unavailable — keep in-memory state */
      }
      return next;
    });
  }, []);

  return <SidebarContext.Provider value={{ collapsed, toggle }}>{children}</SidebarContext.Provider>;
}

// ── Navigation structure ──────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [{ to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true }],
  },
  {
    id: "discovery",
    label: "Career Discovery",
    items: [
      { to: "/opportunities", label: "Job Discovery", icon: Briefcase },
      { to: "/saved", label: "Saved Opportunities", icon: Bookmark },
      { to: "/applications", label: "Applications", icon: ClipboardList },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { to: "/repositories", label: "GitHub Evidence", icon: GitBranch },
      { to: "/development", label: "Role & Gap Analysis", icon: Target },
      { to: "/skills", label: "Skill Intelligence", icon: Sparkles },
    ],
  },
  {
    id: "profile",
    label: "AI & Profile",
    items: [
      { to: "/copilot", label: "Career Copilot", icon: MessageSquare },
      { to: "/resume", label: "My Career Profile", icon: FileText },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

// ── Small pieces ──────────────────────────────────────────────────────────────

/** Hover/focus label shown beside an icon-only control when the rail is collapsed. */
function RailTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap",
        "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-lg",
        "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
      )}
    >
      {label}
    </span>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-700 text-[var(--color-indigo-950)] shadow-[0_6px_16px_-6px_rgba(14,79,74,0.6)]">
        <IconNexus className="h-5 w-5" />
      </span>
      {!collapsed && (
        <div className="min-w-0">
          <p className="font-display leading-none text-slate-900" style={{ fontSize: "1.15rem", letterSpacing: "-0.02em" }}>
            NEXUS
          </p>
          <p className="mt-1 text-[10px] leading-none tracking-wide text-slate-400">Career Intelligence</p>
        </div>
      )}
    </div>
  );
}

function NavRow({
  item,
  active,
  collapsed,
  idPrefix,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  idPrefix: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <div className="group relative">
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        aria-label={collapsed ? item.label : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-xl py-1.5 text-sm font-medium",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700",
          collapsed ? "justify-center px-0" : "px-2",
          active ? "text-slate-900" : "text-slate-600 hover:text-slate-900",
        )}
      >
        {/* Sliding active plate */}
        {active && (
          <motion.span
            layoutId={`${idPrefix}-active-plate`}
            aria-hidden="true"
            className="absolute inset-0 rounded-xl bg-white ring-1 ring-indigo-200/80 shadow-[0_8px_20px_-10px_rgba(14,79,74,0.55)]"
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          />
        )}
        {!active && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-xl bg-indigo-50/0 transition-colors duration-200 group-hover:bg-indigo-50/80"
          />
        )}
        <span
          aria-hidden="true"
          className={cn(
            "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
            active
              ? "bg-indigo-700 text-[var(--color-indigo-950)] shadow-[0_6px_14px_-6px_rgba(14,79,74,0.7)]"
              : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-indigo-700 group-hover:shadow-sm",
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
        </span>
        {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
      </NavLink>
      {collapsed && <RailTooltip label={item.label} />}
    </div>
  );
}

function NavGroupSection({
  group,
  collapsed,
  idPrefix,
  onNavigate,
}: {
  group: NavGroup;
  collapsed: boolean;
  idPrefix: string;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(true);

  const rows = group.items.map((item) => {
    const active = item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
    return <NavRow key={item.to} item={item} active={active} collapsed={collapsed} idPrefix={idPrefix} onNavigate={onNavigate} />;
  });

  // Collapsed rail: no group labels, just a hairline between groups.
  if (collapsed) {
    return <div className="flex flex-col gap-1">{rows}</div>;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "group/label flex w-full items-center justify-between rounded-md px-2 py-1.5",
          "text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 transition-colors hover:text-indigo-700",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700",
        )}
      >
        {group.label}
        <ChevronDown
          aria-hidden="true"
          className="h-3 w-3 transition-transform duration-200 group-data-[state=closed]/label:-rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 flex flex-col gap-1">{rows}</CollapsibleContent>
    </Collapsible>
  );
}

function SidebarNav({
  collapsed,
  idPrefix,
  onNavigate,
}: {
  collapsed: boolean;
  idPrefix: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Primary navigation" className={cn("flex flex-col py-2", collapsed ? "gap-2 px-3" : "gap-4 px-3")}>
      {NAV_GROUPS.map((group, i) => (
        <div key={group.id}>
          {collapsed && i > 0 && <Separator className="mx-auto mb-2 w-6 bg-slate-200/80" />}
          <NavGroupSection group={group} collapsed={collapsed} idPrefix={idPrefix} onNavigate={onNavigate} />
        </div>
      ))}
    </nav>
  );
}

function CommandTrigger({ collapsed, onOpen }: { collapsed: boolean; onOpen: () => void }) {
  if (collapsed) {
    return (
      <div className="group relative flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpen}
          aria-label="Open command palette"
          className="h-10 w-10 rounded-xl text-slate-500 hover:text-indigo-700"
        >
          <Search className="h-[18px] w-[18px]" aria-hidden="true" />
        </Button>
        <RailTooltip label="Search or navigate" />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open command palette (Ctrl+K)"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-left text-xs text-slate-400",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all hover:border-indigo-200 hover:bg-white hover:text-slate-600 hover:shadow-sm",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700",
      )}
    >
      <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="flex-1">Search or navigate…</span>
      <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-px font-mono text-[9px] text-slate-400">⌘K</kbd>
    </button>
  );
}

function AccountCard({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="group relative flex justify-center">
        <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <AccountMenu compact />
        </div>
        <RailTooltip label="Account" />
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-indigo-50/80 via-white to-white p-1.5 shadow-[0_8px_24px_-14px_rgba(14,79,74,0.35)]">
      <AccountMenu />
    </div>
  );
}

// ── Desktop sidebar ───────────────────────────────────────────────────────────

export function DesktopSidebar({ onCommandOpen }: { onCommandOpen: () => void }) {
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden lg:flex",
        "border-r border-slate-200/70 bg-gradient-to-b from-white via-white to-slate-50/90",
        "shadow-[1px_0_0_rgba(255,255,255,0.8),8px_0_30px_-20px_rgba(14,79,74,0.25)]",
        "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "w-[4.75rem]" : "w-64",
      )}
    >
      {/* Ambient teal + coral glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 28% at 0% 0%, oklch(30% 0.065 192 / 0.10), transparent 70%)," +
            "radial-gradient(ellipse 80% 22% at 100% 100%, oklch(70% 0.148 36 / 0.12), transparent 70%)",
        }}
      />

      {/* Header: brand + collapse toggle */}
      <div
        className={cn(
          "relative flex shrink-0 border-b border-slate-100",
          collapsed ? "h-auto flex-col items-center gap-2 px-2 py-4" : "h-16 items-center justify-between px-4",
        )}
      >
        <Brand collapsed={collapsed} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-700"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Command palette */}
      <div className={cn("relative shrink-0 pt-3", collapsed ? "px-2" : "px-3")}>
        <CommandTrigger collapsed={collapsed} onOpen={onCommandOpen} />
      </div>

      {/* Navigation */}
      <ScrollArea className="relative min-h-0 flex-1">
        <SidebarNav collapsed={collapsed} idPrefix="desktop" />
      </ScrollArea>

      {/* Account */}
      <div className={cn("relative shrink-0 border-t border-slate-100", collapsed ? "px-2 py-3" : "px-3 py-3")}>
        <AccountCard collapsed={collapsed} />
      </div>
    </aside>
  );
}

// ── Mobile / tablet: top bar + Sheet ──────────────────────────────────────────

export function MobileTopBar({ onCommandOpen }: { onCommandOpen: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/60 bg-white/85 px-4 py-2.5 shadow-sm backdrop-blur-md lg:hidden">
        <Brand collapsed={false} />
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCommandOpen}
            aria-label="Open command palette (Ctrl+K)"
            className="rounded-xl text-slate-500"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Open navigation menu" className="rounded-xl text-slate-600">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
        </div>
      </header>

      <SheetContent
        side="left"
        closeLabel="Close navigation menu"
        className="flex w-72 flex-col gap-0 overflow-hidden border-slate-200/70 bg-gradient-to-b from-white via-white to-slate-50 p-0 sm:max-w-[18rem]"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">Primary site navigation</SheetDescription>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 26% at 0% 0%, oklch(30% 0.065 192 / 0.10), transparent 70%)," +
              "radial-gradient(ellipse 80% 22% at 100% 100%, oklch(70% 0.148 36 / 0.12), transparent 70%)",
          }}
        />

        <div className="relative flex h-16 shrink-0 items-center border-b border-slate-100 px-4">
          <Brand collapsed={false} />
        </div>
        <ScrollArea className="relative min-h-0 flex-1">
          <SidebarNav collapsed={false} idPrefix="mobile" onNavigate={() => setOpen(false)} />
        </ScrollArea>
        <div className="relative shrink-0 border-t border-slate-100 px-3 py-3">
          <AccountCard collapsed={false} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
