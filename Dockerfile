FROM node:22.14-alpine

# Add default folders
RUN mkdir -p /app/run  \
    && mkdir /app/lib

# Add YT-DLP for the lazy ones
RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python
ADD https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp /app/lib/
RUN chmod +x /app/lib/yt-dlp

# Switch to that folder
WORKDIR /app/run

# Copy latest version
ADD src /app/run/src
ADD package.json package-lock.json /app/run/

# Switch user context
RUN chown -R 1000:1000 /app/
USER 1000

# Run NPM install
RUN npm ci

# Default entry point for starting
ENTRYPOINT ["node", "src/index.js"]