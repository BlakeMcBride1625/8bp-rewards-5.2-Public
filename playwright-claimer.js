const { chromium } = require('playwright');
const { validateClaimResult, shouldSkipButtonForCounting, shouldClickButton } = require('./claimer-utils');
const fs = require('fs');
const cron = require('node-cron');
const DatabaseService = require('./services/database-service');
const Registration = require('./models/Registration');
const mongoose = require('mongoose');
const BrowserPool = require('./browser-pool');
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

// LAYER 1: Database-level duplicate prevention
async function saveClaimRecord(userId, username, claimedItems, success, error = null, schedulerRunTime = null) {
  try {
    // Check if this user already has a successful claim today
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const existingClaim = await ClaimRecord.findOne({
      eightBallPoolId: userId,
      status: 'success',
      claimedAt: { $gte: today }
    });

    // If already claimed successfully today, skip saving
    if (existingClaim && success) {
      console.log(`⏭️ Duplicate prevented (DB check) - user ${username} already claimed today at ${existingClaim.claimedAt.toLocaleTimeString()}`);
      return { saved: false, reason: 'duplicate', existingClaim };
    }

    const claimRecord = new ClaimRecord({
      eightBallPoolId: userId,
      websiteUserId: username,
      status: success ? 'success' : 'failed',
      itemsClaimed: claimedItems || [],
      error: error,
      schedulerRun: schedulerRunTime,
      claimedAt: new Date()
    });

    await claimRecord.save();
    console.log(`💾 Saved claim record for ${username} to database`);
    return { saved: true, record: claimRecord };
  } catch (error) {
    console.error(`❌ Failed to save claim record for ${username}:`, error.message);
    return { saved: false, reason: 'error', error: error.message };
  }
}

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

async function ensureScreenshotDirectories() {
  try {
    const fs = require('fs');
    const path = require('path');

    const directories = [
      'screenshots',
      'screenshots/shop-page',
      'screenshots/login',
      'screenshots/id-entry',
      'screenshots/go-click',
      'screenshots/final-page'
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    }
  } catch (error) {
    console.error('❌ Error creating screenshot directories:', error.message);
  }
}

