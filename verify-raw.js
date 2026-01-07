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
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        console.log("Fetching models...");
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`HTTP Error: ${response.status} ${response.statusText}`);
            return;
        }
        const data = await response.json();
        console.log(`Found ${data.models?.length || 0} models.`);

        const geminis = data.models?.filter(m => m.name.toLowerCase().includes('gemini'));

        if (geminis && geminis.length > 0) {
            console.log("Gemini Models:");
            geminis.forEach(m => console.log(`- ${m.name}`));
        } else {
            console.log("❌ No Gemini models found!");
            console.log("All models:", data.models?.map(m => m.name));
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

listModels();
