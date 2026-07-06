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
