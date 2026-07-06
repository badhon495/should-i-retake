# Full Gradesheet Metadata Capture + PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture the student's name/ID/program and per-semester/course-title/letter-grade metadata during PDF parsing (currently discarded), and add an "Export to PDF" option that reconstructs a BRACU-style gradesheet PDF populated with the user's current (edited) course data.

**Architecture:** Two new pure, dependency-free modules — `gradesheet-utils.js` (parsing/grouping/GPA-math helpers, unit-tested with plain Node `assert`, no framework) and `gradesheet-pdf.js` (the browser-only jsPDF/AutoTable drawing routine, ported from `GradeCanvas/gradesheet-jspdf.html`) — get wired into the existing `GradeSheetAnalyzer` class in `script.js` with minimal, additive changes to the working parser, plus a small dropdown UI replacing the single Export button.

**Tech Stack:** Vanilla JS (no build step, no framework), jsPDF 2.5.1 + jsPDF-AutoTable 3.8.2 (CDN, lazy-loaded), Node.js `assert` for unit tests (no test runner dependency).

## Global Constraints

- Site stays 100% client-side/static — no server, Node runtime, or Puppeteer in the shipped feature (only GradeCanvas's dev-time generator uses Puppeteer; this plan does not).
- Pin jsPDF to `2.5.1` and jsPDF-AutoTable to `3.8.2` (same CDN URLs GradeCanvas uses), so an upstream update can't silently break layout.
- The visible course table (course code, credits, editable grade points, delete) does not change. New metadata (`title`, `grade`, `semesterName`) is captured but not displayed on-screen.
- No persistence across page refresh — metadata lives in memory on the `GradeSheetAnalyzer` instance exactly like `this.courses` does today.
- PDF export always reflects the **current** (post-edit/post-delete/post-manual-add) course list, never the original parsed values.
- The exported PDF shows one row per effective course (retakes already resolved by existing duplicate-handling logic), not full historical retake attempts.
- Export UI: a single "Export ▾" button opens a dropdown with "Export to Excel" and "Export to PDF" (per user's chosen option).
- Include the BRAC University logo in the PDF header (per user's chosen option).

---

## Task 1: `gradesheet-utils.js` skeleton + grade-scale lookup

**Files:**
- Create: `gradesheet-utils.js`
- Create: `tests/gradesheet-utils.test.js`

**Interfaces:**
- Produces: `GradeSheetUtils.pointsToLetter(points: number): string`, `GradeSheetUtils.GRADE_SCALE`, `GradeSheetUtils.DEFAULT_INSTITUTION` — a UMD-lite module usable via `require()` in Node and as `window.GradeSheetUtils` in the browser.

- [ ] **Step 1: Write the failing test file**

Create `tests/gradesheet-utils.test.js`:

```js
const assert = require('assert');
const utils = require('../gradesheet-utils.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('pointsToLetter: exact matches for every scale entry', () => {
    assert.strictEqual(utils.pointsToLetter(4.00), 'A');
    assert.strictEqual(utils.pointsToLetter(3.70), 'A-');
    assert.strictEqual(utils.pointsToLetter(3.30), 'B+');
    assert.strictEqual(utils.pointsToLetter(3.00), 'B');
    assert.strictEqual(utils.pointsToLetter(2.70), 'B-');
    assert.strictEqual(utils.pointsToLetter(2.30), 'C+');
    assert.strictEqual(utils.pointsToLetter(2.00), 'C');
    assert.strictEqual(utils.pointsToLetter(1.70), 'C-');
    assert.strictEqual(utils.pointsToLetter(1.30), 'D+');
    assert.strictEqual(utils.pointsToLetter(1.00), 'D');
    assert.strictEqual(utils.pointsToLetter(0.00), 'F');
});

test('pointsToLetter: nearest match for a non-scale value', () => {
    assert.strictEqual(utils.pointsToLetter(3.86), 'A');
    assert.strictEqual(utils.pointsToLetter(0.15), 'F');
});

test('pointsToLetter: exact midpoint ties resolve to the higher grade', () => {
    // 3.85 is exactly 0.15 from both A- (3.70) and A (4.00)
    assert.strictEqual(utils.pointsToLetter(3.85), 'A');
});

let failed = 0;
for (const t of tests) {
    try {
        t.fn();
        console.log(`PASS: ${t.name}`);
    } catch (err) {
        failed++;
        console.error(`FAIL: ${t.name}`);
        console.error(err);
    }
}
if (failed > 0) {
    console.error(`\n${failed} test(s) failed.`);
    process.exit(1);
} else {
    console.log(`\nAll ${tests.length} tests passed.`);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/gradesheet-utils.test.js`
Expected: `Error: Cannot find module '../gradesheet-utils.js'`

- [ ] **Step 3: Create `gradesheet-utils.js` with the module skeleton and `pointsToLetter`**

```js
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.GradeSheetUtils = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const DEFAULT_INSTITUTION = {
        name: 'BRAC University',
        addressLines: [
            'Kha 224, Bir Uttam Rafiqul Islam Avenue',
            'Merul Badda, Dhaka 1212.'
        ]
    };

    const GRADE_SCALE = [
        { letter: 'A', points: 4.00 },
        { letter: 'A-', points: 3.70 },
        { letter: 'B+', points: 3.30 },
        { letter: 'B', points: 3.00 },
        { letter: 'B-', points: 2.70 },
        { letter: 'C+', points: 2.30 },
        { letter: 'C', points: 2.00 },
        { letter: 'C-', points: 1.70 },
        { letter: 'D+', points: 1.30 },
        { letter: 'D', points: 1.00 },
        { letter: 'F', points: 0.00 }
    ];

    function pointsToLetter(points) {
        let best = GRADE_SCALE[0];
        let bestDiff = Math.abs(points - best.points);
        for (let i = 1; i < GRADE_SCALE.length; i++) {
            const diff = Math.abs(points - GRADE_SCALE[i].points);
            if (diff < bestDiff) {
                best = GRADE_SCALE[i];
                bestDiff = diff;
            }
        }
        return best.letter;
    }

    return {
        DEFAULT_INSTITUTION,
        GRADE_SCALE,
        pointsToLetter
    };
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/gradesheet-utils.test.js`
Expected: `All 3 tests passed.`

- [ ] **Step 5: Commit**

```bash
git add gradesheet-utils.js tests/gradesheet-utils.test.js
git commit -m "Add gradesheet-utils module with grade-scale lookup"
```

---

## Task 2: Line-parsing pure functions

**Files:**
- Modify: `gradesheet-utils.js`
- Modify: `tests/gradesheet-utils.test.js`

**Interfaces:**
- Consumes: nothing new from Task 1 besides the module shape.
- Produces: `parseStudentIdLine(line)`, `parseNameLine(line)`, `parseSemesterHeader(line)`, `isPlainContinuationLine(line)`, `parseCourseLine(line)` — all pure, all returning `null` on non-match, all exported on `GradeSheetUtils`. `parseCourseLine` returns `{ courseCode, title, grade }`; the others return small plain objects or a string/null as noted below. Task 3 consumes all five of these directly.

- [ ] **Step 1: Write the failing tests**

Insert these `test(...)` calls into `tests/gradesheet-utils.test.js`, right before the `let failed = 0;` line:

```js
test('parseStudentIdLine: extracts id and program type', () => {
    const line = 'Student ID : 22341082                      UNDERGRADUATE PROGRAM';
    assert.deepStrictEqual(utils.parseStudentIdLine(line), {
        id: '22341082',
        programType: 'UNDERGRADUATE PROGRAM'
    });
    assert.strictEqual(utils.parseStudentIdLine('CSE110 something'), null);
});

test('parseNameLine: extracts name and the start of the wrapped program text', () => {
    const line = 'Name       : Md Sakib Sadman Badhon        PROGRAM: BACHELOR OF SCIENCE IN COMPUTER';
    assert.deepStrictEqual(utils.parseNameLine(line), {
        name: 'Md Sakib Sadman Badhon',
        programStart: 'BACHELOR OF SCIENCE IN COMPUTER'
    });
    assert.strictEqual(utils.parseNameLine('Student ID : 123'), null);
});

test('parseSemesterHeader: matches only the "SEMESTER:" header line, not the summary row', () => {
    assert.strictEqual(utils.parseSemesterHeader('SEMESTER: SPRING 2022'), 'SPRING 2022');
    assert.strictEqual(
        utils.parseSemesterHeader('SEMESTER Credits Attempted          6.00   Credits Earned     6.00                  GPA   3.65'),
        null
    );
});

test('isPlainContinuationLine: true for wrapped text, false for header/summary/course lines', () => {
    assert.strictEqual(utils.isPlainContinuationLine('SCIENCE'), true);
    assert.strictEqual(utils.isPlainContinuationLine('GEOMETRY'), true);
    assert.strictEqual(utils.isPlainContinuationLine('SEMESTER: SPRING 2022'), false);
    assert.strictEqual(utils.isPlainContinuationLine('CSE110 something 3.00 A 4.00'), false);
    assert.strictEqual(utils.isPlainContinuationLine(''), false);
});

test('parseCourseLine: extracts course code, title, and letter grade from a single-line course row', () => {
    const line = 'CSE110     PROGRAMMING LANGUAGE I                             3.00   A                    4.00';
    assert.deepStrictEqual(utils.parseCourseLine(line), {
        courseCode: 'CSE110',
        title: 'PROGRAMMING LANGUAGE I',
        grade: 'A'
    });
});

test('parseCourseLine: works with a plus/minus letter grade and a longer wrapped title fragment', () => {
    const line = 'MAT110     MATHEMATICS I: DIFFERENTIAL CALCULUS & COORDINATE  3.00   B+                   3.30';
    assert.deepStrictEqual(utils.parseCourseLine(line), {
        courseCode: 'MAT110',
        title: 'MATHEMATICS I: DIFFERENTIAL CALCULUS & COORDINATE',
        grade: 'B+'
    });
});

test('parseCourseLine: returns null for non-course lines', () => {
    assert.strictEqual(utils.parseCourseLine('SEMESTER: SPRING 2022'), null);
    assert.strictEqual(utils.parseCourseLine('Student ID : 22341082'), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/gradesheet-utils.test.js`
Expected: multiple `FAIL` lines with `TypeError: utils.parseStudentIdLine is not a function` (and similarly for the other four new functions).

- [ ] **Step 3: Implement the five functions in `gradesheet-utils.js`**

Add this code inside the factory function, after `pointsToLetter` and before the final `return { ... }` statement:

```js
    const COURSE_CODE_PATTERN = /^([A-Z]{2,4}\d{3}[A-Z]?[A-Z0-9]?)/;
    const HEADER_KEYWORDS = [
        'SEMESTER:', 'Course No', 'Student ID', 'Name', 'GRADE SHEET',
        'BRAC University', 'Page ', 'UNOFFICIAL COPY', 'CUMULATIVE',
        'Credits Attempted', 'PROGRAM:'
    ];

    function parseStudentIdLine(line) {
        const m = line.match(/^Student ID\s*:\s*(\S+)\s*(.*)$/i);
        if (!m) return null;
        return { id: m[1].trim(), programType: (m[2] || '').trim() };
    }

    function parseNameLine(line) {
        const m = line.match(/^Name\s*:\s*(.+?)(?:\s{2,}PROGRAM:\s*(.*))?$/i);
        if (!m) return null;
        return { name: m[1].trim(), programStart: (m[2] || '').trim() };
    }

    function parseSemesterHeader(line) {
        const m = line.match(/^SEMESTER:\s*(.+)$/i);
        return m ? m[1].trim() : null;
    }

    function isPlainContinuationLine(line) {
        if (!line) return false;
        if (/\d/.test(line)) return false;
        return !HEADER_KEYWORDS.some(k => line.includes(k));
    }

    function parseCourseLine(line) {
        const codeMatch = line.match(COURSE_CODE_PATTERN);
        if (!codeMatch) return null;
        const numberMatches = [...line.matchAll(/\d+\.\d+/g)];
        if (numberMatches.length < 2) return null;
        const first = numberMatches[0];
        const last = numberMatches[numberMatches.length - 1];
        const title = line.slice(codeMatch[0].length, first.index).trim().replace(/\s+/g, ' ');
        const grade = line.slice(first.index + first[0].length, last.index).trim();
        return { courseCode: codeMatch[1], title, grade };
    }
```

Then update the final `return { ... };` statement to include the five new functions:

```js
    return {
        DEFAULT_INSTITUTION,
        GRADE_SCALE,
        pointsToLetter,
        parseStudentIdLine,
        parseNameLine,
        parseSemesterHeader,
        isPlainContinuationLine,
        parseCourseLine
    };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/gradesheet-utils.test.js`
Expected: `All 10 tests passed.`

- [ ] **Step 5: Commit**

```bash
git add gradesheet-utils.js tests/gradesheet-utils.test.js
git commit -m "Add line-parsing helpers for gradesheet metadata extraction"
```

---

## Task 3: `extractGradeSheetMetadata` — full-text metadata pass

**Files:**
- Modify: `gradesheet-utils.js`
- Modify: `tests/gradesheet-utils.test.js`

**Interfaces:**
- Consumes: `parseStudentIdLine`, `parseNameLine`, `parseSemesterHeader`, `isPlainContinuationLine`, `parseCourseLine` from Task 2, `DEFAULT_INSTITUTION` from Task 1.
- Produces: `extractGradeSheetMetadata(text: string): { gradeSheetInfo: { student: {id,name,programType,program}, institution: {name,addressLines}, semesterOrder: string[] }, courseMeta: { [courseCode]: {title, grade, semesterName} } }`. Task 5 consumes this exact shape.

- [ ] **Step 1: Write the failing test**

Insert before `let failed = 0;`:

```js
test('extractGradeSheetMetadata: pulls student info, semester order, and per-course metadata from realistic gradesheet text', () => {
    const sampleText = [
        'BRAC University',
        'Kha 224, Bir Uttam Rafiqul Islam Avenue        Page 1 of 2',
        'Merul Badda, Dhaka 1212.',
        'GRADE SHEET',
        'UNOFFICIAL COPY',
        'Student ID : 22341082                      UNDERGRADUATE PROGRAM',
        'Name       : Md Sakib Sadman Badhon        PROGRAM: BACHELOR OF SCIENCE IN COMPUTER',
        'SCIENCE',
        'Course No  Course Title                                       Credits Earned Grade        Grade Points',
        'SEMESTER: SPRING 2022',
        'CSE110     PROGRAMMING LANGUAGE I                             3.00   A                    4.00',
        'ENG091     FOUNDATION COURSE (IN ENGLISH)                     0.00   A-                   3.70',
        'MAT110     MATHEMATICS I: DIFFERENTIAL CALCULUS & COORDINATE  3.00   B+                   3.30',
        '           GEOMETRY',
        'SEMESTER Credits Attempted          6.00   Credits Earned     6.00                  GPA   3.65',
        'CUMULATIVE Credits Attempted        6.00   Credits Earned     6.00                  CGPA  3.65',
        'SEMESTER: SUMMER 2022',
        'CSE111     PROGRAMMING LANGUAGE-II                            3.00   A                    4.00'
    ].join('\n');

    const { gradeSheetInfo, courseMeta } = utils.extractGradeSheetMetadata(sampleText);

    assert.strictEqual(gradeSheetInfo.student.id, '22341082');
    assert.strictEqual(gradeSheetInfo.student.name, 'Md Sakib Sadman Badhon');
    assert.strictEqual(gradeSheetInfo.student.programType, 'UNDERGRADUATE PROGRAM');
    assert.strictEqual(gradeSheetInfo.student.program, 'BACHELOR OF SCIENCE IN COMPUTER SCIENCE');
    assert.deepStrictEqual(gradeSheetInfo.semesterOrder, ['SPRING 2022', 'SUMMER 2022']);
    assert.deepStrictEqual(gradeSheetInfo.institution, utils.DEFAULT_INSTITUTION);

    assert.deepStrictEqual(courseMeta.CSE110, {
        title: 'PROGRAMMING LANGUAGE I', grade: 'A', semesterName: 'SPRING 2022'
    });
    assert.deepStrictEqual(courseMeta.MAT110, {
        title: 'MATHEMATICS I: DIFFERENTIAL CALCULUS & COORDINATE GEOMETRY',
        grade: 'B+', semesterName: 'SPRING 2022'
    });
    assert.deepStrictEqual(courseMeta.CSE111, {
        title: 'PROGRAMMING LANGUAGE-II', grade: 'A', semesterName: 'SUMMER 2022'
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/gradesheet-utils.test.js`
Expected: `FAIL: extractGradeSheetMetadata: ...` with `TypeError: utils.extractGradeSheetMetadata is not a function`

- [ ] **Step 3: Implement `extractGradeSheetMetadata`**

Add this code inside the factory function, after `parseCourseLine` and before the final `return`:

```js
    function extractGradeSheetMetadata(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const gradeSheetInfo = {
            student: { id: '', name: '', programType: '', program: '' },
            institution: {
                name: DEFAULT_INSTITUTION.name,
                addressLines: DEFAULT_INSTITUTION.addressLines.slice()
            },
            semesterOrder: []
        };
        const courseMeta = {};
        let currentSemesterName = null;
        let collectingProgram = false;
        let programParts = [];

        const finalizeProgram = () => {
            if (collectingProgram) {
                gradeSheetInfo.student.program = programParts.join(' ').trim();
                collectingProgram = false;
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            const idMatch = parseStudentIdLine(line);
            if (idMatch) {
                gradeSheetInfo.student.id = idMatch.id;
                gradeSheetInfo.student.programType = idMatch.programType;
                continue;
            }

            const nameMatch = parseNameLine(line);
            if (nameMatch) {
                gradeSheetInfo.student.name = nameMatch.name;
                programParts = nameMatch.programStart ? [nameMatch.programStart] : [];
                collectingProgram = true;
                continue;
            }

            const semesterName = parseSemesterHeader(line);
            if (semesterName) {
                finalizeProgram();
                currentSemesterName = semesterName;
                if (!gradeSheetInfo.semesterOrder.includes(semesterName)) {
                    gradeSheetInfo.semesterOrder.push(semesterName);
                }
                continue;
            }

            if (collectingProgram) {
                if (isPlainContinuationLine(line)) {
                    programParts.push(line);
                    continue;
                }
                finalizeProgram();
            }

            const course = parseCourseLine(line);
            if (course) {
                let title = course.title;
                const next = lines[i + 1];
                if (next && isPlainContinuationLine(next) && !parseCourseLine(next)) {
                    title = `${title} ${next}`.trim();
                    i++;
                }
                if (currentSemesterName) {
                    courseMeta[course.courseCode] = {
                        title,
                        grade: course.grade,
                        semesterName: currentSemesterName
                    };
                }
            }
        }

        finalizeProgram();

        return { gradeSheetInfo, courseMeta };
    }
```

Update the final `return { ... };` to add `extractGradeSheetMetadata`:

```js
    return {
        DEFAULT_INSTITUTION,
        GRADE_SCALE,
        pointsToLetter,
        parseStudentIdLine,
        parseNameLine,
        parseSemesterHeader,
        isPlainContinuationLine,
        parseCourseLine,
        extractGradeSheetMetadata
    };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/gradesheet-utils.test.js`
Expected: `All 11 tests passed.`

- [ ] **Step 5: Commit**

```bash
git add gradesheet-utils.js tests/gradesheet-utils.test.js
git commit -m "Add extractGradeSheetMetadata for full-text header/semester parsing"
```

---

## Task 4: Export grouping + GPA math + `buildGradeSheetData`

**Files:**
- Modify: `gradesheet-utils.js`
- Modify: `tests/gradesheet-utils.test.js`

**Interfaces:**
- Consumes: `pointsToLetter`, `DEFAULT_INSTITUTION` from Task 1.
- Produces: `groupCoursesForExport(courses, gradeSheetInfo)`, `computeSummaries(semesters)`, `buildGradeSheetData(gradeSheetInfo, courses)`. Task 6/7 (browser-side `exportToPDF`) consumes `buildGradeSheetData` directly; its return shape is `{ institution, documentTitle, copyType, watermarkText, student, semesters }` where each `semesters[i]` is `{ name, courses: [{code,title,credits,grade,points}], summary: {semAttempted,semEarned,gpa,cumAttempted,cumEarned,cgpa} }`.

- [ ] **Step 1: Write the failing tests**

Insert before `let failed = 0;`:

```js
test('groupCoursesForExport: groups by semester in semesterOrder, buckets unknown-semester courses last', () => {
    const courses = [
        { courseCode: 'CSE110', title: 'PROGRAMMING LANGUAGE I', credits: 3, gradePoints: 4.00, semesterName: 'SPRING 2022' },
        { courseCode: 'CSE111', title: 'PROGRAMMING LANGUAGE-II', credits: 3, gradePoints: 3.70, semesterName: 'SUMMER 2022' },
        { courseCode: 'MANUAL1', credits: 3, gradePoints: 4.00, isManuallyAdded: true }
    ];
    const gradeSheetInfo = { semesterOrder: ['SPRING 2022', 'SUMMER 2022'] };

    const groups = utils.groupCoursesForExport(courses, gradeSheetInfo);

    assert.deepStrictEqual(groups, [
        { name: 'SPRING 2022', courses: [{ code: 'CSE110', title: 'PROGRAMMING LANGUAGE I', credits: 3, grade: 'A', points: 4.00 }] },
        { name: 'SUMMER 2022', courses: [{ code: 'CSE111', title: 'PROGRAMMING LANGUAGE-II', credits: 3, grade: 'A-', points: 3.70 }] },
        { name: 'ADDITIONAL COURSES', courses: [{ code: 'MANUAL1', title: '', credits: 3, grade: 'A', points: 4.00 }] }
    ]);
});

test('groupCoursesForExport: falls back to a single "COURSES" group with no metadata', () => {
    const courses = [
        { courseCode: 'CSE110', credits: 3, gradePoints: 4.00 },
        { courseCode: 'MAT110', credits: 3, gradePoints: 3.30 }
    ];

    const groups = utils.groupCoursesForExport(courses, null);

    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].name, 'COURSES');
    assert.strictEqual(groups[0].courses.length, 2);
});

test('computeSummaries: matches known real gradesheet GPA/CGPA figures', () => {
    // SPRING 2022: CSE110 3cr@4.00, ENG091 0cr@3.70, MAT110 3cr@3.30 -> GPA 3.65, CGPA 3.65
    // SUMMER 2022: CSE111 3cr@4.00, CSE230 3cr@3.70, ENG101 3cr@3.00, PHY111 3cr@2.00 -> GPA 3.175, cumulative CGPA 3.325
    const semesters = [
        {
            name: 'SPRING 2022',
            courses: [
                { code: 'CSE110', credits: 3, points: 4.00 },
                { code: 'ENG091', credits: 0, points: 3.70 },
                { code: 'MAT110', credits: 3, points: 3.30 }
            ]
        },
        {
            name: 'SUMMER 2022',
            courses: [
                { code: 'CSE111', credits: 3, points: 4.00 },
                { code: 'CSE230', credits: 3, points: 3.70 },
                { code: 'ENG101', credits: 3, points: 3.00 },
                { code: 'PHY111', credits: 3, points: 2.00 }
            ]
        }
    ];

    const result = utils.computeSummaries(semesters);

    assert.strictEqual(result[0].summary.semEarned, 6);
    assert.ok(Math.abs(result[0].summary.gpa - 3.65) < 0.001);
    assert.ok(Math.abs(result[0].summary.cgpa - 3.65) < 0.001);

    assert.strictEqual(result[1].summary.cumEarned, 18);
    assert.ok(Math.abs(result[1].summary.cgpa - 3.325) < 0.001);
});

test('buildGradeSheetData: assembles the full data object, with a placeholder student when metadata is missing', () => {
    const courses = [
        { courseCode: 'CSE110', title: 'PROGRAMMING LANGUAGE I', credits: 3, gradePoints: 4.00, semesterName: 'SPRING 2022' }
    ];
    const gradeSheetInfo = {
        student: { id: '22341082', name: 'Md Sakib Sadman Badhon', programType: 'UNDERGRADUATE PROGRAM', program: 'BACHELOR OF SCIENCE IN COMPUTER SCIENCE' },
        institution: utils.DEFAULT_INSTITUTION,
        semesterOrder: ['SPRING 2022']
    };

    const withInfo = utils.buildGradeSheetData(gradeSheetInfo, courses);
    assert.strictEqual(withInfo.student.id, '22341082');
    assert.strictEqual(withInfo.documentTitle, 'GRADE SHEET');
    assert.strictEqual(withInfo.copyType, 'UNOFFICIAL COPY');
    assert.strictEqual(withInfo.semesters[0].name, 'SPRING 2022');
    assert.ok(withInfo.semesters[0].summary);

    const withoutInfo = utils.buildGradeSheetData(null, courses);
    assert.strictEqual(withoutInfo.student.name, 'Student');
    assert.strictEqual(withoutInfo.student.id, '');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/gradesheet-utils.test.js`
Expected: `FAIL` on all four new tests with `TypeError: utils.groupCoursesForExport is not a function` (and similarly for `computeSummaries`, `buildGradeSheetData`).

- [ ] **Step 3: Implement the three functions**

Add this code inside the factory function, after `extractGradeSheetMetadata` and before the final `return`:

```js
    function groupCoursesForExport(courses, gradeSheetInfo) {
        const order = (gradeSheetInfo && gradeSheetInfo.semesterOrder) || [];
        const groups = new Map();
        const extra = [];

        const toEntry = (course) => ({
            code: course.courseCode,
            title: course.title || '',
            credits: course.credits,
            grade: pointsToLetter(course.gradePoints),
            points: course.gradePoints
        });

        courses.forEach(course => {
            const entry = toEntry(course);
            if (course.semesterName && order.includes(course.semesterName)) {
                if (!groups.has(course.semesterName)) groups.set(course.semesterName, []);
                groups.get(course.semesterName).push(entry);
            } else {
                extra.push(entry);
            }
        });

        const semesters = order
            .filter(name => groups.has(name))
            .map(name => ({ name, courses: groups.get(name) }));

        if (extra.length > 0) {
            semesters.push({ name: 'ADDITIONAL COURSES', courses: extra });
        }

        if (semesters.length === 0) {
            return [{ name: 'COURSES', courses: courses.map(toEntry) }];
        }

        return semesters;
    }

    function computeSummaries(semesters) {
        let cumAttempted = 0, cumEarned = 0, cumQualityPoints = 0;

        return semesters.map((sem) => {
            let semAttempted = 0, semEarned = 0, semQP = 0;

            sem.courses.forEach((c) => {
                const earned = Number(c.credits) || 0;
                const attempted = c.attempted != null ? Number(c.attempted) : earned;
                semAttempted += attempted;
                semEarned += earned;
                semQP += earned * Number(c.points);
            });

            cumAttempted += semAttempted;
            cumEarned += semEarned;
            cumQualityPoints += semQP;

            const auto = {
                semAttempted, semEarned,
                gpa: semEarned > 0 ? semQP / semEarned : 0,
                cumAttempted, cumEarned,
                cgpa: cumEarned > 0 ? cumQualityPoints / cumEarned : 0
            };
            return { ...sem, summary: { ...auto, ...(sem.summary || {}) } };
        });
    }

    function buildGradeSheetData(gradeSheetInfo, courses) {
        const info = gradeSheetInfo || null;
        const student = (info && info.student && info.student.id)
            ? info.student
            : { id: '', name: 'Student', programType: '', program: '' };
        const institution = (info && info.institution) || DEFAULT_INSTITUTION;
        const semesters = computeSummaries(groupCoursesForExport(courses, info));

        return {
            institution,
            documentTitle: 'GRADE SHEET',
            copyType: 'UNOFFICIAL COPY',
            watermarkText: 'UNOFFICIAL',
            student,
            semesters
        };
    }
```

Update the final `return { ... };` to add the three new functions:

```js
    return {
        DEFAULT_INSTITUTION,
        GRADE_SCALE,
        pointsToLetter,
        parseStudentIdLine,
        parseNameLine,
        parseSemesterHeader,
        isPlainContinuationLine,
        parseCourseLine,
        extractGradeSheetMetadata,
        groupCoursesForExport,
        computeSummaries,
        buildGradeSheetData
    };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/gradesheet-utils.test.js`
Expected: `All 15 tests passed.`

- [ ] **Step 5: Commit**

```bash
git add gradesheet-utils.js tests/gradesheet-utils.test.js
git commit -m "Add export grouping, GPA computation, and gradesheet data assembly"
```

---

## Task 5: Wire metadata capture into `script.js`

**Files:**
- Modify: `script.js:6-11` (constructor)
- Modify: `script.js:260-325` (`parseGradeSheet`)
- Modify: `script.js:477-483` (`parseExcelData`)
- Modify: `index.html:283-288` (script tags)

**Interfaces:**
- Consumes: `GradeSheetUtils.extractGradeSheetMetadata`, `GradeSheetUtils.pointsToLetter` (Tasks 1-3), loaded as `window.GradeSheetUtils` via a new `<script>` tag.
- Produces: `this.gradeSheetInfo` on `GradeSheetAnalyzer` instances; each course object gains `title`, `grade`, `semesterName` fields. Task 7's `exportToPDF` consumes `this.gradeSheetInfo` and the enriched `this.courses`.

- [ ] **Step 1: Load `gradesheet-utils.js` before `script.js`**

In `index.html`, replace:

```html
    <!-- Load PDF.js immediately for first-time users -->
    <script async src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script defer src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

    <!-- Custom JavaScript with defer -->
    <script defer src="script.js"></script>
```

with:

```html
    <!-- Load PDF.js immediately for first-time users -->
    <script async src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script defer src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

    <!-- Gradesheet metadata/PDF helper modules (loaded in order before script.js) -->
    <script defer src="gradesheet-utils.js"></script>

    <!-- Custom JavaScript with defer -->
    <script defer src="script.js"></script>
```

- [ ] **Step 2: Track `gradeSheetInfo` on the analyzer instance**

In `script.js`, replace the constructor:

```js
    constructor() {
        this.courses = [];
        this.originalCourses = []; // Store original grade points
        this.initializeEventListeners();
        this.showWelcomeMessage();
    }
```

with:

```js
    constructor() {
        this.courses = [];
        this.originalCourses = []; // Store original grade points
        this.gradeSheetInfo = null; // Student/semester metadata captured from the PDF
        this.initializeEventListeners();
        this.showWelcomeMessage();
    }
```

- [ ] **Step 3: Capture metadata and enrich courses in `parseGradeSheet`**

In `script.js`, replace:

```js
    parseGradeSheet(text) {
        this.courses = [];
        this.originalCourses = [];
```

with:

```js
    parseGradeSheet(text) {
        this.courses = [];
        this.originalCourses = [];

        const { gradeSheetInfo, courseMeta } = GradeSheetUtils.extractGradeSheetMetadata(text);
        this.gradeSheetInfo = gradeSheetInfo;
```

Then replace the end of the same method:

```js
        this.courses = Array.from(courseMap.values());
        this.originalCourses = this.courses.map(course => ({...course}));
    }
```

with:

```js
        this.courses = Array.from(courseMap.values());
        this.enrichCoursesWithMetadata(courseMeta);
        this.originalCourses = this.courses.map(course => ({...course}));
    }

    /**
     * Attach title, letter grade, and originating semester name to each
     * parsed course using the metadata captured by GradeSheetUtils.
     */
    enrichCoursesWithMetadata(courseMeta) {
        this.courses.forEach(course => {
            const meta = courseMeta[course.courseCode];
            course.title = meta ? meta.title : '';
            course.semesterName = meta ? meta.semesterName : null;
            // Original letter grade as parsed from the PDF; this may go stale
            // if the user later edits gradePoints, but exportToPDF always
            // recomputes the letter fresh from current gradePoints via
            // GradeSheetUtils.pointsToLetter, so staleness here is harmless.
            course.grade = meta ? meta.grade : GradeSheetUtils.pointsToLetter(course.gradePoints);
        });
    }
```

- [ ] **Step 4: Reset `gradeSheetInfo` on Excel import**

In `script.js`, replace:

```js
    parseExcelData(data) {
        this.courses = [];
        this.originalCourses = [];

        if (!data || data.length === 0) {
```

with:

```js
    parseExcelData(data) {
        this.courses = [];
        this.originalCourses = [];
        this.gradeSheetInfo = null; // Excel imports carry no PDF metadata

        if (!data || data.length === 0) {
```

- [ ] **Step 5: Manually verify no regression and correct metadata capture**

Start a local static server from the project root (needed later for `fetch()`-based asset loading in Task 6, so set this up now):

```bash
npx --yes serve -l 8080 .
```

Open `http://localhost:8080/` in a browser, upload `GradeCanvas/example_gradesheet.pdf`, and confirm:
- The course table displays exactly as before (course code, credits, editable grade points) — no visible change.
- The summary cards (Total Courses, CGPA, etc.) show the same numbers as before this change.

In the browser devtools console, run:

```js
analyzer.gradeSheetInfo.student
analyzer.gradeSheetInfo.semesterOrder
analyzer.courses.find(c => c.courseCode === 'CSE110')
```

Expected: `student.id` is `"22341082"`, `student.name` is `"Md Sakib Sadman Badhon"`, `semesterOrder` starts with `"SPRING 2022"`, and the `CSE110` course object has `title: "PROGRAMMING LANGUAGE I"`, `grade: "A"`, `semesterName: "SPRING 2022"`.

- [ ] **Step 6: Commit**

```bash
git add script.js index.html
git commit -m "Capture full gradesheet metadata during PDF parsing"
```

---

## Task 6: `gradesheet-pdf.js` drawing module + BRAC logo asset

**Files:**
- Create: `gradesheet-pdf.js`
- Create: `brac_logo.png` (copied from `GradeCanvas/brac_logo.png`)

**Interfaces:**
- Consumes: nothing from this codebase (browser-only, uses `window.jspdf` once loaded).
- Produces: `window.GradeSheetPDF.loadPdfLibraries(): Promise<void>`, `window.GradeSheetPDF.loadLogoDataUrl(): Promise<string|null>`, `window.GradeSheetPDF.generateGradeSheetPDF(data, fileName)` where `data` is exactly the shape `GradeSheetUtils.buildGradeSheetData` returns (Task 4). Task 7's `exportToPDF` consumes all three.

- [ ] **Step 1: Copy the logo asset**

```bash
cp GradeCanvas/brac_logo.png brac_logo.png
```

- [ ] **Step 2: Create `gradesheet-pdf.js`**

```js
(function () {
    'use strict';

    const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    const AUTOTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
    const LOGO_PATH = 'brac_logo.png';

    let pdfLibsPromise = null;
    let logoDataUrlPromise = null;

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${url}`));
            document.head.appendChild(script);
        });
    }

    function loadPdfLibraries() {
        if (!pdfLibsPromise) {
            pdfLibsPromise = (async () => {
                if (typeof window.jspdf === 'undefined') {
                    await loadScript(JSPDF_URL);
                }
                if (typeof window.jspdf.jsPDF.API.autoTable === 'undefined') {
                    await loadScript(AUTOTABLE_URL);
                }
            })();
        }
        return pdfLibsPromise;
    }

    function loadLogoDataUrl() {
        if (!logoDataUrlPromise) {
            logoDataUrlPromise = fetch(LOGO_PATH)
                .then(res => {
                    if (!res.ok) throw new Error(`Logo fetch failed: ${res.status}`);
                    return res.blob();
                })
                .then(blob => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(blob);
                }))
                .catch(err => {
                    console.error('Could not load BRAC logo for PDF export:', err);
                    return null;
                });
        }
        return logoDataUrlPromise;
    }

    const L = {
        pageFormat: 'a4',
        marginLR: 12,
        headerHeight: 60,
        marginBottom: 14,
        colWidths: [24, 38, 26, 34, 26, 16, 22],
        grayFill: [211, 211, 211],
        headFill: [0, 0, 0],
        headText: [255, 255, 255],
        fontBody: 9,
        fontHead: 9,
        watermarkFontSize: 110,
        watermarkOpacity: 0.13,
        watermarkAngle: 55
    };

    const f2 = (n) => Number(n).toFixed(2);

    function generateGradeSheetPDF(data, fileName) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: L.pageFormat, compress: true });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const totalPagesExp = '{total_pages_count_string}';

        const semesters = data.semesters;

        const body = [];
        semesters.forEach((sem) => {
            body.push([{
                content: `SEMESTER:    ${sem.name}`,
                colSpan: 7,
                styles: { fillColor: L.grayFill, fontStyle: 'bolditalic' }
            }]);

            sem.courses.forEach((c) => {
                body.push([
                    { content: c.code, styles: { halign: 'left' } },
                    { content: c.title, colSpan: 3, styles: { halign: 'left' } },
                    { content: f2(c.credits), styles: { halign: 'center' } },
                    { content: c.grade, styles: { halign: 'left' } },
                    { content: f2(c.points), styles: { halign: 'center' } }
                ]);
            });

            const s = sem.summary;
            const summaryRow = (label, attempted, earned, gpaLabel, gpaValue) => ([
                { content: label, styles: { fillColor: L.grayFill } },
                { content: 'Credits Attempted', styles: { fillColor: L.grayFill } },
                { content: f2(attempted), styles: { fillColor: L.grayFill, halign: 'left' } },
                { content: 'Credits Earned', styles: { fillColor: L.grayFill } },
                { content: f2(earned), styles: { fillColor: L.grayFill, halign: 'center' } },
                { content: gpaLabel, styles: { fillColor: L.grayFill, halign: 'center' } },
                { content: f2(gpaValue), styles: { fillColor: L.grayFill, halign: 'center' } }
            ]);
            body.push(summaryRow('SEMESTER', s.semAttempted, s.semEarned, 'GPA', s.gpa));
            body.push(summaryRow('CUMULATIVE', s.cumAttempted, s.cumEarned, 'CGPA', s.cgpa));
        });

        function drawHeader(pageNumber) {
            const cx = pageW / 2;
            let y = 14;

            if (data.institution.logo) {
                try {
                    doc.addImage(
                        data.institution.logo, 'PNG',
                        cx - 60, y - 4,
                        data.institution.logoWidthMm || 18,
                        data.institution.logoHeightMm || 18
                    );
                } catch (e) { /* bad image data - skip logo rather than fail */ }
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.text(data.institution.name, cx, y + 2, { align: 'center' });

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(10);
            doc.text(`Page ${pageNumber} of ${totalPagesExp}`, pageW - L.marginLR, y + 2, { align: 'right' });

            y += 8;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            (data.institution.addressLines || []).forEach((line) => {
                doc.text(line, cx, y, { align: 'center' });
                y += 4.5;
            });

            y += 4;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.text(data.documentTitle || 'GRADE SHEET', cx, y, { align: 'center' });
            if (data.copyType) {
                y += 6.5;
                doc.setFontSize(11);
                doc.text(data.copyType, cx, y, { align: 'center' });
            }

            y += 9;
            const labelX = L.marginLR + 4;
            const colonX = labelX + 26;
            const valueX = colonX + 6;
            const rightX = cx - 2;

            doc.setFont('helvetica', 'bolditalic');
            doc.setFontSize(10.5);
            doc.text('Student ID', labelX, y);
            doc.text(':', colonX, y);
            doc.text(String(data.student.id), valueX, y);
            doc.text(data.student.programType || '', rightX, y);

            y += 6;
            doc.text('Name', labelX, y);
            doc.text(':', colonX, y);
            doc.text(data.student.name, valueX, y);

            doc.setFont('helvetica', 'italic');
            const programText = `PROGRAM: ${data.student.program}`;
            const wrapped = doc.splitTextToSize(programText, pageW - rightX - L.marginLR);
            doc.text(wrapped, rightX, y);
        }

        doc.autoTable({
            startY: L.headerHeight,
            margin: { top: L.headerHeight, bottom: L.marginBottom, left: L.marginLR, right: L.marginLR },
            head: [[
                { content: 'Course No' },
                { content: 'Course Title', colSpan: 3 },
                { content: 'Credits Earned', styles: { halign: 'center' } },
                { content: 'Grade' },
                { content: 'Grade Points', styles: { halign: 'center' } }
            ]],
            body,
            theme: 'plain',
            styles: {
                font: 'helvetica',
                fontSize: L.fontBody,
                cellPadding: { top: 1.6, bottom: 1.6, left: 1.5, right: 1.5 },
                textColor: [0, 0, 0],
                overflow: 'linebreak',
                valign: 'middle'
            },
            headStyles: {
                fillColor: L.headFill,
                textColor: L.headText,
                fontStyle: 'bold',
                fontSize: L.fontHead
            },
            columnStyles: Object.fromEntries(
                L.colWidths.map((w, i) => [i, { cellWidth: w }])
            ),
            rowPageBreak: 'avoid',
            didDrawPage: (hookData) => drawHeader(hookData.pageNumber)
        });

        if (data.watermarkText) {
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.saveGraphicsState();
                doc.setGState(new doc.GState({ opacity: L.watermarkOpacity }));
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(L.watermarkFontSize);
                doc.setTextColor(120, 120, 120);
                doc.text(data.watermarkText, pageW / 2, pageH / 2 + 60, {
                    align: 'center',
                    angle: L.watermarkAngle
                });
                doc.restoreGraphicsState();
            }
        }

        if (typeof doc.putTotalPages === 'function') {
            doc.putTotalPages(totalPagesExp);
        }

        doc.save(fileName || `gradesheet_${data.student.id}.pdf`);
    }

    window.GradeSheetPDF = {
        loadPdfLibraries,
        loadLogoDataUrl,
        generateGradeSheetPDF
    };
})();
```

- [ ] **Step 3: Load `gradesheet-pdf.js` in `index.html`**

Replace:

```html
    <!-- Gradesheet metadata/PDF helper modules (loaded in order before script.js) -->
    <script defer src="gradesheet-utils.js"></script>
