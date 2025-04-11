# Mealie TikTok/Instagram Recipe Fetcher /w Gemini

Simple *micro* service that consumes a TikTok/Instagram(/Any YT-DLP supported link with description) and attempts to create a recipe for it in Mealie.

- Consumes URL by exposing HTTP server on :8080/
- Checks if there isn't a recipe already with that original URL
- Uses YT-DLP to extract thumbnail & description from the URL
- Prompts a Gemini model to create a (best effort) Recipe@Schema.org JSON
- Post that JSON to Mealie to create a new recipe for (+ attach original URL to it)

## Installation

1: Clone this repository.

2.A: Docker: Add a `docker-compose.yml`, see `docker-compose.example.yml` as example.

2.B: Manual (requires Node 22 & NPM): `npm ci && node --env-file .env src/index.js`

See `.env.example` for configuration options.

## TODOs

- Add notification bus