async function claimRewardsForUser(userId) {
  console.log(`🚀 Starting claim process for User ID: ${userId}`);
  
  // Ensure screenshot directories exist
  await ensureScreenshotDirectories();
  
  const claimedItems = [];
  
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
    
    // Set proper User-Agent to avoid 403 Forbidden
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    // Navigate to Daily Reward section first
    const dailyRewardUrl = 'https://8ballpool.com/en/shop#daily_reward';
    console.log(`🌐 Navigating to Daily Reward section: ${dailyRewardUrl}`);
    await page.goto(dailyRewardUrl, { waitUntil: 'networkidle' });
    console.log('✅ Successfully loaded Daily Reward page');
    
    // Wait for page to fully load
    await page.waitForTimeout(5000);
    
    // Take a screenshot to see what we're working with
    await page.screenshot({ path: 'screenshots/shop-page/daily-reward-page.png' });
    console.log('📸 Screenshot saved as daily-reward-page.png');
    
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
        await page.screenshot({ path: 'screenshots/login/after-login.png' });
        console.log('📸 Screenshot after login saved as after-login.png');
      }
    } else {
      console.log('⚠️ No login modal found - user might already be logged in');
    }
    
    // Advanced FREE button detection with sophisticated logic
    console.log('🎁 Looking for all FREE and CLAIM buttons...');
    
    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(3000);
    
    // Specific target keywords to identify rewards we care about
    // ORDER MATTERS! Check more specific items first
    const targetKeywords = [
      // Free Daily Cue Piece FIRST (most specific - check before individual cue names)
      'Free Daily Cue Piece', 'FREE DAILY CUE PIECE', 'DAILY CUE PIECE', 'Daily Cue Piece',
      'Free Cue Piece', 'FREE CUE PIECE',
      // Black Diamond (special item)
      'Black Diamond', 'BLACK DIAMOND',
      // Daily Rewards
      'Daily Reward', 'DAILY REWARD', 'WEBSHOP EXCLUSIVE',
      // 7 Random Cues (check AFTER Free Daily Cue Piece)
      'Opti Shot', 'Spin Wizard', 'Power Break', 'Strike Zone', 
      'Trickster', 'Gamechanger', 'Legacy Strike',
      // Other items
      'Cash', 'Coins', 'Box', 'Boxes', 'FREE CASH', 'FREE COINS'
    ];
    
    // Find all FREE/CLAIM buttons first
    console.log('🔍 Scanning for all FREE and CLAIM buttons...');
    const freeButtonSelectors = [
      'button:has-text("FREE")',
      'button:has-text("free")',
      'a:has-text("FREE")',
      'a:has-text("free")',
      '[class*="free"]:has-text("FREE")',
      '[class*="free"]:has-text("free")'
    ];

    let allFreeButtons = [];
    for (const selector of freeButtonSelectors) {
      try {
        const buttons = await page.locator(selector).all();
        allFreeButtons = allFreeButtons.concat(buttons);
      } catch (error) {
        // Continue with next selector
      }
    }

    // Remove duplicates
    const uniqueButtons = [];
    for (const button of allFreeButtons) {
      try {
        const isVisible = await button.isVisible();
        if (isVisible) {
          const buttonText = await button.textContent();
          const buttonId = await button.evaluate(el => el.id || el.className || el.textContent);
          
          // Check if we already have this button
          const alreadyExists = uniqueButtons.some(existing => {
            return existing.id === buttonId;
          });
          
          if (!alreadyExists) {
            uniqueButtons.push({
              element: button,
              text: buttonText,
              id: buttonId
            });
          }
        }
      } catch (error) {
        // Skip this button
      }
    }

    console.log(`Found ${uniqueButtons.length} unique FREE buttons`);
    
    if (uniqueButtons.length > 0) {
      console.log('🎯 Clicking all FREE buttons...');
      
      for (let i = 0; i < uniqueButtons.length; i++) {
        const buttonInfo = uniqueButtons[i];
        try {
          // Check if button should be clicked (for actual claiming)
          const shouldClick = await shouldClickButton(buttonInfo.element, buttonInfo.text, console);
          if (!shouldClick) {
            continue;
          }
          
          // Check if button should be skipped for counting (already claimed indicators)
          const shouldSkipForCounting = shouldSkipButtonForCounting(buttonInfo.text, console);
          
          // Check if button is disabled
          const isDisabled = await buttonInfo.element.isDisabled().catch(() => false);
          if (isDisabled) {
            console.log(`⏭️ Skipping button ${i + 1} - disabled/greyed out`);
            continue;
          }
          
          // Check if button is actually clickable
          const isClickable = await buttonInfo.element.evaluate(el => !el.disabled && el.offsetParent !== null).catch(() => false);
          if (!isClickable) {
            console.log(`⏭️ Skipping button ${i + 1} - not clickable`);
            continue;
          }
          
          // Try to identify what item this button is for
          let itemName = 'Unknown Item';
          try {
            // Look for text in multiple parent levels
            let parentText = '';
            
            // Try to get text from several ancestor levels
            for (let level = 1; level <= 5; level++) {
              try {
                const parent = await buttonInfo.element.locator(`xpath=ancestor::div[${level}]`).first();
                const text = await parent.textContent().catch(() => '');
                parentText += ' ' + text;
              } catch (e) {
                // Continue with next level
              }
            }
            
            console.log(`📝 Parent text snippet: ${parentText.substring(0, 200)}...`);
            
            // Check if it matches any of our target keywords
            for (const keyword of targetKeywords) {
              if (parentText.includes(keyword)) {
                itemName = keyword;
                console.log(`🎯 Identified item: ${keyword}`);
                break;
              }
            }
          } catch (error) {
            // Use button text if we can't find parent
            itemName = buttonInfo.text || 'Unknown';
          }
          
          console.log(`🎁 Clicking FREE button ${i + 1} for "${itemName}" (button text: "${buttonInfo.text}")`);
          
          // Scroll button into view
          await buttonInfo.element.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          
          // Force-hide interfering overlays using JavaScript
          try {
            await page.evaluate(() => {
              // Hide all consent overlays and sidebars that might interfere
              const selectors = [
                '[class*="mc-consents"]',
                '[class*="mc-sidebar"]', 
                '[class*="consent"]',
                '[class*="cookie"]',
                '[class*="policy"]',
                '[role="dialog"]',
                '[class*="modal"]',
                '[class*="popup"]'
              ];
              
              selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                  if (el) {
                    el.style.display = 'none';
                    el.style.visibility = 'hidden';
                    el.style.opacity = '0';
                    el.style.pointerEvents = 'none';
                  }
                });
              });
              
              console.log('🔧 Force-hid all interfering overlays');
            });
            
            // Wait for any animations to complete
            await page.waitForTimeout(1000);
          } catch (error) {
            console.log('⚠️ Could not force-hide overlays, continuing...');
          }
          
          // Store original button text for validation
          const originalButtonText = await buttonInfo.element.evaluate(el => el.textContent || '');
          buttonInfo.element._originalText = originalButtonText;
          
          // Try to dismiss Privacy Settings modal by clicking outside or using aggressive dismissal
          try {
            // Check if Privacy Settings modal is present
            const privacyModal = await page.$('text="Privacy Settings"');
            if (privacyModal) {
              console.log('🍪 Privacy Settings modal detected - attempting aggressive dismissal');
              
              // Try multiple dismissal strategies
              const dismissalSuccess = await page.evaluate(() => {
                try {
                  // Strategy 1: Click outside the modal (on backdrop)
                  const modal = document.querySelector('[class*="modal"], [role="dialog"]');
                  if (modal) {
                    const backdrop = modal.parentElement;
                    if (backdrop && backdrop !== modal) {
                      backdrop.click();
                      return true;
                    }
                  }
                  
                  // Strategy 2: Press Escape key
                  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
                  return true;
                  
                  // Strategy 3: Try to find and click any close button
                  const closeButtons = document.querySelectorAll('button, [role="button"]');
                  for (const btn of closeButtons) {
                    const text = btn.textContent || '';
                    if (text.toLowerCase().includes('save') || 
                        text.toLowerCase().includes('exit') || 
                        text.toLowerCase().includes('close') ||
                        text.toLowerCase().includes('dismiss')) {
                      btn.click();
                      return true;
                    }
                  }
                  
                  return false;
                } catch (error) {
                  return false;
                }
              });
              
              if (dismissalSuccess) {
                console.log('✅ Modal dismissal successful');
                await page.waitForTimeout(2000);
                // Now try normal click
                await buttonInfo.element.click();
              } else {
                console.log('⚠️ Modal dismissal failed, trying force click');
                // Fallback to force click
                try {
                  await buttonInfo.element.click({ force: true });
                  console.log('✅ Force click successful');
                } catch (forceError) {
                  console.log(`⚠️ Force click failed: ${forceError.message}`);
                }
              }
            } else {
              // No modal detected, proceed with normal click
              await buttonInfo.element.click();
            }
          } catch (error) {
            console.log(`⚠️ Error with modal bypass: ${error.message}`);
            // Fallback to normal click
            try {
              await buttonInfo.element.click();
            } catch (clickError) {
              console.log(`⚠️ Normal click failed: ${clickError.message}`);
            }
          }
          
          // Use standardized claim validation logic
          const isValidNewClaim = await validateClaimResult(buttonInfo.element, itemName, console);
          
          // Count items that were successfully claimed
          // Only count if it's a valid new claim AND the button wasn't already in a "claimed" state
          if (isValidNewClaim && !shouldSkipForCounting) {
            claimedItems.push(itemName);
          }
          
          // Wait between clicks
          await page.waitForTimeout(2000);
          
        } catch (error) {
          console.log(`⚠️ Error clicking FREE button ${i + 1}: ${error.message}`);
        }
      }
      
      console.log(`🎉 Claimed ${claimedItems.length} items: ${claimedItems.join(', ')}`);
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
    
    // Navigate to Free Daily Cue Piece section
    console.log('🌐 Navigating to Free Daily Cue Piece section...');
    const freeDailyCueUrl = 'https://8ballpool.com/en/shop#free_daily_cue_piece';
    await page.goto(freeDailyCueUrl, { waitUntil: 'networkidle' });
    console.log('✅ Successfully loaded Free Daily Cue Piece page');
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Look for FREE buttons in Free Daily Cue Piece section
    console.log('🎁 Checking Free Daily Cue Piece section for FREE items...');
    const cueFreeButtons = await page.locator('button:has-text("FREE")').all();
    console.log(`Found ${cueFreeButtons.length} FREE buttons in cue section`);
    
    if (cueFreeButtons.length > 0) {
      console.log('🎯 Clicking FREE buttons in cue section...');
      
      for (let i = 0; i < cueFreeButtons.length; i++) {
        try {
          const button = cueFreeButtons[i];
          const isVisible = await button.isVisible();
          
          if (isVisible) {
            const buttonText = await button.textContent().catch(() => '');
            
            // Skip if button says "CLAIMED" (case insensitive)
            if (buttonText && buttonText.toLowerCase().includes('claimed')) {
              console.log(`⏭️ Skipping cue button ${i + 1} - already CLAIMED: "${buttonText}"`);
              continue;
            }
            
            // Check if button is disabled
            const isDisabled = await button.isDisabled().catch(() => false);
            if (isDisabled) {
              console.log(`⏭️ Skipping cue button ${i + 1} - disabled/greyed out`);
              continue;
            }
            
            console.log(`🖱️ Clicking cue FREE button ${i + 1}/${cueFreeButtons.length}`);
            
            // Hover over button first
            await button.hover();
            await page.waitForTimeout(500);
            
            // Click the button
            await button.click();
            
            // Wait a moment and check if button text changed
            await page.waitForTimeout(1000);
            try {
              const newButtonText = await button.textContent();
              if (newButtonText && newButtonText.toLowerCase().includes('claimed')) {
                console.log(`⚠️ Cue button text changed to "${newButtonText}" - item was already claimed`);
              } else {
                console.log(`✅ Successfully clicked cue FREE button ${i + 1}`);
              }
            } catch (error) {
              console.log(`✅ Successfully clicked cue FREE button ${i + 1}`);
            }
            
            // Wait between clicks
            if (i < cueFreeButtons.length - 1) {
              await page.waitForTimeout(3000);
            }
          }
        } catch (error) {
          console.log(`⚠️ Failed to click cue FREE button ${i + 1}: ${error.message}`);
        }
      }
      
      console.log(`🎉 Successfully clicked ${cueFreeButtons.length} cue FREE buttons!`);
    } else {
      console.log('❌ No FREE buttons found in cue section');
    }
    
    // Take final screenshot
    await page.screenshot({ path: `screenshots/final-page/final-page-${userId}.png` });
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
  
  // Create browser pool with max 6 concurrent browsers
  const browserPool = new BrowserPool(6);
  
  // Process all users with browser pool limiting! 🚀
  console.log(`\n🚀 Running ${users.length} claims with BROWSER POOL (max 6 concurrent browsers)!`);
  console.log(`📊 Browser Pool Status: ${browserPool.getStatus().activeBrowsers}/${browserPool.getStatus().maxConcurrent} active, ${browserPool.getStatus().queued} queued`);
  
  const claimPromises = users.map(async (user, index) => {
    console.log(`\n📋 Starting user ${index + 1}/${users.length}: ${user.username} (${user.eightBallPoolId})`);
    
    try {
      // Wait for browser pool slot
      console.log(`⏳ Waiting for browser slot for ${user.username}...`);
      await browserPool.acquire();
      console.log(`✅ Browser slot acquired for ${user.username}`);
      
      const claimResult = await claimRewardsForUser(user.eightBallPoolId);
      console.log(`✅ Successfully processed user: ${user.username}`);
      
      // LAYER 3: Pre-save validation - check if any items were actually claimed
      const claimedItems = claimResult?.claimedItems || ['Daily Reward', 'Free Items'];
      
      if (claimedItems.length === 0) {
        console.log(`⏭️ No new items claimed for user ${user.username} - skipping database save`);
        return { success: true, user: user.username, alreadyClaimed: true };
      }
      
      // Save successful claim to database (with Layer 1 duplicate check)
      const saveResult = await saveClaimRecord(
        user.eightBallPoolId, 
        user.username, 
        claimedItems, 
        true, 
        null, 
        schedulerRunTime
      );
      
      // Handle duplicate detection from Layer 1
      if (saveResult && !saveResult.saved && saveResult.reason === 'duplicate') {
        console.log(`⏭️ Duplicate detected by database layer - claim already recorded today`);
        return { success: true, user: user.username, alreadyClaimed: true };
      }
      
      return { success: true, user: user.username };
    } catch (error) {
      console.log(`❌ Failed to process user ${user.username}: ${error.message}`);
      
      // Save failed claim to database
      await saveClaimRecord(
        user.eightBallPoolId, 
        user.username, 
        [], 
        false, 
        error.message, 
        schedulerRunTime
      );
      
      return { success: false, user: user.username, error: error.message };
    } finally {
      // Release browser pool slot
      browserPool.release();
      console.log(`🔄 Browser slot released for ${user.username}`);
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
