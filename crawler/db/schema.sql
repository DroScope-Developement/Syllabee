-- SyllaBee catalog: syllabi, crawl history, reusable courses, multi-major curricula

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    course_code     TEXT,
    category        TEXT,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS majors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS curricula (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    major_id        INTEGER NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    total_years     INTEGER NOT NULL DEFAULT 4,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS curriculum_terms (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    curriculum_id   INTEGER NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    year_number     INTEGER NOT NULL,
    term_name       TEXT NOT NULL,
    term_order      INTEGER NOT NULL,
    UNIQUE (curriculum_id, year_number, term_name)
);

CREATE TABLE IF NOT EXISTS curriculum_courses (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    curriculum_term_id  INTEGER NOT NULL REFERENCES curriculum_terms(id) ON DELETE CASCADE,
    course_id           INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    is_required         INTEGER NOT NULL DEFAULT 1,
    credits             REAL,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    UNIQUE (curriculum_term_id, course_id)
);

-- Courses required by a major (for overlap / shared requirements across programs)
CREATE TABLE IF NOT EXISTS major_courses (
    major_id        INTEGER NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
    course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    is_core         INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (major_id, course_id)
);

CREATE TABLE IF NOT EXISTS crawled_domains (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    domain          TEXT NOT NULL UNIQUE,
    first_crawled_at TEXT NOT NULL,
    last_crawled_at  TEXT NOT NULL,
    pages_fetched   INTEGER NOT NULL DEFAULT 0,
    pdfs_discovered INTEGER NOT NULL DEFAULT 0,
    pdfs_downloaded INTEGER NOT NULL DEFAULT 0,
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS crawl_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at      TEXT NOT NULL,
    finished_at     TEXT,
    queries_json    TEXT,
    seeds_json      TEXT,
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS syllabi (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_url      TEXT NOT NULL UNIQUE,
    file_path       TEXT,
    sha256          TEXT UNIQUE,
    file_size       INTEGER,
    status          TEXT NOT NULL,
    course_id       INTEGER REFERENCES courses(id),
    title           TEXT,
    institution     TEXT,
    term_label      TEXT,
    release_date    TEXT,
    downloaded_at   TEXT,
    discovery_source TEXT,
    referrer_url    TEXT,
    crawl_session_id INTEGER REFERENCES crawl_sessions(id),
    metadata_json   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One syllabus PDF can map to multiple courses (CS / CE overlap)
CREATE TABLE IF NOT EXISTS syllabus_courses (
    syllabus_id     INTEGER NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
    course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    confidence      REAL NOT NULL DEFAULT 1.0,
    match_reason    TEXT,
    PRIMARY KEY (syllabus_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_syllabi_course ON syllabi(course_id);
CREATE INDEX IF NOT EXISTS idx_syllabi_sha ON syllabi(sha256);
CREATE INDEX IF NOT EXISTS idx_syllabi_status ON syllabi(status);
CREATE INDEX IF NOT EXISTS idx_curriculum_terms_order ON curriculum_terms(curriculum_id, term_order);
