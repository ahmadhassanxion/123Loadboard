const puppeteer = require('puppeteer');
const fs = require('fs');
let hasSavedResponse = false;

async function run(pickupLocation, dropoffLocation) {
  // Launch the browser
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
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
    if (url.includes('api/ratechecks') && !hasSavedResponse) {
        try {
            const json = await response.json();
            const responseData = {
                url: url,
                status: response.status(),
                data: json
            };
            apiResponses.push(responseData);
            console.log('✅ Captured API Response');
            let fileName = pickupLocation +"-"+dropoffLocation+".json";
            
            // Save the response only if we haven't already
            if (!hasSavedResponse) {
                fs.writeFileSync(fileName, JSON.stringify(responseData, null, 2));
                console.log('💾 Saved to loads.json');
                hasSavedResponse = true; // Set flag to true after saving
                await browser.close();
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
    await page.goto('https://members.123loadboard.com/tools/market-rates-carrier', { 
      waitUntil: 'networkidle2' 
    });
    
    // Perform search
    console.log('🔎 Performing search...');
   
    
    await page.waitForSelector('#pickup_location_picker', { visible: true, timeout: 10000 });
    await page.type('#pickup_location_picker', pickupLocation);
    await page.waitForSelector('#pickup_location_picker-item-0', { visible: true, timeout: 10000 });
    await page.click('#pickup_location_picker-item-0');
    setTimeout(() => {
        // page.keyboard.press('Enter');
    }, 1000);
    await page.waitForSelector('#dropoff_location_picker', { visible: true, timeout: 10000 });
    await page.type('#dropoff_location_picker', dropoffLocation);
    await page.waitForSelector('#dropoff_location_picker-item-0', { visible: true, timeout: 10000 });
    await page.click('#dropoff_location_picker-item-0');
    
    // await page.waitForSelector('#see_exact_loads', { visible: true, timeout: 10000 });
    // await page.click('#see_exact_loads');
    
    // Wait for the data to load
    console.log('⏳ Waiting for data to load...');
    // await page.waitForTimeout(5000);
    
    if (apiResponses.length === 0) {
      console.log('⚠️ No API responses captured. The page might need more time to load or the selectors might have changed.');
    }

  } catch (error) {
    console.error('❌ An error occurred:', error);
  } finally {
    // Keep the browser open for inspection
    console.log('🏁 Script finished. Press Ctrl+C to exit.');
    // Uncomment the line below to close the browser automatically
    // await browser.close();
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

run("Baltimore, MD", "Los Angeles, CA");