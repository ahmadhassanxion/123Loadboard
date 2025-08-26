import puppeteer from 'puppeteer';
import fs from 'fs';
let hasSavedResponse = false;

async function run(location) {
  // Launch the browser
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  try {
    // Open a new page
    const page = await browser.newPage();
    // await page.setViewport({ width: 1600, height: 900 });
    // await page.setDefaultNavigationTimeout(60000);

    // Set up request interception before any navigation
    await page.setRequestInterception(true);
    const apiResponses = [];

    // Setup request handler
    page.on('request', request => {
      request.continue();
    });

    // Setup response handler
    // page.on('response', async (response) => {
    //   const url = response.url();
    //   if (url.includes('/api/loads/named-searches/') && url.endsWith('/search')) {
    //     try {
    //       const json = await response.json();
    //       const responseData = {
    //         url: url,
    //         status: response.status(),
    //         data: json
    //       };
    //       apiResponses.push(responseData);
    //       console.log('✅ Captured API Response');
          
    //       // Save the response
    //       fs.writeFileSync('loads.json', JSON.stringify(responseData, null, 2));
    //       console.log('💾 Saved to loads.json');
          
    //     } catch (e) {
    //       console.error('❌ Error parsing JSON:', e);
    //     }
    //   }
    // });
    // At the top of your file, add this flag
let hasSavedResponse = false;
let requestCount = 0;

// Log all requests
page.on('request', request => {
    const url = request.url();
    if (url.includes('api') || url.includes('search')) {
        console.log(`➡️  Request [${++requestCount}]: ${url.substring(0, 100)}...`);
    }
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
                data: json
            };
            
            apiResponses.push(responseData);
            console.log(`📥 Stored response data (${apiResponses.length} responses collected)`);
            
            if (!hasSavedResponse) {
                console.log('📝 Attempting to save response data...');
                const filename = `${location.replace(/[^a-z0-9]/gi, '_')}.json`;
                try {
                    fs.writeFileSync(filename, JSON.stringify(responseData, null, 2));
                    console.log(`💾 Successfully saved to ${filename}`);
                    hasSavedResponse = true;
                    // return { filename, data: responseData };
                    await browser.close();
                } catch (e) {
                    console.error('❌ Failed to write file:', e);
                }
            }
            
        } catch (e) {
            console.error('❌ Error processing response:', e);
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
    console.log(`Location: ${location}`);
    await page.waitForSelector('#clear', { visible: true, timeout: 10000 });
    await page.click('#clear');
    await page.waitForSelector('#remove_all', { visible: true, timeout: 10000 });
    await page.click('#remove_all');
    await page.waitForSelector('#create_new_search_btn', { visible: true, timeout: 10000 });
    await page.click('#create_new_search_btn');
    
    await page.waitForSelector('#pickup_picker', { visible: true, timeout: 10000 });
    await page.click('#pickup_picker');
    await page.waitForSelector('#lc_picker', { visible: true, timeout: 10000 });
    await page.type('#lc_picker', location);
    await page.waitForSelector('#lc_picker', { visible: true, timeout: 10000 });
    await page.click('#lc_picker');
    await page.waitForSelector('#lc_picker-item-0', { visible: true, timeout: 10000 });
    await page.click('#lc_picker-item-0');
    // Clear the input field first
   setTimeout(async() => {
    await searchLoad(page);
   }, 2000);
    // Type the new location
   
    
    // await page.keyboard.press('Enter');
    // await page.waitForSelector('#see_exact_loads', { visible: true, timeout: 10000 });
    // await page.click('#see_exact_loads');
    
    // Wait for the data to load
    console.log('⏳ Waiting for data to load...');
    
    // Wait for any of these conditions:
    // 1. API response is captured
    // 2. Search button is visible
    // 3. Timeout after 30 seconds
    try {
        await Promise.race([
            // Wait for API response
            new Promise(resolve => {
                if (apiResponses.length > 0) resolve();
                else {
                    const check = setInterval(() => {
                        if (apiResponses.length > 0) {
                            clearInterval(check);
                            resolve();
                        }
                    }, 1000);
                }
            }),
            // Or wait for search button
            page.waitForSelector('#see_exact_loads', { visible: true, timeout: 10000 })
                .then(async () => {
                    console.log('🔍 Search button is visible, clicking it...');
                    await page.click('#see_exact_loads');
                    console.log('✅ Clicked search button');
                })
                .catch(e => console.log('⚠️ Search button not found:', e.message)),
            // Or timeout after 30 seconds
            new Promise(resolve => setTimeout(resolve, 30000))
        ]);
    } catch (e) {
        console.log('⚠️ Error while waiting for data:', e.message);
    }
    
    if (apiResponses.length === 0) {
        console.log('⚠️ No API responses captured after waiting. Possible issues:');
        console.log('1. The page might need more time to load');
        console.log('2. The selectors might have changed');
        console.log('3. The API endpoint might be different');
        console.log('4. The search might require additional parameters');
    }

    return null; // Return null if no response was captured
  } catch (error) {
    console.error('❌ An error occurred:', error);
    throw error; // Re-throw the error to be handled by the caller
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

async function searchLoad(page) {
  try {
      // Check if page is still available and not closed
      if (page.isClosed()) {
          console.log('Page is closed, skipping check');
          return false;
      }

      // Ensure record is a plain object
   

      return await page.evaluate((rec) => {
          try {
      
              const see_exact_loads = document.getElementById('see_exact_loads');
            
            
  console.log("here");
             
              setTimeout(() => {
                  if(see_exact_loads){
                      see_exact_loads.click();
                   }
              }, 2000);
             
             
  
           
              return true;
          } catch (error) {
              console.error('Error in checkFeild:', error);
              return false;
          }
      },);
  } catch (error) {
      console.error('Error in Puppeteer evaluation:', error);
      return false;
  }
}

// run();

export default run;