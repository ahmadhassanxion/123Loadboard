import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

let hasSavedResponse = false;

// Resource management configuration
const RESOURCE_CONFIG = {
  maxConcurrentPages: 1, // Limit to 1 page at a time
  pageTimeout: 45000,    // Reduced timeout
  navigationTimeout: 30000,
  requestTimeout: 15000,
  maxRetries: 3,
  retryDelay: 2000
};

// Memory optimization flags
const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=TranslateUI,VizDisplayCompositor',
  '--disable-ipc-flooding-protection',
  '--disable-web-security',
  '--disable-features=site-per-process',
  '--disable-hang-monitor',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-sync',
  '--disable-translate',
  '--disable-extensions',
  '--disable-plugins',
  '--disable-preconnect',
  '--disable-component-extensions-with-background-pages',
  '--memory-pressure-off',
  '--max_old_space_size=512',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-client-side-phishing-detection',
  '--disable-default-apps',
  '--disable-hang-monitor',
  '--disable-prompt-on-repost',
  '--disable-sync',
  '--disable-web-resources',
  '--no-default-browser-check',
  '--no-first-run',
  '--single-process', // Use single process to reduce memory usage
  '--window-size=1280,720'
];

class ScraperError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ScraperError';
    this.code = code;
  }
}

async function createBrowser() {
  const launchOptions = {
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    args: CHROME_ARGS,
    defaultViewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    timeout: 30000,
  };

  let browser = null;
  let retries = 0;

  while (retries < RESOURCE_CONFIG.maxRetries) {
    try {
      console.log(`🚀 Launching browser (attempt ${retries + 1}/${RESOURCE_CONFIG.maxRetries})`);
      browser = await puppeteer.launch(launchOptions);
      console.log('✅ Browser launched successfully');
      return browser;
    } catch (error) {
      retries++;
      console.error(`❌ Browser launch failed (attempt ${retries}):`, error.message);
      
      if (retries >= RESOURCE_CONFIG.maxRetries) {
        throw new ScraperError(`Failed to launch browser after ${RESOURCE_CONFIG.maxRetries} attempts`, 'BROWSER_LAUNCH_FAILED');
      }
      
      console.log(`⏳ Waiting ${RESOURCE_CONFIG.retryDelay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, RESOURCE_CONFIG.retryDelay));
    }
  }
}

async function ensureDataDirectory() {
  const dataDir = '/app/data';
  try {
    if (!existsSync(dataDir)) {
      await fs.mkdir(dataDir, { recursive: true });
      console.log(`📁 Created data directory: ${dataDir}`);
    }
    return dataDir;
  } catch (error) {
    console.error('❌ Failed to create data directory:', error);
    throw new ScraperError('Failed to create data directory', 'DIRECTORY_ERROR');
  }
}

async function setupPage(browser) {
  const page = await browser.newPage();
  
  // Set timeouts
  await page.setDefaultNavigationTimeout(RESOURCE_CONFIG.navigationTimeout);
  await page.setDefaultTimeout(RESOURCE_CONFIG.requestTimeout);
  
  // Set user agent
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Enable request interception for resource blocking
  await page.setRequestInterception(true);
  
  return page;
}

async function setupRequestHandling(page, location) {
  const apiResponses = [];
  let requestCount = 0;

  // Block unnecessary resources
  page.on('request', (request) => {
    const resourceType = request.resourceType();
    const url = request.url();
    
    // Block resource-intensive content
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      return request.abort();
    }
    
    // Block tracking and analytics
    if (url.includes('google-analytics') || 
        url.includes('doubleclick') || 
        url.includes('facebook.com') ||
        url.includes('twitter.com')) {
      return request.abort();
    }
    
    if (url.includes('api') || url.includes('search')) {
      console.log(`➡️  Request [${++requestCount}]: ${url.substring(0, 80)}...`);
    }
    
    request.continue();
  });

  // Handle responses
  page.on('response', async (response) => {
    try {
      const url = response.url();
      const status = response.status();
      
      if (url.includes('api') || url.includes('search')) {
        console.log(`⬅️  Response [${status}]: ${url.substring(0, 80)}...`);
      }
      
      // Target the specific API endpoint
      if (url.includes('/api/loads/named-searches/') && 
          url.endsWith('/search') && 
          !hasSavedResponse &&
          status === 200) {
        
        console.log('✅ Found target API endpoint');
        
        try {
          const json = await Promise.race([
            response.json(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('JSON parse timeout')), 5000)
            )
          ]);
          
          if (!json) {
            console.log('⚠️ Empty JSON response');
            return;
          }
          
          console.log('✅ Successfully parsed API response');
          
          const responseData = {
            url: url,
            status: status,
            data: json,
            timestamp: new Date().toISOString(),
            location: location
          };
          
          apiResponses.push(responseData);
          await saveResponseData(responseData, location);
          
        } catch (jsonError) {
          console.error('❌ Failed to parse JSON:', jsonError.message);
        }
      }
    } catch (error) {
      console.error('❌ Error in response handler:', error.message);
    }
  });

  // Error handling
  page.on('error', (error) => {
    console.error('❌ Page error:', error.message);
  });

  page.on('pageerror', (error) => {
    console.error('❌ Page script error:', error.message);
  });

  return apiResponses;
}

async function saveResponseData(responseData, location) {
  try {
    const dataDir = await ensureDataDirectory();
    const filename = `${location.replace(/[^a-z0-9]/gi, '_')}.json`;
    const filepath = path.join(dataDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(responseData, null, 2));
    console.log(`💾 Successfully saved to ${filepath}`);
    hasSavedResponse = true;
    
    return filepath;
  } catch (error) {
    console.error('❌ Failed to save response data:', error);
    throw new ScraperError('Failed to save response data', 'SAVE_ERROR');
  }
}

async function performLogin(page) {
  const email = process.env.LOGIN_EMAIL || "quotes@stretchxlfreight.com";
  const password = process.env.LOGIN_PASSWORD || "B8G@pML$bzftvJN";

  try {
    console.log('🔑 Attempting login...');
    
    await page.goto('https://login.123loadboard.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: RESOURCE_CONFIG.navigationTimeout
    });
    
    // Wait for and fill email
    await page.waitForSelector('#email', { visible: true, timeout: 15000 });
    await page.type('#email', email, { delay: 100 });
    
    // Wait for and fill password
    await page.waitForSelector('#password', { visible: true, timeout: 15000 });
    await page.type('#password', password, { delay: 100 });
    
    // Click login button
    await page.waitForSelector('#sign-in-button', { visible: true, timeout: 15000 });
    await page.click('#sign-in-button');
    
    // Wait for navigation with reduced timeout
    await page.waitForNavigation({ 
      waitUntil: 'domcontentloaded', 
      timeout: RESOURCE_CONFIG.navigationTimeout 
    });
    
    console.log('✅ Login successful');
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    throw new ScraperError('Login failed', 'LOGIN_ERROR');
  }
}

async function performSearch(page, location) {
  try {
    console.log('🔍 Navigating to search page...');
    
    await page.goto('https://members.123loadboard.com/loads/search/', { 
      waitUntil: 'domcontentloaded',
      timeout: RESOURCE_CONFIG.navigationTimeout
    });
    
    console.log(`🔎 Setting up search for: ${location}`);
    
    // Clear existing search
    await page.waitForSelector('#clear', { visible: true, timeout: 15000 });
    await page.click('#clear');
    await page.waitForTimeout(1000);
    
    // Remove all filters
    await page.waitForSelector('#remove_all', { visible: true, timeout: 15000 });
    await page.click('#remove_all');
    await page.waitForTimeout(1000);
    
    // Create new search
    await page.waitForSelector('#create_new_search_btn', { visible: true, timeout: 15000 });
    await page.click('#create_new_search_btn');
    await page.waitForTimeout(1000);
    
    // Set pickup location
    await page.waitForSelector('#pickup_picker', { visible: true, timeout: 15000 });
    await page.click('#pickup_picker');
    await page.waitForTimeout(500);
    
    await page.waitForSelector('#lc_picker', { visible: true, timeout: 15000 });
    await page.type('#lc_picker', location, { delay: 100 });
    await page.waitForTimeout(1000);
    
    // Select first suggestion
    await page.waitForSelector('#lc_picker-item-0', { visible: true, timeout: 15000 });
    await page.click('#lc_picker-item-0');
    await page.waitForTimeout(2000);
    
    // Execute search
    console.log('🔍 Executing search...');
    const searchSuccess = await page.evaluate(() => {
      try {
        const searchButton = document.getElementById('see_exact_loads');
        if (searchButton) {
          searchButton.click();
          return true;
        }
        return false;
      } catch (error) {
        console.error('Search button click failed:', error);
        return false;
      }
    });
    
    if (!searchSuccess) {
      throw new ScraperError('Failed to click search button', 'SEARCH_ERROR');
    }
    
    console.log('✅ Search initiated successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    throw new ScraperError(`Search failed: ${error.message}`, 'SEARCH_ERROR');
  }
}

async function waitForResults(apiResponses) {
  console.log('⏳ Waiting for search results...');
  
  const maxWaitTime = 45000; // 45 seconds
  const checkInterval = 1000; // 1 second
  let elapsed = 0;
  
  while (elapsed < maxWaitTime && !hasSavedResponse) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsed += checkInterval;
    
    if (elapsed % 5000 === 0) {
      console.log(`⏳ Still waiting... (${elapsed / 1000}s elapsed)`);
    }
  }
  
  if (hasSavedResponse) {
    console.log('✅ Results captured successfully');
  } else {
    console.log('⚠️ No results captured within timeout period');
  }
}

async function run(location) {
  let browser = null;
  
  try {
    console.log(`🚀 Starting scraper for location: ${location}`);
    
    // Reset global state
    hasSavedResponse = false;
    
    // Create browser
    browser = await createBrowser();
    
    // Setup page
    const page = await setupPage(browser);
    
    // Setup request handling
    const apiResponses = await setupRequestHandling(page, location);
    
    // Perform login
    await performLogin(page);
    
    // Perform search
    await performSearch(page, location);
    
    // Wait for results
    await waitForResults(apiResponses);
    
    return { 
      location, 
      captured: hasSavedResponse, 
      filename: `${location.replace(/[^a-z0-9]/gi, '_')}.json`,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Scraper error:', error.message);
    throw error;
  } finally {
    // Cleanup
    if (browser) {
      try {
        console.log('🔄 Closing browser...');
        await browser.close();
        console.log('✅ Browser closed successfully');
      } catch (error) {
        console.error('❌ Error closing browser:', error.message);
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('🏁 Scraper finished');
  }
}

export default run;