```

with:

```html
    <!-- Gradesheet metadata/PDF helper modules (loaded in order before script.js) -->
    <script defer src="gradesheet-utils.js"></script>
    <script defer src="gradesheet-pdf.js"></script>
```

- [ ] **Step 4: Manually verify the module loads and the logo resolves**

With the `npx serve` server from Task 5 still running (or restarted with `npx --yes serve -l 8080 .`), open `http://localhost:8080/` and in devtools console run:

```js
await GradeSheetPDF.loadPdfLibraries();
typeof window.jspdf.jsPDF   // expect "function"
const logo = await GradeSheetPDF.loadLogoDataUrl();
logo.startsWith('data:image/png')   // expect true
```

- [ ] **Step 5: Commit**

```bash
git add gradesheet-pdf.js brac_logo.png index.html
git commit -m "Add client-side PDF drawing module and BRAC logo asset"
```

---

## Task 7: Export dropdown UI + `exportToPDF` wiring

**Files:**
- Modify: `index.html:227-234` (controls section)
- Modify: `styles.css` (after line 380, the `.export-btn:hover` block)
- Modify: `script.js:42-55` (click listener), and add new methods after `exportToExcel` (ends at `script.js:928`)

**Interfaces:**
- Consumes: `GradeSheetUtils.buildGradeSheetData` (Task 4), `GradeSheetPDF.loadPdfLibraries` / `loadLogoDataUrl` / `generateGradeSheetPDF` (Task 6), `this.gradeSheetInfo` / `this.courses` (Task 5).
- Produces: a working "Export to PDF" menu item; no further tasks consume this.

