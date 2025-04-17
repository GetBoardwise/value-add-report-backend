const { google } = require('googleapis');
const { Readable } = require('stream');

const { Client } = require('@hubspot/api-client');
const { generateCompleteReport } = require('../example');

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

    let pdfBuffer = await generateCompleteReport(name, email, linkedinURL, 'getboardwise-logo.png', 'file.pdf', process.env.OPENAI_API_KEY)

    if (pdfBuffer.success) {
      // Generate a unique filename
      const timestamp = new Date().getTime();
      const fileName = `${name.replace(/\s+/g, '_')}_Value_Add_Report_${timestamp}.pdf`;

      // Upload to Google Drive
      const driveResult = await uploadToDrive(pdfBuffer.base64, fileName);

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
          base64PDF: pdfBuffer.base64.toString('base64'),
        }),
      };
    } else {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({
          message: 'Error generating report',
          error: pdfBuffer.error
        }),
      };
    }

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