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
