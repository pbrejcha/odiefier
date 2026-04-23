/**
 * Netlify serverless function: POST /api/speak
 *
 * Body (JSON): { "text": "<string to speak>" }
 *
 * Calls the ElevenLabs text-to-speech API and returns audio/mpeg binary
 * data so the browser can play it directly.
 *
 * Required environment variables:
 *   ELEVENLABS_API_KEY   – your ElevenLabs API key
 *
 * Optional environment variables:
 *   ELEVENLABS_VOICE_ID  – ElevenLabs voice ID (defaults to "Adam")
 *   ELEVENLABS_MODEL_ID  – ElevenLabs model ID (defaults to eleven_monolingual_v1)
 */

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID    = 'pNInz6obpgDQGcFmaJgB'; // Adam
const DEFAULT_MODEL_ID    = 'eleven_monolingual_v1';

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Parse request body
  let text;
  try {
    ({ text } = JSON.parse(event.body || '{}'));
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing or empty "text" field' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const apiKey  = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;

  if (!apiKey) {
    return {
      statusCode: 503,
      body: JSON.stringify({ error: 'ElevenLabs API key is not configured' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Call ElevenLabs TTS API
  let elevenResponse;
  try {
    elevenResponse = await fetch(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key':   apiKey,
          'Content-Type': 'application/json',
          'Accept':       'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: modelId,
          voice_settings: {
            stability:        0.45,
            similarity_boost: 0.75,
          },
        }),
      },
    );
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Failed to reach ElevenLabs API', detail: err.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  if (!elevenResponse.ok) {
    const detail = await elevenResponse.text();
    return {
      statusCode: elevenResponse.status,
      body: JSON.stringify({ error: 'ElevenLabs API error', detail }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Convert audio binary to base64 for the Netlify response
  const audioBuffer = await elevenResponse.arrayBuffer();
  const base64Audio  = Buffer.from(audioBuffer).toString('base64');

  return {
    statusCode: 200,
    headers: {
      'Content-Type':  'audio/mpeg',
      'Cache-Control': 'no-store',
    },
    body: base64Audio,
    isBase64Encoded: true,
  };
};
