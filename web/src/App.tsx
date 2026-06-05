import { BrowserRouter, Route, Routes } from "react-router-dom"

import { SiteHeader } from "@/components/site-header"
import { CourseModalProvider } from "@/components/course-modal"
import { HomePage } from "@/pages/home"
import { CurriculumPage } from "@/pages/curriculum"
import { ScrollToTop } from "@/components/scroll-to-top"

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <CourseModalProvider>
        <div className="flex min-h-svh flex-col">
          <SiteHeader />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/curriculum/:slug" element={<CurriculumPage />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </main>
          <footer className="border-t py-6 text-center text-xs text-muted-foreground">
            SyllaBee &middot; Curricula and public syllabi for reference only.
          </footer>
        </div>
      </CourseModalProvider>
    </BrowserRouter>
  )
}

export default App
