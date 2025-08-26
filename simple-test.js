// simple-test.js - Quick browser test to verify setup
import puppeteer from 'puppeteer';

console.log('🧪 Simple Browser Test Starting...\n');

// Ultra-minimal Chrome args for testing
const TEST_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox', 
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-zygote',
  '--single-process',
  '--no-first-run',
  '--disable-extensions',
  '--disable-default-apps',
  '--renderer-process-limit=1',
  '--max-memory-per-process=64000000' // 64MB limit
];

async function simpleTest() {
  let browser = null;
  
  try {
    console.log('🚀 Attempting to launch browser...');
    
    const startTime = Date.now();
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: TEST_ARGS,
      timeout: 10000,
      dumpio: false
    });
    
    const launchTime = Date.now() - startTime;
    console.log(`✅ Browser launched successfully in ${launchTime}ms`);
    
    // Test basic page operations
    console.log('📄 Testing basic page operations...');
    const page = await browser.newPage();
    
    // Navigate to a simple data URL
    await page.goto('data:text/html,<html><body><h1>Test Page</h1><p>Hello World</p></body></html>', {
      waitUntil: 'load',
      timeout: 5000
    });
    
    console.log('✅ Page navigation successful');
    
    // Test JavaScript execution
    const result = await page.evaluate(() => {
      return {
        title: document.title,
        userAgent: navigator.userAgent.substring(0, 50) + '...',
        windowSize: `${window.innerWidth}x${window.innerHeight}`
      };
    });
    
    console.log('✅ JavaScript execution successful');
    console.log(`   Title: ${result.title}`);
    console.log(`   User Agent: ${result.userAgent}`);
    console.log(`   Window: ${result.windowSize}`);
    
    await page.close();
    console.log('✅ Page closed successfully');
    
    console.log('\n🎉 All tests passed! Your browser setup is working.');
    console.log('\n💡 You can now proceed with the main scraper using these args:');
    console.log(`   ${TEST_ARGS.join(' ')}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    console.log('\n🔧 Troubleshooting suggestions:');
    console.log('1. Check if Chrome is installed: /usr/bin/google-chrome-stable --version');
    console.log('2. Try with --privileged flag: docker run --privileged ...');
    console.log('3. Increase shared memory: docker run --shm-size=256m ...');
    console.log('4. Check system resources: free -h && ps aux | wc -l');
    console.log('5. Kill existing Chrome processes: pkill -f chrome');
    
    return false;
    
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('🔄 Browser cleanup completed');
      } catch (e) {
        console.log('⚠️  Browser cleanup failed (this is usually fine)');
      }
    }
  }
}

// Memory and process monitoring
function showSystemInfo() {
  try {
    const memUsage = process.memoryUsage();
    console.log('\n📊 System Information:');
    console.log(`   Node Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB used / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB total`);
    console.log(`   Process ID: ${process.pid}`);
    console.log(`   Platform: ${process.platform} ${process.arch}`);
    console.log(`   Node Version: ${process.version}`);
    
    if (process.env.NODE_OPTIONS) {
      console.log(`   Node Options: ${process.env.NODE_OPTIONS}`);
    }
  } catch (error) {
    console.log('⚠️  Could not gather system info');
  }
}

async function main() {
  showSystemInfo();
  console.log('\n' + '='.repeat(50));
  
  const success = await simpleTest();
  
  console.log('\n' + '='.repeat(50));
  console.log(success ? '✅ TEST PASSED' : '❌ TEST FAILED');
  
  process.exit(success ? 0 : 1);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error.message);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error.message);
  process.exit(1);
});

// main().catch(console.error);
export default main