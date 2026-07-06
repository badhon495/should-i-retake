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
    assert.ok(Math.abs(result[1].summary.cgpa - 3.333) < 0.001);
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
