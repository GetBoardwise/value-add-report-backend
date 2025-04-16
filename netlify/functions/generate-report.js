export async function handler(event) {
  const body = JSON.parse(event.body || '{}');
  const name = body.name || "Unknown";
  const linkedin = body.linkedin || "No LinkedIn URL provided";

  const response = {
    message: `Received data for ${name} with LinkedIn ${linkedin}`,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
}