- [ ] **Step 1: Replace the controls section markup in `index.html`**

Replace:

```html
            <!-- Controls Section -->
            <div class="controls-section">
                <button id="resetBtn" class="control-btn reset-btn">
                Reset to Original
                </button>
                <button id="exportBtn" class="control-btn export-btn">
                    Export to Excel
                </button>
            </div>
```

with:

```html
            <!-- Controls Section -->
            <div class="controls-section">
                <button id="resetBtn" class="control-btn reset-btn">
                Reset to Original
                </button>
                <div class="export-dropdown">
                    <button id="exportMenuBtn" class="control-btn export-btn" type="button" aria-haspopup="true" aria-expanded="false">
                        Export &#9662;
                    </button>
                    <div id="exportMenu" class="export-menu" role="menu">
                        <button id="exportExcelBtn" class="export-menu-item" role="menuitem" type="button">Export to Excel</button>
                        <button id="exportPdfBtn" class="export-menu-item" role="menuitem" type="button">Export to PDF</button>
                    </div>
                </div>
            </div>
```

- [ ] **Step 2: Add dropdown styles to `styles.css`**

Insert this block right after the `.export-btn:hover { ... }` rule (the one ending around line 380, just before the `/* Editable grade points */` comment):

```css
.export-dropdown {
    position: relative;
    display: inline-block;
}

.export-menu {
    display: none;
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 50%;
    transform: translateX(-50%);
    background: #24273a;
    border: 1px solid #5b6078;
    border-radius: 12px;
    padding: 0.5rem;
    min-width: 180px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.35);
    z-index: 100;
}

.export-menu.show {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.export-menu-item {
    background: transparent;
    border: none;
    color: #cad3f5;
    padding: 0.6rem 0.9rem;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
}

.export-menu-item:hover {
    background: #363a4f;
}
```

