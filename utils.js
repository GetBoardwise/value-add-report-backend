const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Generates a professional PDF report like the GetBoardwise sample
 * @param {string} name - Client's full name
 * @param {string} email - Client's email address
 * @param {string} linkedinURL - Client's LinkedIn profile URL
 * @param {string} logoPath - Path to the GetBoardwise logo file (PNG or JPG)
 * @param {string} apiKey - OpenAI API key
 * @param {string} outputPath - Path where the PDF should be saved
 * @returns {Promise<Buffer>} - PDF document as a Buffer
 */
async function generateAndSavePDF(name, email, linkedinURL, logoPath, apiKey, outputPath) {
    try {
        // First, generate the report content
        console.log("Generating report content...");
        const reportContent = await generateReportContent(name, email, linkedinURL, apiKey);

        // For debugging - save the raw content to a file
        fs.writeFileSync('raw_report_content.txt', reportContent);
        console.log("Raw report content saved to raw_report_content.txt");

        // Generate the PDF with the report content
        console.log("Creating PDF...");
        const pdfBuffer = await generatePDF(name, email, reportContent, logoPath);

        // Save the PDF to the specified location
        fs.writeFileSync(outputPath, pdfBuffer);
        console.log(`PDF report saved to ${outputPath}`);

        return pdfBuffer;
    } catch (error) {
        console.error("Error generating and saving PDF:", error);
        throw error;
    }
}

/**
 * Generates report content using OpenAI API
 * @param {string} name - Client's full name
 * @param {string} email - Client's email address
 * @param {string} linkedinURL - Client's LinkedIn profile URL
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} - Report content text
 */
async function generateReportContent(name, email, resumeText, apiKey) {
    try {
        console.log("Calling OpenAI API...");
        
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
            Ensure the content feels personalized and targeted to the individual's career trajectory.
            
            VERY IMPORTANT: Format each bullet point on its own line. Each point must start with "* " at the beginning of a new line.
            DO NOT put multiple bullet points on the same line.
            DO NOT start sections with bullet points - always have an introductory sentence first.
            
            Avoid using special characters like:
            - ≥ (greater than or equal to) - use >= instead
            - ≤ (less than or equal to) - use <= instead
            - ± (plus/minus) - use +/- instead
            - × (multiplication) - use x instead
            - ÷ (division) - use / instead
            
            Stick to basic ASCII characters when possible.`
              },
              {
                role: 'user',
                content: `Generate a value-add report for ${name} with email ${email} based on their resume information: ${resumeText}
            
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
            - First write a brief introductory sentence for the section
            - Then provide 3-5 bullet points of specific insights
            - Start each bullet point on a NEW LINE beginning with "* " (asterisk + space)
            - Keep content concise but high-value
            - Include industry-specific terminology and insights
            - Focus on actionable guidance
            - Avoid special characters outside the standard ASCII range
            
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
    
        let content = response.data.choices[0].message.content;
        return processApiResponse(content);
    } catch (error) {
        console.error('Error generating content with OpenAI:', error.response?.data || error.message);
        throw new Error('Failed to generate report content');
    }
}

/**
 * Process the API response to ensure proper formatting
 * @param {string} content - Raw content from API
 * @returns {string} - Processed content
 */
function processApiResponse(content) {
    // Convert all bullet symbols to asterisks
    content = content.replace(/•\s+/g, '* ');

    // Make sure there's always a newline before bullet points
    content = content.replace(/([^\n])\s*\*\s+/g, '$1\n* ');

    // Ensure each bullet point is properly separated
    content = content.replace(/(\*\s+[^*\n]+?)(\*\s+)/g, '$1\n$2');

    // Clean up any problematic characters
    const problematicChars = [
        { char: '≥', replace: '>=' },
        { char: '≤', replace: '<=' },
        { char: '±', replace: '+/-' },
        { char: '≠', replace: '!=' },
        { char: '×', replace: 'x' },
        { char: '÷', replace: '/' },
        { char: '…', replace: '...' },
        { char: '•', replace: '*' },
        { char: '–', replace: '-' },
        { char: '—', replace: '-' },
        { char: '\'', replace: "'" },
        { char: '\'', replace: "'" },
        { char: '"', replace: '"' },
        { char: '"', replace: '"' },
        { char: '′', replace: "'" },
        { char: '″', replace: '"' },
        { char: '‐', replace: '-' },
        { char: '‒', replace: '-' },
        { char: '―', replace: '-' },
        { char: '→', replace: '->' },
        { char: '←', replace: '<-' },
        { char: '↓', replace: 'v' },
        { char: '↑', replace: '^' },
        { char: '€', replace: 'EUR' },
        { char: '£', replace: 'GBP' },
        { char: '¥', replace: 'JPY' },
        { char: '©', replace: '(c)' },
        { char: '®', replace: '(R)' },
        { char: '™', replace: '(TM)' }
    ];

    let result = content;
    problematicChars.forEach(item => {
        result = result.replace(new RegExp(item.char, 'g'), item.replace);
    });

    // Replace any remaining non-ASCII characters
    result = result.normalize('NFKD')
        .replace(/[^\x00-\x7F]/g, '')

    return result;
}

