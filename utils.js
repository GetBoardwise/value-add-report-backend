const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const axios = require('axios')
/**
 * Generates a professional PDF report like the GetBoardwise sample
 * @param {string} name - Client's full name
 * @param {string} email - Client's email address
 * @param {string} reportText - The full text of the report to be formatted into sections
 * @param {string} logoPath - Path to the GetBoardwise logo file (PNG or JPG)
 * @returns {Buffer} - PDF document as a Buffer
 */
const generatePDF = async (name, email, reportText, logoPath) => {
    try {
        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();

        // Embed fonts
        const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Add a page with A4 dimensions
        let page = pdfDoc.addPage([595.28, 841.89]); // A4 size
        const { width, height } = page.getSize();

        // Set background color (dark green like in the sample)
        page.drawRectangle({
            x: 0,
            y: 0,
            width: width,
            height: height,
            color: rgb(0.05, 0.25, 0.15), // Dark green color
        });

        // Load and embed the logo if provided
        let logoImage, logoWidth, logoHeight, logoX, logoY;
        if (logoPath) {
            try {
                const logoData = fs.readFileSync(logoPath);

                // Determine the file type
                const fileExtension = path.extname(logoPath).toLowerCase();

                if (fileExtension === '.png') {
                    logoImage = await pdfDoc.embedPng(logoData);
                } else if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
                    logoImage = await pdfDoc.embedJpg(logoData);
                } else {
                    console.warn('Logo file must be PNG or JPG format');
                }

                if (logoImage) {
                    // Set logo size and centered position at the top
                    logoWidth = 150;
                    logoHeight = 150;
                    logoX = (width - logoWidth) / 2;
                    logoY = height - 220;

                    // Draw the logo with white background rectangle
                    page.drawRectangle({
                        x: logoX - 25,
                        y: logoY - 25,
                        width: logoWidth + 50,
                        height: logoHeight + 50,
                        color: rgb(1, 1, 1), // White background
                    });

                    page.drawImage(logoImage, {
                        x: logoX,
                        y: logoY,
                        width: logoWidth,
                        height: logoHeight,
                    });
                }
            } catch (error) {
                console.warn('Error loading logo:', error);
            }
        }

        // Set initial Y position below the logo
        let currentY = logoImage ? logoY - 50 : height - 100;
        const margin = 60; // Wider margins for the clean look

        // Helper function to add text with proper color and wrapping
        const addText = (text, { fontSize, font, color, x, y, maxWidth, lineHeight = 1.3 }) => {
            // Sanitize the text
            const sanitizedText = text
                .replace(/[\u0000-\u001F]/g, ' ')
                .replace(/[\u007F-\u00A0]/g, ' ')
                .replace(/[\u2028\u2029]/g, ' ');

            // Split into words for wrapping
            const words = sanitizedText.split(' ');
            let line = '';
            let newY = y;

            for (const word of words) {
                const testLine = line + (line ? ' ' : '') + word;
                const testWidth = font.widthOfTextAtSize(testLine, fontSize);

                if (testWidth > maxWidth && line) {
                    // Draw the current line
                    page.drawText(line, {
                        x,
                        y: newY,
                        size: fontSize,
                        font,
                        color,
                    });

                    // Move to next line
                    line = word;
                    newY -= fontSize * lineHeight;

                    // Check if we need a new page
                    if (newY < margin) {
                        const newPage = pdfDoc.addPage([595.28, 841.89]);

                        // Set same background color for new page
                        newPage.drawRectangle({
                            x: 0,
                            y: 0,
                            width: width,
                            height: height,
                            color: rgb(0.05, 0.25, 0.15), // Dark green color
                        });

                        newY = height - margin;
                        page = newPage;
                    }
                } else {
                    line = testLine;
                }
            }

            // Draw the last line
            if (line) {
                page.drawText(line, {
                    x,
                    y: newY,
                    size: fontSize,
                    font,
                    color,
                });
                newY -= fontSize * lineHeight;
            }

            return newY;
        };

        // Add client name as title - using gold/yellow color like in the sample
        const nameColor = rgb(0.95, 0.8, 0.2); // Gold/yellow color
        const textColor = rgb(1, 1, 1); // White for regular text

        // Add "Dear [Name]," line
        currentY = addText(`Dear ${name},`, {
            fontSize: 16,
            font: boldFont,
            color: nameColor,
            x: margin,
            y: currentY,
            maxWidth: width - (margin * 2),
            lineHeight: 1.5,
        });

        currentY -= 20; // Add more space after the greeting

        // Parse sections from the report text
        const sections = [
            'Key Commercial Strengths',
            'Potential Markets & Sectors to Target',
            'Ideal Company Profile',
            'Where You Can Add Value',
            'Example Outreach Message',
            'LinkedIn Profile Feedback',
            'Your Potential Impact',
            'Final Thoughts'
        ];

        // Extract introduction content (everything before the first section)
        let introContent = '';
        const firstSectionIndex = reportText.indexOf(sections[0]);
        if (firstSectionIndex > 0) {
            introContent = reportText.substring(0, firstSectionIndex).trim();
        }

        // Add introduction content
        currentY = addText(introContent, {
            fontSize: 11,
            font: regularFont,
            color: textColor,
            x: margin,
            y: currentY,
            maxWidth: width - (margin * 2),
            lineHeight: 1.2,
        });

        currentY -= 30; // Add space after introduction

        // Extract and add each section
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const nextSection = i < sections.length - 1 ? sections[i + 1] : null;

            // Extract section content
            let sectionContent = '';
            try {
                const sectionStart = reportText.indexOf(section);
                if (sectionStart !== -1) {
                    const sectionTextStart = sectionStart + section.length;
                    const sectionEnd = nextSection
                        ? reportText.indexOf(nextSection, sectionTextStart)
                        : reportText.length;

                    if (sectionEnd !== -1) {
                        sectionContent = reportText
                            .substring(sectionTextStart, sectionEnd)
                            .trim()
                            .replace(/^[\s:]+/, ''); // Remove leading spaces and colons
                    }
                }
            } catch (error) {
                console.warn(`Error extracting ${section} content:`, error);
                sectionContent = `[Error extracting ${section} content]`;
            }

            // Add section header with gold/yellow color
            currentY = addText(section, {
                fontSize: 14,
                font: boldFont,
                color: nameColor,
                x: margin,
                y: currentY,
                maxWidth: width - (margin * 2),
                lineHeight: 1.3,
            });

            currentY -= 20; // Space after section header

            // Add section content
            currentY = addText(sectionContent, {
                fontSize: 11,
                font: regularFont,
                color: textColor,
                x: margin,
                y: currentY,
                maxWidth: width - (margin * 2),
                lineHeight: 1.3,
            });

            currentY -= 40; // Space after section

            // Check if we need a new page for the next section
            if (currentY < 200 && i < sections.length - 1) {
                const newPage = pdfDoc.addPage([595.28, 841.89]);

                // Set background color for the new page
                newPage.drawRectangle({
                    x: 0,
                    y: 0,
                    width: width,
                    height: height,
                    color: rgb(0.05, 0.25, 0.15), // Dark green color
                });

                page = newPage;
                currentY = height - margin;
            }
        }

        // Generate the PDF
        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw new Error('Failed to generate PDF: ' + error.message);
    }
};
const generateReportContent = async (name, email, linkedinURL, apiKey) => {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'o4-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional business analyst creating value-add reports for GetBoardwise clients.
              
              Your reports should be insightful, actionable, and tailored to the individual's professional background.
              Use a warm, professional tone and include specific, actionable insights.
              
              Format the report with clear section headers and bullet points for key information.
              Ensure the content feels personalized and targeted to the individual's career trajectory.`
                    },
                    {
                        role: 'user',
                        content: `Generate a value-add report for ${name} with email ${email} and LinkedIn profile ${linkedinURL}. 
              
              The report should start with a personalized introduction addressing the client by name.
              
              Include these exact sections in this order:
              1. Key Commercial Strengths
              2. Potential Markets & Sectors to Target
              3. Ideal Company Profile
              4. Where You Can Add Value
              5. Example Outreach Message
              6. LinkedIn Profile Feedback
              7. Your Potential Impact
              8. Final Thoughts
              
              For each section:
              - Use the exact section title as listed above
              - Provide 3-5 bullet points of specific insights where appropriate
              - Keep content concise but high-value
              - Include industry-specific terminology and insights
              - Focus on actionable guidance
              
              Total length should be 1000-1500 words.`
                    }
                ],
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            }
        );

        // Sanitize the content to remove problematic characters before returning
        let sanitizedContent = response.data.choices[0].message.content;

        console.log(sanitizedContent);
        
        // Replace special characters that might cause PDF encoding issues
        sanitizedContent = sanitizedContent
            .replace(/[\u2011\u2012\u2013\u2014\u2015]/g, '-')  // Replace various hyphens/dashes
            .replace(/[\u2018\u2019]/g, "'")                    // Replace smart single quotes
            .replace(/[\u201C\u201D]/g, '"')                    // Replace smart double quotes
            .replace(/…/g, '...')                              // Replace ellipsis
            .replace(/•/g, '*');                               // Replace bullet points

        return sanitizedContent;
    } catch (error) {
        console.error('Error generating content with OpenAI:', error.response?.data || error.message);
        throw new Error('Failed to generate report content');
    }
}

module.exports = { generatePDF, generateReportContent }
// Run the example
// generateSampleReport().catch(console.error);