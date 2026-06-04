# Syllabee

Discover public syllabi, organize them by **course/subject**, and map them onto **multi-year degree curricula** where courses are reused across overlapping majors (e.g. Computer Science and Computer Engineering).

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
| **`run.command`** | Full crawl (double-click this) |
| **`run-quick.command`** | Same limits; alias for one-click |

**Default limit:** up to **10 PDFs per subject/course** (e.g. `sylabi/Calculus 1/`), not a global cap. Override: `MAX_PER_COURSE=20 ./run.sh`

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
```

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
| `--max-per-course N` | Max PDFs per subject folder (default: **10**) |
| `--max-downloads N` | Optional global cap (usually leave unset) |
| `--queries-file` / `--seeds-file` | Extra discovery inputs |
| `--ignore-robots` | Needed for many `.edu` hosts |
| `--quiet` | Minimal output (default is **verbose** per-query progress) |

**Note:** No crawler can index every public syllabus online. Re-run periodically and add university syllabus index URLs via `--seeds-file`.
