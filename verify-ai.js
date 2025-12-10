const fs = require('fs');
const path = require('path');

function loadEnv() {
    let envContent = '';
    try {
        envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
    } catch (e) {
        try {
            envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
        } catch (e2) {
            console.error("Could not read .env or .env.local");
            return {};
        }
    }

    const env = {};
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, '');
            env[key] = value;
        }
    });
    return env;
}

const env = loadEnv();
const apiKey = env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("GEMINI_API_KEY not found in .env or .env.local");
    process.exit(1);
}

async function listModels() {
    console.log("Checking available models with key:", apiKey.substring(0, 5) + "...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`HTTP Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error("Response:", text);
            return;
        }

        const data = await response.json();

        if (data.models) {
            console.log("\nAvailable Models for generateContent:");
            data.models.forEach(m => {
                if (m.supportedGenerationMethods.includes('generateContent')) {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log("No models found. Response:", data);
        }
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

listModels();
