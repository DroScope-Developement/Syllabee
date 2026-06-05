# SyllaBee Web

A fully static React site for browsing SyllaBee's degree curricula and the
syllabi collected for each class. Built with **Vite + React + TypeScript**,
**Tailwind CSS v4**, and **shadcn/ui**.

There is **no database and no backend**. All data is baked into a static
`catalog.json` at build time, and the syllabus PDFs are served as static
assets. That makes the whole thing deployable to any free static host.

## Project layout

```
web/
  gen_web_data.py        # builds src/data/catalog.json + copies PDFs (run with the repo venv)
  src/
    data/catalog.json    # generated catalog (majors, curricula, courses, syllabi)
    lib/catalog.ts        # typed access to the catalog
    components/           # shadcn/ui + app components (course card, course modal, header)
    pages/                # home (search + grid) and curriculum (year/term/class breakdown)
  public/
    syllabi/<slug>/*.pdf   # generated PDF assets
    _redirects             # SPA fallback for static hosts
```

## Regenerating the data

The catalog is generated from the existing YAML catalog and the populated
SQLite database (`data/syllabee.db`). Run from the repo root using the
project's virtualenv:

```bash
# 1. (Recommended) clean up syllabus->course matches in the DB
.venv/bin/python syllabee.py reclassify

# 2. Generate the static catalog + copy PDFs into the web app
.venv/bin/python web/gen_web_data.py
```

`reclassify` recomputes each syllabus's course links from its title, filename,
URL and the folder it was filed under, using boundary-aware matching so a
syllabus only appears under courses it actually belongs to (no more Calculus
III or Thermodynamics showing up under Calculus 2).

`gen_web_data.py` then rewrites `src/data/catalog.json` and refreshes
`public/syllabi/`. As a safety net it applies the same relevance check while
building, so the site stays clean even if the database still has noise.
Re-run both whenever the crawler updates the catalog or database.

## Local development

```bash
cd web
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

## Deploying (free, live, public)

The production build is a plain static site in `web/dist`, so it works on
Cloudflare Pages, Netlify, Vercel, GitHub Pages, etc. The included
`public/_redirects` provides the SPA fallback for Cloudflare Pages / Netlify.

### Option A - Cloudflare Pages via direct upload (fastest)

```bash
cd web
npm run build
npx wrangler pages deploy dist --project-name syllabee
```

This uploads the already-built `dist/` (including the PDFs) and returns a
public `https://syllabee.pages.dev` URL. No Git connection or server needed.

### Option B - Cloudflare Pages connected to Git

In the Cloudflare dashboard, create a Pages project from the
`DroScope-Developement/Syllabee` repo with:

- **Root directory:** `web`
- **Build command:** `npm run build`
- **Build output directory:** `dist`

For Git-connected builds the generated `src/data/catalog.json` and
`public/syllabi/` must be committed to the repo (Cloudflare's build runner
does not run the Python generator). If you prefer not to commit the PDFs,
use Option A instead, or move the PDFs to Cloudflare R2 object storage and
update the `file` URLs in `gen_web_data.py`.
