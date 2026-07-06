# Full Gradesheet Metadata Capture + PDF Export

## Problem

`should-i-retake` parses an uploaded BRACU gradesheet PDF but only extracts course code, credits, and grade points — it discards the student's name, ID, program, and per-semester grouping/course-titles/letter-grades even though that text passes through the parser already. Users can calculate and edit their CGPA in the UI, but the only export option is a plain Excel course list. There's no way to get back a document that looks like an official gradesheet but reflects the user's edits (fixed retakes, added/removed courses, adjusted grades).

## Goals

- Capture all gradesheet metadata (student name/ID/program, per-semester structure, course titles, letter grades) during PDF parsing, without changing the visible course-editing table.
- Add a PDF export option that reconstructs a BRACU-style gradesheet PDF, populated with the user's *current* (edited) course data, grouped back into original semesters with recomputed per-semester GPA and cumulative CGPA.
- Reuse GradeCanvas's existing client-side jsPDF/AutoTable generator (`GradeCanvas/gradesheet-jspdf.html`) rather than rebuilding gradesheet rendering from scratch.

## Non-goals

- No change to the visible course table (still: code, credits, editable grade points, delete). Title/semester/letter-grade are captured but not displayed on-screen.
- No persistence across page refresh (matches today's behavior — in-memory only, cleared on reload).
- No attempt to preserve full retake history in the export; the exported PDF shows the same "effective" course set the CGPA calculator already uses (one row per course code, retakes already resolved), not every historical attempt.
- No server-side or Puppeteer/Node PDF generation (the site is static/client-side only).

## Design

### 1. Parser extensions

In `parseGradeSheet(text)` (script.js), before line-skipping is applied, capture:

- `Student ID : <id>` and, from the same line, the trailing `programType` (e.g. "UNDERGRADUATE PROGRAM").
- `Name : <name>` and, from the same/adjacent line(s), `program` (e.g. "BACHELOR OF SCIENCE IN COMPUTER SCIENCE"), joining wrapped continuation lines until a recognized header/section line is hit.
- `SEMESTER: <name>` lines mark the start of a new semester group; every course parsed after one (until the next `SEMESTER:` line) is tagged with that `semesterName`.
- Per-course capture, in addition to existing code/credits/points: `title` (text between the course code and the first decimal number on the line) and `grade` (the letter token between the credits number and the final grade-points number, e.g. "A-", "B+"). If a course's title line is followed by a continuation line that has no course code, no numbers, and isn't a semester/summary/header line, append it to the title (handles wrapped titles like "MATHEMATICS I: ... COORDINATE" + "GEOMETRY").

Institution name/address defaults to BRAC University's known values, overridden if found in the text (defensive, but in practice always present).

Store the result as `this.gradeSheetInfo`:
```js
{
  student: { id, name, programType, program },
  institution: { name, addressLines: [...] },
  semesterOrder: ["SPRING 2022", "SUMMER 2022", ...]   // order first seen
}
```

Each entry in `this.courses` / `this.originalCourses` gains: `title`, `grade` (original letter, may be stale after edits), `semesterName`.

If no metadata can be found (e.g., Excel import, or a PDF whose layout doesn't match expectations), `this.gradeSheetInfo` stays `null`. This is a normal, handled case — not an error — and export falls back to a generic layout (see below).

### 2. Grade-scale helper

A module-level constant, the standard BRACU letter/point scale:

```
A 4.00, A- 3.70, B+ 3.30, B 3.00, B- 2.70, C+ 2.30, C 2.00, C- 1.70, D+ 1.30, D 1.00, F 0.00
```

`pointsToLetter(points)` returns the nearest scale entry by absolute difference (ties resolve to the higher grade). Used only at export time to compute a current letter grade for courses whose points were edited or that were manually added (whose `grade` was never set).

### 3. PDF export (`exportToPDF`)

New method on `GradeSheetAnalyzer`, wired to a new "Export to PDF" menu item.

- Lazily loads jsPDF + AutoTable from the same CDN GradeCanvas uses, mirroring the existing lazy-load pattern already used for PDF.js/XLSX in this codebase. Loading failure surfaces through the existing `showError()` UI path.
- Rebuilds a `semesters` array from the **current** `this.courses` (i.e., post-edit/post-delete/post-manual-add state):
  - Group courses by `semesterName`, in the order recorded in `gradeSheetInfo.semesterOrder`.
  - Courses with no `semesterName` (manually added) go into a trailing synthetic group named "ADDITIONAL COURSES".
  - Each course's `grade` field is recomputed via `pointsToLetter(course.gradePoints)` so edited grades show the correct letter.
  - If `gradeSheetInfo` is `null` (Excel import / parse fallback), all current courses go into a single group named "COURSES", and student/institution fields use placeholders ("Student", blank ID, "BRAC University" default address).
- Feeds `{ institution, student, documentTitle: "GRADE SHEET", copyType: "UNOFFICIAL COPY", watermarkText: "UNOFFICIAL", semesters }` into a ported version of GradeCanvas's `computeSummaries` (auto-computes per-semester GPA and cumulative CGPA from credits × points, matching the 0-credit-course exclusion rule already used) and `generateGradeSheetPDF` (the AutoTable-based drawing routine, unchanged layout logic).
- BRAC logo: `GradeCanvas/brac_logo.png` is copied into the should-i-retake repo (e.g. `assets/brac_logo.png`), fetched once on first PDF export, converted to a data URL, and cached in memory for subsequent exports in the same session. Drawn top-left of the header exactly as in GradeCanvas's layout.
- Output filename: `gradesheet_<studentId-or-"export">_<YYYY-MM-DD>.pdf`.

### 4. Export UI

The current single `<button id="exportBtn">Export to Excel</button>` becomes a button+dropdown: `Export ▾` toggles a small menu with two items, "Export to Excel" (existing `exportToExcel()`, untouched) and "Export to PDF" (new `exportToPDF()`). Menu closes on selection or on outside click. Styled consistently with the existing `.control-btn` styles in styles.css.

## Error handling

| Case | Behavior |
|---|---|
| No courses to export | Same guard as today's `exportToExcel` — `showError('No courses to export')`. |
| Metadata missing (`gradeSheetInfo === null`) | Not an error — generic fallback header/grouping, export proceeds. |
| CDN script (jsPDF/AutoTable) fails to load | `showError()` with a message to retry; no partial/corrupt download attempted. |
| Logo fetch fails | Log to console, generate the PDF without the logo rather than failing the whole export. |
| Edited grade point doesn't land on a standard scale value | Nearest-letter shown via `pointsToLetter`; no error, this is expected editing behavior. |

## Testing / verification

No automated test framework exists in this repo today; verification is manual:
1. Upload `GradeCanvas/example_gradesheet.pdf`, confirm all courses/credits/points still populate the on-screen table exactly as before (no regression).
2. Edit a grade, delete a course, add a manual course; export to PDF; confirm the resulting PDF reflects all three changes, groups courses under the correct original semesters, and per-semester/cumulative GPA figures recompute correctly.
3. Visually compare output against `GradeCanvas/example-gradesheet-images/*.jpg` for layout fidelity (logo, header block, table styling, watermark).
4. Upload an Excel file, export to PDF, confirm the generic-fallback layout renders without errors.
5. Export to Excel still works unchanged (regression check on the dropdown wiring).