/**
 * Generate hardcoded content for testing
 * @param {string} name - Client's name
 * @returns {string} - Test content
 */
function generateHardcodedContent(name) {
    return `Dear ${name},

It is a pleasure to share this tailored Value-Add Report based on your background in B2B SaaS sales, enterprise account management, and strategic business development. Drawing on your track record of managing multi-million-dollar pipelines and consistently exceeding quarterly quotas, this report highlights actionable insights to accelerate your career trajectory.

1. Key Commercial Strengths

Your proven track record in SaaS sales demonstrates several notable strengths:

* Extensive experience driving revenue growth through consultative selling approaches
* Skilled at building and managing complex sales pipelines with enterprise clients
* Strong negotiation capabilities that consistently close deals above $500K
* Ability to form strategic partnerships across departments to maximize sales effectiveness
* Data-driven approach to forecasting and performance optimization

2. Potential Markets & Sectors to Target

These sectors align well with your expertise and offer strong growth potential:

* Fintech platforms seeking compliance solutions and API integrations
* Healthcare technology companies focused on secure data management
* Cloud infrastructure and DevOps enterprises investing in automation
* Manufacturing firms adopting IIoT and predictive maintenance solutions
* Education technology providers expanding their enterprise offerings

3. Ideal Company Profile

Companies with these characteristics would benefit most from your expertise:

* Series B/C funded SaaS organizations with $10-50M ARR
* Teams with collaborative sales structures and dedicated support roles
* Organizations valuing consultative sales approaches and customer success
* Companies with strong product roadmaps in analytics or AI-enhanced workflows

4. Where You Can Add Value

Your skills can deliver significant impact in these areas:

* Designing strategic account plans that align with customer priorities
* Mentoring sales teams on advanced objection handling techniques
* Implementing upsell frameworks based on product usage analytics
* Collaborating with marketing on targeted account-based campaigns
* Enhancing sales forecasting with predictive methodologies

5. Example Outreach Message

This templated approach can help you connect with decision-makers effectively:

* Subject: "Driving Enterprise Adoption with Proven SaaS Integration Methods"
* "Hi [Name], I noticed [Company] is expanding its [specific product] offering, and wanted to share how I helped a similar organization increase adoption by 35% within 90 days."
* "My background in [relevant experience] could provide valuable perspective on your integration challenges. Would you be open to a 15-minute call next Tuesday?"
* "Best regards, ${name} | [Your brief tagline]"

6. LinkedIn Profile Feedback

Consider these enhancements to optimize your LinkedIn presence:

* Update your headline to include specific value proposition, e.g., "Enterprise SaaS Leader | Driving 30%+ Revenue Growth Through Strategic Partnerships"
* Add quantifiable achievements to each role description (deal sizes, growth percentages, retention metrics)
* Request targeted recommendations from clients and cross-functional partners that highlight your collaborative approach
* Share industry insights weekly to position yourself as a thought leader in your target sectors

7. Your Potential Impact

In your next role, you can create measurable value through:

* Accelerating sales cycle velocity by 20-30% through optimized qualification frameworks
* Improving forecast accuracy to 85%+ by implementing consistent pipeline review methodologies
* Increasing average deal size by 15% through strategic account planning and expansion models
* Reducing customer acquisition costs by developing efficient partner channel strategies
* Enhancing team performance through structured coaching and skills development programs

8. Final Thoughts

Your blend of technical understanding and business acumen positions you uniquely in the market:

* Focus your search on organizations where revenue operations is a strategic priority
* Leverage your industry-specific expertise to target firms in regulated sectors where your compliance knowledge adds value
* Prepare case studies that demonstrate your approach to solving complex sales challenges
* Consider roles that allow you to influence product strategy while driving commercial outcomes
* Build a network of strategic partners who can provide introductions to your target organizations

I hope these insights prove valuable as you navigate your next career move. Please don't hesitate to reach out if you'd like to discuss any aspect of this report in more detail.`;
}

/**
 * Generates a professional PDF report
 * @param {string} name - Client's full name
 * @param {string} email - Client's email address
 * @param {string} reportText - The full text of the report to be formatted into sections
 * @param {string} logoPath - Path to the GetBoardwise logo file (PNG or JPG)
 * @returns {Promise<Buffer>} - PDF document as a Buffer
 */