- [ ] **Step 3: Wire the dropdown and `exportToPDF` in `script.js`**

Replace the click listener:

```js
        // Control buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'resetBtn') {
                this.resetToOriginal();
            } else if (e.target.id === 'exportBtn') {
                this.exportToExcel();
            } else if (e.target.id === 'addCourseBtn') {
                this.addNewCourseRow();
            } else if (e.target.classList.contains('save-btn')) {
                this.saveNewCourse(e.target);
            } else if (e.target.classList.contains('cancel-btn')) {
                this.cancelNewCourse(e.target);
            }
        });
```

with:

```js
        // Control buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'resetBtn') {
                this.resetToOriginal();
            } else if (e.target.id === 'exportMenuBtn') {
                this.toggleExportMenu();
            } else if (e.target.id === 'exportExcelBtn') {
                this.closeExportMenu();
                this.exportToExcel();
            } else if (e.target.id === 'exportPdfBtn') {
                this.closeExportMenu();
                this.exportToPDF();
            } else if (e.target.id === 'addCourseBtn') {
                this.addNewCourseRow();
            } else if (e.target.classList.contains('save-btn')) {
                this.saveNewCourse(e.target);
            } else if (e.target.classList.contains('cancel-btn')) {
                this.cancelNewCourse(e.target);
            } else if (!e.target.closest('.export-dropdown')) {
                this.closeExportMenu();
            }
        });
```

