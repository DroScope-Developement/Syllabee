export type NavTab = "courses" | "profile";

export interface NavItem {
  id: NavTab;
  label: string;
}

export const navItems: NavItem[] = [
  { id: "courses", label: "Courses" },
  { id: "profile", label: "Profile" },
];
