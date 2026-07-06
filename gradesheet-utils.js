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
});
