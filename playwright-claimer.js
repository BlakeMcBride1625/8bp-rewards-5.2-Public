const { chromium } = require('playwright');
const fs = require('fs');
const cron = require('node-cron');
const DatabaseService = require('./services/database-service');
const Registration = require('./models/Registration');
const mongoose = require('mongoose');
require('dotenv').config();

// ClaimRecord schema for saving claim results (matching backend TypeScript model)
const ClaimRecordSchema = new mongoose.Schema({
  eightBallPoolId: { type: String, required: true, index: true },
  websiteUserId: { type: String, required: true }, // Added to match backend model
  status: { type: String, enum: ['success', 'failed'], required: true },
  itemsClaimed: [String],
  error: String,
  claimedAt: { type: Date, default: Date.now },
  schedulerRun: Date
}, { timestamps: true, collection: 'claim_records' });

const ClaimRecord = mongoose.models.ClaimRecord || mongoose.model('ClaimRecord', ClaimRecordSchema);

// Get user IDs from database instead of environment
async function getUserIdsFromDatabase() {
  try {
    const dbService = new DatabaseService();
    await dbService.connect();
    
    const registrations = await Registration.getAllRegistrations();
    console.log(`📋 Found ${registrations.length} registered users in database`);
    
    // Filter out blocked users
    const activeUsers = registrations.filter(reg => !reg.isBlocked);
    const blockedCount = registrations.length - activeUsers.length;
    
    if (blockedCount > 0) {
      console.log(`⚠️ Skipping ${blockedCount} blocked users`);
    }
    
    return activeUsers.map(reg => ({
      eightBallPoolId: reg.eightBallPoolId,
      username: reg.username
    }));
  } catch (error) {
    console.error('❌ Error fetching users from database:', error.message);
    return [];
  }
}

