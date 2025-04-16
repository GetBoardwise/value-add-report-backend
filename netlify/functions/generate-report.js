import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

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
            line-height: 1.6;
          }
          .footer {
            margin-top: 40px;
            font-size: 12px;
            color: #999999;
          }
        </style>
      </head>
      <body>
        <h1>Value-Add Report for ${name}</h1>
        <p><strong>LinkedIn:</strong> ${linkedin}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p>This is a placeholder report generated from a Typeform submission via Zapier and Netlify. A full branded Value-Add Report would go here.</p>
        <div class="footer">© GetBoardwise</div>
      </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const pdfBuffer = await page.pdf({ format: 'A4' });

  await browser.close();

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name.replace(/\s+/g, '-')}-Value-Add-Report.pdf"`,
    },
    body: pdfBuffer.toString('base64'),
    isBase64Encoded: true,
  };
}
