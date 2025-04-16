const { ChatGPTAPI } = require('chatgpt');
const { google } = require('googleapis');
const getStream = require('get-stream');
const axios = require('axios')

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { Readable } = require('stream');

const { Client } = require('@hubspot/api-client');
// const html_to_pdf = require('html-pdf-node');
const fs = require('fs');
const path = require('path');

// Environment variables to be set in Netlify
// OPENAI_API_KEY: Your OpenAI API key
// GOOGLE_CREDENTIALS: JSON string of your Google service account credentials
// HUBSPOT_API_KEY: Your HubSpot API key
// FOLDER_ID: Your Google Drive folder ID to upload PDFs

// Initialize ChatGPT API
const chatGptApi = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Google Drive
const initializeGoogleDrive = () => {
  let creds = {
    "type": "service_account",
    "project_id": "boardwisepdf-uploader",
    "private_key_id": process.env.PRIVATE_KEY_ID,
    "private_key": process.env.PRIVATE_KEY,
    "client_email": "pdf-uploader@boardwisepdf-uploader.iam.gserviceaccount.com",
    "client_id": process.env.CLIENT_ID,
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/pdf-uploader%40boardwisepdf-uploader.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
  }
  
  try {
    const credentials = creds
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.error('Error initializing Google Drive:', error);
    return null;
  }
};

// Initialize HubSpot
const hubspotClient = new Client({ apiKey: process.env.HUBSPOT_API_KEY });

// Helper function to generate the PDF

