const { ChatGPTAPI } = require('chatgpt');
const { google } = require('googleapis');
const { Client } = require('@hubspot/api-client');
const html_to_pdf = require('html-pdf-node');
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
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
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
// const hubspotClient = new Client({ apiKey: process.env.HUBSPOT_API_KEY });

// Helper function to generate the PDF
const generatePDF = async (html) => {
  const options = { format: 'A4' };
  const file = { content: html };

  return new Promise((resolve, reject) => {
    html_to_pdf.generatePdf(file, options)
      .then(buffer => {
        resolve(buffer);
      })
      .catch(error => {
        reject(error);
      });
  });
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
// const uploadToHubSpot = async (buffer, fileName, email) => {
//   try {
//     // First, find contact by email
//     const contactsResponse = await hubspotClient.crm.contacts.basicApi.getPage(
//       undefined, undefined, undefined, undefined, undefined, undefined,
//       `email=${email}`
//     );

//     const contactId = contactsResponse.results[0]?.id;
//     if (!contactId) {
//       console.error('No contact found with email:', email);
//       return null;
//     }

//     // Create a file in HubSpot
//     const fileResponse = await hubspotClient.files.filesApi.upload({
//       file: buffer,
//       fileName: fileName,
//       options: {
//         access: 'PRIVATE',
//         overwrite: true,
//       },
//     });

//     // Associate file with contact
//     await hubspotClient.crm.contacts.associationsApi.create(
//       contactId,
//       'FILE',
//       fileResponse.id
//     );

//     return {
//       fileId: fileResponse.id,
//     };
//   } catch (error) {
//     console.error('Error uploading to HubSpot:', error);
//     return null;
//   }
// };

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
    const { name, email, linkedinURL } = requestBody;

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

    const chatGptResponse = await chatGptApi.sendMessage(prompt);

    // Convert the ChatGPT response to HTML
    const reportHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Value Add Report for ${name}</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #121212;
              color: #ffffff;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              padding: 20px 0;
              border-bottom: 1px solid #444;
            }
            .logo {
              max-width: 200px;
              margin-bottom: 20px;
            }
            h1 {
              font-size: 28px;
              margin-bottom: 10px;
              color: #ffffff;
            }
            h2 {
              font-size: 22px;
              margin-top: 30px;
              margin-bottom: 15px;
              color: #ffffff;
            }
            h3 {
              font-size: 18px;
              margin-top: 25px;
              margin-bottom: 10px;
              color: #ffffff;
            }
            p {
              margin-bottom: 15px;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #444;
              text-align: center;
              font-size: 14px;
              color: #999;
            }
            .highlight {
              background-color: #2c2c2c;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Value Add Report</h1>
              <p>Prepared exclusively for ${name}</p>
              <p>Generated on ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="content">
              ${chatGptResponse.text}
            </div>
            
            <div class="footer">
              <p>This report was generated based on information provided.</p>
              <p>For questions or further assistance, please contact us.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log(reportHTML);
    
    // Generate the PDF
    // const pdfBuffer = await generatePDF(reportHTML);

    // const localFilePath = path.join(__dirname, `${name.replace(/\s+/g, '_')}_Value_Add_Report.pdf`);
    // fs.writeFileSync(localFilePath, pdfBuffer);
    // console.log(`PDF saved locally at: ${localFilePath}`);

    // Generate a unique filename
    const timestamp = new Date().getTime();
    const fileName = `${name.replace(/\s+/g, '_')}_Value_Add_Report_${timestamp}.pdf`;

    // // Upload to Google Drive
    // const driveResult = await uploadToDrive(pdfBuffer, fileName);

    // // Upload to HubSpot
    // const hubspotResult = await uploadToHubSpot(pdfBuffer, fileName, email);

    // Return success response
    console.log("PDF GENERATED");
    
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
        // driveLink: driveResult?.webViewLink || null,
        // hubspotFileId: hubspotResult?.fileId || null,
        // Include base64 PDF for direct download if needed
        // base64PDF: pdfBuffer.toString('base64'),
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