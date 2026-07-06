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
