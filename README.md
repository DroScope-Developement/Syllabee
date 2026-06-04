# Syllabee

Repository for the Syllabee project.

## Getting started

Clone the repository:

```bash
git clone https://github.com/DroScope-Developement/Syllabee.git
cd Syllabee
```

## Syllabus crawler

Discovers public syllabus PDFs via DuckDuckGo search and shallow seed-page crawling, then downloads them into `sylabi/` with a `manifest.jsonl` log (URL, filename, SHA-256, status).

### Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Run

```bash
python crawl_syllabi.py
```

Options:

| Flag | Description |
|------|-------------|
| `--output-dir sylabi` | Download folder (default: `sylabi`) |
| `--max-downloads N` | Stop after N new PDFs |
| `--queries-file path` | Extra search queries, one per line |
| `--seeds-file path` | Extra seed URLs for link discovery |
| `--skip-search` | Only crawl seeds |
| `--skip-seeds` | Only run search |
| `--ignore-robots` | Attempt downloads even when robots.txt disallows crawling |

**Note:** No crawler can index every public syllabus on the internet. This tool uses search plus configurable seeds; re-run periodically or add university course-catalog URLs via `--seeds-file` to grow the collection. It respects `robots.txt` and uses a polite delay between downloads.
