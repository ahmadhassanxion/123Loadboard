# Use a lighter base image with Node 18
FROM node:18-slim

# Set environment variables early
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    DEBIAN_FRONTEND=noninteractive \
    NODE_OPTIONS="--max-old-space-size=512" \
    CHROME_PATH=/usr/bin/google-chrome-stable

# Install system dependencies in a single layer
RUN apt-get update && apt-get install -y \
    # Essential Chrome dependencies (minimal set)
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    libxshmfence1 \
    # Process management
    procps \
    # Clean up in same layer to reduce image size
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && apt-get autoremove -y \
    && apt-get autoclean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/*

# Create app directory and user in single step
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /app /home/pptruser/Downloads /app/data /app/logs \
    && chown -R pptruser:pptruser /home/pptruser /app

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY --chown=pptruser:pptruser package*.json ./
RUN npm ci --only=production --no-optional \
    && npm cache clean --force

# Copy application code
COPY --chown=pptruser:pptruser . .

# Create startup script with resource limits
RUN echo '#!/bin/bash\n\
# Set resource limits\n\
ulimit -n 1024\n\
ulimit -u 512\n\
ulimit -v 1048576\n\
\n\
# Start the application with memory limits\n\
exec node --max-old-space-size=512 --gc-interval=100 main.js\n\
' > /app/start.sh \
    && chmod +x /app/start.sh \
    && chown pptruser:pptruser /app/start.sh

# Switch to non-root user
USER pptruser

# Expose port
EXPOSE 9000

# Set resource limits in the container
# These should be set by your container runtime (Docker/K8s)
LABEL resource.memory="1GB"
LABEL resource.cpu="0.5"

# Health check with timeout
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node healthcheck.js || exit 1

# Use the startup script
CMD ["/app/start.sh"]