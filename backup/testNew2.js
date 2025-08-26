import puppeteer from 'puppeteer';
import fs from 'fs';
let hasSavedResponse = false;

async function run(location) {
  // Launch the browser with Docker-friendly settings
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    args: [
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
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--window-size=1366,768'
    ],
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    console.log(`🚀 Starting scraper for location: ${location}`);
    
    // Open a new page
    const page = await browser.newPage();
    
    // Set additional page settings
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36');
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(30000);

    // Set up request interception
    await page.setRequestInterception(true);
    const apiResponses = [];

    // Reset the flag for each run
    hasSavedResponse = false;
    let requestCount = 0;

    // Setup request handler - block unnecessary resources to speed up
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      const url = request.url();
      
      // Block images, stylesheets, and fonts to speed up loading
      if (['image', 'stylesheet', 'font'].includes(resourceType)) {
        request.abort();
        return;
      }
      
      if (url.includes('api') || url.includes('search')) {
        console.log(`➡️  Request [${++requestCount}]: ${url.substring(0, 100)}...`);
      }
      
      request.continue();
    });

    // Log all responses
    page.on('response', async (response) => {
        const url = response.url();
        const status = response.status();
        
        // Log all API responses
        if (url.includes('api') || url.includes('search')) {
            console.log(`⬅️  Response [${status}]: ${url}`);
        }
        
        // Handle the specific API endpoint we're interested in
        if (url.includes('/api/loads/named-searches/') && url.endsWith('/search') && !hasSavedResponse) {
            console.log('✅ Found matching API endpoint');
            try {
                const json = await response.json().catch(e => {
                    console.error('❌ Failed to parse JSON from response');
                    return null;
                });
                
                if (!json) {
                    console.log('⚠️ Empty or invalid JSON response');
                    return;
                }
                
                console.log('✅ Successfully parsed JSON response');
                const responseData = {
                    url: url,
                    status: status,
                    data: json,
                    timestamp: new Date().toISOString(),
                    location: location
                };
                
                apiResponses.push(responseData);
                console.log(`📥 Stored response data (${apiResponses.length} responses collected)`);
                
                if (!hasSavedResponse) {
                    console.log('📝 Attempting to save response data...');
                    const filename = `${location.replace(/[^a-z0-9]/gi, '_')}.json`;
                    try {
                        // Ensure data directory exists
                        const dataDir = '/app/data';
                        if (!fs.existsSync(dataDir)) {
                            fs.mkdirSync(dataDir, { recursive: true });
                        }
                        
                        const filepath = `${dataDir}/${filename}`;
                        fs.writeFileSync(filepath, JSON.stringify(responseData, null, 2));
                        console.log(`💾 Successfully saved to ${filepath}`);
                        hasSavedResponse = true;
                        
                        // Close browser after successful save
                        setTimeout(async () => {
                            try {
                                await browser.close();
                            } catch (e) {
                                console.error('Error closing browser:', e);
                            }
                        }, 1000);
                        
                    } catch (e) {
                        console.error('❌ Failed to write file:', e);
                    }
                }
                
            } catch (e) {
                console.error('❌ Error processing response:', e);
            }
        }
    });

    // Handle page errors
    page.on('error', (error) => {
        console.error('❌ Page error:', error);
    });

    page.on('pageerror', (error) => {
        console.error('❌ Page script error:', error);
    });

    // Navigate to the login page
    console.log('🔑 Logging in...');
    await page.goto('https://login.123loadboard.com/', { 
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Execute login
    await login(page);
    
    // Navigate to search page
    console.log('🔍 Navigating to search page...');
    await page.goto('https://members.123loadboard.com/loads/search/', { 
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Perform search
    console.log('🔎 Performing search...');
    console.log(`Location: ${location}`);
    
    await page.waitForSelector('#clear', { visible: true, timeout: 20000 });
    await page.click('#clear');
    
    await page.waitForSelector('#remove_all', { visible: true, timeout: 20000 });
    await page.click('#remove_all');
    
    await page.waitForSelector('#create_new_search_btn', { visible: true, timeout: 20000 });
    await page.click('#create_new_search_btn');
    
    await page.waitForSelector('#pickup_picker', { visible: true, timeout: 20000 });
    await page.click('#pickup_picker');
    
    await page.waitForSelector('#lc_picker', { visible: true, timeout: 20000 });
    await page.type('#lc_picker', location);
    await page.click('#lc_picker');
    
    await page.waitForSelector('#lc_picker-item-0', { visible: true, timeout: 20000 });
    await page.click('#lc_picker-item-0');
    
    // Wait a bit and then search
    await page.waitForTimeout(3000);
    await searchLoad(page);
    
    // Wait for the data to load
    console.log('⏳ Waiting for data to load...');
    
    try {
        await Promise.race([
            // Wait for API response
            new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (apiResponses.length > 0 || hasSavedResponse) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 1000);
            }),
            // Or timeout after 60 seconds
            new Promise((resolve, reject) => 
                setTimeout(() => reject(new Error('Timeout waiting for data')), 60000)
            )
        ]);
    } catch (e) {
        console.log('⚠️ Timeout or error while waiting for data:', e.message);
    }
    
    if (apiResponses.length === 0) {
        console.log('⚠️ No API responses captured after waiting.');
        console.log('This might be normal if the search returned no results.');
    }

    return { 
        location, 
        captured: apiResponses.length > 0, 
        filename: `${location.replace(/[^a-z0-9]/gi, '_')}.json`,
        timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ An error occurred:', error);
    throw error;
  } finally {
    // Ensure browser is closed
    try {
      if (browser && !browser._closed) {
        console.log('🔄 Closing browser...');
        await browser.close();
      }
    } catch (e) {
      console.error('Error closing browser:', e);
    }
    console.log('🏁 Script finished.');
  }
}

async function login(page) {
  const email = process.env.LOGIN_EMAIL || "quotes@stretchxlfreight.com";
  const password = process.env.LOGIN_PASSWORD || "B8G@pML$bzftvJN";

  try {
    await page.waitForSelector('#email', { visible: true, timeout: 20000 });
    await page.type('#email', email);
    
    await page.waitForSelector('#password', { visible: true, timeout: 20000 });
    await page.type('#password', password);
    
    await page.waitForSelector('#sign-in-button', { visible: true, timeout: 20000 });
    await page.click('#sign-in-button');
    
    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Login successful!');
  } catch (error) {
    console.error('❌ Login failed:', error);
    throw error;
  }
}

async function searchLoad(page) {
  try {
      if (page.isClosed()) {
          console.log('Page is closed, skipping search');
          return false;
      }

      return await page.evaluate(() => {
          try {
              const see_exact_loads = document.getElementById('see_exact_loads');
              if (!see_exact_loads) {
                  console.log("Search button not found");
                  return false;
              }
              
              console.log("Found search button, clicking...");
              see_exact_loads.click();
              console.log("✅ Clicked search button");
              return true;
          } catch (error) {
              console.error('Error in searchLoad:', error);
              return false;
          }
      });
  } catch (error) {
      console.error('Error in Puppeteer evaluation:', error);
      return false;
  }
}

export default run;