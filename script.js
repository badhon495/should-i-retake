// PDF.js configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Grade Sheet Analyzer Class
 * Handles PDF upload, parsing, and course data extraction
 */
class GradeSheetAnalyzer {
    constructor() {
        this.courses = [];
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
                            this.courses.push({
                                courseCode: courseCode,
                                credits: credits,
                                gradePoints: gradePoints,
                                qualityPoints: credits * gradePoints
                            });
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
                                this.courses.push({
                                    courseCode: word,
                                    credits: credits,
                                    gradePoints: gradePoints,
                                    qualityPoints: credits * gradePoints
                                });
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
     * Display parsed results on the webpage
     */
    displayResults() {
        console.log('🖥️ Displaying results on webpage...');
        
        // Update summary cards
        document.getElementById('totalCourses').textContent = this.courses.length;
        document.getElementById('totalCredits').textContent = this.courses.reduce((sum, course) => sum + course.credits, 0).toFixed(2);
        document.getElementById('currentCGPA').textContent = this.calculateCGPA().toFixed(2);

        // Populate course table
        const tableBody = document.getElementById('courseTableBody');
        tableBody.innerHTML = '';

        this.courses.forEach((course, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="course-code">${course.courseCode}</td>
                <td>${course.credits.toFixed(2)}</td>
                <td>${course.gradePoints.toFixed(2)}</td>
                <td>${course.qualityPoints.toFixed(2)}</td>
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
    new GradeSheetAnalyzer();
    
    // Add some fun console art
    console.log(`
    🎓 Grade Sheet Analyzer
    =====================
    Built with PDF.js and modern web technologies
    Ready to analyze your academic journey!
    `);
});
