const { google } = require("@ai-sdk/google");
const { generateText } = require("ai");
const fs = require('fs');
const path = require('path');

// Mock loadEnv
function loadEnv() {
    let envContent = '';
    const envPath = path.resolve(process.cwd(), '.env');
    try {
        envContent = fs.readFileSync(envPath, 'utf8');
    } catch (e) { return {}; }
    const env = {};
    const lines = envContent.split(/\r?\n/);
    lines.forEach(line => {
        const match = line.match(/^\s*([^=]+)\s*=\s*(.*)?$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2] ? match[2].trim().replace(/^["']|["']$/g, '') : '';
            env[key] = value;
        }
    });
    return env;
}

const env = loadEnv();
const apiKey = env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ GEMINI_API_KEY missing");
    process.exit(1);
}

process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

async function verifyGeminiSDK() {
    console.log("🚀 Verifying Gemini Models via AI SDK...");
    const models = [
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
        "gemini-2.0-flash-exp"
    ];

    for (const modelId of models) {
        console.log(`\nTesting model: ${modelId}`);
        try {
            const { text } = await generateText({
                model: google(modelId),
                prompt: "Suggest one movie title.",
            });
            console.log(`✅ Success with ${modelId}! Response:`, text);
            return; // Exit on first success
        } catch (error) {
            console.log(`❌ Failed with ${modelId}:`, error.message || error);
            // console.dir(error, { depth: null });
        }
    }
    console.log("All models failed.");
}

verifyGeminiSDK();
