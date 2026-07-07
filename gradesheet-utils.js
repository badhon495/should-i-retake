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
        // pdf.js's own text-extraction joins same-line items with exactly one
        // space regardless of their visual column gap, so this must not
        // require 2+ spaces before "PROGRAM:" (a `pdftotext -layout`-only
        // assumption that doesn't hold for the app's real extracted text).
        const m = line.match(/^Name\s*:\s*(.+?)(?:\s+PROGRAM:\s*(.*))?$/i);
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
        // Holds an "orphan" line - text that matched none of the recognized
        // patterns below - so it can be attached to whatever recognized line
        // comes next. Real BRACU gradesheets (per pdf.js's own Y-coordinate
        // line grouping, not `pdftotext -layout`) split some two-column
        // header rows onto separate lines (programType lands on its own line
        // immediately before "Student ID :") and wrap a two-line course title
        // AROUND its own code+numbers line: [title line 1] / [code+numbers,
        // no title text] / [title line 2]. Both cases are "an unclaimed plain
        // line immediately preceding the line that actually needs it".
        let pendingPlainLine = '';

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
                gradeSheetInfo.student.programType = idMatch.programType || pendingPlainLine;
                pendingPlainLine = '';
                continue;
            }

            const nameMatch = parseNameLine(line);
            if (nameMatch) {
                gradeSheetInfo.student.name = nameMatch.name;
                programParts = nameMatch.programStart ? [nameMatch.programStart] : [];
                collectingProgram = true;
                pendingPlainLine = '';
                continue;
            }

            const semesterName = parseSemesterHeader(line);
            if (semesterName) {
                finalizeProgram();
                currentSemesterName = semesterName;
                pendingPlainLine = '';
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
                if (!title) {
                    // Title-less code+numbers line means the row's title
                    // wrapped to two lines flanking it: the orphan line that
                    // preceded it is the first half, and (if present) the
                    // very next line is the second half. A course whose
                    // title already fits inline never needs either flank -
                    // only look here when the inline title came back empty,
                    // so a complete one-line title (e.g. the course right
                    // before a wrapped one) never steals its neighbor's text.
                    title = pendingPlainLine;
                    const next = lines[i + 1];
                    if (next && isPlainContinuationLine(next) && !parseCourseLine(next)) {
                        title = title ? `${title} ${next}`.trim() : next;
                        i++;
                    }
                }
                pendingPlainLine = '';
                if (currentSemesterName) {
                    courseMeta[course.courseCode] = {
                        title,
                        grade: course.grade,
                        semesterName: currentSemesterName
                    };
                }
                continue;
            }

            pendingPlainLine = isPlainContinuationLine(line) ? line : '';
        }

        finalizeProgram();

        return { gradeSheetInfo, courseMeta };
    }

    function enrichCourses(courses, courseMeta) {
        return courses.map(course => {
            const meta = courseMeta[course.courseCode];
            return {
                ...course,
                title: meta ? meta.title : (course.title || ''),
                semesterName: meta ? meta.semesterName : (course.semesterName || null),
                grade: meta ? meta.grade : (course.grade || pointsToLetter(course.gradePoints))
            };
        });
    }

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

        if (semesters.length === 0) {
            return [{ name: 'COURSES', courses: courses.map(toEntry) }];
        }

        if (extra.length > 0) {
            semesters.push({ name: 'ADDITIONAL COURSES', courses: extra });
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
        enrichCourses,
        groupCoursesForExport,
        computeSummaries,
        buildGradeSheetData
    };
});
