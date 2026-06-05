# SyllaBee

Discover public syllabi, organize them by **course/subject**, and map them onto **multi-year degree curricula** where courses are reused across overlapping majors (e.g. Computer Science and Computer Engineering).

**Status:** 10 degree programs · 74 courses · 172 syllabi collected across 40 courses (and growing).

## What I built

A two-part system:

1. **A polite, resumable syllabus crawler** (Python) that discovers public
   syllabus PDFs from `.edu` sites, MIT OpenCourseWare, and university index
   pages, classifies each one to a canonical course, and stores everything in a
   SQLite catalog. It fills **each course up to a target of 3 quality syllabi**,
   working a per-course retry queue and only searching when the queue runs dry.
2. **A fast static website** (React + Vite + Tailwind + shadcn/ui) that lets you
   browse the 10 degree curricula year-by-year, see which courses are shared
   across majors, and open the collected syllabus PDFs — with **no backend**.

## How I built it

- **Crawler:** `httpx` + `ddgs` (DuckDuckGo) + `BeautifulSoup` for discovery,
  `pypdf`/`fpdf2` for PDFs, a `robots.txt` cache, and pluggable sources
  (`mit-ocw`, `university-search`, `university-seeds`). A boundary-aware
  classifier keeps a syllabus from landing under the wrong course.
- **Catalog:** SQLite (`data/syllabee.db`) with courses, majors, curricula, a
  per-course URL queue, and crawl sessions. Curricula are defined in editable
  YAML (`data/programs.yaml`, `data/courses.yaml`, `data/taxonomy.yaml`).
- **Website:** `web/gen_web_data.py` bakes the DB into a static `catalog.json`
  and copies the PDFs into `web/public/`, so the React app ships as plain static
  files to any free host (Cloudflare Pages / Netlify).
- **Tooling:** built end-to-end with Cursor's Agent (see `.cursorrules`),
  one-click `*.command` launchers for macOS, and a `syllabee.py` CLI.

## What's next

- Finish coverage: 34 of 74 courses still have zero syllabi — re-run
  `finish-crawl.command` to keep filling gaps to 3/course.
- Clean empty-name PDFs at the **source** (`sylabi/`), not just in the web build.
- Add full-text extraction + search across syllabus contents.
- Move PDFs to object storage (e.g. Cloudflare R2) so the repo stays lean.
- Schedule periodic re-crawls to refresh terms (Spring/Fall) automatically.

## Concepts

| Layer | Purpose |
|-------|---------|
| **Course** | Reusable unit (`Calculus 1`, `Data Structures`) — one folder per course under `sylabi/` |
| **Syllabus** | A downloaded PDF + metadata (source URL, term, release date, institution) |
| **Major** | Degree program (`software-engineering`, `computer-science`) |
| **Curriculum** | Year → semester → ordered list of courses for a major |
| **Overlap** | Same course slug appears in multiple majors; one syllabus can link to several courses |

## One-click run (macOS)

**Double-click `run.command`** in Finder — macOS opens **Terminal** and runs the full pipeline.

| File | What it does |
|------|----------------|
| **`finish-crawl.command`** | Fill gaps to 3/course, focuses on missing courses (double-click this) |
| **`run.command`** | Full crawl (double-click this) |
| **`run-quick.command`** | Same limits; alias for one-click |

**Default:** **gap-fill mode** — searches **each of the 74 catalog courses** until it has up to **3 PDFs** (not one giant search that fills `_unclassified` first). Override: `MAX_PER_COURSE=20 ./run.sh`

```bash
python syllabee.py gaps          # have / need / queued URLs per course
python syllabee.py reorganize    # sort loose PDFs into course folders
```

**Queue behavior:** Every discovered PDF URL is stored in `syllabus_candidates` per course. The crawler works the queue first (retries failures up to 3×), then searches only when the queue is empty—so failed URLs do not block other alternatives.

