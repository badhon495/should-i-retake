# 🎓 Grade Sheet Analyzer

A modern, client-side web application for analyzing PDF grade sheets. Extract course information, calculate CGPA, and visualize your academic progress - all without sending your data to any server.

![Grade Sheet Analyzer](https://via.placeholder.com/800x400/667eea/ffffff?text=Grade+Sheet+Analyzer)

## ✨ Features

- **🔒 100% Client-Side Processing** - Your data never leaves your device
- **📄 PDF Parsing** - Extract course codes, credits, and grade points automatically
- **📊 CGPA Calculation** - Instant calculation of your current CGPA
- **📱 Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **🎨 Modern UI** - Beautiful, intuitive interface with smooth animations
- **⚡ Fast Performance** - No server delays, instant processing
- **🌐 Cross-Platform** - Works in any modern web browser

## 🚀 Quick Start

### Option 1: Direct Usage
1. Clone or download this repository
2. Open `index.html` in your web browser
3. Upload your PDF grade sheet and analyze!

### Option 2: Local Server
```bash
# Using Python (recommended)
python3 -m http.server 8000

# Using Node.js
npx http-server . -p 8000 -c-1

# Using npm scripts
npm run serve
```

Then open `http://localhost:8000` in your browser.

## 📁 Project Structure

```
grade-sheet-analyzer/
├── index.html          # Main HTML file
├── styles.css          # Main stylesheet
├── animations.css      # Animation styles
├── script.js           # Main JavaScript logic
├── config.js           # Configuration settings
├── utils.js            # Utility functions
├── package.json        # Project configuration
├── README.md           # Project documentation
└── grade-sheet-web.pdf # Sample grade sheet
```

## 🔧 Technical Details

### Libraries Used
- **PDF.js** (v3.11.174) - Mozilla's PDF parsing library
- **Inter Font** - Modern typography
- **Pure CSS3** - No framework dependencies
- **Vanilla JavaScript** - No framework dependencies

### Supported Grade Sheet Formats
Currently optimized for BRAC University grade sheets, but can be adapted for other formats:
- Course codes: Letters followed by numbers (e.g., CSE110, MAT215)
- Credits: Decimal numbers (e.g., 3.00)
- Grade points: Decimal numbers between 0.00-4.00

### Browser Compatibility
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+

## 🎯 How It Works

1. **File Upload**: User uploads or drags a PDF grade sheet
2. **PDF Processing**: PDF.js extracts text content while preserving structure
3. **Text Parsing**: Custom algorithms identify course codes, credits, and grade points
4. **Data Validation**: Ensures extracted data meets academic standards
5. **Results Display**: Shows parsed courses in a beautiful, interactive table

### Parsing Algorithm
The application uses a two-stage parsing approach:

1. **Line-by-Line Parsing**: Analyzes each line for course patterns
2. **Word-by-Word Fallback**: If line parsing fails, uses positional analysis

## 🛠️ Development

### Prerequisites
- Modern web browser
- Python 3.x or Node.js (for local server)
- Text editor or IDE

### Local Development
```bash
# Clone the repository
git clone https://github.com/your-username/grade-sheet-analyzer.git
cd grade-sheet-analyzer

# Start development server
npm run dev

# Or with Python
python3 -m http.server 8000
```

### Configuration
Modify `config.js` to customize:
- PDF processing settings
- Parsing patterns
- UI behavior
- Debug options

### Adding New Grade Sheet Formats
1. Update parsing patterns in `config.js`
2. Modify the `parseGradeSheet()` method in `script.js`
3. Test with sample PDFs

## 📊 Features in Detail

### Course Information Extraction
- **Course Codes**: Automatically detects patterns like CSE110, MAT215
- **Credits**: Extracts credit hours for each course
- **Grade Points**: Captures grade point values (0.00-4.00)
- **Quality Points**: Automatically calculates (Credits × Grade Points)

### CGPA Calculation
```javascript
CGPA = Total Quality Points / Total Credits
```

### Data Validation
- Credits must be between 0-10
- Grade points must be between 0.00-4.00
- Duplicate detection prevents data corruption
- Comprehensive error handling

## 🎨 UI Components

### Upload Area
- Drag & drop functionality
- File type validation
- Size limit checking
- Visual feedback

### Results Dashboard
- Summary cards with key metrics
- Interactive course table
- Responsive design
- Smooth animations

### Error Handling
- Clear error messages
- Auto-hiding notifications
- Debug information in console

## 🔒 Privacy & Security

- **No Server Communication**: All processing happens in your browser
- **No Data Storage**: Files are not saved or cached
- **No Analytics**: No tracking or data collection
- **Local Processing**: Your academic data stays on your device

## 🐛 Troubleshooting

### Common Issues

**"No courses found" Error**
- Ensure the PDF contains a valid grade sheet
- Check that course codes follow the pattern (letters + numbers)
- Verify the PDF is not password-protected or corrupted

**Slow Performance**
- Large PDFs may take longer to process
- Close other browser tabs to free up memory
- Ensure your browser supports modern JavaScript features

**Incorrect Parsing**
- Check browser console for detailed parsing logs
- Use the "Test Parsing Logic" button to verify functionality
- Report issues with sample data (remove personal information)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines
1. Follow existing code style
2. Add comments for complex logic
3. Test with multiple PDF formats
4. Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Mozilla PDF.js Team** - For the excellent PDF parsing library
- **BRAC University** - For the sample grade sheet format
- **Web Development Community** - For inspiration and best practices

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Look through existing issues on GitHub
3. Create a new issue with detailed information
4. Include browser version and sample data (anonymized)

---

**Made with ❤️ for students everywhere**
