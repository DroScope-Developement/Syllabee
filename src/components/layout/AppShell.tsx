import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import type { NavTab } from "./navItems";

interface AppShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: ReactNode;
}

export function AppShell({
  activeTab,
  onTabChange,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-8">{children}</main>
      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
