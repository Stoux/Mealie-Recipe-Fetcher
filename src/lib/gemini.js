
export function extractJson(text) {
    // Attempt to parse JSON from it
    const match = /```json([\s\S]+)```/im.exec(text);
    if (!match.length) {
        throw new Error('AI response not valid JSON');
    }

    const json = JSON.parse(match[1]);
    if (!json || !json.name) {
        throw new Error(`AI request failed: invalid JSON response`);
    }

    return json;
}

