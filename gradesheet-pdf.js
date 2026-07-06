(function () {
    'use strict';

    const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    const AUTOTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
    const LOGO_PATH = 'brac_logo.png';

    let pdfLibsPromise = null;
    let logoDataUrlPromise = null;

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${url}`));
            document.head.appendChild(script);
        });
    }

    function loadPdfLibraries() {
        if (!pdfLibsPromise) {
            pdfLibsPromise = (async () => {
                if (typeof window.jspdf === 'undefined') {
                    await loadScript(JSPDF_URL);
                }
                if (typeof window.jspdf.jsPDF.API.autoTable === 'undefined') {
                    await loadScript(AUTOTABLE_URL);
                }
            })();
        }
        return pdfLibsPromise;
    }

    function loadLogoDataUrl() {
        if (!logoDataUrlPromise) {
            logoDataUrlPromise = fetch(LOGO_PATH)
                .then(res => {
                    if (!res.ok) throw new Error(`Logo fetch failed: ${res.status}`);
                    return res.blob();
                })
                .then(blob => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(blob);
                }))
                .catch(err => {
                    console.error('Could not load BRAC logo for PDF export:', err);
                    return null;
                });
        }
        return logoDataUrlPromise;
    }

    const L = {
        pageFormat: 'a4',
        marginLR: 12,
        headerHeight: 60,
        marginBottom: 14,
        colWidths: [24, 38, 26, 34, 26, 16, 22],
        grayFill: [211, 211, 211],
        headFill: [0, 0, 0],
        headText: [255, 255, 255],
        fontBody: 9,
        fontHead: 9,
        watermarkFontSize: 110,
        watermarkOpacity: 0.13,
        watermarkAngle: 55
    };

    const f2 = (n) => Number(n).toFixed(2);

    function generateGradeSheetPDF(data, fileName) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: L.pageFormat, compress: true });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const totalPagesExp = '{total_pages_count_string}';

        const semesters = data.semesters;

        const body = [];
        semesters.forEach((sem) => {
            body.push([{
                content: `SEMESTER:    ${sem.name}`,
                colSpan: 7,
                styles: { fillColor: L.grayFill, fontStyle: 'bolditalic' }
            }]);

            sem.courses.forEach((c) => {
                body.push([
                    { content: c.code, styles: { halign: 'left' } },
                    { content: c.title, colSpan: 3, styles: { halign: 'left' } },
                    { content: f2(c.credits), styles: { halign: 'center' } },
                    { content: c.grade, styles: { halign: 'left' } },
                    { content: f2(c.points), styles: { halign: 'center' } }
                ]);
            });

            const s = sem.summary;
            const summaryRow = (label, attempted, earned, gpaLabel, gpaValue) => ([
                { content: label, styles: { fillColor: L.grayFill } },
                { content: 'Credits Attempted', styles: { fillColor: L.grayFill } },
                { content: f2(attempted), styles: { fillColor: L.grayFill, halign: 'left' } },
                { content: 'Credits Earned', styles: { fillColor: L.grayFill } },
                { content: f2(earned), styles: { fillColor: L.grayFill, halign: 'center' } },
                { content: gpaLabel, styles: { fillColor: L.grayFill, halign: 'center' } },
                { content: f2(gpaValue), styles: { fillColor: L.grayFill, halign: 'center' } }
            ]);
            body.push(summaryRow('SEMESTER', s.semAttempted, s.semEarned, 'GPA', s.gpa));
            body.push(summaryRow('CUMULATIVE', s.cumAttempted, s.cumEarned, 'CGPA', s.cgpa));
        });

        function drawHeader(pageNumber) {
            const cx = pageW / 2;
            let y = 14;

            if (data.institution.logo) {
                try {
                    doc.addImage(
                        data.institution.logo, 'PNG',
                        cx - 60, y - 4,
                        data.institution.logoWidthMm || 18,
                        data.institution.logoHeightMm || 18
                    );
                } catch (e) { /* bad image data - skip logo rather than fail */ }
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.text(data.institution.name, cx, y + 2, { align: 'center' });

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(10);
            doc.text(`Page ${pageNumber} of ${totalPagesExp}`, pageW - L.marginLR, y + 2, { align: 'right' });

            y += 8;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            (data.institution.addressLines || []).forEach((line) => {
                doc.text(line, cx, y, { align: 'center' });
                y += 4.5;
            });

            y += 4;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.text(data.documentTitle || 'GRADE SHEET', cx, y, { align: 'center' });
            if (data.copyType) {
                y += 6.5;
                doc.setFontSize(11);
                doc.text(data.copyType, cx, y, { align: 'center' });
            }

            y += 9;
            const labelX = L.marginLR + 4;
            const colonX = labelX + 26;
            const valueX = colonX + 6;
            const rightX = cx - 2;

            doc.setFont('helvetica', 'bolditalic');
            doc.setFontSize(10.5);
            doc.text('Student ID', labelX, y);
            doc.text(':', colonX, y);
            doc.text(String(data.student.id), valueX, y);
            doc.text(data.student.programType || '', rightX, y);

            y += 6;
            doc.text('Name', labelX, y);
            doc.text(':', colonX, y);
            doc.text(data.student.name, valueX, y);

            doc.setFont('helvetica', 'italic');
            const programText = `PROGRAM: ${data.student.program}`;
            const wrapped = doc.splitTextToSize(programText, pageW - rightX - L.marginLR);
            doc.text(wrapped, rightX, y);
        }

        doc.autoTable({
            startY: L.headerHeight,
            margin: { top: L.headerHeight, bottom: L.marginBottom, left: L.marginLR, right: L.marginLR },
            head: [[
                { content: 'Course No' },
                { content: 'Course Title', colSpan: 3 },
                { content: 'Credits Earned', styles: { halign: 'center' } },
                { content: 'Grade' },
                { content: 'Grade Points', styles: { halign: 'center' } }
            ]],
            body,
            theme: 'plain',
            styles: {
                font: 'helvetica',
                fontSize: L.fontBody,
                cellPadding: { top: 1.6, bottom: 1.6, left: 1.5, right: 1.5 },
                textColor: [0, 0, 0],
                overflow: 'linebreak',
                valign: 'middle'
            },
            headStyles: {
                fillColor: L.headFill,
                textColor: L.headText,
                fontStyle: 'bold',
                fontSize: L.fontHead
            },
            columnStyles: Object.fromEntries(
                L.colWidths.map((w, i) => [i, { cellWidth: w }])
            ),
            rowPageBreak: 'avoid',
            didDrawPage: (hookData) => drawHeader(hookData.pageNumber)
        });

        if (data.watermarkText) {
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.saveGraphicsState();
                doc.setGState(new doc.GState({ opacity: L.watermarkOpacity }));
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(L.watermarkFontSize);
                doc.setTextColor(120, 120, 120);
                doc.text(data.watermarkText, pageW / 2, pageH / 2 + 60, {
                    align: 'center',
                    angle: L.watermarkAngle
                });
                doc.restoreGraphicsState();
            }
        }

        if (typeof doc.putTotalPages === 'function') {
            doc.putTotalPages(totalPagesExp);
        }

        doc.save(fileName || `gradesheet_${data.student.id}.pdf`);
    }

    window.GradeSheetPDF = {
        loadPdfLibraries,
        loadLogoDataUrl,
        generateGradeSheetPDF
    };
})();
