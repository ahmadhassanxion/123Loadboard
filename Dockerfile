# Use a lighter base image with Node 18
FROM node:18-slim

# Set environment variables early
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    DEBIAN_FRONTEND=noninteractive \
    NODE_OPTIONS="--max-old-space-size=512" \
    CHROME_PATH=/usr/bin/google-chrome-stable

# Install system dependencies in a single layer (minimal Chrome deps only)
RUN apt-get update && apt-get install -y \
    # Essential Chrome dependencies (absolute minimum)
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    libgbm1 \
    # Process management
    procps \
    # Install Chrome
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    # Cleanup aggressively
    && apt-get autoremove -y \
    && apt-get autoclean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/* \
    && rm -rf /usr/share/doc/* \
    && rm -rf /usr/share/man/* \
    && rm -rf /var/cache/apt/*

# Create app directory and user in single step
RUN groupadd -r pptruser && useradd -r -g pptruser -s /bin/bash pptruser \
    && mkdir -p /app /home/pptruser /app/data /app/logs \
    && chown -R pptruser:pptruser /home/pptruser /app

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY --chown=pptruser:pptruser package*.json ./
RUN npm ci --only=production --no-optional \
    && npm cache clean --force

# Copy application code
COPY --chown=pptruser:pptruser . .

# Create startup script with comprehensive resource management
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "🚀 Starting Puppeteer Scraper with resource limits"\n\
\n\
# Set comprehensive resource limits\n\
ulimit -c 0          # Core dumps\n\
ulimit -n 1024       # File descriptors\n\
ulimit -u 256        # Max user processes (reduced further)\n\
ulimit -v 1048576    # Virtual memory (1GB)\n\
ulimit -m 1048576    # Physical memory (1GB)\n\
\n\
# Display current limits for debugging\n\
echo "📊 Current Resource Limits:"\n\
echo "   File descriptors: $(ulimit -n)"\n\
echo "   Max processes: $(ulimit -u)"\n\
echo "   Virtual memory: $(ulimit -v) KB"\n\
\n\
# Check available system resources\n\
if [ -f /proc/meminfo ]; then\n\
  echo "💾 Available Memory: $(grep MemAvailable /proc/meminfo | awk '"'"'{print $2}'"'"') KB"\n\
fi\n\
\n\
# Cleanup any existing chrome processes\n\
pkill -f chrome || true\n\
sleep 1\n\
\n\
# Start the application with optimized settings\n\
exec node \\\n\
  --max-old-space-size=384 \\\n\
  --gc-interval=100 \\\n\
  --max-semi-space-size=2 \\\n\
  main.js\n\
' > /app/start.sh \
    && chmod +x /app/start.sh \
    && chown pptruser:pptruser /app/start.sh

# Switch to non-root user
USER pptruser

# Expose port
EXPOSE 9000

# Health check with shorter timeout
HEALTHCHECK --interval=45s --timeout=10s --start-period=15s --retries=2 \
    CMD node healthcheck.js || exit 1

# Use the startup script
CMD ["/app/start.sh"]