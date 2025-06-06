<div align="center">

# Should I Retake?

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![PDF.js](https://img.shields.io/badge/PDF.js-00539F?style=flat-square&logo=pdf&logoColor=white)

A modern, client-side web application for analyzing PDF grade sheets. Extract course information, calculate CGPA, and visualize your academic progress - all without sending your data to any server.

</div>

## Features

- **100% Client-Side Processing** - Your data never leaves your device
- **PDF Parsing** - Extract course codes, credits, and grade points automatically
- **CGPA Calculation** - Instant calculation of your current CGPA
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile

## Quick Start

1. Clone or download this repository
2. Open `index.html` in your web browser
3. Upload your PDF grade sheet and analyze!


## Project Structure

```
📁 should-i-retake/
├── 📄 index.html          (Main HTML file)
├── 📄 script.js           (Main JavaScript)
├── 📄 styles.css          (Main stylesheet)
├── 📄 animations.css      (Animation styles)
├── 📄 faq.html            (FAQ page)
├── 📄 README.md           (Documentation)
├── 📄 LICENSE             (License file)
└── 📄 .gitignore          (Git ignore rules)
```

## Features in Detail

### Course Information Extraction
- **Course Codes**: Automatically detects patterns like CSE110, MAT215
- **Credits**: Extracts credit hours for each course
- **Grade Points**: Captures grade point values (0.00-4.00)
- **Quality Points**: Automatically calculates (Credits × Grade Points)

### CGPA Calculation
```javascript
CGPA = Total Quality Points / Total Credits
```


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <p>⭐ Star this repo if you found it helpful!</p>
</div>