// Helper function to generate the PDF
const generatePDF = async (name, email, reportText) => {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Embed the standard font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Add a page
    let page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const { width, height } = page.getSize();
    
    // Set up some constants
    const margin = 50;
    const fontSize = 12;
    const headerSize = 16;
    const titleSize = 24;
    let currentY = height - margin;
    
    // Helper function to sanitize text for PDF encoding
    const sanitizeText = (text) => {
      // Replace problematic characters
      return text
        .replace(/[\u0000-\u001F]/g, ' ') // Replace control characters with spaces
        .replace(/[\u007F-\u00A0]/g, ' ') // Replace DEL and non-breaking space
        .replace(/[\u2028\u2029]/g, ' '); // Replace line/paragraph separator
    };
    
    // Helper function to add text with line wrapping
    const addText = (text, { fontSize, font, x, y, maxWidth }) => {
      // First sanitize the text
      const sanitizedText = sanitizeText(text);
      
      // Split the text into paragraphs (on double newlines)
      const paragraphs = sanitizedText.split(/\n\s*\n/);
      let newY = y;
      
      for (const paragraph of paragraphs) {
        // Split each paragraph into words
        const words = paragraph.replace(/\n/g, ' ').split(' ').filter(word => word);
        let line = '';
        
        if (words.length === 0) continue;
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const testLine = line + (line ? ' ' : '') + word;
          
          try {
            const testWidth = font.widthOfTextAtSize(testLine, fontSize);
            
            if (testWidth > maxWidth && line.length > 0) {
              // If this line would be too long, draw what we have and start a new line
              page.drawText(line, { x, y: newY, size: fontSize, font });
              line = word;
              newY -= fontSize * 1.2;
              
              // Check if we need a new page
              if (newY < margin) {
                const newPage = pdfDoc.addPage([595.28, 841.89]);
                newY = height - margin;
                page = newPage;
              }
            } else {
              line = testLine;
            }
          } catch (e) {
            // If there's an encoding error with a word, skip it
            console.warn(`Skipping problematic word: "${word}"`);
            continue;
          }
        }
        
        // Draw the last line of this paragraph
        if (line.length > 0) {
          try {
            page.drawText(line, { x, y: newY, size: fontSize, font });
            newY -= fontSize * 1.2;
          } catch (e) {
            console.warn(`Error drawing line: "${line}" - ${e.message}`);
          }
        }
        
        // Add paragraph spacing
        newY -= fontSize * 0.8;
        
        // Check if we need a new page
        if (newY < margin) {
          const newPage = pdfDoc.addPage([595.28, 841.89]);
          newY = height - margin;
          page = newPage;
        }
      }
      
      return newY; // Return the new Y position
    };
    
    // Add title - in a try/catch to handle any encoding issues
    try {
      page.drawText('Value Add Report', {
        x: margin,
        y: currentY,
        size: titleSize,
        font: boldFont,
      });
    } catch (e) {
      console.warn('Error drawing title:', e.message);
    }
    
    currentY -= titleSize * 1.5;
    
    // Add metadata - in try/catch blocks
    try {
      page.drawText(`Prepared for: ${sanitizeText(name)}`, {
        x: margin,
        y: currentY,
        size: fontSize,
        font: font,
      });
    } catch (e) {
      console.warn('Error drawing name:', e.message);
    }
    
    currentY -= fontSize * 1.5;
    
    try {
      page.drawText(`Email: ${sanitizeText(email)}`, {
        x: margin,
        y: currentY,
        size: fontSize,
        font: font,
      });
    } catch (e) {
      console.warn('Error drawing email:', e.message);
    }
    
    currentY -= fontSize * 1.5;
    
    try {
      page.drawText(`Generated on: ${new Date().toLocaleDateString()}`, {
        x: margin,
        y: currentY,
        size: fontSize,
        font: font,
      });
    } catch (e) {
      console.warn('Error drawing date:', e.message);
    }
    
    currentY -= fontSize * 3;
    
    // Parse sections from the report text
    const sections = [
      'Introduction',
      'Market Analysis',
      'Current Opportunities',
      'Recommended Actions',
      'Conclusion'
    ];
    
    // Extract content more safely
    const extractSectionContent = (text, sectionName, nextSectionName) => {
      try {
        // Make section names regex-safe
        const safeSectionName = sectionName.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
        const safeNextSectionName = nextSectionName ? 
            nextSectionName.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1") : null;
        
        let regex;
        
        // First try with section header formatting (numbered or with colon)
        if (!nextSectionName) {
          // This is the last section
          regex = new RegExp(`(?:${safeSectionName}:?|\\d+\\.?\\s*${safeSectionName}:?)\\s*(.*?)$`, 'is');
        } else {
          // Match until next section
          regex = new RegExp(
            `(?:${safeSectionName}:?|\\d+\\.?\\s*${safeSectionName}:?)\\s*(.*?)(?:${safeNextSectionName}:?|\\d+\\.?\\s*${safeNextSectionName}:?)`, 
            'is'
          );
        }
        
        const match = text.match(regex);
        return match ? match[1].trim() : '[No content found]';
      } catch (error) {
        console.warn(`Error extracting ${sectionName} section:`, error);
        return '[Error extracting content]';
      }
    };
    
    // Add each section
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const nextSection = i < sections.length - 1 ? sections[i + 1] : null;
      let content;
      
      try {
        content = extractSectionContent(reportText, section, nextSection);
      } catch (e) {
        console.warn(`Error processing section ${section}:`, e);
        content = '[Error processing content]';
      }
      
      // Add a new page if nearing the bottom
      if (currentY < 100) {
        page = pdfDoc.addPage([595.28, 841.89]);
        currentY = height - margin;
      }
      
      // Draw section header
      try {
        page.drawText(section, {
          x: margin,
          y: currentY,
          size: headerSize,
          font: boldFont
        });
      } catch (e) {
        console.warn(`Error drawing section header ${section}:`, e.message);
      }
      
      currentY -= headerSize * 1.5;
      
      // Draw section content with text wrapping
      try {
        currentY = addText(content, {
          fontSize,
          font,
          x: margin,
          y: currentY,
          maxWidth: width - (margin * 2)
        });
      } catch (e) {
        console.warn(`Error in text rendering for ${section}:`, e.message);
        
        // Make a simplified attempt to render something
        try {
          page.drawText('[Content rendering error - please see logs]', {
            x: margin,
            y: currentY,
            size: fontSize,
            font: font
          });
          currentY -= fontSize * 2;
        } catch (err) {
          console.error('Even fallback rendering failed:', err);
        }
      }
      
      currentY -= fontSize * 2;
    }
    
    // Add footer
    try {
      const footerText = "This report was generated automatically based on available information.";
      const footerWidth = font.widthOfTextAtSize(footerText, 10);
      
      page.drawText(footerText, {
        x: (width - footerWidth) / 2,
        y: margin / 2,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      });
    } catch (e) {
      console.warn('Error adding footer:', e.message);
    }
    
    // Serialize the PDF to bytes
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
};

