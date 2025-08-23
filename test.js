import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
let hasSavedResponse = false;

async function run(location) {
  // Launch the browser
  // Configure launch options for serverless environment
  const launchOptions = {
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-site-isolation-trials'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    },
    executablePath: process.env.IS_LOCAL 
      ? '/usr/bin/google-chrome-stable' 
      : await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  };

  console.log('Launching browser with options:', {
    ...launchOptions,
    executablePath: '***'
  });
 
  const browser = await puppeteer.launch(launchOptions);
  
  try {
    // Open a new page
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setDefaultNavigationTimeout(60000);

    // Set up request interception before any navigation
    await page.setRequestInterception(true);
    const apiResponses = [];

    // Setup request handler
    page.on('request', request => {
      request.continue();
    });

    
let hasSavedResponse = false;

// Then modify the response handler like this:
page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/loads/named-searches/') && url.endsWith('/search') && !hasSavedResponse) {
        try {
            const json = await response.json();
            const responseData = {
                url: url,
                status: response.status(),
                data: json
            };
            apiResponses.push(responseData);
            console.log('✅ Captured API Response');
            
            // Save the response only if we haven't already
            if (!hasSavedResponse) {
                fs.writeFileSync(location+'.json', JSON.stringify(responseData, null, 2));
                console.log('💾 Saved to '+location+'.json');
                hasSavedResponse = true; // Set flag to true after saving

                await browser.close();
                return location+'.json';
            }
            
        } catch (e) {
            console.error('❌ Error parsing JSON:', e);
        }
    }
});

    // Navigate to the login page
    console.log('🔑 Logging in...');
    await page.goto('https://login.123loadboard.com/', { 
      waitUntil: 'networkidle2' 
    });
    
    // Execute login
    await login(page);
    
    // Navigate to search page
    console.log('🔍 Navigating to search page...');
    await page.goto('https://members.123loadboard.com/loads/search/', { 
      waitUntil: 'networkidle2' 
    });
    
    // Perform search
    console.log('🔎 Performing search...');
    console.log('🔎 '+location);

    await page.waitForSelector('#create_new_search_btn', { visible: true, timeout: 10000 });
    await page.click('#create_new_search_btn');
    
    await page.waitForSelector('#pickup_picker', { visible: true, timeout: 10000 });
    await page.type('#pickup_picker', location);
    
    await page.waitForSelector('#see_exact_loads', { visible: true, timeout: 10000 });
    await page.click('#see_exact_loads');
    
    // Wait for the data to load
    console.log('⏳ Waiting for data to load...');
    // await page.waitForTimeout(5000);
    
    if (apiResponses.length === 0) {
      console.log('⚠️ No API responses captured. The page might need more time to load or the selectors might have changed.');
    }

    return location+'.json';
  } catch (error) {
    console.error('❌ An error occurred:', error);
    throw error; // Re-throw to be caught by the route handler
  } finally {
    try {
      // Ensure browser is closed in all cases
      if (browser && browser.process() != null) {
        await browser.close();
      }
    } catch (e) {
      console.error('Error while closing browser:', e);
    }
    console.log('🏁 Script finished.');
  }
}

async function login(page) {
  const email = "quotes@stretchxlfreight.com";
  const password = "B8G@pML$bzftvJN";

  try {
    await page.waitForSelector('#email', { visible: true, timeout: 10000 });
    await page.type('#email', email);
    await page.waitForSelector('#password', { visible: true, timeout: 10000 });
    await page.type('#password', password);
    await page.waitForSelector('#sign-in-button', { visible: true, timeout: 10000 });
    await page.click('#sign-in-button');
    
    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('✅ Login successful!');
  } catch (error) {
    console.error('❌ Login failed:', error);
    throw error;
  }
}

// run();

export default run;