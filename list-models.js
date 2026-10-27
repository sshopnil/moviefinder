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
        const target = ["gemma-4-31b-it", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
        models.forEach(m => {
            const shortName = m.name.replace("models/", "");
            if (target.includes(shortName)) {
                console.log(`\nModel: ${shortName}`);
                console.log(`- Display Name: ${m.displayName}`);
                console.log(`- Input Token Limit: ${m.inputTokenLimit?.toLocaleString()}`);
                console.log(`- Output Token Limit: ${m.outputTokenLimit?.toLocaleString()}`);
            }
        });
    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

listModels();