// Helper function to upload to Google Drive
const uploadToDrive = async (buffer, fileName) => {
  try {
    const drive = initializeGoogleDrive();
    if (!drive) return null;

    const fileMetadata = {
      name: fileName,
      parents: [process.env.FOLDER_ID],
    };

    const media = {
      mimeType: 'application/pdf',
      body: Readable.from(buffer),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id,webViewLink',
    });

    return {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    return null;
  }
};

// Helper function to upload to HubSpot
const uploadToHubSpot = async (buffer, fileName, email) => {
  try {
    // First, find contact by email
    const contactsResponse = await hubspotClient.crm.contacts.basicApi.getPage(
      undefined, undefined, undefined, undefined, undefined, undefined,
      `email=${email}`
    );

    const contactId = contactsResponse.results[0]?.id;
    if (!contactId) {
      console.error('No contact found with email:', email);
      return null;
    }

    // Create a file in HubSpot
    const fileResponse = await hubspotClient.files.filesApi.upload({
      file: buffer,
      fileName: fileName,
      options: {
        access: 'PRIVATE',
        overwrite: true,
      },
    });

    // Associate file with contact
    await hubspotClient.crm.contacts.associationsApi.create(
      contactId,
      'FILE',
      fileResponse.id
    );

    return {
      fileId: fileResponse.id,
    };
  } catch (error) {
    console.error('Error uploading to HubSpot:', error);
    return null;
  }
};

const generateReportContent = async (name, email, linkedinURL) => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'o4-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional business analyst creating value-add reports.'
          },
          {
            role: 'user',
            content: `Generate a value-add report for ${name} with email ${email} and LinkedIn profile ${linkedinURL}. 
            The report should have the following sections:
            1. Introduction
            2. Market Analysis
            3. Current Opportunities
            4. Recommended Actions
            5. Conclusion
            
            Format the report with clear section titles followed by professional, insightful content.`
          }
        ],
        max_completion_tokens: 1500
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating content with ChatGPT:', error.response?.data || error.message);
    throw new Error('Failed to generate report content');
  }
};

// The main function handler
exports.handler = async (event, context) => {
  // Check if the request method is POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    // Parse the request body
    const requestBody = JSON.parse(event.body);

    // Extract data from the request
    const { name, email, linkedinURL = "https://linkedin.com/5345/534" } = requestBody;

    if (!name || !email || !linkedinURL) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields: name, email, linkedinURL' }),
      };
    }

    // Generate the report content using ChatGPT
    const prompt = `Generate a value-add report for ${name} with email ${email} and LinkedIn profile ${linkedinURL}. 
    The report should have the following sections:
    1. Introduction
    2. Market Analysis
    3. Current Opportunities
    4. Recommended Actions
    5. Conclusion
    
    Format the report professionally with headers and subheaders.`;

    const chatGptResponse = "await chatGptApi.sendMessage(prompt)";
    let content = await generateReportContent(name, email, linkedinURL)

    // Generate the PDF
    const pdfBuffer = await generatePDF(name, email, content);

    // const localFilePath = path.join(__dirname, `${name.replace(/\s+/g, '_')}_Value_Add_Report.pdf`);
    // fs.writeFileSync(localFilePath, pdfBuffer);
    // console.log(`PDF saved locally at: ${localFilePath}`);

    // Generate a unique filename
    const timestamp = new Date().getTime();
    const fileName = `${name.replace(/\s+/g, '_')}_Value_Add_Report_${timestamp}.pdf`;

    // Upload to Google Drive
    const driveResult = await uploadToDrive(pdfBuffer, fileName);

    // // Upload to HubSpot
    // const hubspotResult = await uploadToHubSpot(pdfBuffer, fileName, email);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({
        message: 'Report generated successfully',
        fileName: fileName,
        driveLink: driveResult?.webViewLink || null,
        // hubspotFileId: hubspotResult?.fileId || null,
        // Include base64 PDF for direct download if needed
        base64PDF: pdfBuffer.toString('base64'),
      }),
    };

  } catch (error) {
    console.error('Error generating report:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({
        message: 'Error generating report',
        error: error.message,
      }),
    };
  }
};