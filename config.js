/**
 * Configuration file for Grade Sheet Analyzer
 */

const CONFIG = {
    // PDF Processing Settings
    PDF: {
        MAX_FILE_SIZE_MB: 10,
        SUPPORTED_TYPES: ['application/pdf'],
        WORKER_URL: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    },
    
    // Course Parsing Settings
    PARSING: {
        COURSE_CODE_PATTERN: /^[A-Z]{2,4}\d{3}$/,
        DECIMAL_PATTERN: /\d+\.\d+/g,
        MAX_CREDITS: 10,
        MIN_CREDITS: 0,
        MAX_GRADE_POINTS: 4.0,
        MIN_GRADE_POINTS: 0.0,
        
        // Patterns to skip during parsing
        SKIP_PATTERNS: [
            'SEMESTER:',
            'CUMULATIVE',
            'Credits Attempted',
            'Course No',
            'Course Title',
            'GRADE SHEET',
            'Student ID',
            'BRAC University',
            'PROGRAM:',
            'Page ',
            'UNOFFICIAL COPY',
            'GPA ',
            'CGPA '
        ]
    },
    
    // UI Settings
    UI: {
        ANIMATION_DURATION: 500,
        ERROR_AUTO_HIDE_DELAY: 10000,
        SUCCESS_AUTO_HIDE_DELAY: 5000,
        SCROLL_BEHAVIOR: 'smooth'
    },
    
    // Debug Settings
    DEBUG: {
        ENABLE_CONSOLE_LOGS: true,
        ENABLE_PERFORMANCE_LOGGING: false,
        ENABLE_TEST_BUTTON: true
    }
};

// Freeze the configuration to prevent modification
Object.freeze(CONFIG);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