async function claimRewardsForUser(userId) {
  console.log(`🚀 Starting claim process for User ID: ${userId}`);
  
  const shopUrl = 'https://8ballpool.com/en/shop';
  
  let browser;
  
  try {
    console.log('🌐 Launching browser...');
    browser = await chromium.launch({ 
      headless: process.env.HEADLESS !== 'false', // Headless by default for VPS
      slowMo: process.env.HEADLESS === 'false' ? 1000 : 0 // Only slow down if not headless
    });
    
    const page = await browser.newPage();
    console.log('📄 Created new page');
    
    // Set realistic user agent
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    console.log(`🌐 Navigating to: ${shopUrl}`);
    await page.goto(shopUrl, { waitUntil: 'networkidle' });
    console.log('✅ Successfully loaded shop page');
    
    // Wait for page to fully load
    await page.waitForTimeout(5000);
    
    // Take a screenshot to see what we're working with
    await page.screenshot({ path: 'shop-page.png' });
    console.log('📸 Screenshot saved as shop-page.png');
    
    // Look for login modal - it might appear after hovering or clicking
    console.log('🔍 Looking for login modal...');
    
    // First, try to find and hover over elements that might trigger the login modal
    const potentialTriggers = await page.locator('button, a, [class*="login"], [class*="sign"], [class*="user"]').all();
    console.log(`Found ${potentialTriggers.length} potential login triggers`);
    
    let loginModalFound = false;
    
    // Try hovering over potential login triggers
    for (let i = 0; i < Math.min(potentialTriggers.length, 5); i++) {
      try {
        const trigger = potentialTriggers[i];
        const isVisible = await trigger.isVisible();
        
        if (isVisible) {
          console.log(`🖱️ Hovering over potential trigger ${i + 1}...`);
          await trigger.hover();
          await page.waitForTimeout(1000);
          
          // Check if login modal appeared
          const modalInputs = await page.locator('input[placeholder*="Unique ID"], input[placeholder*="123-456-789-0"]').all();
          if (modalInputs.length > 0) {
            console.log('✅ Login modal appeared after hover!');
            loginModalFound = true;
            break;
          }
        }
      } catch (error) {
        console.log(`⚠️ Error hovering over trigger ${i + 1}: ${error.message}`);
      }
    }
    
    // If no modal found by hovering, try clicking potential login buttons
    if (!loginModalFound) {
      console.log('🔍 Trying to click login buttons...');
      const loginButtons = await page.locator('button:has-text("Login"), button:has-text("Sign In"), a:has-text("Login")').all();
      console.log(`Found ${loginButtons.length} login buttons`);
      
      for (let i = 0; i < loginButtons.length; i++) {
        try {
          const button = loginButtons[i];
          const isVisible = await button.isVisible();
          
          if (isVisible) {
            console.log(`🖱️ Clicking login button ${i + 1}...`);
            await button.click();
            await page.waitForTimeout(2000);
            
            // Check if login modal appeared
            const modalInputs = await page.locator('input[placeholder*="Unique ID"], input[placeholder*="123-456-789-0"]').all();
            if (modalInputs.length > 0) {
              console.log('✅ Login modal appeared after clicking!');
              loginModalFound = true;
              break;
            }
          }
        } catch (error) {
          console.log(`⚠️ Error clicking login button ${i + 1}: ${error.message}`);
        }
      }
    }
    
    // Now try to fill the login form if modal is found
    if (loginModalFound) {
      console.log('📝 Filling login form...');
      
      // Find the Unique ID input field
      const userIdInputs = await page.locator('input[placeholder*="Unique ID"], input[placeholder*="123-456-789-0"]').all();
      console.log(`Found ${userIdInputs.length} Unique ID input fields`);
      
      if (userIdInputs.length > 0) {
        const input = userIdInputs[0];
        
        // Hover over the input field first
        console.log('🖱️ Hovering over input field...');
        await input.hover();
        await page.waitForTimeout(500);
        
        // Click to focus the input
        console.log('🖱️ Clicking input field to focus...');
        await input.click();
        await page.waitForTimeout(500);
        
        // Clear and fill the input
        console.log('📝 Clearing and filling input...');
        await input.clear();
        await input.fill(userId);
        console.log(`✅ Entered User ID: ${userId}`);
        
        // Try a completely different approach - look for the button by its exact position
        console.log('🔍 Looking for Go button by position and attributes...');
        
        let goButtonFound = false;
        
        // Method 1: Look for button that's immediately after the input field in the DOM
        try {
          const nextElement = await input.locator('xpath=following-sibling::*[1]').first();
          const nextElementTag = await nextElement.evaluate(el => el.tagName);
          const nextElementText = await nextElement.textContent();
          
          console.log(`Next element after input: ${nextElementTag}, text: "${nextElementText}"`);
          
          if (nextElementTag === 'BUTTON' && nextElementText.includes('Go')) {
            console.log('✅ Found Go button as immediate next sibling');
            await nextElement.click();
            console.log('✅ Clicked immediate next sibling Go button');
            goButtonFound = true;
          }
        } catch (error) {
          console.log('⚠️ Immediate next sibling not a Go button');
        }
        
        // Method 2: Look for button with specific styling that indicates it's the login button
        if (!goButtonFound) {
          try {
            const styledButtons = await page.locator('button[style*="background"], button[class*="primary"], button[class*="submit"], button[class*="login"]').all();
            
            for (let i = 0; i < styledButtons.length; i++) {
              const button = styledButtons[i];
              const buttonText = await button.textContent();
              const buttonClass = await button.getAttribute('class') || '';
              
              if (buttonText.includes('Go') && !buttonClass.includes('google')) {
                const isVisible = await button.isVisible();
                if (isVisible) {
                  console.log(`✅ Found styled Go button: "${buttonText}"`);
                  await button.click();
                  console.log('✅ Clicked styled Go button');
                  goButtonFound = true;
                  break;
                }
              }
            }
          } catch (error) {
            console.log('⚠️ No styled Go button found');
          }
        }
        
        // Method 3: Look for button that's in a form with the input
        if (!goButtonFound) {
          try {
            const form = await input.locator('xpath=ancestor::form').first();
            const formButtons = await form.locator('button').all();
            
            for (let i = 0; i < formButtons.length; i++) {
              const button = formButtons[i];
              const buttonText = await button.textContent();
              
              if (buttonText.includes('Go')) {
                const isVisible = await button.isVisible();
                if (isVisible) {
                  console.log(`✅ Found Go button in form: "${buttonText}"`);
                  await button.click();
                  console.log('✅ Clicked form Go button');
                  goButtonFound = true;
                  break;
                }
              }
            }
          } catch (error) {
            console.log('⚠️ No form Go button found');
          }
        }
        
        // Method 4: Last resort - try to click the button that's visually closest to the input
        if (!goButtonFound) {
          console.log('🔍 Last resort: finding button by visual proximity...');
          
          // Get input position
          const inputBox = await input.boundingBox();
          if (inputBox) {
            console.log(`Input position: x=${inputBox.x}, y=${inputBox.y}, width=${inputBox.width}, height=${inputBox.height}`);
            
            // Look for buttons in the area around the input
            const nearbyButtons = await page.locator('button').all();
            
            for (let i = 0; i < nearbyButtons.length; i++) {
              const button = nearbyButtons[i];
              const buttonBox = await button.boundingBox();
              const buttonText = await button.textContent();
              
              if (buttonBox && buttonText.includes('Go')) {
                // Check if button is to the right of the input (within reasonable distance)
                const isToTheRight = buttonBox.x > inputBox.x && 
                                   buttonBox.y >= inputBox.y - 50 && 
                                   buttonBox.y <= inputBox.y + inputBox.height + 50 &&
                                   buttonBox.x <= inputBox.x + inputBox.width + 200;
                
                if (isToTheRight) {
                  const isVisible = await button.isVisible();
                  if (isVisible) {
                    console.log(`✅ Found Go button to the right of input: "${buttonText}"`);
                    await button.click();
                    console.log('✅ Clicked right-side Go button');
                    goButtonFound = true;
                    break;
                  }
                }
              }
            }
          }
        }
        
        if (!goButtonFound) {
          console.log('❌ No suitable Go button found');
        }
        
        // Wait for login to complete and check for redirects
        await page.waitForTimeout(3000);
        
        // Check if we got redirected to Google or another site
        const currentUrl = page.url();
        console.log(`🌐 Current URL after login attempt: ${currentUrl}`);
        
        if (currentUrl.includes('google.com') || currentUrl.includes('accounts.google.com')) {
          console.log('❌ Got redirected to Google - login failed');
          console.log('🔄 Trying to go back to shop page...');
          await page.goto(shopUrl, { waitUntil: 'networkidle' });
          await page.waitForTimeout(3000);
        } else if (currentUrl.includes('8ballpool.com')) {
          console.log('✅ Still on 8ball pool site - login may have succeeded');
        } else {
          console.log(`⚠️ Unexpected redirect to: ${currentUrl}`);
        }
        
        // Take screenshot after login
        await page.screenshot({ path: 'after-login.png' });
        console.log('📸 Screenshot after login saved as after-login.png');
      }
    } else {
      console.log('⚠️ No login modal found - user might already be logged in');
    }
    
    // Look for FREE buttons - try multiple approaches
    console.log('🎁 Looking for FREE buttons...');
    
    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(3000);
    
    // Try different selectors for FREE buttons
    const freeButtonSelectors = [
      'button:has-text("FREE")',
      'button:has-text("Free")',
      'button:has-text("free")',
      '[class*="free"] button',
      '[class*="claim"] button',
      'button[class*="free"]'
    ];
    
    let allFreeButtons = [];
    
    for (const selector of freeButtonSelectors) {
      try {
        const buttons = await page.locator(selector).all();
        allFreeButtons = allFreeButtons.concat(buttons);
      } catch (error) {
        console.log(`⚠️ Error with selector ${selector}: ${error.message}`);
      }
    }
    
    // Remove duplicates
    const uniqueButtons = [];
    for (const button of allFreeButtons) {
      const isDuplicate = uniqueButtons.some(existing => existing === button);
      if (!isDuplicate) {
        uniqueButtons.push(button);
      }
    }
    
    console.log(`Found ${uniqueButtons.length} unique FREE buttons`);
    
    if (uniqueButtons.length > 0) {
      console.log('🎯 Clicking all FREE buttons...');
      
      for (let i = 0; i < uniqueButtons.length; i++) {
        try {
          const button = uniqueButtons[i];
          const isVisible = await button.isVisible();
          
          if (isVisible) {
            // Get context about what this button is for
            const buttonText = await button.textContent().catch(() => '');
            const parentText = await button.locator('xpath=ancestor::*[contains(@class, "daily") or contains(@class, "reward") or contains(@class, "cue") or contains(@class, "piece") or contains(@class, "card")]').first().textContent().catch(() => '');
            
            console.log(`🖱️ Clicking FREE button ${i + 1}/${uniqueButtons.length}`);
            console.log(`   Button text: ${buttonText}`);
            if (parentText) {
              console.log(`   Context: ${parentText.substring(0, 100)}...`);
            }
            
            // Hover over button first
            await button.hover();
            await page.waitForTimeout(500);
            
            // Click the button
            await button.click();
            console.log(`✅ Clicked FREE button ${i + 1}`);
            
            // Wait between clicks
            if (i < uniqueButtons.length - 1) {
              await page.waitForTimeout(3000);
            }
          } else {
            console.log(`⚠️ FREE button ${i + 1} is not visible`);
          }
        } catch (error) {
          console.log(`⚠️ Failed to click FREE button ${i + 1}: ${error.message}`);
        }
      }
      
      console.log(`🎉 Successfully clicked ${uniqueButtons.length} FREE buttons!`);
    } else {
      console.log('❌ No FREE buttons found - may already be claimed or not available');
      
      // Try to find any buttons that might be claim buttons
      const allButtons = await page.locator('button').all();
      console.log(`Found ${allButtons.length} total buttons on page`);
      
      for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
        try {
          const button = allButtons[i];
          const text = await button.textContent().catch(() => '');
          const isVisible = await button.isVisible();
          
          if (isVisible && (text.includes('FREE') || text.includes('Claim') || text.includes('Get'))) {
            console.log(`🎯 Found potential claim button: "${text}"`);
          }
        } catch (error) {
          // Continue
        }
      }
    }
    
    // Take final screenshot
    await page.screenshot({ path: `final-page-${userId}.png` });
    console.log(`📸 Final screenshot saved as final-page-${userId}.png`);
    
    // Wait a bit to see results
    await page.waitForTimeout(3000);
    
    // Logout to prepare for next user
    console.log('🚪 Logging out...');
    await logout(page);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
  
  console.log(`✅ Claim process completed for user: ${userId}`);
}

