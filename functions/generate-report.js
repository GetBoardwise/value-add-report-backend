const { google } = require('googleapis');
const { Readable } = require('stream');

const { Client } = require('@hubspot/api-client');
const { generateCompleteReport } = require('../example');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

const uploadToHubSpot = async (buffer, fileName, email) => {
  try {
    // Initialize HubSpot client
    const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_API_KEY });

    console.log(`Starting HubSpot upload for ${email}`);

    // return await hubspotClient.crm.contacts.basicApi.update("260896528632", {
    //   properties: {
    //     report_download_link: "https://api-eu1.hubspot.com/filemanager/api/v2/files/228987602122/signed-url-redirect?portalId=25911622"
    //   }
    // });


    // Find contact by email using the search API
    console.log(`Searching for contact with email: ${email}`);
    const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",
              operator: "EQ",
              value: email
            }
          ]
        }
      ]
    });

    console.log(`Search results:`, JSON.stringify(searchResponse, null, 2));

    if (!searchResponse.results || searchResponse.results.length === 0) {
      console.error('No contact found with email:', email);
      console.log('Creating new contact...');

      // Create a new contact if none exists
      const newContact = await hubspotClient.crm.contacts.basicApi.create({
        properties: {
          email: email,
          firstname: fileName.split('-')[0] || 'New',
          lastname: fileName.split('-')[1] || 'Contact'
        }
      });

      console.log('New contact created:', JSON.stringify(newContact, null, 2));
      var contactId = newContact.id;
    } else {
      var contactId = searchResponse.results[0].id;
      console.log(`Found contact with ID: ${contactId}`);
    }

    // Upload the file
    console.log('Uploading file to HubSpot...');

    const tempPath = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(tempPath, buffer);

    const fileStream = fs.createReadStream(tempPath);


    const fileResponse = await hubspotClient.files.filesApi.upload(
      {
        data: fileStream,
        name: fileName,
      },
      undefined, // folderId
      '/reports', // folderPath (it'll be created if it doesn't exist)
      fileName,
      undefined,
      JSON.stringify({
        access: 'PRIVATE',
        overwrite: false,
        duplicateValidationStrategy: 'NONE',
        duplicateValidationScope: 'ENTIRE_PORTAL',
      })
    );


    console.log('File uploaded successfully:', JSON.stringify(fileResponse, null, 2));

    fs.unlinkSync(tempPath);
    // Associate file with contact
    console.log(`Associating file ${fileResponse.id} with contact ${contactId}`);
    await hubspotClient.crm.contacts.basicApi.update(contactId, {
      properties: {
        report_download_link: fileResponse.url,
      }
    });

    console.log('File associated with contact successfully');

    return {
      fileId: fileResponse.id,
      contactId: contactId,
      fileUrl: fileResponse.url
    };
  } catch (error) {
    console.error('Error uploading to HubSpot:', error.message);

    // Log more details about the error
    if (error.response) {
      console.error('Error response:', JSON.stringify({
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data
      }, null, 2));
    }

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
      const hubspotResult = await uploadToHubSpot(pdfBuffer.base64, fileName, email);
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
          hubspotFileId: hubspotResult?.fileId || null,
          // Include base64 PDF for direct download if needed
          // base64PDF: pdfBuffer.base64.toString('base64'),
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