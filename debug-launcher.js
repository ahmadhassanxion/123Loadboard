// debug-launcher.js - Browser launch diagnostics and system check
import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import fs from 'fs';

// System diagnostics
function runSystemCheck() {
  console.log('🔍 Running system diagnostics...\n');
  
  try {
    // Check memory
    const memInfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const memMatch = memInfo.match(/MemAvailable:\s+(\d+) kB/);
    if (memMatch) {
      const memAvailableMB = Math.round(parseInt(memMatch[1]) / 1024);
      console.log(`💾 Available Memory: ${memAvailableMB} MB`);
    }
    
    // Check processes
    const processes = execSync('ps aux | wc -l').toString().trim();
    console.log(`📊 Running Processes: ${processes}`);
    
    // Check Chrome processes
    try {
      const chromeProcs = execSync('ps aux | grep -i chrome | grep -v grep | wc -l').toString().trim();
      console.log(`🌐 Chrome Processes: ${chromeProcs}`);
    } catch (e) {
      console.log('🌐 Chrome Processes: 0');
    }
    
    // Check file descriptors
    try {
      const fdCount = execSync('ls -la /proc/self/fd | wc -l').toString().trim();
      console.log(`📁 File Descriptors: ${fdCount}`);
    } catch (e) {
      console.log('📁 File Descriptors: Unable to check');
    }
    
    // Check Chrome executable
    const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';
    if (fs.existsSync(chromePath)) {
      console.log(`✅ Chrome found at: ${chromePath}`);
      try {
        const chromeVersion = execSync(`${chromePath} --version`).toString().trim();
        console.log(`🌐 Chrome Version: ${chromeVersion}`);
      } catch (e) {
        console.log('⚠️  Chrome version check failed');
      }
    } else {
      console.log(`❌ Chrome not found at: ${chromePath}`);
    }
    
    // Check ulimits
    try {
      const ulimits = {
        'Max processes': execSync('ulimit -u').toString().trim(),
        'Max files': execSync('ulimit -n').toString().trim(),
        'Max memory': execSync('ulimit -v').toString().trim()
      };
      console.log('\n📊 Resource Limits:');
      Object.entries(ulimits).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    } catch (e) {
      console.log('⚠️  Could not check ulimits');
    }
    
  } catch (error) {
    console.error('❌ System check error:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

// Test different Chrome launch configurations
const testConfigs = [
  {
    name: 'Ultra Minimal',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process',
      '--no-first-run',
      '--disable-extensions',
      '--disable-default-apps'
    ]
  },
  {
    name: 'Container Optimized',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-software-rasterizer',
      '--no-zygote',
      '--renderer-process-limit=1',
      '--max-memory-per-process=128000000'
    ]
  },
  {
    name: 'Resource Limited',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--memory-pressure-off',
      '--no-first-run'
    ]
  }
];

async function testBrowserLaunch(config) {
  console.log(`🧪 Testing: ${config.name}`);
  console.log(`   Args: ${config.args.join(' ')}`);
  
  const startTime = Date.now();
  
  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: config.args,
      timeout: 15000,
      dumpio: false
    });
    
    const launchTime = Date.now() - startTime;
    console.log(`   ✅ Launch successful (${launchTime}ms)`);
    
    // Test basic functionality
    try {
      const page = await browser.newPage();
      await page.goto('data:text/html,<h1>Test</h1>', { waitUntil: 'load', timeout: 5000 });
      const title = await page.title();
      await page.close();
      console.log(`   ✅ Page test successful`);
    } catch (pageError) {
      console.log(`   ⚠️  Page test failed: ${pageError.message}`);
    }
    
    await browser.close();
    console.log(`   ✅ Browser closed successfully\n`);
    return true;
    
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}\n`);
    return false;
  }
}

async function cleanupChromeProcesses() {
  console.log('🧹 Cleaning up any stuck Chrome processes...');
  
  try {
    // Kill any existing chrome processes
    execSync('pkill -f chrome || true');
    execSync('pkill -f chromium || true');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Cleanup completed\n');
  } catch (error) {
    console.log('⚠️  Cleanup failed (this is usually fine)\n');
  }
}

async function main() {
  console.log('🚀 Browser Launch Diagnostics\n');
  
  // Run system check
  runSystemCheck();
  
  // Cleanup any stuck processes
  await cleanupChromeProcesses();
  
  // Test different launch configurations
  console.log('🧪 Testing browser launch configurations...\n');
  
  let successfulConfig = null;
  
  for (const config of testConfigs) {
    const success = await testBrowserLaunch(config);
    if (success && !successfulConfig) {
      successfulConfig = config;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('📊 Test Results Summary:');
  console.log('========================');
  
  if (successfulConfig) {
    console.log(`✅ Successful configuration found: ${successfulConfig.name}`);
    console.log(`   Recommended args: ${successfulConfig.args.join(' ')}`);
    console.log('\n💡 Use these args in your main scraper configuration');
  } else {
    console.log('❌ No configurations worked');
    console.log('\n🔧 Recommendations:');
    console.log('   1. Increase container memory limits');
    console.log('   2. Increase shared memory (--shm-size)');
    console.log('   3. Check ulimits (especially nproc and nofile)');
    console.log('   4. Ensure Chrome is properly installed');
    console.log('   5. Try running with --privileged flag (temporary test)');
  }
}

// Export for use in other modules
export { testConfigs, testBrowserLaunch, runSystemCheck };

// Run if called directly
if (process.argv[1].includes('debug-launcher')) {
  main().catch(console.error);
}