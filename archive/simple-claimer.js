const https = require('https');
const http = require('http');

async function claimRewards() {
  console.log('🚀 Starting simple 8ball pool reward claimer...');
  
  const userIds = ['1826254746', '3057211056'];
  
  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    console.log(`\n📋 Processing user ${i + 1}/${userIds.length}: ${userId}`);
    
    try {
      // Try to make a request to the shop page
      const options = {
        hostname: '8ballpool.com',
        port: 443,
        path: '/en/shop',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      };
      
      console.log(`🌐 Attempting to access shop for user: ${userId}`);
      
      const req = https.request(options, (res) => {
        console.log(`📊 Response status: ${res.statusCode}`);
        console.log(`📋 Response headers:`, res.headers);
        
        if (res.statusCode === 200) {
          console.log(`✅ Successfully accessed shop page for user: ${userId}`);
        } else if (res.statusCode === 403) {
          console.log(`⚠️ Access forbidden (403) - website may be blocking automated access`);
        } else {
          console.log(`⚠️ Unexpected status code: ${res.statusCode}`);
        }
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log(`📄 Page content length: ${data.length} characters`);
          if (data.includes('DAILY REWARD') || data.includes('FREE')) {
            console.log(`🎯 Found reward-related content on page!`);
          } else {
            console.log(`❌ No reward content found on page`);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`❌ Request error for user ${userId}:`, error.message);
      });
      
      req.end();
      
      // Wait between users
      if (i < userIds.length - 1) {
        console.log('⏳ Waiting 5 seconds before next user...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
    } catch (error) {
      console.error(`❌ Error processing user ${userId}:`, error.message);
    }
  }
  
  console.log('\n✅ Simple claimer completed!');
}

claimRewards();
