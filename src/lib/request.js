export function gatherPostedJson(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString(); // Collect request body chunks
        });
        req.on('end', () => resolve(body));
    });
}


export function parseRequestBody(res, body) {
    try {
        let requestData = JSON.parse(body);
        if (!requestData.url) {
            throw new Error('Missing "url" or "user" in JSON body');
        }

        if (!requestData.user) {
            requestData.user = 1;
        }

        return requestData;
    } catch (error) {
        doErrorResponse(res, 400, {  error: 'Invalid JSON request', details: error.message } );

        return undefined;
    }
}

export function doErrorResponse(res, code, body) {
    console.error(`=> Error response [${code}]:`, body)
    res.writeHead(code, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(body));
}