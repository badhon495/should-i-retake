// PDF.js configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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
            if (file && file.type === 'application/pdf') {
                this.processPDF(file);
            } else {
                this.showError('Please select a valid PDF file.');
            }
        });

        // Control buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'resetBtn') {
                this.resetToOriginal();
            } else if (e.target.id === 'applyPerfectBtn') {
                this.applyPerfectGrades();
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
        console.log('🎓 Grade Sheet Analyzer initialized!');
        console.log('Upload your PDF grade sheet to get started.');
    }

    /**
     * Process uploaded PDF file
     */
    async processPDF(file) {
        try {
            this.showLoading(true);
            this.hideError();
            this.hideResults();

            console.log(`📄 Processing PDF: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            let fullText = '';
            
            // Extract text from all pages with better structure preservation
            for (let i = 1; i <= pdf.numPages; i++) {
                console.log(`📖 Processing page ${i} of ${pdf.numPages}`);
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                // Sort text items by their vertical position (top to bottom)
                const sortedItems = textContent.items.sort((a, b) => {
                    const yDiff = b.transform[5] - a.transform[5]; // Y coordinate (inverted)
                    if (Math.abs(yDiff) > 5) return yDiff; // Different lines
                    return a.transform[4] - b.transform[4]; // Same line, sort by X coordinate
                });
                
                let currentY = null;
                let lineText = '';
                
                for (const item of sortedItems) {
                    const y = Math.round(item.transform[5]);
                    
                    if (currentY === null || Math.abs(currentY - y) > 5) {
                        // New line
                        if (lineText.trim()) {
                            fullText += lineText.trim() + '\n';
                        }
                        lineText = item.str;
                        currentY = y;
                    } else {
                        // Same line
                        lineText += ' ' + item.str;
                    }
                }
                
                // Add the last line
                if (lineText.trim()) {
                    fullText += lineText.trim() + '\n';
                }
            }

            console.log('📝 Extracted PDF text (structured):', fullText);
            console.log(`📊 Text length: ${fullText.length} characters`);
            
            // Parse the extracted text
            this.parseGradeSheet(fullText);
            
            if (this.courses.length === 0) {
                console.error('❌ No courses found. PDF text was:', fullText);
                this.showError(`No courses found in the PDF. Please make sure this is a valid grade sheet. 
                Extracted text length: ${fullText.length} characters. 
                Check browser console for more details.`);
                return;
            }

            this.displayResults();
            this.showSuccessMessage(`✅ Successfully extracted ${this.courses.length} courses from your grade sheet!`);
            
        } catch (error) {
            console.error('❌ Error processing PDF:', error);
            this.showError('Error processing PDF. Please try again with a different file. Check browser console for details.');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Parse grade sheet text and extract course information
     */
    parseGradeSheet(text) {
        this.courses = [];
        this.originalCourses = []; // Reset original courses
        
        console.log('🔍 Starting grade sheet parsing...');
        
        // Normalize the text - replace multiple spaces with single space
        const normalizedText = text.replace(/\s+/g, ' ').trim();
        
        // Split text into lines and words
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const words = normalizedText.split(' ');
        
        console.log(`📋 Processing ${lines.length} lines and ${words.length} words`);
        
        const seenCourses = new Set(); // To avoid duplicates
        
        // Method 1: Line-by-line parsing
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip irrelevant lines
            if (this.shouldSkipLine(line)) {
                continue;
            }
            
            console.log(`🔎 Processing line: "${line}"`);
            
            // Look for course pattern: CourseCode followed by course title, credits, grade, grade points
            const courseMatch = line.match(/^([A-Z]{2,4}\d{3})/);
            
            if (courseMatch) {
                const courseCode = courseMatch[1];
                console.log(`🎯 Found course code: ${courseCode}`);
                
                // Extract all decimal numbers from the line
                const numbers = line.match(/\d+\.\d+/g);
                console.log(`🔢 Numbers found in line: ${numbers ? numbers.join(', ') : 'none'}`);
                
                if (numbers && numbers.length >= 2) {
                    // The first number should be credits, the last should be grade points
                    const credits = parseFloat(numbers[0]);
                    const gradePoints = parseFloat(numbers[numbers.length - 1]);
                    
                    console.log(`📊 Attempting to parse - Course: ${courseCode}, Credits: ${credits}, Grade Points: ${gradePoints}`);
                    
                    // Validate that we have reasonable values
                    if (credits >= 0 && credits <= 10 && gradePoints >= 0 && gradePoints <= 4.0) {
                        const courseKey = `${courseCode}_${credits}_${gradePoints}`;
                        
                        if (!seenCourses.has(courseKey)) {
                            const courseData = {
                                courseCode: courseCode,
                                credits: credits,
                                gradePoints: gradePoints,
                                qualityPoints: credits * gradePoints
                            };
                            this.courses.push(courseData);
                            this.originalCourses.push({...courseData}); // Store original values
                            seenCourses.add(courseKey);
                            console.log(`✅ Successfully parsed course: ${courseCode}, Credits: ${credits}, Grade Points: ${gradePoints}`);
                        } else {
                            console.log(`⚠️ Duplicate course found: ${courseCode}`);
                        }
                    } else {
                        console.log(`❌ Invalid values - Credits: ${credits}, Grade Points: ${gradePoints}`);
                    }
                }
            }
        }
        
        // Method 2: Word-by-word parsing if line parsing didn't work well
        if (this.courses.length === 0) {
            console.log('🔄 Line parsing found no courses, trying word-by-word parsing...');
            this.parseWordByWord(words, seenCourses);
        }
        
        console.log(`🎉 Parsing complete! Found ${this.courses.length} courses total`);
        console.log('📋 Final parsed courses:', this.courses);
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
     * Alternative parsing method using word-by-word analysis
     */
    parseWordByWord(words, seenCourses) {
        for (let i = 0; i < words.length - 4; i++) {
            const word = words[i];
            
            // Check if current word is a course code
            if (/^[A-Z]{2,4}\d{3}$/.test(word)) {
                console.log(`🎯 Found course code (word method): ${word}`);
                
                // Look for two decimal numbers in the next few words
                const nextWords = words.slice(i + 1, i + 10); // Look ahead up to 10 words
                const numbers = [];
                
                for (const nextWord of nextWords) {
                    if (/^\d+\.\d+$/.test(nextWord)) {
                        numbers.push(parseFloat(nextWord));
                    }
                }
                
                console.log(`🔢 Numbers found after course code: ${numbers.join(', ')}`);
                
                if (numbers.length >= 2) {
                    // Find the best pair (credits should be first occurrence, grade points should be reasonable)
                    for (let j = 0; j < numbers.length - 1; j++) {
                        const credits = numbers[j];
                        const gradePoints = numbers[j + 1];
                        
                        if (credits >= 0 && credits <= 10 && gradePoints >= 0 && gradePoints <= 4.0) {
                            const courseKey = `${word}_${credits}_${gradePoints}`;
                            
                            if (!seenCourses.has(courseKey)) {
                                const courseData = {
                                    courseCode: word,
                                    credits: credits,
                                    gradePoints: gradePoints,
                                    qualityPoints: credits * gradePoints
                                };
                                this.courses.push(courseData);
                                this.originalCourses.push({...courseData}); // Store original values
                                seenCourses.add(courseKey);
                                console.log(`✅ Word method - parsed course: ${word}, Credits: ${credits}, Grade Points: ${gradePoints}`);
                                break; // Found valid pair, move to next course
                            }
                        }
                    }
                }
            }
        }
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
     * Update summary cards with current values
     */
    updateSummaryCards() {
        document.getElementById('totalCourses').textContent = this.courses.length;
        document.getElementById('totalCredits').textContent = this.courses.reduce((sum, course) => sum + course.credits, 0).toFixed(2);
        
        // If no courses have been deleted and no grade changes, show original CGPA
        // Otherwise, show the current calculated CGPA for both
        const currentCGPA = this.calculateCGPA();
        const originalCGPA = this.calculateOriginalCGPA();
        
        // Check if any courses have been deleted or grades modified
        const coursesDeleted = this.courses.length < this.originalCourses.length;
        const gradesModified = this.courses.some((course, index) => {
            if (course.isManuallyAdded) return false; // Manually added courses don't affect this check
            const original = this.originalCourses.find(orig => orig.courseCode === course.courseCode);
            return original && Math.abs(original.gradePoints - course.gradePoints) > 0.001;
        });
        
        // Current CGPA: show original only if nothing changed, otherwise show current
        document.getElementById('currentCGPA').textContent = (coursesDeleted || gradesModified) ? currentCGPA.toFixed(2) : originalCGPA.toFixed(2);
        // Dream CGPA: always show current calculated value
        document.getElementById('dreamCGPA').textContent = currentCGPA.toFixed(2);
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

        console.log(`📊 Updated course ${this.courses[courseIndex].courseCode}: Grade Points = ${gradePoints}, Quality Points = ${this.courses[courseIndex].qualityPoints.toFixed(2)}`);
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
        this.showSuccessMessage('✅ Reset to original grade points');
        
        console.log('🔄 Reset to original grade points');
    }

    /**
     * Apply perfect grades (4.0) to all courses
     */
    applyPerfectGrades() {
        if (this.courses.length === 0) {
            this.showError('No courses to update');
            return;
        }

        // Set all grade points to 4.0
        this.courses.forEach(course => {
            course.gradePoints = 4.0;
            course.qualityPoints = course.credits * 4.0;
        });

        // Update display
        this.displayResults();
        this.showSuccessMessage('⭐ Applied perfect grades (4.0) to all courses!');
        
        console.log('⭐ Applied perfect grades (4.0) to all courses');
    }

    /**
     * Display parsed results on the webpage
     */
    displayResults() {
        console.log('🖥️ Displaying results on webpage...');
        
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
                    <button class="delete-course-btn" onclick="analyzer.deleteCourse(${index})" title="Delete Course">🗑️</button>
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
                       placeholder="e.g., CSE101" 
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
                    <button class="save-btn">💾 Save</button>
                    <button class="cancel-btn">❌ Cancel</button>
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
        } else if (!/^[A-Z]{2,4}\d{3}$/.test(courseCode)) {
            errors.push('Course code must be in format like CSE110, MAT215, etc.');
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
        this.showSuccessMessage(`✅ Successfully added ${courseCode} to your course list!`);

        console.log(`➕ Added new course: ${courseCode}, Credits: ${credits}, Grade Points: ${gradePoints}`);
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
        this.showSuccessMessage(`✅ Deleted course ${course.courseCode} successfully!`);

        console.log(`🗑️ Deleted course: ${course.courseCode}`);
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
    console.log('🚀 Initializing Grade Sheet Analyzer...');
    window.analyzer = new GradeSheetAnalyzer();
    
    // Add some fun console art
    console.log(`
    🎓 Grade Sheet Analyzer
    =====================
    Built with PDF.js and modern web technologies
    Ready to analyze your academic journey!
    `);
});