async function generatePDF(name, email, reportText, logoPath) {
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

        // Helper function to add a new page with consistent formatting
        const addNewPage = () => {
            const newPage = pdfDoc.addPage([595.28, 841.89]);

            // Set same background color for new page
            newPage.drawRectangle({
                x: 0,
                y: 0,
                width,
                height,
                color: rgb(0.05, 0.25, 0.15), // Dark green color
            });

            return newPage;
        };

        // Helper function to add text with proper color, wrapping, and bullet point handling
        const addText = (text, { fontSize, font, color, x, y, maxWidth, lineHeight = 1.3 }) => {
            if (!text || text.trim() === '') {
                return y; // Return the same y position if there's no text
            }

            // Convert bullet points and ensure proper line breaks
            const processedText = text
                .replace(/•/g, '*') // Convert bullets to asterisks
                .replace(/([^\n])\s*\*\s+/g, '$1\n* '); // Ensure bullet points start on new lines

            // Split the text into paragraphs
            const paragraphs = processedText.split('\n');
            let newY = y;

            for (const paragraph of paragraphs) {
                const trimmedParagraph = paragraph.trim();
                if (!trimmedParagraph) continue;

                // Check if this paragraph is a bullet point
                if (trimmedParagraph.startsWith('*')) {
                    // Extract content after bullet marker
                    const bulletText = trimmedParagraph.substring(1).trim();

                    // Draw bullet point symbol
                    page.drawText('•', {
                        x,
                        y: newY,
                        size: fontSize,
                        font,
                        color,
                    });

                    // Calculate indentation for bullet point text
                    const bulletIndent = 15;
                    const bulletTextX = x + bulletIndent;
                    const bulletMaxWidth = maxWidth - bulletIndent;

                    // Split into words for wrapping
                    const words = bulletText.split(' ');
                    let currentLine = '';

                    for (const word of words) {
                        const testLine = currentLine + (currentLine ? ' ' : '') + word;
                        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

                        if (testWidth > bulletMaxWidth && currentLine) {
                            // Draw the current line
                            page.drawText(currentLine, {
                                x: bulletTextX,
                                y: newY,
                                size: fontSize,
                                font,
                                color,
                            });

                            // Move to next line
                            currentLine = word;
                            newY -= fontSize * lineHeight;

                            // Check if we need a new page
                            if (newY < margin) {
                                page = addNewPage();
                                newY = height - margin;
                            }
                        } else {
                            currentLine = testLine;
                        }
                    }

                    // Draw the last line of the bullet point
                    if (currentLine) {
                        page.drawText(currentLine, {
                            x: bulletTextX,
                            y: newY,
                            size: fontSize,
                            font,
                            color,
                        });
                        newY -= fontSize * lineHeight;
                    }
                } else {
                    // Regular text (not a bullet point)
                    // Split into words for wrapping
                    const words = trimmedParagraph.split(' ');
                    let currentLine = '';

                    for (const word of words) {
                        const testLine = currentLine + (currentLine ? ' ' : '') + word;
                        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

                        if (testWidth > maxWidth && currentLine) {
                            // Draw the current line
                            page.drawText(currentLine, {
                                x,
                                y: newY,
                                size: fontSize,
                                font,
                                color,
                            });

                            // Move to next line
                            currentLine = word;
                            newY -= fontSize * lineHeight;

                            // Check if we need a new page
                            if (newY < margin) {
                                page = addNewPage();
                                newY = height - margin;
                            }
                        } else {
                            currentLine = testLine;
                        }
                    }

                    // Draw the last line
                    if (currentLine) {
                        page.drawText(currentLine, {
                            x,
                            y: newY,
                            size: fontSize,
                            font,
                            color,
                        });
                        newY -= fontSize * lineHeight;
                    }
                }
            }

            return newY;
        };

        // Define colors
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
            '1. Key Commercial Strengths',
            '2. Potential Markets & Sectors to Target',
            '3. Ideal Company Profile',
            '4. Where You Can Add Value',
            '5. Example Outreach Message',
            '6. LinkedIn Profile Feedback',
            '7. Your Potential Impact',
            '8. Final Thoughts'
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
                            .trim();
                    }
                }
            } catch (error) {
                console.warn(`Error extracting ${section} content:`, error);
            }

            // Debug - log the extracted content
            console.log(`\n${section} content: \n${sectionContent || "NO CONTENT"}`);

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

            if (sectionContent && sectionContent.trim()) {
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
            } else {
                // Add placeholder if no content
                currentY = addText("Content for this section will be added.", {
                    fontSize: 11,
                    font: regularFont,
                    color: textColor,
                    x: margin,
                    y: currentY,
                    maxWidth: width - (margin * 2),
                    lineHeight: 1.3,
                });
            }

            currentY -= 40; // Space after section

            // Check if we need a new page for the next section
            if (currentY < 200 && i < sections.length - 1) {
                page = addNewPage();
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
}

// Export functions
module.exports = {
    generateAndSavePDF,
    generateReportContent,
    generatePDF
};