Then add these new methods immediately after the closing brace of `exportToExcel()` (right before the `/** * Display parsed results on the webpage */` comment):

```js
    /**
     * Toggle the Export dropdown menu open/closed.
     */
    toggleExportMenu() {
        const menu = document.getElementById('exportMenu');
        const btn = document.getElementById('exportMenuBtn');
        const isOpen = menu.classList.toggle('show');
        btn.setAttribute('aria-expanded', String(isOpen));
    }

    /**
     * Close the Export dropdown menu.
     */
    closeExportMenu() {
        const menu = document.getElementById('exportMenu');
        const btn = document.getElementById('exportMenuBtn');
        if (menu) menu.classList.remove('show');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    /**
     * Export the current (edited) course list as a BRACU-style gradesheet PDF.
     */
    async exportToPDF() {
        if (this.courses.length === 0) {
            this.showError('No courses to export');
            return;
        }

        try {
            this.showLoading(true);
            await GradeSheetPDF.loadPdfLibraries();
            const logo = await GradeSheetPDF.loadLogoDataUrl();

            const data = GradeSheetUtils.buildGradeSheetData(this.gradeSheetInfo, this.courses);
            if (logo) {
                data.institution.logo = logo;
                data.institution.logoWidthMm = 18;
                data.institution.logoHeightMm = 18;
            }

            const dateStr = new Date().toISOString().split('T')[0];
            const idPart = (this.gradeSheetInfo && this.gradeSheetInfo.student.id) || 'export';
            GradeSheetPDF.generateGradeSheetPDF(data, `gradesheet_${idPart}_${dateStr}.pdf`);

            this.showSuccessMessage('PDF gradesheet exported successfully!');
        } catch (error) {
            console.error('PDF export error:', error);
            this.showError('Failed to export PDF. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }
```

