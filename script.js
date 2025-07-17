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
     * Process uploaded Excel file
     */
    async processExcel(file) {
        try {
            this.showLoading(true);
            this.hideError();
            this.hideResults();

            console.log(`📊 Processing Excel: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            // Get the first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            console.log('📝 Extracted Excel data:', data);
            
            // Parse the Excel data
            this.parseExcelData(data);
            
            if (this.courses.length === 0) {
                console.error('❌ No courses found in Excel file');
                this.showError(`No valid courses found in the Excel file. Please make sure the file contains columns for Course Code, Credits, and Grade Points.`);
                return;
            }

            this.displayResults();
            this.showSuccessMessage(`✅ Successfully imported ${this.courses.length} courses from your Excel file!`);
            
        } catch (error) {
            console.error('❌ Error processing Excel:', error);
            this.showError('Error processing Excel file. Please check the file format and try again.');
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
        
        const courseMap = new Map(); // To handle duplicates with RP/RT priority
        
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
                
                // Check if this line contains "(RP)" or "(RT)" notation in various formats
                const hasRP = line.includes('(RP)') || 
                              line.includes('( RP )') || 
                              line.includes(' RP ') || 
                              line.includes(' RP') ||
                              line.includes('RP ') ||
                              line.includes(' RP') ||
                              /\bRP\b/i.test(line) || // Word boundary for standalone RP (case insensitive)
                              /(^|\s)RP(\s|$)/i.test(line); // RP as standalone word
                
                const hasRT = line.includes('(RT)') || 
                              line.includes('( RT )') || 
                              line.includes(' RT ') || 
                              line.includes(' RT') ||
                              line.includes('RT ') ||
                              line.includes(' RT') ||
                              /\bRT\b/i.test(line) || // Word boundary for standalone RT (case insensitive)
                              /(^|\s)RT(\s|$)/i.test(line); // RT as standalone word
                
                const isRetake = hasRP || hasRT;
                if (isRetake) {
                    const notation = hasRP && hasRT ? 'RP/RT' : (hasRP ? 'RP' : 'RT');
                    console.log(`🔄 Found retake course with (${notation}): ${courseCode}`);
                    console.log(`🔍 Line content for retake detection: "${line}"`);
                }
                
                // Additional debugging for RT specifically
                if (hasRT && !hasRP) {
                    console.log(`🔥 RT FOUND: Course ${courseCode} detected as RT retake`);
                } else if (hasRP && !hasRT) {
                    console.log(`🔄 RP FOUND: Course ${courseCode} detected as RP repeat`);
                }
                
                // Extract all decimal numbers from the line
                const numbers = line.match(/\d+\.\d+/g);
                console.log(`🔢 Numbers found in line: ${numbers ? numbers.join(', ') : 'none'}`);
                
                if (numbers && numbers.length >= 2) {
                    // The first number should be credits, the last should be grade points
                    let credits = parseFloat(numbers[0]);
                    const gradePoints = parseFloat(numbers[numbers.length - 1]);
                    
                    console.log(`📊 Attempting to parse - Course: ${courseCode}, Credits: ${credits}, Grade Points: ${gradePoints}, Retake: ${isRetake}`);
                    
                    // Handle failed courses: if both credits and grade points are 0, 
                    // use standard credit hours for CGPA calculation (excluding prep courses)
                    const isFailedCourse = credits === 0 && gradePoints === 0;
                    const isPrepCourse = ['MAT091', 'MAT092', 'ENG091'].includes(courseCode);
                    
                    if (isFailedCourse && !isPrepCourse) {
                        // Assign standard credit hours for failed courses
                        credits = this.getStandardCredits(courseCode);
                        console.log(`📉 Failed course detected: ${courseCode}, using standard credits: ${credits}`);
                    }
                    
                    // Validate that we have reasonable values
                    if (credits >= 0 && credits <= 10 && gradePoints >= 0 && gradePoints <= 4.0) {
                        const courseData = {
                            courseCode: courseCode,
                            credits: credits,
                            gradePoints: gradePoints,
                            qualityPoints: credits * gradePoints,
                            isRetake: isRetake,
                            retakeType: isRetake ? (hasRP && hasRT ? 'RP/RT' : (hasRP ? 'RP' : 'RT')) : null,
                            isFailed: isFailedCourse && !isPrepCourse
                        };
                        
                        // Handle duplicates by prioritizing retake courses
                        this.handleDuplicateCourse(courseMap, courseData);
                    } else {
                        console.log(`❌ Invalid values - Credits: ${credits}, Grade Points: ${gradePoints}`);
                    }
                }
            }
        }
        
        // Method 2: Word-by-word parsing if line parsing didn't work well
        if (courseMap.size === 0) {
            console.log('🔄 Line parsing found no courses, trying word-by-word parsing...');
            this.parseWordByWord(words, courseMap);
        }
        
        // Convert the course map to arrays, with retake courses (RP/RT) taking priority
        this.courses = Array.from(courseMap.values());
        this.originalCourses = this.courses.map(course => ({...course})); // Store original values
        
        console.log(`🎉 Parsing complete! Found ${this.courses.length} courses total`);
        console.log('📋 Final parsed courses:', this.courses);
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
                console.log(`🔄 Replacing original course ${courseCode} with retake version`);
                courseMap.set(courseCode, newCourseData);
            } 
            // If the existing course is a retake and the new one is not, keep the existing one
            else if (existingCourse.isRetake && !newCourseData.isRetake) {
                console.log(`⚠️ Keeping existing retake course ${courseCode}, ignoring original`);
            }
            // If both are retakes, keep the one with higher grade points (latest/better grade)
            else if (existingCourse.isRetake && newCourseData.isRetake) {
                if (newCourseData.gradePoints > existingCourse.gradePoints) {
                    console.log(`🔄 Replacing existing retake ${courseCode} (${existingCourse.gradePoints}) with better retake (${newCourseData.gradePoints})`);
                    courseMap.set(courseCode, newCourseData);
                } else {
                    console.log(`⚠️ Keeping existing retake ${courseCode} with better/equal grade (${existingCourse.gradePoints} >= ${newCourseData.gradePoints})`);
                }
            }
            // If both are originals, keep the first one found
            else {
                console.log(`⚠️ Duplicate original course found for ${courseCode}, keeping first occurrence`);
            }
        } else {
            // First occurrence of this course
            courseMap.set(courseCode, newCourseData);
            console.log(`✅ Successfully parsed course: ${courseCode}, Credits: ${newCourseData.credits}, Grade Points: ${newCourseData.gradePoints}, Retake: ${newCourseData.isRetake || false}`);
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
     * Alternative parsing method using word-by-word analysis
     */
    parseWordByWord(words, courseMap) {
        for (let i = 0; i < words.length - 4; i++) {
            const word = words[i];
            
            // Check if current word is a course code
            if (/^[A-Z]{2,4}\d{3}$/.test(word)) {
                console.log(`🎯 Found course code (word method): ${word}`);
                
                // Check for (RP) or (RT) notation in surrounding words with enhanced detection
                const contextWords = words.slice(Math.max(0, i - 3), i + 10);
                const hasRP = contextWords.some(w => 
                    w.includes('(RP)') || 
                    w.includes('( RP )') || 
                    w.includes(' RP ') || 
                    w.includes(' RP') ||
                    w.includes('RP ') ||
                    w === 'RP' ||
                    /\bRP\b/i.test(w) || // Case insensitive
                    /(^|\s)RP(\s|$)/i.test(w)
                );
                
                const hasRT = contextWords.some(w => 
                    w.includes('(RT)') || 
                    w.includes('( RT )') || 
                    w.includes(' RT ') || 
                    w.includes(' RT') ||
                    w.includes('RT ') ||
                    w === 'RT' ||
                    /\bRT\b/i.test(w) || // Case insensitive
                    /(^|\s)RT(\s|$)/i.test(w)
                );
                
                const isRetake = hasRP || hasRT;
                if (isRetake) {
                    const notation = hasRP && hasRT ? 'RP/RT' : (hasRP ? 'RP' : 'RT');
                    console.log(`🔄 Found retake course with (${notation}) in word method: ${word}`);
                    console.log(`🔍 Context words for retake detection: [${contextWords.join(', ')}]`);
                }
                
                // Additional debugging for RT specifically
                if (hasRT && !hasRP) {
                    console.log(`🔥 RT FOUND (word method): Course ${word} detected as RT retake`);
                } else if (hasRP && !hasRT) {
                    console.log(`🔄 RP FOUND (word method): Course ${word} detected as RP repeat`);
                }
                
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
                        let credits = numbers[j];
                        const gradePoints = numbers[j + 1];
                        
                        // Handle failed courses: if both credits and grade points are 0, 
                        // use standard credit hours for CGPA calculation (excluding prep courses)
                        const isFailedCourse = credits === 0 && gradePoints === 0;
                        const isPrepCourse = ['MAT091', 'MAT092', 'ENG091'].includes(word);
                        
                        if (isFailedCourse && !isPrepCourse) {
                            // Assign standard credit hours for failed courses
                            credits = this.getStandardCredits(word);
                            console.log(`📉 Failed course detected (word method): ${word}, using standard credits: ${credits}`);
                        }
                        
                        if (credits >= 0 && credits <= 10 && gradePoints >= 0 && gradePoints <= 4.0) {
                            const courseData = {
                                courseCode: word,
                                credits: credits,
                                gradePoints: gradePoints,
                                qualityPoints: credits * gradePoints,
                                isRetake: isRetake,
                                retakeType: isRetake ? (hasRP && hasRT ? 'RP/RT' : (hasRP ? 'RP' : 'RT')) : null,
                                isFailed: isFailedCourse && !isPrepCourse
                            };
                            
                            // Handle duplicates by prioritizing retake courses
                            this.handleDuplicateCourse(courseMap, courseData);
                            break; // Found valid pair, move to next course
                        }
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
        
        console.log('🔍 Starting Excel data parsing...');
        console.log('📊 Excel data:', data);
        
        if (!data || data.length === 0) {
            console.error('❌ No data found in Excel file');
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
                console.log(`📍 Found headers at row ${headerRowIndex}: Course Code(${courseCodeCol}), Credits(${creditsCol}), Grade Points(${gradePointsCol})`);
                break;
            }
        }
        
        // If we couldn't find proper headers, try to guess based on first few rows
        if (headerRowIndex === -1) {
            console.log('⚠️ No proper headers found, trying to guess column structure...');
            // Assume first row is header or data, look for patterns
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
                        // Assume credits is next, grade points after that
                        creditsCol = j + 1;
                        gradePointsCol = j + 2;
                        headerRowIndex = i;
                        console.log(`🔍 Guessed structure: Course Code(${courseCodeCol}), Credits(${creditsCol}), Grade Points(${gradePointsCol})`);
                        break;
                    }
                }
                
                if (courseCodeCol !== -1) break;
            }
        }
        
        if (courseCodeCol === -1 || creditsCol === -1 || gradePointsCol === -1) {
            console.error('❌ Could not determine Excel file structure');
            return;
        }
        
        // Parse data rows
        const courseMap = new Map();
        
        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!Array.isArray(row) || row.length < Math.max(courseCodeCol, creditsCol, gradePointsCol) + 1) {
                continue;
            }
            
            const courseCode = String(row[courseCodeCol] || '').trim();
            const creditsValue = row[creditsCol];
            const gradePointsValue = row[gradePointsCol];
            
            // Check if any cell in this row contains (RP) or (RT) notation with enhanced detection
            const isRetake = row.some(cell => {
                const cellStr = String(cell || '').toLowerCase();
                return cellStr.includes('(rp)') || 
                       cellStr.includes('( rp )') || 
                       cellStr.includes(' rp ') || 
                       cellStr.includes(' rp') ||
                       cellStr.includes('rp ') ||
                       /\brp\b/i.test(cellStr) || // Word boundary for standalone rp (case insensitive)
                       /(^|\s)rp(\s|$)/i.test(cellStr) || // RP as standalone word
                       cellStr.includes('(rt)') || 
                       cellStr.includes('( rt )') || 
                       cellStr.includes(' rt ') || 
                       cellStr.includes(' rt') ||
                       cellStr.includes('rt ') ||
                       /\brt\b/i.test(cellStr) || // Word boundary for standalone rt (case insensitive)
                       /(^|\s)rt(\s|$)/i.test(cellStr); // RT as standalone word
            });
            
            // Determine retake type more specifically
            let retakeType = null;
            if (isRetake) {
                const hasRP = row.some(cell => {
                    const cellStr = String(cell || '').toLowerCase();
                    return cellStr.includes('(rp)') || 
                           cellStr.includes('( rp )') || 
                           cellStr.includes(' rp ') || 
                           cellStr.includes(' rp') ||
                           cellStr.includes('rp ') ||
                           /\brp\b/i.test(cellStr) ||
                           /(^|\s)rp(\s|$)/i.test(cellStr);
                });
                
                const hasRT = row.some(cell => {
                    const cellStr = String(cell || '').toLowerCase();
                    return cellStr.includes('(rt)') || 
                           cellStr.includes('( rt )') || 
                           cellStr.includes(' rt ') || 
                           cellStr.includes(' rt') ||
                           cellStr.includes('rt ') ||
                           /\brt\b/i.test(cellStr) ||
                           /(^|\s)rt(\s|$)/i.test(cellStr);
                });
                
                retakeType = hasRP && hasRT ? 'RP/RT' : (hasRP ? 'RP' : 'RT');
            }
            
            // Skip if course code doesn't look valid
            if (!courseCode || courseCode.toLowerCase().includes('summary') || courseCode.toLowerCase().includes('total')) {
                continue;
            }
            
            // Parse numeric values
            let credits = parseFloat(creditsValue);
            const gradePoints = parseFloat(gradePointsValue);
            
            // Handle failed courses: if both credits and grade points are 0, 
            // use standard credit hours for CGPA calculation (excluding prep courses)
            const isFailedCourse = credits === 0 && gradePoints === 0;
            const isPrepCourse = ['MAT091', 'MAT092', 'ENG091'].includes(courseCode.toUpperCase());
            
            if (isFailedCourse && !isPrepCourse) {
                // Assign standard credit hours for failed courses
                credits = this.getStandardCredits(courseCode.toUpperCase());
                console.log(`📉 Failed course detected (Excel): ${courseCode}, using standard credits: ${credits}`);
            }
            
            // Validate values
            if (isNaN(credits) || isNaN(gradePoints) || 
                credits < 0 || credits > 10 || 
                gradePoints < 0 || gradePoints > 4.0) {
                console.log(`⚠️ Skipping invalid row: ${courseCode}, Credits: ${creditsValue}, Grade Points: ${gradePointsValue}`);
                continue;
            }
            
            const courseData = {
                courseCode: courseCode.toUpperCase(),
                credits: credits,
                gradePoints: gradePoints,
                qualityPoints: credits * gradePoints,
                isManuallyAdded: false,
                isRetake: isRetake,
                retakeType: retakeType,
                isFailed: isFailedCourse && !isPrepCourse
            };
            
            // Handle duplicates by prioritizing retake courses
            this.handleDuplicateCourse(courseMap, courseData);
        }
        
        // Convert the course map to arrays, with retake courses (RP/RT) taking priority
        this.courses = Array.from(courseMap.values());
        this.originalCourses = this.courses.map(course => ({...course}));
        
        console.log(`🎉 Excel parsing complete! Found ${this.courses.length} courses`);
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

            this.showSuccessMessage('📊 Excel file exported successfully!');
            console.log('📊 Course data exported to Excel:', filename);

        } catch (error) {
            console.error('Export error:', error);
            this.showError('Failed to export to Excel. Please try again.');
        }
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
