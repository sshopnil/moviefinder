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

async function listModels() {
    console.log("Fetching models...");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }
        const data = await response.json();
        const models = data.models || [];
        console.log("Available Models:");
        models.forEach(m => {
            if (m.name.includes("gemini")) {
                console.log(`- ${m.name} (${m.displayName})`);
            }
        });
    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

listModels();
