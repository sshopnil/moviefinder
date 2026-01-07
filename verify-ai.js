const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const fs = require('fs');
const path = require('path');

// Mock loadEnv to get keys
function loadEnv() {
    let envContent = '';
    const envPath = path.resolve(process.cwd(), '.env');
    try {
        envContent = fs.readFileSync(envPath, 'utf8');
    } catch (e) {
        console.error("Could not read .env at", envPath);
        return {};
    }
    const env = {};
    const lines = envContent.split(/\r?\n/);
    lines.forEach(line => {
        const match = line.match(/^\s*([^=]+)\s*=\s*(.*)?$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2] ? match[2].trim() : '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
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

async function verifyGemini() {
    console.log("🚀 Verifying Gemini 1.5 Flash Integration...");
    try {
        console.log(`🔑 Key found: ${apiKey.substring(0, 5)}...`);

        // Try 'model' instead of 'modelName'
        const model = new ChatGoogleGenerativeAI({
            apiKey: apiKey,
            model: "gemini-1.5-flash", // Changed from modelName
            temperature: 0.7,
        });

        console.log("📤 Sending test prompt...");
        const response = await model.invoke("Suggest one movie. Return only the title.");
        console.log("✅ Success! Response:", response.content);
    } catch (error) {
        console.error("❌ Verification Failed with Error:");
        console.error(error);
    }
}

verifyGemini();
