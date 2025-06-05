// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

class GradeSheetAnalyzer {
    constructor() {
        this.initializeEventListeners();
        this.courses = [];
    }

    initializeEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const testBtn = document.getElementById('testParsingBtn');

        // Test parsing button
        testBtn.addEventListener('click', () => {
            this.testParsingLogic();
        });

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

    testParsingLogic() {
        console.log('Testing parsing logic...');
        
        // Sample text from the PDF
        const sampleText = `Course No Course Title Credits Earned Grade Grade Points
SEMESTER: SPRING 2022 
CSE110 PROGRAMMING LANGUAGE I 3.00 A 4.00
ENG091 FOUNDATION COURSE (IN ENGLISH) 0.00 A- 3.70
MAT110MATHEMATICS I: DIFFERENTIAL CALCULUS & COORDINATE GEOMETRY3.00 B+ 3.30
SEMESTER Credits Attempted 6.00 Credits Earned 6.00 GPA 3.65
CSE111 PROGRAMMING LANGUAGE-II 3.00 A 4.00
CSE230 DISCRETE MATHEMATICS 3.00 A- 3.70`;
        
        this.parseGradeSheet(sampleText);
        
        if (this.courses.length > 0) {
            this.displayResults();
            console.log('Test successful! Found', this.courses.length, 'courses');
        } else {
            console.error('Test failed! No courses found');
            this.showError('Test failed - parsing logic needs adjustment');
        }
    }

    async processPDF(file) {
        try {
            this.showLoading(true);
            this.hideError();
            this.hideResults();

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            let fullText = '';
            
            // Extract text from all pages with better structure preservation
            for (let i = 1; i <= pdf.numPages; i++) {
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

            console.log('Extracted PDF text (structured):', fullText);
            console.log('Text length:', fullText.length);
            
            // Parse the extracted text
            this.parseGradeSheet(fullText);
            
            if (this.courses.length === 0) {
                console.error('No courses found. PDF text was:', fullText);
                this.showError(`No courses found in the PDF. Please make sure this is a valid grade sheet. 
                Extracted text length: ${fullText.length} characters. 
                Check browser console for more details.`);
                return;
            }

            this.displayResults();
            
        } catch (error) {
            console.error('Error processing PDF:', error);
            this.showError('Error processing PDF. Please try again with a different file. Check browser console for details.');
        } finally {
            this.showLoading(false);
        }
    }

    parseGradeSheet(text) {
        this.courses = [];
        
        console.log('Raw PDF text:', text); // Debug log
        
        // Normalize the text - replace multiple spaces with single space
        const normalizedText = text.replace(/\s+/g, ' ').trim();
        
        // Split text into lines and words
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const words = normalizedText.split(' ');
        
        console.log('Number of lines:', lines.length);
        console.log('Number of words:', words.length);
        
        const seenCourses = new Set(); // To avoid duplicates
        
        // Method 1: Line-by-line parsing
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip irrelevant lines
            if (this.shouldSkipLine(line)) {
                continue;
            }
            
            console.log('Processing line:', line);
            
            // Look for course pattern: CourseCode followed by course title, credits, grade, grade points
            const courseMatch = line.match(/^([A-Z]{2,4}\d{3})/);
            
            if (courseMatch) {
                const courseCode = courseMatch[1];
                console.log('Found course code:', courseCode);
                
                // Extract all decimal numbers from the line
                const numbers = line.match(/\d+\.\d+/g);
                console.log('Numbers found in line:', numbers);
                
                if (numbers && numbers.length >= 2) {
                    // The first number should be credits, the last should be grade points
                    const credits = parseFloat(numbers[0]);
                    const gradePoints = parseFloat(numbers[numbers.length - 1]);
                    
                    console.log(`Attempting to parse - Course: ${courseCode}, Credits: ${credits}, Grade Points: ${gradePoints}`);
                    
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
                            console.log(`✓ Successfully parsed course: ${courseCode}, Credits: ${credits}, Grade Points: ${gradePoints}`);
                        }
                    } else {
                        console.log(`✗ Invalid values - Credits: ${credits}, Grade Points: ${gradePoints}`);
                    }
                }
            }
        }
        
        // Method 2: Word-by-word parsing if line parsing didn't work
        if (this.courses.length === 0) {
            console.log('Line parsing failed, trying word-by-word parsing...');
            this.parseWordByWord(words, seenCourses);
        }
        
        console.log('Total courses parsed:', this.courses.length);
        console.log('Final parsed courses:', this.courses);
    }
    
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
    
    parseWordByWord(words, seenCourses) {
        for (let i = 0; i < words.length - 4; i++) {
            const word = words[i];
            
            // Check if current word is a course code
            if (/^[A-Z]{2,4}\d{3}$/.test(word)) {
                console.log('Found course code (word method):', word);
                
                // Look for two decimal numbers in the next few words
                const nextWords = words.slice(i + 1, i + 10); // Look ahead up to 10 words
                const numbers = [];
                
                for (const nextWord of nextWords) {
                    if (/^\d+\.\d+$/.test(nextWord)) {
                        numbers.push(parseFloat(nextWord));
                    }
                }
                
                console.log('Numbers found after course code:', numbers);
                
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
                                console.log(`✓ Word method - parsed course: ${word}, Credits: ${credits}, Grade Points: ${gradePoints}`);
                                break; // Found valid pair, move to next course
                            }
                        }
                    }
                }
            }
        }
    }

    calculateCGPA() {
        if (this.courses.length === 0) return 0;
        
        const totalQualityPoints = this.courses.reduce((sum, course) => sum + course.qualityPoints, 0);
        const totalCredits = this.courses.reduce((sum, course) => sum + course.credits, 0);
        
        return totalCredits > 0 ? (totalQualityPoints / totalCredits) : 0;
    }

    displayResults() {
        // Update summary cards
        document.getElementById('totalCourses').textContent = this.courses.length;
        document.getElementById('totalCredits').textContent = this.courses.reduce((sum, course) => sum + course.credits, 0).toFixed(2);
        document.getElementById('currentCGPA').textContent = this.calculateCGPA().toFixed(2);

        // Populate course table
        const tableBody = document.getElementById('courseTableBody');
        tableBody.innerHTML = '';

        this.courses.forEach(course => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${course.courseCode}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${course.credits.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${course.gradePoints.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${course.qualityPoints.toFixed(2)}</td>
            `;
            tableBody.appendChild(row);
        });

        this.showResults();
    }

    showLoading(show) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (show) {
            loadingIndicator.classList.add('show');
        } else {
            loadingIndicator.classList.remove('show');
        }
    }

    showResults() {
        document.getElementById('resultsSection').classList.remove('hidden');
    }

    hideResults() {
        document.getElementById('resultsSection').classList.add('hidden');
    }

    showError(message) {
        document.getElementById('errorText').textContent = message;
        document.getElementById('errorMessage').classList.remove('hidden');
    }

    hideError() {
        document.getElementById('errorMessage').classList.add('hidden');
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GradeSheetAnalyzer();
});