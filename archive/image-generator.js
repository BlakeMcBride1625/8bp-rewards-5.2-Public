const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

class ImageGenerator {
  constructor() {
    this.canvas = null;
    this.ctx = null;
  }

  async createConfirmationImage(bpAccountId, username, claimedItems = [], screenshotPath = null) {
    try {
      // Create a proper image with canvas overlay
      return await this.createCanvasImage(bpAccountId, username, claimedItems, screenshotPath);
    } catch (error) {
      console.error('❌ Error creating confirmation image:', error.message);
      // Fallback to simple copy if canvas fails
      if (screenshotPath && fs.existsSync(screenshotPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newImagePath = `confirmation-${bpAccountId}-${timestamp}.png`;
        fs.copyFileSync(screenshotPath, newImagePath);
        console.log(`📸 Created fallback confirmation image: ${newImagePath}`);
        return newImagePath;
      }
      return null;
    }
  }

  createTextImage(bpAccountId, username, claimedItems = []) {
    try {
      // Create a simple text file as fallback (in production, you'd use canvas/sharp)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const textPath = `confirmation-${bpAccountId}-${timestamp}.txt`;
      
      let content = `8 BALL POOL REWARD CLAIM CONFIRMATION\n`;
      content += `==========================================\n\n`;
      content += `Account ID: ${bpAccountId}\n`;
      content += `Username: ${username}\n`;
      content += `Claimed At: ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}\n\n`;
      
      if (claimedItems.length > 0) {
        content += `Claimed Items:\n`;
        claimedItems.forEach(item => {
          content += `• ${item}\n`;
        });
      } else {
        content += `Status: No new items available to claim\n`;
        content += `(May have already been claimed today)\n`;
      }
      
      fs.writeFileSync(textPath, content);
      console.log(`📄 Created text confirmation: ${textPath}`);
      return textPath;
      
    } catch (error) {
      console.error('❌ Error creating text confirmation:', error.message);
      return null;
    }
  }

  // Enhanced method to create a proper image with canvas overlay
  async createCanvasImage(bpAccountId, username, claimedItems = [], screenshotPath = null) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputPath = `confirmation-${bpAccountId}-${timestamp}.png`;
      
      let backgroundImage = null;
      let canvasWidth = 800;
      let canvasHeight = 600;
      
      // Load screenshot if available
      if (screenshotPath && fs.existsSync(screenshotPath)) {
        try {
          backgroundImage = await loadImage(screenshotPath);
          canvasWidth = backgroundImage.width;
          canvasHeight = backgroundImage.height;
        } catch (imageError) {
          console.log('⚠️ Could not load screenshot, creating image without background');
        }
      }
      
      // Create canvas
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');
      
      // Draw background image if available
      if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
      } else {
        // Create gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }
      
      // Create overlay box for text
      const overlayHeight = 120;
      const overlayY = canvasHeight - overlayHeight;
      
      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, overlayY, canvasWidth, overlayHeight);
      
      // Add border
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, overlayY, canvasWidth, overlayHeight);
      
      // Set text properties
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Title
      ctx.font = 'bold 24px Arial';
      ctx.fillText('🎱 8 BALL POOL REWARD CLAIMED', canvasWidth / 2, overlayY + 25);
      
      // Account ID (large and prominent)
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 28px Arial';
      ctx.fillText(`Account ID: ${bpAccountId}`, canvasWidth / 2, overlayY + 55);
      
      // Username and timestamp
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '18px Arial';
      ctx.fillText(`User: ${username}`, canvasWidth / 2, overlayY + 80);
      
      // Claimed items
      if (claimedItems.length > 0) {
        ctx.fillText(`Claimed: ${claimedItems.join(', ')}`, canvasWidth / 2, overlayY + 100);
      } else {
        ctx.fillText('Status: Already claimed today', canvasWidth / 2, overlayY + 100);
      }
      
      // Save the image
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);
      
      console.log(`📸 Created confirmation image with ID overlay: ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      console.error('❌ Canvas image creation failed:', error.message);
      throw error;
    }
  }

  // Clean up old confirmation files (keep only last 24 hours)
  cleanupOldFiles() {
    try {
      const files = fs.readdirSync('.');
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      files.forEach(file => {
        if (file.startsWith('confirmation-') && (file.endsWith('.png') || file.endsWith('.txt'))) {
          const stats = fs.statSync(file);
          if (now - stats.mtime.getTime() > oneDayMs) {
            fs.unlinkSync(file);
            console.log(`🗑️ Cleaned up old confirmation file: ${file}`);
          }
        }
      });
    } catch (error) {
      console.error('⚠️ Error cleaning up old files:', error.message);
    }
  }
}

module.exports = ImageGenerator;
