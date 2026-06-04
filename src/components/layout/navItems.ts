export type NavTab = "outline" | "courses" | "explore" | "saved" | "profile";

export interface NavItem {
  id: NavTab;
  label: string;
}

export const navItems: NavItem[] = [
  { id: "outline", label: "Outline" },
  { id: "courses", label: "Courses" },
  { id: "explore", label: "Explore" },
  { id: "saved", label: "Saved" },
  { id: "profile", label: "Profile" },
];
