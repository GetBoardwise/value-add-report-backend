const { generatePDF } = require('./utils.js');
const { generateReportContent } = require('./utils.js');
const fs = require('fs');
const path = require('path');

/**
 * Generate and save a complete GetBoardwise report
 * @param {string} name - Client's full name
 * @param {string} email - Client's email address
 * @param {string} linkedinURL - Client's LinkedIn profile URL
 * @param {string} logoPath - Path to the GetBoardwise logo
 * @param {string} outputPath - Where to save the generated PDF
 */
async function generateCompleteReport(name, email, linkedinURL, logoPath, outputPath, apiKey, parsedData) {
    try {
        console.log(`Generating report for ${name}...`);

        // Step 1: Generate the report content
        console.log('Generating report content...');
        const content = await generateReportContent(name, email, parsedData, apiKey);
        console.log(content);
        

        // Step 2: Generate the PDF with the content
        console.log('Creating PDF document...');
        const pdfBuffer = await generatePDF(name, email, content, logoPath);

        // // Step 3: Save the PDF to the specified path
        console.log(`Saving PDF to ${outputPath}...`);
        // fs.writeFileSync(outputPath, pdfBuffer);

        console.log('Report generation complete!');
        return { success: true, path: '', base64: pdfBuffer };
    } catch (error) {
        console.error('Error generating complete report:', error.message);
        return { success: false, error: error.message };
    }
}

// Example usage
// async function runExample() {
//     const clientName = 'Josh Hayes';
//     const clientEmail = 'josh.hayes@example.com';
//     const clientLinkedIn = 'https://www.linkedin.com/in/joshhayes';
//     const logoPath = path.join(__dirname, 'getboardwise-logo.jpeg');
//     const outputPath = path.join(__dirname, 'reports', `${clientName.replace(/\s+/g, '-')}-report.pdf`);

//     // Make sure the output directory exists
//     const outputDir = path.dirname(outputPath);
//     if (!fs.existsSync(outputDir)) {
//         fs.mkdirSync(outputDir, { recursive: true });
//     }

//     const result = await generateCompleteReport(
//         clientName,
//         clientEmail,
//         clientLinkedIn,
//         logoPath,
//         outputPath
//     );

//     if (result.success) {
//         console.log(`Report successfully saved to: ${result.path}`);
//     } else {
//         console.error(`Report generation failed: ${result.error}`);
//     }
// }

// // Run the example if this file is executed directly
// if (require.main === module) {
//     runExample().catch(console.error);
// }

module.exports = { generateCompleteReport };