If double-clicking `run.sh` opens **Xcode**, that is normal on Mac; use the `.command` files instead.

First time: if macOS blocks the script, right-click → **Open** → **Open** once to allow it.

From Terminal:

```bash
chmod +x run.sh run.command run-quick.command
./run.sh
```

Optional: `MAX_PER_COURSE=20 ./run.sh` or `python crawl_syllabi.py --max-per-course 15`

## Setup (manual)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python syllabee.py init
```

## Top 10 curricula

| Slug | Program |
|------|---------|
| `software-engineering-bs` | Software Engineering (B.S.) |
| `computer-science-bs` | Computer Science (B.S.) |
| `computer-engineering-bs` | Computer Engineering (B.S.) |
| `data-science-bs` | Data Science (B.S.) |
| `information-technology-bs` | Information Technology (B.S.) |
| `business-administration-bs` | Business Administration (B.S.) |
| `nursing-bsn` | Nursing (B.S.N.) |
| `psychology-ba` | Psychology (B.A.) |
| `biology-bs` | Biology (B.S.) |
| `mechanical-engineering-bs` | Mechanical Engineering (B.S.) |

```bash
python syllabee.py curricula
python syllabee.py curriculum data-science-bs
python syllabee.py overlap computer-science data-science
```

## Crawl syllabi

```bash
python crawl_syllabi.py --ignore-robots
python crawl_syllabi.py --max-downloads 50 --ignore-robots
python crawl_syllabi.py --broad-discovery --ignore-robots   # + university index seeds
python crawl_syllabi.py --sources mit-ocw,university-search --ignore-robots
python crawl_syllabi.py --no-university-sources --ignore-robots  # DuckDuckGo only
```

**University sources** (enabled by default during gap-fill):

| Source | What it does |
|--------|----------------|
| `mit-ocw` | MIT Learn API (2,500+ OCW courses) → syllabus pages; HTML syllabi saved as PDF |
| `university-search` | Site-specific search on ocw.mit.edu, cs50.harvard.edu, pll.harvard.edu, Stanford, Berkeley, OpenCulture, Academic Earth |
| `university-seeds` | Shallow crawl of university syllabus index pages (used with `--broad-discovery`) |

MIT OCW course catalog is cached at `data/mit_ocw_courses.json` for one week.

PDFs are stored as:

```text
sylabi/
  Calculus 1/
    syllabus.pdf
  Data Structures/
    ...
  _unclassified/
    ...
```

The catalog lives at `data/syllabee.db` (domains crawled, every syllabus, course links).

## Catalog CLI

```bash
python syllabee.py stats
python syllabee.py majors
python syllabee.py curriculum software-engineering-bs
python syllabee.py overlap computer-science computer-engineering
python syllabee.py syllabi
python syllabee.py syllabi --course data-structures
python syllabee.py domains
```

## Customize curricula

Edit YAML (then re-run `python syllabee.py init`):

- `data/courses.yaml` — canonical course list
- `data/programs.yaml` — majors, shared `required_courses`, and 4-year `plan`
- `data/taxonomy.yaml` — keywords/codes used to sort downloads into course folders

### Example: Software Engineering path

`python syllabee.py curriculum software-engineering-bs` prints Year 1 Fall/Spring through capstone, using the same `data-structures` and `algorithms` courses shared with CS/CE where applicable.

## Crawler flags

| Flag | Description |
|------|-------------|
| `--output-dir sylabi` | PDF root |
| `--db data/syllabee.db` | SQLite catalog |
| `--max-per-course N` | Max PDFs per subject folder (default: **3**) |
| `--max-downloads N` | Optional global cap (usually leave unset) |
| `--queries-file` / `--seeds-file` | Extra discovery inputs |
| `--ignore-robots` | Needed for many `.edu` hosts |
| `--quiet` | Minimal output (default is **verbose** per-query progress) |

**Note:** No crawler can index every public syllabus online. Re-run periodically and add university syllabus index URLs via `--seeds-file`.
