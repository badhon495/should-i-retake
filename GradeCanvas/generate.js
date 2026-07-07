const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log('Starting PDF generation...');

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log('Browser launched successfully');

    // Load local HTML file
    const htmlPath = path.join(__dirname, 'gradesheet.html');
    const fileUrl = `file://${htmlPath}`;

    console.log('Loading HTML file:', fileUrl);

    await page.goto(fileUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('HTML file loaded successfully');

    // Generate PDF
    const pdfPath = path.join(__dirname, 'generated_gradesheet.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    console.log('PDF generated successfully at:', pdfPath);

    await browser.close();
    console.log('Browser closed. PDF generation complete!');

  } catch (error) {
    console.error('Error generating PDF:', error);
    process.exit(1);
  }
})();