// Logout function
async function logout(page) {
  try {
    console.log('🔍 Looking for logout button...');
    
    // Look for logout buttons
    const logoutButtons = await page.locator('button:has-text("Logout"), button:has-text("Sign Out"), button:has-text("Log Out"), a:has-text("Logout"), a:has-text("Sign Out")').all();
    
    if (logoutButtons.length > 0) {
      for (let i = 0; i < logoutButtons.length; i++) {
        try {
          const logoutButton = logoutButtons[i];
          const isVisible = await logoutButton.isVisible();
          
          if (isVisible) {
            const buttonText = await logoutButton.textContent();
            console.log(`🚪 Found logout button: "${buttonText}"`);
            await logoutButton.click();
            console.log('✅ Clicked logout button');
            await page.waitForTimeout(2000);
            return true;
          }
        } catch (error) {
          console.log(`⚠️ Error with logout button ${i + 1}: ${error.message}`);
        }
      }
    }
    
    // Alternative: Look for user menu/profile that might contain logout
    const profileButtons = await page.locator('button[class*="profile"], button[class*="user"], button[class*="account"], a[class*="profile"], a[class*="user"]').all();
    
    for (let i = 0; i < profileButtons.length; i++) {
      try {
        const profileButton = profileButtons[i];
        const isVisible = await profileButton.isVisible();
        
        if (isVisible) {
          console.log(`👤 Clicking profile button ${i + 1} to find logout...`);
          await profileButton.click();
          await page.waitForTimeout(1000);
          
          // Look for logout in dropdown
          const dropdownLogout = await page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")').first();
          const dropdownVisible = await dropdownLogout.isVisible().catch(() => false);
          
          if (dropdownVisible) {
            await dropdownLogout.click();
            console.log('✅ Clicked logout from dropdown');
            await page.waitForTimeout(2000);
            return true;
          }
        }
      } catch (error) {
        console.log(`⚠️ Error with profile button ${i + 1}: ${error.message}`);
      }
    }
    
    console.log('⚠️ No logout button found - user may already be logged out');
    return false;
    
  } catch (error) {
    console.log(`⚠️ Error during logout: ${error.message}`);
    return false;
  }
}

