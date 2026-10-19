import { NavLink, Route, Routes } from "react-router-dom";
import { AuthGate } from "./AuthGate";
import { RolesPage } from "./features/roles/RolesPage";
import { SkillDetailPage } from "./features/skills/SkillDetailPage";
import { SkillOverviewPage } from "./features/skills/SkillOverviewPage";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 ${
    isActive ? "bg-indigo-100 text-indigo-900" : "text-slate-700 hover:bg-slate-100"
  }`;

export function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div>
            <p className="text-lg font-semibold">NEXUS</p>
            <p className="text-xs text-slate-600">GitHub Evidence Engine</p>
          </div>
          <nav aria-label="Primary" className="flex gap-2">
            <NavLink to="/" end className={navClass}>
              Skills
            </NavLink>
            <NavLink to="/roles" className={navClass}>
              Target role
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <AuthGate>
          <Routes>
            <Route path="/" element={<SkillOverviewPage />} />
            <Route path="/skills/:skillId" element={<SkillDetailPage />} />
            <Route path="/roles" element={<RolesPage />} />
            <Route path="*" element={<p>Page not found.</p>} />
          </Routes>
        </AuthGate>
      </main>
    </div>
  );
}
