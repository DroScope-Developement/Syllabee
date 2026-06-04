# Syllabee

Syllabus indexing education platform — parse structured syllabus data and explore topics with summaries from open-source educational sources.

## Getting started

```bash
git clone https://github.com/DroScope-Developement/Syllabee.git
cd Syllabee
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the syllabus outline demo.

## Syllabus outline viewer

The outline viewer lives in `src/components/syllabus/`:

| Component | Role |
|-----------|------|
| `SyllabusOutline` | Root container — renders course header and all sections |
| `SyllabusSection` | Collapsible top-level unit |
| `SubpointRow` | Expandable topic row; lazy-loads summaries on expand |
| `TopicSummaryPanel` | Source cards (Wikipedia, Khan Academy, OpenStax, MIT OCW) |

### Data shapes

- Syllabus input: `src/types/syllabus.ts` (`SyllabusOutlineData`, `SyllabusSection`, `SyllabusSubpoint`)
- Source summaries: `TopicSummary`, `TopicSummariesResult`

### Mock data & real API wiring

- Mock syllabus: `src/data/mockSyllabus.ts`
- Mock summaries: `src/data/mockTopicSummaries.ts`
- **Fetch layer:** `src/services/topicSummaries.ts` — replace the mock lookup inside `fetchTopicSummaries()` with live API calls when ready.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
