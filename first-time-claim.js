/**
 * First-time claim script - Claims rewards for a single newly registered user
 * Usage: node first-time-claim.js <eightBallPoolId> <username>
 */

const { chromium } = require('playwright');
const mongoose = require('mongoose');
require('dotenv').config();

// ClaimRecord schema (matching backend TypeScript model)
const ClaimRecordSchema = new mongoose.Schema({
  eightBallPoolId: { type: String, required: true, index: true },
  websiteUserId: { type: String, required: true },
  status: { type: String, enum: ['success', 'failed'], required: true },
  itemsClaimed: [String],
  error: String,
  claimedAt: { type: Date, default: Date.now },
  schedulerRun: Date
}, { timestamps: true, collection: 'claim_records' });

const ClaimRecord = mongoose.models.ClaimRecord || mongoose.model('ClaimRecord', ClaimRecordSchema);

async function claimForSingleUser(eightBallPoolId, username) {
  console.log(`🎁 Starting FIRST-TIME claim for: ${username} (${eightBallPoolId})`);
  
  const shopUrl = 'https://8ballpool.com/en/shop';
  let browser;
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    console.log('🌐 Launching browser...');
    browser = await chromium.launch({ 
      headless: process.env.HEADLESS !== 'false'
    });
    
    const page = await browser.newPage();
    
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    
    console.log('🌐 Navigating to 8 Ball Pool shop...');
    await page.goto(shopUrl, { waitUntil: 'networkidle', timeout: 60000 });
    
    // Click login button
    console.log('🔓 Opening login modal...');
    const loginButtons = await page.$$('button:has-text("GUEST LOGIN")');
    if (loginButtons.length > 0) {
      await loginButtons[0].click();
      await page.waitForTimeout(2000);
    }
    
    // Enter user ID
    console.log(`📝 Logging in as ${eightBallPoolId}...`);
    const inputFields = await page.$$('input[placeholder*="Unique ID"]');
    if (inputFields.length > 0) {
      await inputFields[0].click();
      await inputFields[0].fill(eightBallPoolId);
      await page.waitForTimeout(1000);
    }
    
    // Click Go button
    const goButtons = await page.$$('button:has-text("Go")');
    if (goButtons.length > 0) {
      await goButtons[0].click();
      await page.waitForTimeout(3000);
    }
    
    // Find and click FREE buttons
    console.log('🎁 Looking for FREE rewards...');
    const freeButtons = await page.$$('button:has-text("FREE")');
    const visibleFreeButtons = [];
    
    for (const button of freeButtons) {
      if (await button.isVisible()) {
        visibleFreeButtons.push(button);
      }
    }
    
    console.log(`🎯 Found ${visibleFreeButtons.length} FREE rewards to claim`);
    
    const claimedItems = [];
    for (let i = 0; i < visibleFreeButtons.length; i++) {
      try {
        await visibleFreeButtons[i].click();
        claimedItems.push(`Free Item ${i + 1}`);
        console.log(`✅ Clicked FREE button ${i + 1}`);
        await page.waitForTimeout(500);
      } catch (err) {
        console.log(`⚠️ Could not click button ${i + 1}`);
      }
    }
    
    await browser.close();
    console.log('🔒 Browser closed');
    
    // Save claim record to database
    const claimRecord = new ClaimRecord({
      eightBallPoolId,
      websiteUserId: username,
      status: 'success',
      itemsClaimed: claimedItems.length > 0 ? claimedItems : ['First time claim completed'],
      schedulerRun: new Date(),
      claimedAt: new Date()
    });
    
    await claimRecord.save();
    console.log('💾 Saved claim record to database');
    
    await mongoose.connection.close();
    
    console.log(`🎉 First-time claim COMPLETE for ${username}!`);
    console.log(`✅ Claimed ${claimedItems.length} items`);
    
    process.exit(0);
    
  } catch (error) {
    console.error(`❌ First-time claim FAILED for ${username}:`, error.message);
    
    if (browser) {
      await browser.close();
    }
    
    // Save failed claim record
    try {
      const claimRecord = new ClaimRecord({
        eightBallPoolId,
        websiteUserId: username,
        status: 'failed',
        itemsClaimed: [],
        error: error.message,
        schedulerRun: new Date(),
        claimedAt: new Date()
      });
      await claimRecord.save();
      console.log('💾 Saved failed claim record to database');
    } catch (dbError) {
      console.error('❌ Could not save failed claim record:', dbError.message);
    }
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    process.exit(1);
  }
}

// Get arguments
const eightBallPoolId = process.argv[2];
const username = process.argv[3];

if (!eightBallPoolId || !username) {
  console.error('❌ Usage: node first-time-claim.js <eightBallPoolId> <username>');
  process.exit(1);
}

// Run the claim
claimForSingleUser(eightBallPoolId, username);
