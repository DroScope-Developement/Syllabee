import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import type { NavTab } from "./navItems";

interface AppShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  userEmail?: string | null;
  authLoading?: boolean;
  onProfileClick?: () => void;
  children: ReactNode;
}

export function AppShell({
  activeTab,
  onTabChange,
  userEmail,
  authLoading,
  onProfileClick,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header
        userEmail={userEmail}
        authLoading={authLoading}
        onProfileClick={onProfileClick}
      />
      <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8">{children}</main>
      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
