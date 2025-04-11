import http from 'node:http';
import {GoogleGenAI} from '@google/genai';
import {getVideoDetails, validateYtDlp} from "./lib/yt-dlp.js";
import {doErrorResponse, gatherPostedJson, parseRequestBody} from "./lib/request.js";
import {Mealie} from "./lib/mealie.js";
import {extractJson} from "./lib/gemini.js";

// Configuration
const YTDLP_PATH = process.env.YTDLP_PATH || '/app/lib/yt-dlp';
const LISTEN_PORT = process.env.LISTEN_PORT || 8080;
const PROTECT_WITH_TOKEN = process.env.PROTECT_WITH_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const MEALIE_HOST = process.env.MEALIE_HOST;
const MEALIE_PUBLIC_HOST = process.env.MEALIE_PUBLIC_HOST || MEALIE_HOST;
const MEALIE_TOKEN = process.env.MEALIE_TOKEN;

if (!YTDLP_PATH || !LISTEN_PORT || !GEMINI_API_KEY || !GEMINI_MODEL ||!MEALIE_HOST ||!MEALIE_TOKEN) {
    console.error(`Missing configuration env`);
    process.exit(1); // Exit if the file doesn't exist
}

// Setup clients
const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});
const mealieClients = {
    1: new Mealie(MEALIE_HOST, MEALIE_TOKEN),
};

// Load for any additional users
Object.keys(process.env).forEach(key => {
   const tokenMatch = /MEALIE_TOKEN_USER_(\d+)$/.exec(key);
   if (tokenMatch && process.env[key]) {
       mealieClients[parseInt(tokenMatch[1], 10)] = new Mealie(MEALIE_HOST, process.env[key]);
   }
});


// Make sure YT-DLP exists & works
await validateYtDlp(YTDLP_PATH);

// Start the processing server
const server = http.createServer(handleRequest);

server.listen(LISTEN_PORT, () => {
    console.log();
    console.log('=== SERVER STARTED ===')
    console.log(`Server listening on http://localhost:${LISTEN_PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EACCES') {
        console.error(`Error: Permission denied to bind to port ${LISTEN_PORT}. Try running with sudo or choosing a port > 1024.`);
    } else if (err.code === 'EADDRINUSE') {
        console.error(`Error: Port ${LISTEN_PORT} is already in use.`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
});



// Handle a new incoming request
async function handleRequest(req, res) {
    console.log();

    // Only accept POST requests to the root path for this example
    if (req.method !== 'POST' || req.url !== '/') {
        doErrorResponse(res, 404, { error: 'Not Found' });
        return;
    }

    if (PROTECT_WITH_TOKEN && req.headers.authorization !== `Bearer ${PROTECT_WITH_TOKEN}`) {
        doErrorResponse(res, 401, { error: 'Invalid token' });
        return;
    }

    // Gather the posted data
    const body = await gatherPostedJson(req);
    const requestData = parseRequestBody(res, body);
    if (!requestData) {
        return;
    }

    // Check if Mealie is configured for this user
    const mealie = mealieClients[requestData.user];
    if (!mealie) {
        doErrorResponse(res, 404, { error: 'User not found' });
        return;
    }

    // Start our action
    console.log('=> Request received:', requestData.url);

    let aiResponse = undefined;

    try {
        // Check if Mealie already has that recipe
        console.log('=> Checking Mealie for duplicate recipe')
        if (await mealie.recipeAlreadyExists(requestData.url)) {
            doErrorResponse(res, 409, 'Already exists in Mealie');
            return;
        }

        // Fetch the details via YTDLP
        console.log('=> Fetching YT-DLP video details')
        const videoInfo = await getVideoDetails(YTDLP_PATH, requestData.url);
        console.log('=> Success! Video title:', videoInfo.title);

        // Prompt gemini to fetch that data
        console.log('=> Prompting Gemini to create a JSON')
        aiResponse = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `
I've lost the formatting for the following text (after ----). Convert it into a structured Schema.org Recipe JSON. 

- Rules:
1. If the ingredients are not in Dutch, output them twice: first the original (do not modify the text at all) & then translated into dutch & metric system. If the ingredients are already in dutch, only output the originals.
2. Convert any data points (so not in text fields), like CookingTime, to metric. 
3. Put the full original text, excluding ingredients & steps, in the description.
4. Optionally modify the title to not include any clickbait / call to actions. It should describe the meal as best as possible. Emoji's are allowed.

- Additional data:
Thumbnail: ${videoInfo.thumbnail}
Author: "${videoInfo.channel}"

----
${videoInfo.description}
`,
        })
        const recipeJson = extractJson(aiResponse.text);

        // Create the new recipe with Mealie
        console.log('=> Creating new recipe from JSON')
        const newRecipeSlug = await mealie.importRecipe(recipeJson);
        const newRecipeUrl = `${MEALIE_PUBLIC_HOST}/g/home/r/${newRecipeSlug}`;

        // Patch the correct URL in
        console.log(`=> New recipe created: ${newRecipeUrl} | Patching original URL into recipe`)
        await mealie.updateRecipe(newRecipeSlug, {
            orgURL: requestData.url
        });

        // Send success response back to the original client
        console.log('=> Recipe imported!!');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            message: 'Recipe imported',
            url: newRecipeUrl,
        }));
    } catch (error) {
        if (aiResponse && aiResponse.text) {
            console.log('-- AI Response --')
            console.log(aiResponse.text);
            console.log('-- END AI RESPONE --');
        }
        if (error.response) {
            error = { status: error.status, data: error.response.data }
        }
        doErrorResponse(res, 500, error);
    }
}