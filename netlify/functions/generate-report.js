import pdf from 'html-pdf-node';

export async function handler(event) {
  const body = JSON.parse(event.body || '{}');
  const name = body.name || 'Unknown';
  const linkedin = body.linkedin || 'No LinkedIn URL provided';
  const email = body.email || 'No email provided';

  const html = `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            background: #0c1e2c;
            color: #ffffff;
          }
          h1 {
            font-size: 32px;
            color: #ffffff;
            margin-bottom: 10px;
          }
          p {
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <h1>Value-Add Report</h1>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>LinkedIn:</strong> ${linkedin}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p>This is a test report generated via Netlify serverless function.</p>
      </body>
    </html>
  `;

  const file = { content: html };
  const options = { format: 'A4' };

  try {
    const pdfBuffer = await pdf.generatePdf(file, options);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="value-add-report.pdf"'
      },
      body: pdfBuffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'PDF generation failed' })
    };
  }
}
