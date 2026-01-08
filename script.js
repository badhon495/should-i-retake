/**
 * Grade Sheet Analyzer Class
 * Handles PDF upload, parsing, and course data extraction
 */
class GradeSheetAnalyzer {
    constructor() {
        this.courses = [];
        this.originalCourses = []; // Store original grade points
        this.initializeEventListeners();
        this.showWelcomeMessage();
    }

    /**
     * Initialize all event listeners for the application
     */
    initializeEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.type === 'application/pdf') {
                    this.processPDF(file);
                } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                          file.type === 'application/vnd.ms-excel' || 
                          file.name.endsWith('.xlsx') || 
                          file.name.endsWith('.xls')) {
                    this.processExcel(file);
                } else {
                    this.showError('Please select a valid PDF or Excel file (.pdf, .xlsx, .xls).');
                }
            }
        });

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

        // Remove the old add course form event listeners
        // document.addEventListener('input', (e) => {
        //     if (e.target.id === 'newCredits' || e.target.id === 'newGradePoints') {
        //         this.updateQualityPointsPreview();
        //     }
        // });

        // document.addEventListener('input', (e) => {
        //     if (e.target.id === 'newCourseCode') {
        //         e.target.value = e.target.value.toUpperCase();
        //     }
        // });

        // Drag and drop functionality
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                this.processPDF(file);
            } else {
                this.showError('Please drop a valid PDF file.');
            }
        });
    }

    /**
     * Show welcome message on page load
     */
    showWelcomeMessage() {
        // Grade Sheet Analyzer initialized and ready
    }

    /**
     * Check if PDF.js is ready
     */
    async ensurePDFJSReady() {
        return new Promise((resolve) => {
            if (typeof pdfjsLib !== 'undefined') {
                resolve();
                return;
            }

            // Update loading message for first-time users
            const loadingContent = document.querySelector('.loading-content');
            if (loadingContent) {
                loadingContent.textContent = 'Loading PDF processing library...';
            }

            const checkInterval = setInterval(() => {
                if (typeof pdfjsLib !== 'undefined') {
                    clearInterval(checkInterval);
                    // Reset loading message
                    if (loadingContent) {
                        loadingContent.textContent = 'Processing your grade sheet...';
                    }
                    resolve();
                }
            }, 50);

            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 10000);
        });
    }

    /**
     * Process uploaded PDF file
     */
    async processPDF(file) {
        try {
            this.showLoading(true);
            this.hideError();
            this.hideResults();

            // Ensure PDF.js is loaded
            await this.ensurePDFJSReady();

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            let fullText = '';

            // Extract text from all pages with optimized processing
            const pagePromises = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                pagePromises.push(this.extractPageText(pdf, i));
            }

            // Process pages in parallel
            const pageTexts = await Promise.all(pagePromises);
            fullText = pageTexts.join('\n');

            // Parse the extracted text
            this.parseGradeSheet(fullText);

            if (this.courses.length === 0) {
                this.showError(`No courses found in the PDF. Please make sure this is a valid grade sheet.`);
                return;
            }

            this.displayResults();
            this.showSuccessMessage(`Successfully extracted ${this.courses.length} courses from your grade sheet!`);

        } catch (error) {
            console.error('Error processing PDF:', error);
            this.showError('Error processing PDF. Please try again with a different file.');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Extract text from a single PDF page (optimized)
     */
    async extractPageText(pdf, pageNumber) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();

        // Use Map for faster Y-coordinate grouping
        const lineMap = new Map();

        // Group text items by Y coordinate efficiently
        for (const item of textContent.items) {
            const y = Math.round(item.transform[5]);
            const x = item.transform[4];

            if (!lineMap.has(y)) {
                lineMap.set(y, []);
            }
            lineMap.get(y).push({ text: item.str, x });
        }

        // Sort lines by Y coordinate and combine text
        const sortedLines = Array.from(lineMap.entries())
            .sort((a, b) => b[0] - a[0]) // Sort by Y (top to bottom)
            .map(([_, items]) => {
                // Sort items on same line by X coordinate
                return items
                    .sort((a, b) => a.x - b.x)
                    .map(item => item.text)
                    .join(' ')
                    .trim();
            })
            .filter(line => line.length > 0);

        return sortedLines.join('\n');
    }

    /**
     * Process uploaded Excel file
     */
    async processExcel(file) {
        try {
            this.showLoading(true);
            this.hideError();
            this.hideResults();

            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });

            // Get the first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert to JSON
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Parse the Excel data
            this.parseExcelData(data);

            if (this.courses.length === 0) {
                this.showError(`No valid courses found in the Excel file. Please make sure the file contains columns for Course Code, Credits, and Grade Points.`);
                return;
            }

            this.displayResults();
            this.showSuccessMessage(`Successfully imported ${this.courses.length} courses from your Excel file!`);

        } catch (error) {
            console.error('Error processing Excel:', error);
            this.showError('Error processing Excel file. Please check the file format and try again.');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Parse grade sheet text and extract course information (optimized)
     */
    parseGradeSheet(text) {
        this.courses = [];
        this.originalCourses = [];

        // Cache regex patterns for better performance
        const courseCodePattern = /^([A-Z]{2,4}\d{3}[A-Z]?[A-Z0-9]?)/;
        const numbersPattern = /\d+\.\d+/g;
        const retakePatterns = {
            rp: /\b(RP|\(RP\)|\( RP \))\b/i,
            rt: /\b(RT|\(RT\)|\( RT \))\b/i
        };

        const lines = text.split('\n').map(line => line.trim()).filter(line => line && !this.shouldSkipLine(line));
        const courseMap = new Map();

        // Optimized line parsing
        for (const line of lines) {
            const courseMatch = line.match(courseCodePattern);

            if (courseMatch) {
                const courseCode = courseMatch[1];

                // Optimized retake detection
                const hasRP = retakePatterns.rp.test(line);
                const hasRT = retakePatterns.rt.test(line);
                const isRetake = hasRP || hasRT;

                // Extract numbers efficiently
                const numbers = line.match(numbersPattern);

                if (numbers && numbers.length >= 2) {
                    let credits = parseFloat(numbers[0]);
                    const gradePoints = parseFloat(numbers[numbers.length - 1]);

                    const isFailedCourse = credits === 0 && gradePoints === 0;
                    const isPrepCourse = this.isPrepCourse(courseCode);

                    if (isFailedCourse && !isPrepCourse) {
                        credits = this.getStandardCredits(courseCode);
                    }

                    if (this.isValidCourse(credits, gradePoints)) {
                        const courseData = {
                            courseCode,
                            credits,
                            gradePoints,
                            qualityPoints: credits * gradePoints,
                            isRetake,
                            retakeType: isRetake ? (hasRP && hasRT ? 'RP/RT' : (hasRP ? 'RP' : 'RT')) : null,
                            isFailed: isFailedCourse && !isPrepCourse
                        };

                        this.handleDuplicateCourse(courseMap, courseData);
                    }
                }
            }
        }

        // Fallback to word-by-word parsing only if no courses found
        if (courseMap.size === 0) {
            this.parseWordByWord(text.replace(/\s+/g, ' ').split(' '), courseMap);
        }

        this.courses = Array.from(courseMap.values());
        this.originalCourses = this.courses.map(course => ({...course}));
    }

    /**
     * Check if course is a prep course
     */
    isPrepCourse(courseCode) {
        return ['MAT091', 'MAT092', 'ENG091'].includes(courseCode);
    }

    /**
     * Validate course credits and grade points
     */
    isValidCourse(credits, gradePoints) {
        return credits >= 0 && credits <= 10 && gradePoints >= 0 && gradePoints <= 4.0;
    }

    /**
     * Handle duplicate courses by prioritizing retake courses with (RP) or (RT) notation
     * For multiple retakes, prioritize the one with the highest grade points
     */
    handleDuplicateCourse(courseMap, newCourseData) {
        const courseCode = newCourseData.courseCode;

        if (courseMap.has(courseCode)) {
            const existingCourse = courseMap.get(courseCode);

            // If the new course is a retake and the existing one is not, replace it
            if (newCourseData.isRetake && !existingCourse.isRetake) {
                courseMap.set(courseCode, newCourseData);
            }
            // If the existing course is a retake and the new one is not, keep the existing one
            else if (existingCourse.isRetake && !newCourseData.isRetake) {
                // Keep existing retake
                return;
            }
            // If both are retakes, keep the one with higher grade points (latest/better grade)
            else if (existingCourse.isRetake && newCourseData.isRetake) {
                if (newCourseData.gradePoints > existingCourse.gradePoints) {
                    courseMap.set(courseCode, newCourseData);
                }
            }
            // If both are originals, keep the first one found
        } else {
            // First occurrence of this course
            courseMap.set(courseCode, newCourseData);
        }
    }
    
    /**
     * Get standard credit hours for a course based on course code patterns
     */
    getStandardCredits(courseCode) {
        // Common BRAC University credit patterns
        if (courseCode.match(/^(CSE|EEE|ECE)\d{3}$/)) {
            return 3; // Most CSE/EEE/ECE courses are 3 credits
        } else if (courseCode.match(/^(CSE|EEE|ECE)\d{3}L$/)) {
            return 1; // Lab courses are typically 1 credit
        } else if (courseCode.match(/^MAT\d{3}$/)) {
            return 3; // Math courses are typically 3 credits
        } else if (courseCode.match(/^(PHY|CHE)\d{3}$/)) {
            return 3; // Physics/Chemistry courses are typically 3 credits
        } else if (courseCode.match(/^(PHY|CHE)\d{3}L$/)) {
            return 1; // Lab courses are typically 1 credit
        } else if (courseCode.match(/^ENG\d{3}$/)) {
            return 3; // English courses are typically 3 credits
        } else if (courseCode.match(/^BUS\d{3}$/)) {
            return 3; // Business courses are typically 3 credits
        } else {
            // Default to 3 credits for unknown course patterns
            return 3;
        }
    }

    /**
     * Check if a line should be skipped during parsing
     */
    shouldSkipLine(line) {
        const skipPatterns = [
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
        ];
        
        return skipPatterns.some(pattern => line.includes(pattern));
    }
    
    /**
     * Alternative parsing method using word-by-word analysis (optimized)
     */
    parseWordByWord(words, courseMap) {
        const courseCodePattern = /^[A-Z]{2,4}\d{3}$/;
        const numberPattern = /^\d+\.\d+$/;

        for (let i = 0; i < words.length - 4; i++) {
            const word = words[i];

            if (courseCodePattern.test(word)) {
                // Check for retake notation in context
                const contextWords = words.slice(Math.max(0, i - 3), i + 10);
                const contextText = contextWords.join(' ');
                const hasRP = /\b(RP|\(RP\))\b/i.test(contextText);
                const hasRT = /\b(RT|\(RT\))\b/i.test(contextText);
                const isRetake = hasRP || hasRT;

                // Extract numbers efficiently
                const numbers = words.slice(i + 1, i + 10)
                    .filter(w => numberPattern.test(w))
                    .map(w => parseFloat(w));

                if (numbers.length >= 2) {
                    let credits = numbers[0];
                    const gradePoints = numbers[1];

                    const isFailedCourse = credits === 0 && gradePoints === 0;
                    const isPrepCourse = this.isPrepCourse(word);

                    if (isFailedCourse && !isPrepCourse) {
                        credits = this.getStandardCredits(word);
                    }

                    if (this.isValidCourse(credits, gradePoints)) {
                        const courseData = {
                            courseCode: word,
                            credits,
                            gradePoints,
                            qualityPoints: credits * gradePoints,
                            isRetake,
                            retakeType: isRetake ? (hasRP && hasRT ? 'RP/RT' : (hasRP ? 'RP' : 'RT')) : null,
                            isFailed: isFailedCourse && !isPrepCourse
                        };

                        this.handleDuplicateCourse(courseMap, courseData);
                        break;
                    }
                }
            }
        }
    }

    /**
     * Parse Excel data and extract course information
     */
    parseExcelData(data) {
        this.courses = [];
        this.originalCourses = [];

        if (!data || data.length === 0) {
            return;
        }

        // Find header row - look for common column names
        let headerRowIndex = -1;
        let courseCodeCol = -1;
        let creditsCol = -1;
        let gradePointsCol = -1;

        for (let i = 0; i < Math.min(5, data.length); i++) {
            const row = data[i];
            if (!Array.isArray(row)) continue;

            for (let j = 0; j < row.length; j++) {
                const cell = String(row[j]).toLowerCase().trim();

                if (cell.includes('course') && cell.includes('code')) {
                    courseCodeCol = j;
                    headerRowIndex = i;
                } else if (cell.includes('credit') && creditsCol === -1) {
                    creditsCol = j;
                    headerRowIndex = i;
                } else if (cell.includes('grade') && cell.includes('point') && gradePointsCol === -1) {
                    gradePointsCol = j;
                    headerRowIndex = i;
                }
            }

            // If we found all three columns, we're good
            if (courseCodeCol !== -1 && creditsCol !== -1 && gradePointsCol !== -1) {
                break;
            }
        }

        // If we couldn't find proper headers, try to guess based on first few rows
        if (headerRowIndex === -1) {
            headerRowIndex = 0;

            // Look at first data row to determine structure
            for (let i = 0; i < Math.min(3, data.length); i++) {
                const row = data[i];
                if (!Array.isArray(row) || row.length < 3) continue;

                // Look for course code pattern in first few columns
                for (let j = 0; j < Math.min(3, row.length); j++) {
                    const cell = String(row[j]).trim();
                    if (/^[A-Z]{2,4}\d{3}$/i.test(cell)) {
                        courseCodeCol = j;
                        creditsCol = j + 1;
                        gradePointsCol = j + 2;
                        headerRowIndex = i;
                        break;
                    }
                }

                if (courseCodeCol !== -1) break;
            }
        }

        if (courseCodeCol === -1 || creditsCol === -1 || gradePointsCol === -1) {
            return;
        }
        
        // Parse data rows
        const courseMap = new Map();
        const retakePatterns = {
            rp: /\b(rp|\(rp\)|\( rp \))\b/i,
            rt: /\b(rt|\(rt\)|\( rt \))\b/i
        };

        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!Array.isArray(row) || row.length < Math.max(courseCodeCol, creditsCol, gradePointsCol) + 1) {
                continue;
            }

            const courseCode = String(row[courseCodeCol] || '').trim();
            const creditsValue = row[creditsCol];
            const gradePointsValue = row[gradePointsCol];

            // Skip if course code doesn't look valid
            if (!courseCode || courseCode.toLowerCase().includes('summary') || courseCode.toLowerCase().includes('total')) {
                continue;
            }

            // Check for retake notation efficiently
            const rowText = row.join(' ').toLowerCase();
            const hasRP = retakePatterns.rp.test(rowText);
            const hasRT = retakePatterns.rt.test(rowText);
            const isRetake = hasRP || hasRT;
            const retakeType = isRetake ? (hasRP && hasRT ? 'RP/RT' : (hasRP ? 'RP' : 'RT')) : null;

            // Parse numeric values
            let credits = parseFloat(creditsValue);
            const gradePoints = parseFloat(gradePointsValue);

            // Handle failed courses
            const isFailedCourse = credits === 0 && gradePoints === 0;
            const isPrepCourse = this.isPrepCourse(courseCode.toUpperCase());

            if (isFailedCourse && !isPrepCourse) {
                credits = this.getStandardCredits(courseCode.toUpperCase());
            }

            // Validate values
            if (!this.isValidCourse(credits, gradePoints)) {
                continue;
            }

            const courseData = {
                courseCode: courseCode.toUpperCase(),
                credits,
                gradePoints,
                qualityPoints: credits * gradePoints,
                isManuallyAdded: false,
                isRetake,
                retakeType,
                isFailed: isFailedCourse && !isPrepCourse
            };

            this.handleDuplicateCourse(courseMap, courseData);
        }

        // Convert the course map to arrays
        this.courses = Array.from(courseMap.values());
        this.originalCourses = this.courses.map(course => ({...course}));
    }

    /**
     * Calculate CGPA from parsed courses
     */
    calculateCGPA() {
        if (this.courses.length === 0) return 0;
        
        const totalQualityPoints = this.courses.reduce((sum, course) => sum + course.qualityPoints, 0);
        const totalCredits = this.courses.reduce((sum, course) => sum + course.credits, 0);
        
        return totalCredits > 0 ? (totalQualityPoints / totalCredits) : 0;
    }

    /**
     * Calculate original CGPA from original courses (fixed value)
     */
    calculateOriginalCGPA() {
        if (this.originalCourses.length === 0) return 0;
        
        const totalQualityPoints = this.originalCourses.reduce((sum, course) => sum + course.qualityPoints, 0);
        const totalCredits = this.originalCourses.reduce((sum, course) => sum + course.credits, 0);
        
        return totalCredits > 0 ? (totalQualityPoints / totalCredits) : 0;
    }

    /**
     * Calculate total earned credits (excluding failed courses)
     */
    calculateEarnedCredits() {
        if (this.courses.length === 0) return 0;
        
        return this.courses.reduce((sum, course) => {
            // If it's a failed course (isFailed = true), don't count it as earned
            // Failed courses are those with 0 grade points originally
            if (course.isFailed || course.gradePoints === 0) {
                return sum;
            }
            return sum + course.credits;
        }, 0);
    }

    /**
     * Calculate total credit courses (courses that have credits > 0)
     */
    calculateCreditCourses() {
        if (this.courses.length === 0) return 0;
        
        return this.courses.filter(course => course.credits > 0).length;
    }

    /**
     * Calculate CGPA rounded according to BRAC University grading system
     * (The CGPA gets rounded up if the third decimal digit is 5 or more)
     */
    calculateActualCGPA(cgpa) {
        // Round to 2 decimal places according to BRACU system
        // If third decimal is 5 or more, round up
        const multiplied = cgpa * 100;
        const thirdDecimal = Math.floor((cgpa * 1000) % 10);
        
        if (thirdDecimal >= 5) {
            return Math.ceil(multiplied) / 100;
        } else {
            return Math.floor(multiplied) / 100;
        }
    }

    /**
     * Update summary cards with current values
     */
    updateSummaryCards() {
        document.getElementById('totalCourses').textContent = this.courses.length;
        document.getElementById('creditCourses').textContent = this.calculateCreditCourses();
        document.getElementById('totalCredits').textContent = this.courses.reduce((sum, course) => sum + course.credits, 0).toFixed(2);
        document.getElementById('earnedCredits').textContent = this.calculateEarnedCredits().toFixed(2);
        
        // If no courses have been deleted and no grade changes, show original CGPA
        // Otherwise, show the current calculated CGPA for both
        const currentCGPA = this.calculateCGPA();
        const originalCGPA = this.calculateOriginalCGPA();
        
        // Calculate actual CGPAs according to BRACU rounding system
        const currentActualCGPA = this.calculateActualCGPA(originalCGPA);
        const dreamActualCGPA = this.calculateActualCGPA(currentCGPA);
        
        // Check if any courses have been deleted or grades modified
        const coursesDeleted = this.courses.length < this.originalCourses.length;
        const gradesModified = this.courses.some((course, index) => {
            if (course.isManuallyAdded) return false; // Manually added courses don't affect this check
            const original = this.originalCourses.find(orig => orig.courseCode === course.courseCode);
            return original && Math.abs(original.gradePoints - course.gradePoints) > 0.001;
        });
        
        // Current CGPA: always show original CGPA (unchanged)
        document.getElementById('currentCGPA').textContent = originalCGPA.toFixed(4);
        document.getElementById('currentActualCGPA').textContent = currentActualCGPA.toFixed(2);
        
        // Dream CGPA: always show current calculated value (reflects all changes)
        document.getElementById('dreamCGPA').textContent = currentCGPA.toFixed(4);
        document.getElementById('dreamActualCGPA').textContent = dreamActualCGPA.toFixed(2);
    }

    /**
     * Update grade points for a specific course
     */
    updateGradePoints(courseIndex, newGradePoints) {
        const gradePoints = parseFloat(newGradePoints);
        
        // Validate grade points
        if (isNaN(gradePoints) || gradePoints < 0 || gradePoints > 4) {
            this.showError('Grade points must be between 0.00 and 4.00');
            // Reset to original value
            const input = document.querySelector(`input[data-course-index="${courseIndex}"]`);
            input.value = this.courses[courseIndex].gradePoints.toFixed(2);
            return;
        }

        // Update course data
        this.courses[courseIndex].gradePoints = gradePoints;
        this.courses[courseIndex].qualityPoints = this.courses[courseIndex].credits * gradePoints;

        // Update quality points display in the table
        const row = document.querySelector(`input[data-course-index="${courseIndex}"]`).closest('tr');
        row.querySelector('.quality-points').textContent = this.courses[courseIndex].qualityPoints.toFixed(2);

        // Update summary cards
        this.updateSummaryCards();

    }

    /**
     * Reset all courses to their original grade points
     */
    resetToOriginal() {
        if (this.originalCourses.length === 0) {
            this.showError('No original data to reset to');
            return;
        }

        // Reset courses to original values
        this.courses = this.originalCourses.map(course => ({...course}));
        
        // Update display
        this.displayResults();
        this.showSuccessMessage('Reset to original grade points');
    }

    /**
     * Export course data to Excel file
     */
    exportToExcel() {
        if (this.courses.length === 0) {
            this.showError('No courses to export');
            return;
        }

        try {
            // Prepare data for Excel
            const exportData = this.courses.map(course => ({
                'Course Code': course.courseCode,
                'Credits Earned': course.credits,
                'Grade Points': course.gradePoints.toFixed(2),
                'Quality Points': course.qualityPoints.toFixed(2),
                'Type': course.isManuallyAdded ? 'Manual' : (course.isRetake ? `Retake (${course.retakeType || 'RP/RT'})` : 'From Grade Sheet')
            }));

            // Add summary information
            const currentCGPA = this.calculateOriginalCGPA();
            const dreamCGPA = this.calculateCGPA();
            const totalCredits = this.courses.reduce((sum, course) => sum + course.credits, 0);
            const earnedCredits = this.calculateEarnedCredits();
            const creditCourses = this.calculateCreditCourses();
            const currentActualCGPA = this.calculateActualCGPA(currentCGPA);
            const dreamActualCGPA = this.calculateActualCGPA(dreamCGPA);

            const summaryData = [
                {},
                { 'Course Code': 'SUMMARY', 'Credits Earned': '', 'Grade Points': '', 'Quality Points': '', 'Type': '' },
                { 'Course Code': 'Total Courses', 'Credits Earned': this.courses.length, 'Grade Points': '', 'Quality Points': '', 'Type': '' },
                { 'Course Code': 'Credit Courses', 'Credits Earned': creditCourses, 'Grade Points': '', 'Quality Points': '', 'Type': '' },
                { 'Course Code': 'Total Credits', 'Credits Earned': totalCredits.toFixed(2), 'Grade Points': '', 'Quality Points': '', 'Type': '' },
                { 'Course Code': 'Earned Credits', 'Credits Earned': earnedCredits.toFixed(2), 'Grade Points': '', 'Quality Points': '', 'Type': '' },
                { 'Course Code': 'Current CGPA', 'Credits Earned': currentCGPA.toFixed(4), 'Grade Points': '', 'Quality Points': '', 'Type': '' },
                { 'Course Code': 'Current Actual CGPA', 'Credits Earned': currentActualCGPA.toFixed(2), 'Grade Points': '', 'Quality Points': '', 'Type': '' },
                { 'Course Code': 'Dream CGPA', 'Credits Earned': dreamCGPA.toFixed(4), 'Grade Points': '', 'Quality Points': '', 'Type': '' },
                { 'Course Code': 'Dream Actual CGPA', 'Credits Earned': dreamActualCGPA.toFixed(2), 'Grade Points': '', 'Quality Points': '', 'Type': '' }
            ];

            // Combine course data with summary
            const finalData = [...exportData, ...summaryData];

            // Create workbook
            const ws = XLSX.utils.json_to_sheet(finalData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Course Analysis");

            // Set column widths
            ws['!cols'] = [
                { wch: 15 }, // Course Code
                { wch: 12 }, // Credits Earned
                { wch: 12 }, // Grade Points
                { wch: 12 }, // Quality Points
                { wch: 15 }  // Type
            ];

            // Generate filename with current date
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const filename = `should-i-retake-analysis-${dateStr}.xlsx`;

            // Save the file
            XLSX.writeFile(wb, filename);

            this.showSuccessMessage('Excel file exported successfully!');

        } catch (error) {
            console.error('Export error:', error);
            this.showError('Failed to export to Excel. Please try again.');
        }
    }

    /**
     * Display parsed results on the webpage
     */
    displayResults() {
        // Update summary cards
        this.updateSummaryCards();

        // Populate course table with editable grade points
        const tableBody = document.getElementById('courseTableBody');
        tableBody.innerHTML = '';

        this.courses.forEach((course, index) => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td class="course-code">
                    ${course.courseCode}
                    ${course.isManuallyAdded ? '<span class="manual-course-tag">Manual</span>' : ''}
                    ${course.isRetake ? `<span class="retake-course-tag">(${this.getRetakeType(course, index)})</span>` : ''}
                    ${course.isFailed ? '<span class="failed-course-tag">(F)</span>' : ''}
                </td>
                <td>${course.credits.toFixed(2)}</td>
                <td>
                    <input type="number" 
                           class="grade-input" 
                           value="${course.gradePoints.toFixed(2)}" 
                           min="0" 
                           max="4" 
                           step="0.01" 
                           data-course-index="${index}"
                           onchange="analyzer.updateGradePoints(${index}, this.value)">
                </td>
                <td class="quality-points">
                    <span class="quality-points-value">${course.qualityPoints.toFixed(2)}</span>
                </td>
                <td class="actions-column">
                    <button class="delete-course-btn" onclick="analyzer.deleteCourse(${index})" title="Delete Course">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        this.showResults();
        
        // Scroll to results
        document.getElementById('resultsSection').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }

    /**
     * Get the specific retake type for a course (RT, RP, or RP/RT)
     */
    getRetakeType(course, index) {
        // If the course has specific retake type stored, use it
        if (course.retakeType) {
            return course.retakeType;
        }
        
        // Default to RP/RT if we can't determine the specific type
        return 'RP/RT';
    }

    /**
     * Add a new editable course row to the table
     */
    addNewCourseRow() {
        const tableBody = document.getElementById('courseTableBody');
        
        // Check if there's already an editable row
        if (tableBody.querySelector('.editable-row')) {
            this.showError('Please complete or cancel the current course entry first.');
            return;
        }

        const row = document.createElement('tr');
        row.className = 'editable-row';
        
        row.innerHTML = `
            <td>
                <input type="text" 
                       class="course-code-input" 
                       placeholder="e.g., CSE101, EEE102L" 
                       maxlength="10"
                       style="text-transform: uppercase;">
            </td>
            <td>
                <input type="number" 
                       class="credits-input" 
                       placeholder="3.00" 
                       min="0" 
                       max="10" 
                       step="0.5">
            </td>
            <td>
                <input type="number" 
                       class="grade-points-input" 
                       placeholder="4.00" 
                       min="0" 
                       max="4" 
                       step="0.01">
            </td>
            <td class="quality-points">
                <span class="quality-points-preview">-</span>
            </td>
            <td class="actions-column">
                <div class="save-cancel-buttons">
                    <button class="save-btn">Save</button>
                    <button class="cancel-btn">Cancel</button>
                </div>
            </td>
        `;

        // Add event listener for automatic uppercase conversion
        const courseCodeInput = row.querySelector('.course-code-input');
        courseCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });

        // Add event listeners for quality points preview calculation
        const creditsInput = row.querySelector('.credits-input');
        const gradePointsInput = row.querySelector('.grade-points-input');
        const qualityPointsPreview = row.querySelector('.quality-points-preview');

        const updateQualityPointsPreview = () => {
            const credits = parseFloat(creditsInput.value) || 0;
            const gradePoints = parseFloat(gradePointsInput.value) || 0;
            const qualityPoints = credits * gradePoints;
            qualityPointsPreview.textContent = qualityPoints.toFixed(2);
        };

        // Pre-fill default values for ease of manual course entry
        creditsInput.value = '3.00';
        gradePointsInput.value = '4.00';
        updateQualityPointsPreview();

        creditsInput.addEventListener('input', updateQualityPointsPreview);
        gradePointsInput.addEventListener('input', updateQualityPointsPreview);

        tableBody.appendChild(row);
        
        // Focus on the first input
        courseCodeInput.focus();
    }

    /**
     * Save the new course from the editable row
     */
    saveNewCourse(saveButton) {
        const row = saveButton.closest('tr');
        const courseCode = row.querySelector('.course-code-input').value.trim();
        const credits = parseFloat(row.querySelector('.credits-input').value);
        const gradePoints = parseFloat(row.querySelector('.grade-points-input').value);

        // Validate input
        const errors = [];

        if (!courseCode) {
            errors.push('Course code is required');
        } else if (!/^[A-Z]{2,4}\d{3}[A-Z]?[A-Z0-9]?$/.test(courseCode)) {
            errors.push('Course code must be in format like CSE110, EEE102L, MAT215, etc.');
        }

        // Check for duplicate course code
        if (this.courses.some(course => course.courseCode === courseCode)) {
            errors.push('Course code already exists');
        }

        if (isNaN(credits) || credits <= 0 || credits > 10) {
            errors.push('Credits must be between 0.5 and 10');
        }

        if (isNaN(gradePoints) || gradePoints < 0 || gradePoints > 4) {
            errors.push('Grade points must be between 0.00 and 4.00');
        }

        if (errors.length > 0) {
            this.showError(errors.join('. '));
            return;
        }

        // Create new course object
        const newCourse = {
            courseCode: courseCode,
            credits: credits,
            gradePoints: gradePoints,
            qualityPoints: credits * gradePoints,
            isManuallyAdded: true
        };

        // Add to courses array
        this.courses.push(newCourse);

        // Remove the editable row and refresh display
        row.remove();
        this.displayResults();

        // Show success message
        this.showSuccessMessage(`Successfully added ${courseCode} to your course list!`);
    }

    /**
     * Cancel adding new course and remove the editable row
     */
    cancelNewCourse(cancelButton) {
        const row = cancelButton.closest('tr');
        row.remove();
    }

    /**
     * Delete a course (both manually added and auto-added courses)
     */
    deleteCourse(courseIndex) {
        const course = this.courses[courseIndex];
        
        if (!course) {
            this.showError('Course not found.');
            return;
        }

        // Remove the course from the current courses array
        this.courses.splice(courseIndex, 1);

        // Update display
        this.displayResults();

        // Show success message
        this.showSuccessMessage(`Deleted course ${course.courseCode} successfully!`);
    }

    /**
     * UI Helper Methods
     */
    showLoading(show) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (show) {
            loadingIndicator.classList.add('show');
        } else {
            loadingIndicator.classList.remove('show');
        }
    }

    showResults() {
        document.getElementById('resultsSection').classList.add('show');
    }

    hideResults() {
        document.getElementById('resultsSection').classList.remove('show');
    }

    showError(message) {
        document.getElementById('errorText').textContent = message;
        document.getElementById('errorMessage').classList.add('show');
        
        // Auto-hide error after 10 seconds
        setTimeout(() => {
            this.hideError();
        }, 10000);
    }

    hideError() {
        document.getElementById('errorMessage').classList.remove('show');
    }

    showSuccessMessage(message) {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `
            <div class="success-content">
                ${message}
            </div>
        `;
        
        // Insert after upload card
        const uploadCard = document.querySelector('.upload-card');
        uploadCard.parentNode.insertBefore(successDiv, uploadCard.nextSibling);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 5000);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.analyzer = new GradeSheetAnalyzer();

    // Pre-initialize PDF.js for faster first use
    if (typeof pdfjsLib !== 'undefined') {
        // Configure PDF.js worker immediately
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    } else {
        // Wait for PDF.js to load and then configure
        const waitForPDFJS = setInterval(() => {
            if (typeof pdfjsLib !== 'undefined') {
                clearInterval(waitForPDFJS);
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
        }, 100);
    }
});
