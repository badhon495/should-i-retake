<div align="center">

# Should I Retake?

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![PDF.js](https://img.shields.io/badge/PDF.js-00539F?style=flat-square&logo=pdf&logoColor=white)

This is a modern, client-side web application built to help BRAC University students take control of their academic journey. Simply download your grade sheet from Connect, upload it here, and instantly see how many courses you need to retake or what grades you’ll need in future courses to reach your target CGPA. Designed to be simple yet powerful, this tool brings clarity to academic planning. Built with JavaScript, pdf.js, HTML, and CSS, it runs entirely in the browser—no data ever leaves your device.
</div>


## Features

- **100% Client-Side Processing** - Your data never leaves your device
- **PDF Parsing** - Extract course codes, credits, and grade points automatically
- **CGPA Calculation** - Instant calculation of your current CGPA
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **Course Information Extraction**:
  - **Course Codes**: Automatically detects patterns like CSE110, MAT215
  - **Credits**: Extracts credit hours for each course
  - **Grade Points**: Captures grade point values (0.00-4.00)
  - **Quality Points**: Automatically calculates (Credits × Grade Points)


## Quick Start

1. Clone or download this repository
2. Open `index.html` in your web browser
3. Upload your PDF grade sheet and analyze!


### CGPA Calculation
```javascript
CGPA = Total Quality Points / Total Credits
```
This formula calculates your grade point up to four decimal places. If you get a CGPA of 3.567 then it will be rounded to 3.57 in Connect.


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <p>⭐ Star this repo if you found it helpful!</p>
</div>