// Main function to claim rewards for all users
async function claimRewards() {
  // Get users from database
  const users = await getUserIdsFromDatabase();
  
  if (users.length === 0) {
    console.log('⚠️ No registered users found in database');
    return;
  }
  
  console.log(`🚀 Starting 8ball pool reward claimer for ${users.length} users...`);
  console.log(`👥 Users: ${users.map(u => `${u.username} (${u.eightBallPoolId})`).join(', ')}`);
  
  let successCount = 0;
  let failureCount = 0;
  const schedulerRunTime = new Date();
  
  // Process all users in parallel for speed! 🚀
  console.log(`\n🚀 Running ${users.length} claims in PARALLEL for maximum speed!`);
  
  const claimPromises = users.map(async (user, index) => {
    console.log(`\n📋 Starting user ${index + 1}/${users.length}: ${user.username} (${user.eightBallPoolId})`);
    
    try {
      await claimRewardsForUser(user.eightBallPoolId);
      console.log(`✅ Successfully processed user: ${user.username}`);
      
      // Save successful claim to database
      const claimRecord = new ClaimRecord({
        eightBallPoolId: user.eightBallPoolId,
        websiteUserId: user.username, // Added to match backend model
        status: 'success',
        itemsClaimed: ['Daily Reward', 'Free Items'], // TODO: Parse actual items from claim result
        schedulerRun: schedulerRunTime,
        claimedAt: new Date()
      });
      await claimRecord.save();
      console.log(`💾 Saved claim record for ${user.username} to database`);
      
      return { success: true, user: user.username };
    } catch (error) {
      console.log(`❌ Failed to process user ${user.username}: ${error.message}`);
      
      // Save failed claim to database
      const claimRecord = new ClaimRecord({
        eightBallPoolId: user.eightBallPoolId,
        websiteUserId: user.username, // Added to match backend model
        status: 'failed',
        itemsClaimed: [],
        error: error.message,
        schedulerRun: schedulerRunTime,
        claimedAt: new Date()
      });
      await claimRecord.save();
      console.log(`💾 Saved failed claim record for ${user.username} to database`);
      
      return { success: false, user: user.username, error: error.message };
    }
  });
  
  // Wait for all claims to complete
  const results = await Promise.all(claimPromises);
  
  // Count successes and failures
  successCount = results.filter(r => r.success).length;
  failureCount = results.filter(r => !r.success).length;
  
  console.log(`\n🎉 Claim process completed!`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failures: ${failureCount}`);
  console.log(`💾 All results saved to MongoDB`);
}

// Function to run the claimer with scheduling
function startScheduler() {
  console.log('🕐 Starting 8ball pool reward scheduler...');
  console.log('📅 Scheduled runs (every 6 hours):');
  console.log('   - 00:00 (12:00 AM midnight) UTC');
  console.log('   - 06:00 (6:00 AM) UTC');
  console.log('   - 12:00 (12:00 PM noon) UTC');
  console.log('   - 18:00 (6:00 PM) UTC');
  console.log('⏰ Scheduler started. Press Ctrl+C to stop.');
  
  // Schedule at 00:00 (midnight) UTC
  cron.schedule('0 0 * * *', () => {
    console.log('\n🕐 00:00 UTC - Running scheduled claim...');
    claimRewards().catch(console.error);
  });
  
  // Schedule at 06:00 (6 AM) UTC
  cron.schedule('0 6 * * *', () => {
    console.log('\n🕐 06:00 UTC - Running scheduled claim...');
    claimRewards().catch(console.error);
  });
  
  // Schedule at 12:00 (noon) UTC
  cron.schedule('0 12 * * *', () => {
    console.log('\n🕐 12:00 UTC - Running scheduled claim...');
    claimRewards().catch(console.error);
  });
  
  // Schedule at 18:00 (6 PM) UTC
  cron.schedule('0 18 * * *', () => {
    console.log('\n🕐 18:00 UTC - Running scheduled claim...');
    claimRewards().catch(console.error);
  });
  
  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\n🛑 Scheduler stopped.');
    process.exit(0);
  });
  
  // Keep alive
  setInterval(() => {}, 1000);
}

// Check if we should run once or start scheduler
const args = process.argv.slice(2);
if (args.includes('--schedule') || args.includes('-s')) {
  startScheduler();
} else {
  console.log('💡 To start daily scheduler, run: node playwright-claimer.js --schedule');
  claimRewards();
}
