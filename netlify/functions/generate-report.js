import pdf from 'html-pdf-node';

export async function handler(event) {
  const body = JSON.parse(event.body || '{}');
  const name = body.name || 'Unknown';
  const linkedin = body.linkedin || 'No LinkedIn URL provided';

  const htmlContent = `
    <html>
      <head>
        <style>
          body {
            font-family: Arial;
            background: #0c1e2c;
            color: #ffffff;
            padding: 40px;
          }
          h1 {
            font-size: 32px;
            margin-bottom: 10px;
          }
          p {
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <h1>Value Add Report for ${name}</h1>
        <p><strong>LinkedIn:</strong> ${linkedin}</p>
      </body>
    </html>
  `;

  const options = { format: 'A4' };
  const file = { content: htmlContent };

  const pdfBuffer = await pdf.generatePdf(file, options);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}-value-add-report.pdf"`
    },
    body: pdfBuffer.toString('base64'),
    isBase64Encoded: true
  };
}
