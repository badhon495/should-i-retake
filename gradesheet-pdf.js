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
        headFill: [255, 255, 255],
        headText: [0, 0, 0],
        headBorderWidth: 0.4,
        fontBody: 9,
        fontHead: 9,
        watermarkFontSize: 110,
        watermarkOpacity: 0.13,
        watermarkAngle: 55
    };

    const f2 = (n) => Number(n).toFixed(2);

    // Rendered on an offscreen canvas rather than drawn as rotated jsPDF text:
    // jsPDF's align:'center' + angle combination does not reliably center a
    // rotated string on its anchor point, so a large watermark could still
    // run off the page edges no matter how the font size was scaled. Here we
    // rasterize into a canvas sized exactly to the available page area, so
    // the resulting image is guaranteed (by construction) to fit and center
    // when placed with addImage.
    function createWatermarkImage(text, angleDeg, maxWidthMm, maxHeightMm, maxFontSizePt, opacity) {
        const PX_PER_MM = 8; // ~200dpi, sharp enough for a faint background watermark
        const canvasW = Math.max(1, Math.round(maxWidthMm * PX_PER_MM));
        const canvasH = Math.max(1, Math.round(maxHeightMm * PX_PER_MM));
        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');

        const angleRad = angleDeg * Math.PI / 180;
        const cos = Math.abs(Math.cos(angleRad));
        const sin = Math.abs(Math.sin(angleRad));

        let fontSizePx = maxFontSizePt * 0.352778 * PX_PER_MM;
        ctx.font = `bold ${fontSizePx}px Arial, Helvetica, sans-serif`;
        let textWidthPx = ctx.measureText(text).width;
        const textHeightPx = fontSizePx;

        const bboxW = textWidthPx * cos + textHeightPx * sin;
        const bboxH = textWidthPx * sin + textHeightPx * cos;
        const fitScale = Math.min(1, canvasW / bboxW, canvasH / bboxH);
        fontSizePx *= fitScale;

        ctx.font = `bold ${fontSizePx}px Arial, Helvetica, sans-serif`;
        ctx.fillStyle = `rgba(120, 120, 120, ${opacity})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(canvasW / 2, canvasH / 2);
        ctx.rotate(-angleRad);
        ctx.fillText(text, 0, 0);

        return canvas.toDataURL('image/png');
    }

    function generateGradeSheetPDF(data, fileName) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: L.pageFormat, compress: true });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const totalPagesExp = '{total_pages_count_string}';

        const semesters = data.semesters;

        // The header block's height is variable: a long program name wraps to a
        // second line, which would otherwise run into the table's header row.
        function computeHeaderHeight() {
            const cx = pageW / 2;
            const rightX = cx - 2;
            let y = 14;
            y += 8;
            y += (data.institution.addressLines || []).length * 4.5;
            y += 4;
            if (data.copyType) y += 6.5;
            y += 9;
            y += 6;

            doc.setFont('helvetica', 'bolditalic');
            doc.setFontSize(10.5);
            const programText = `PROGRAM: ${data.student.program}`;
            const wrapped = doc.splitTextToSize(programText, pageW - rightX - L.marginLR);
            const lineHeightMm = 10.5 * 1.15 * 0.352778;
            y += (wrapped.length - 1) * lineHeightMm;

            return y;
        }
        const headerHeight = Math.max(L.headerHeight, computeHeaderHeight() + 6);

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
                    // Grades are 1 or 2 characters (A, B+, A-, ...); centering
                    // the raw string makes single-letter grades drift from the
                    // ones with a +/- suffix. Padding to a common width keeps
                    // the base letter lined up across rows.
                    { content: String(c.grade || '').padEnd(2, ' '), styles: { halign: 'center' } },
                    { content: f2(c.points), styles: { halign: 'center' } }
                ]);
            });

            const s = sem.summary;
            // `border` adds a full-width black rule flush against this row -
            // 'top' before the SEMESTER row, 'bottom' after the CUMULATIVE
            // row - using the same lineWidth/lineColor convention as the
            // column-header row above.
            const summaryRow = (label, attempted, earned, gpaLabel, gpaValue, border) => {
                const borderStyles = border ? { lineWidth: { [border]: L.headBorderWidth }, lineColor: [0, 0, 0] } : {};
                return [
                    { content: label, styles: { fillColor: L.grayFill, ...borderStyles } },
                    { content: 'Credits Attempted', styles: { fillColor: L.grayFill, ...borderStyles } },
                    { content: f2(attempted), styles: { fillColor: L.grayFill, halign: 'left', ...borderStyles } },
                    { content: 'Credits Earned', styles: { fillColor: L.grayFill, ...borderStyles } },
                    { content: f2(earned), styles: { fillColor: L.grayFill, halign: 'center', ...borderStyles } },
                    { content: gpaLabel, styles: { fillColor: L.grayFill, halign: 'center', ...borderStyles } },
                    { content: f2(gpaValue), styles: { fillColor: L.grayFill, halign: 'center', ...borderStyles } }
                ];
            };
            body.push(summaryRow('SEMESTER', s.semAttempted, s.semEarned, 'GPA', s.gpa, 'top'));
            body.push(summaryRow('CUMULATIVE', s.cumAttempted, s.cumEarned, 'CGPA', s.cgpa, 'bottom'));
        });

        let headerBottomY = 0;
        // Deferred rather than drawn immediately: if drawn while the table is
        // still rendering, the very next row (e.g. the next SEMESTER: band,
        // same gray fill as CUMULATIVE) paints its own background right after
        // and partially covers/mutes the line just drawn. Recording {page, y}
        // here and drawing every line only once the whole table is finished
        // (same timing as the watermark below) guarantees both the pre-
        // SEMESTER and post-CUMULATIVE rules are laid down at the same stage,
        // so nothing painted afterward can mute one and not the other.
        const summaryBorders = [];

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
            doc.text(`Page ${pageNumber} of ${totalPagesExp}`, pageW - L.marginLR + 10, y + 2, { align: 'right' });

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

            doc.setFont('helvetica', 'bolditalic');
            const programText = `PROGRAM: ${data.student.program}`;
            const wrapped = doc.splitTextToSize(programText, pageW - rightX - L.marginLR);
            doc.text(wrapped, rightX, y);

            // Reinforce the header row's bottom border: at some PDF viewer zoom
            // levels a thin hairline stroke can round away and disappear, so this
            // redraws it on top after the body fill for that row is painted.
            if (headerBottomY) {
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(L.headBorderWidth);
                doc.line(L.marginLR, headerBottomY, pageW - L.marginLR, headerBottomY);
            }
        }

        doc.autoTable({
            startY: headerHeight,
            margin: { top: headerHeight, bottom: L.marginBottom, left: L.marginLR, right: L.marginLR },
            head: [[
                {
                    content: 'Course No',
                    styles: { lineWidth: { top: L.headBorderWidth, bottom: L.headBorderWidth, left: L.headBorderWidth } }
                },
                { content: 'Course Title', colSpan: 3 },
                { content: 'Credits Earned', styles: { halign: 'center' } },
                { content: 'Grade', styles: { halign: 'center' } },
                {
                    content: 'Grade Points',
                    styles: { halign: 'center', lineWidth: { top: L.headBorderWidth, bottom: L.headBorderWidth, right: L.headBorderWidth } }
                }
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
                fontSize: L.fontHead,
                cellPadding: { top: 1, bottom: 1, left: 1, right: 1 },
                lineWidth: { top: L.headBorderWidth, bottom: L.headBorderWidth },
                lineColor: [0, 0, 0]
            },
            columnStyles: Object.fromEntries(
                L.colWidths.map((w, i) => [i, { cellWidth: w }])
            ),
            rowPageBreak: 'avoid',
            didDrawCell: (hookData) => {
                if (hookData.section === 'head') {
                    headerBottomY = hookData.cell.y + hookData.cell.height;
                }
                // Same reinforcement as the header border above: a cell-level
                // lineWidth can look thinner/inconsistent against a matching
                // fill color on the other side of the line (e.g. the gray
                // CUMULATIVE row butting against the next gray SEMESTER band),
                // so redraw both the pre-SEMESTER and post-CUMULATIVE rules
                // explicitly, exactly like the header row's border, so the two
                // always render identically regardless of what's next to them.
                if (hookData.section === 'body') {
                    const lw = hookData.cell.styles.lineWidth;
                    if (lw && typeof lw === 'object') {
                        if (lw.top) {
                            summaryBorders.push({ page: hookData.pageNumber, width: lw.top, y: hookData.cell.y });
                        }
                        if (lw.bottom) {
                            summaryBorders.push({
                                page: hookData.pageNumber,
                                width: lw.bottom,
                                y: hookData.cell.y + hookData.cell.height
                            });
                        }
                    }
                }
            },
            didDrawPage: (hookData) => drawHeader(hookData.pageNumber)
        });

        // Draw every recorded summary-row border now that the whole table is
        // done, so none of them can be muted by a later row's fill.
        summaryBorders.forEach((border) => {
            doc.setPage(border.page);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(border.width);
            doc.line(L.marginLR, border.y, pageW - L.marginLR, border.y);
        });

        if (data.watermarkText) {
            const watermarkMargin = 10;
            const maxWidth = pageW - watermarkMargin * 2;
            const maxHeight = pageH - watermarkMargin * 2;
            const watermarkImg = createWatermarkImage(
                data.watermarkText,
                L.watermarkAngle,
                maxWidth,
                maxHeight,
                L.watermarkFontSize,
                L.watermarkOpacity
            );
            const x = (pageW - maxWidth) / 2;
            const y = (pageH - maxHeight) / 2;

            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.addImage(watermarkImg, 'PNG', x, y, maxWidth, maxHeight);
            }
        }

        const pageCountForFooter = doc.getNumberOfPages();
        for (let i = 1; i <= pageCountForFooter; i++) {
            doc.setPage(i);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7);
            doc.setTextColor(120, 120, 120);
            doc.text('*This is generated by should i retake website', pageW - L.marginLR, pageH - 6, { align: 'right' });
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
