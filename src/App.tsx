import { useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { NavTab } from "./components/layout/navItems";
import { PlaceholderView } from "./components/layout/PlaceholderView";
import { SyllabusOutline } from "./components/syllabus/SyllabusOutline";
import { mockSyllabus } from "./data/mockSyllabus";

function TabContent({ tab }: { tab: NavTab }) {
  switch (tab) {
    case "outline":
      return <SyllabusOutline data={mockSyllabus} />;
    case "courses":
      return (
        <PlaceholderView
          icon="courses"
          title="Your courses"
          description="Upload and manage syllabi for all your classes in one place."
        />
      );
    case "explore":
      return (
        <PlaceholderView
          icon="explore"
          title="Explore topics"
          description="Search open-source resources across Wikipedia, Khan Academy, OpenStax, and more."
        />
      );
    case "saved":
      return (
        <PlaceholderView
          icon="saved"
          title="Saved resources"
          description="Bookmark summaries and articles to revisit while you study."
        />
      );
    case "profile":
      return (
        <PlaceholderView
          icon="profile"
          title="Profile"
          description="Manage your account, preferences, and notification settings."
        />
      );
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("outline");

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      <TabContent tab={activeTab} />
    </AppShell>
  );
}