- [ ] **Step 4: Manually verify the dropdown and PDF export**

With the server from Task 5 running, open `http://localhost:8080/`, upload `GradeCanvas/example_gradesheet.pdf`, then:
1. Click the "Export ▾" button — confirm the menu opens showing "Export to Excel" and "Export to PDF".
2. Click elsewhere on the page — confirm the menu closes.
3. Click "Export to PDF" — confirm a file named `gradesheet_22341082_<today>.pdf` downloads.
4. Open the downloaded PDF — confirm it shows the BRAC University logo, student ID/name, "UNOFFICIAL" watermark, and course rows grouped by semester with correct GPA/CGPA figures.
5. Click "Export to Excel" — confirm the existing `.xlsx` export still works unchanged.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css script.js
git commit -m "Add Export dropdown and wire PDF gradesheet export"
```

---

## Task 8: End-to-end verification of edits reflected in the exported PDF

**Files:** none (verification only)

**Interfaces:** none — this task exercises the full stack built in Tasks 1-7.

- [ ] **Step 1: Verify edits/deletes/additions are reflected in the export**

With the server running, open `http://localhost:8080/`, upload `GradeCanvas/example_gradesheet.pdf`, then:
1. Change `CSE110`'s grade points from `4.00` to `3.00` in the table.
2. Delete the `PHY111` course (Summer 2022).
3. Click "Add Course", enter `TST101` / credits `3` / grade points `4.00`, save it.
4. Click "Export ▾" → "Export to PDF".
5. Open the downloaded PDF and confirm:
   - `CSE110` shows grade `B` and points `3.00` under `SEMESTER: SPRING 2022`, and that semester's GPA/CGPA figures are recomputed lower than the original `3.65`.
   - `PHY111` does not appear anywhere in the Summer 2022 section, and Summer 2022's credit/GPA totals reflect its absence.
   - A trailing `SEMESTER: ADDITIONAL COURSES` section appears containing `TST101` with grade `A`, credits `3.00`, points `4.00`.

- [ ] **Step 2: Verify the Excel-import fallback path**

Upload any `.xlsx`/`.xls` file that the existing `processExcel` flow accepts (or construct one with columns "Course Code", "Credits", "Grade Points"). After it loads:
1. Click "Export ▾" → "Export to PDF".
2. Confirm the PDF still generates (no error), with a single `SEMESTER: COURSES` section listing all imported courses, and the student header showing blank/placeholder values instead of crashing.

- [ ] **Step 3: Visual fidelity spot-check**

Open `GradeCanvas/example-gradesheet-images/example_gradesheet_page-0001.jpg` side-by-side with the first page of a PDF exported from the unmodified `example_gradesheet.pdf` (no edits). Confirm the header layout, table styling, and watermark visually match.

- [ ] **Step 4: Run the full unit test suite one last time**

```bash
node tests/gradesheet-utils.test.js
```

Expected: `All 15 tests passed.`

No commit for this task — it's a verification pass over work already committed in Tasks 1-7. If any check fails, fix the relevant task's code, re-run the affected task's steps, and commit the fix separately.
