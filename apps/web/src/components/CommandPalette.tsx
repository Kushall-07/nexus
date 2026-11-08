import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconDashboard,
  IconBriefcase,
  IconBookmark,
  IconClipboard,
  IconCode,
  IconTarget,
  IconStar,
  IconChat,
  IconDocument,
  IconGear,
  IconSearch,
} from "./Icons";

// ── Command definitions ────────────────────────────────────────────────────────

interface Command {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: React.ReactNode;
  group: string;
}

const COMMANDS: Command[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Your career intelligence dashboard",
    to: "/dashboard",
    icon: <IconDashboard className="h-4 w-4" />,
    group: "Workspace",
  },
  {
    id: "job-discovery",
    label: "Job Discovery",
    description: "Search and browse matched job listings",
    to: "/opportunities",
    icon: <IconBriefcase className="h-4 w-4" />,
    group: "Career Discovery",
  },
  {
    id: "saved",
    label: "Saved Opportunities",
    description: "Jobs you've saved for later review",
    to: "/saved",
    icon: <IconBookmark className="h-4 w-4" />,
    group: "Career Discovery",
  },
  {
    id: "applications",
    label: "Applications",
    description: "Track your job application pipeline",
    to: "/applications",
    icon: <IconClipboard className="h-4 w-4" />,
    group: "Career Discovery",
  },
  {
    id: "github-evidence",
    label: "GitHub Evidence",
    description: "Repositories and demonstrated skills",
    to: "/repositories",
    icon: <IconCode className="h-4 w-4" />,
    group: "Intelligence",
  },
  {
    id: "role-gap",
    label: "Role & Gap Analysis",
    description: "Target role comparison and skill gaps",
    to: "/development",
    icon: <IconTarget className="h-4 w-4" />,
    group: "Intelligence",
  },
  {
    id: "skill-intelligence",
    label: "Skill Intelligence",
    description: "Detailed view of your demonstrated skills",
    to: "/skills",
    icon: <IconStar className="h-4 w-4" />,
    group: "Intelligence",
  },
  {
    id: "copilot",
    label: "Career Copilot",
    description: "AI-powered career guidance",
    to: "/copilot",
    icon: <IconChat className="h-4 w-4" />,
    group: "AI & Personalization",
  },
  {
    id: "profile",
    label: "My Career Profile",
    description: "Resume, experience, and career information",
    to: "/resume",
    icon: <IconDocument className="h-4 w-4" />,
    group: "AI & Personalization",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Appearance, account, and preferences",
    to: "/settings",
    icon: <IconGear className="h-4 w-4" />,
    group: "AI & Personalization",
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Store the element that opened the palette so we can restore focus
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      setQuery("");
      setActiveIndex(0);
      // Focus the input on next tick after the portal mounts
      requestAnimationFrame(() => { inputRef.current?.focus(); });
    } else {
      // Restore focus to the element that opened the palette
      if (triggerRef.current && triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
        triggerRef.current = null;
      }
    }
  }, [open]);

  const filtered = query.trim()
    ? COMMANDS.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description.toLowerCase().includes(query.toLowerCase()) ||
          cmd.group.toLowerCase().includes(query.toLowerCase()),
      )
    : COMMANDS;

  // Reset active index when filtered list changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const execute = useCallback(
    (cmd: Command) => {
      navigate(cmd.to);
      onClose();
    },
    [navigate, onClose],
  );

  // Keep active item scrolled into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelectorAll<HTMLElement>('[role="option"]')[activeIndex];
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const groupedCmds = filtered.reduce<{ group: string; items: Command[] }[]>((acc, cmd) => {
    const existing = acc.find((g) => g.group === cmd.group);
    if (existing) { existing.items.push(cmd); }
    else { acc.push({ group: cmd.group, items: [cmd] }); }
    return acc;
  }, []);

  // Flat index map for keyboard navigation
  const flatItems = groupedCmds.flatMap((g) => g.items);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) execute(item);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  // Track flat index across groups for active state
  let flatIdx = 0;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/60 backdrop-blur-sm pt-[12vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-hidden="false"
    >
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden mx-4"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <IconSearch className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="command-list"
            aria-expanded="true"
            aria-activedescendant={flatItems[activeIndex] ? `cmd-${flatItems[activeIndex].id}` : undefined}
            placeholder="Go to…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 sm:inline">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <ul
          ref={listRef}
          id="command-list"
          role="listbox"
          aria-label="Navigation destinations"
          className="max-h-[min(60vh,360px)] overflow-y-auto py-2"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              No results for &ldquo;{query}&rdquo;
            </li>
          ) : (
            groupedCmds.map((group) => (
              <li key={group.group}>
                {/* Group label */}
                <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {group.group}
                </p>
                <ul>
                  {group.items.map((cmd) => {
                    const isActive = flatItems[activeIndex]?.id === cmd.id;
                    const idx = flatIdx++;
                    return (
                      <li key={cmd.id}>
                        <button
                          id={`cmd-${cmd.id}`}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          data-flat-index={idx}
                          onMouseEnter={() => setActiveIndex(flatItems.findIndex((f) => f.id === cmd.id))}
                          onClick={() => execute(cmd)}
                          className={[
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            isActive
                              ? "bg-indigo-50 text-indigo-900"
                              : "text-slate-700 hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <span className={`shrink-0 ${isActive ? "text-indigo-700" : "text-slate-400"}`}>
                            {cmd.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium leading-tight">{cmd.label}</span>
                            <span className="block truncate text-xs text-slate-500 leading-tight mt-0.5">
                              {cmd.description}
                            </span>
                          </span>
                          {isActive && (
                            <kbd className="ml-auto shrink-0 rounded border border-indigo-200 bg-indigo-100 px-1.5 py-0.5 text-[10px] font-mono text-indigo-700">
                              ↵
                            </kbd>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>

        {/* Footer hint */}
        <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-4">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <kbd className="rounded border border-slate-200 px-1 py-px font-mono">↑↓</kbd> navigate
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <kbd className="rounded border border-slate-200 px-1 py-px font-mono">↵</kbd> open
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <kbd className="rounded border border-slate-200 px-1 py-px font-mono">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
