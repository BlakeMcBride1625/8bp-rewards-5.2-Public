import { Message, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { roleManager } from '../services/roleManager';
import { databaseService } from '../services/database';
import { logger } from '../services/logger';
import { dmCleanupService } from '../services/dmCleanup';
import path from 'path';
import { VerificationStatus } from '@prisma/client';
import { verificationAuditService } from '../services/verificationAudit';
import { processImage, saveVerificationImage } from '../services/imageProcessor';
import { screenshotLockService, ScreenshotLockConflictError } from '../services/screenshotLock';
import { accountPortalSync } from '../services/accountPortalSync';
import { spawn } from 'child_process';
import * as fs from 'fs';

const envRankChannelId = process.env.VERIFICATION_RANK_CHANNEL_ID || process.env.RANK_CHANNEL_ID;
if (!envRankChannelId) {
  throw new Error('RANK_CHANNEL_ID environment variable is required');
}
const RANK_CHANNEL_ID = envRankChannelId;
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

/**
 * Send DM to user with verification confirmation
 */
type VerificationDMOptions = {
  rankName: string;
  levelMin: number;
  uniqueId?: string | null;
  attachmentUrl?: string | null;
  attachmentFile?: {
    data: Buffer;
    name: string;
    contentType: string;
  } | null;
  profileUrl?: string;
  hasMultipleAccounts?: boolean;
};

async function sendVerificationDM(
  userId: string,
  options: VerificationDMOptions & { levelDetected: number },
): Promise<void> {
  try {
    const client = (global as any).client;
    if (!client) {
      logger.warn('Discord client not available for DM', { user_id: userId });
      return;
    }
    const user = await client.users.fetch(userId);
    if (!user) {
      logger.warn('User not found for DM', { user_id: userId });
      return;
    }

    const { rankName, levelDetected, uniqueId, attachmentUrl, attachmentFile } = options;
    const displayUniqueId =
      uniqueId && uniqueId.length > 0 ? formatUniqueIdForDisplay(uniqueId) : null;

    const { hasMultipleAccounts = false } = options;
    
    const descriptionLines = [
      `Your 8 Ball Pool rank has been verified as **${rankName}** (Level ${levelDetected}).`,
      'Your Discord role has been updated successfully.',
    ];
    
    // Add explanatory line for multi-account scenarios
    if (hasMultipleAccounts) {
      descriptionLines.push('', '**All your accounts are fully verified. Your highest-level account is displayed first.**');
    }
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Rank Verification Successful')
      .setDescription(descriptionLines.join('\n\n'))
      .setColor(0x00AE86)
      .setTimestamp();

    if (uniqueId) {
      embed.addFields({
        name: '8BP Unique ID',
        value: `\`${displayUniqueId ?? uniqueId}\``,
        inline: false,
      });
    }

    // Get public URL for user-facing links (not internal Docker URLs)
    // PUBLIC_URL already includes /8bp-rewards path, so don't append it again
    const publicUrl = process.env.PUBLIC_URL || process.env.APP_URL || 'https://8ballpool.website';
    const baseUrl = publicUrl.endsWith('/8bp-rewards') ? publicUrl : `${publicUrl}/8bp-rewards`;
    const registrationUrl = `${baseUrl}/register`;
    
    const fields = [
      {
        name: '🎁 Auto-Claim Rewards',
        value:
          [
            'Register for automatic rewards claiming for free if you haven\'t already.',
            '',
            '**8BP Rewards Registration:**',
            registrationUrl,
          ].join('\n'),
        inline: false,
      },
    ];

    // Add profile URL if available
    if (options.profileUrl) {
      fields.push({
        name: '👤 View Your Profile',
        value: `[View your accounts profile](${options.profileUrl})`,
        inline: false,
      });
    }

    fields.push({
      name: '🔗 Link Your Account',
      value: [
        'Link your Discord to your 8 Ball Pool Unique ID with the slash command:',
        '',
        '`/link-account`',
      ].join('\n'),
      inline: false,
    });

    embed.addFields(fields);

    let files: AttachmentBuilder[] | undefined;
    if (attachmentFile) {
      embed.setImage(`attachment://${attachmentFile.name}`);
      files = [
        new AttachmentBuilder(attachmentFile.data, {
          name: attachmentFile.name,
          description: 'Verified screenshot',
        }),
      ];
    } else if (attachmentUrl) {
      embed.setImage(attachmentUrl);
    }

    const sentMessage = await user.send({ embeds: [embed], files });
    logger.info('Verification DM sent', { user_id: userId, rank_name: rankName });
    
    // Schedule message for deletion after 30 minutes
    if (sentMessage) {
      dmCleanupService.scheduleDeletion(sentMessage);
    }
  } catch (error) {
    // User may have DMs disabled
    logger.warn('Failed to send verification DM', { error, user_id: userId });
  }
}

function formatUniqueIdForDisplay(uniqueId: string): string {
  const digits = uniqueId.replace(/\D/g, '');
  if (digits.length <= 3) {
    return digits;
  }

  const groups: string[] = [];
  let index = 0;

  while (digits.length - index > 4) {
    groups.push(digits.slice(index, index + 3));
    index += 3;
  }

  const remaining = digits.length - index;
  if (remaining === 4) {
    groups.push(digits.slice(index, index + 3));
    groups.push(digits.slice(index + 3));
  } else {
    groups.push(digits.slice(index));
  }

  return groups.join('-');
}

/**
 * Send error DM to user
 */
async function sendErrorDM(userId: string, message: string): Promise<void> {
  try {
    const client = (global as any).client;
    if (!client) {
      return;
    }
    const user = await client.users.fetch(userId);
    if (!user) {
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('❌ Verification Failed')
      .setDescription(message)
      .setColor(0xe74c3c)
      .setTimestamp()
      .addFields({
        name: 'Need help?',
        value: 'Double-check the pinned instructions in the verification channel or ping a staff member for assistance.',
      });

    const sentMessage = await user.send({ embeds: [embed] });
    
    // Schedule message for deletion after 30 minutes
    if (sentMessage) {
      dmCleanupService.scheduleDeletion(sentMessage);
    }
  } catch (error) {
    // User may have DMs disabled - that's okay for error messages
    logger.debug('Failed to send error DM', { error, user_id: userId });
  }
}

/**
 * Handle message create event
 */
export async function handleMessageCreate(message: Message): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) {
    return;
  }

  // Debug: Log all messages in the rank channel
  if (message.channel.id === RANK_CHANNEL_ID) {
    logger.debug('Message received in rank channel', {
      channel_id: message.channel.id,
      user_id: message.author.id,
      username: message.author.username,
      has_attachments: message.attachments.size > 0,
      attachment_count: message.attachments.size,
    });
  }

  // Only process messages in the rank verification channel
  if (message.channel.id !== RANK_CHANNEL_ID) {
    return;
  }

  const startedAt = Date.now();

  // Only process messages with image attachments
  const imageAttachments = message.attachments.filter(attachment => {
    const ext = path.extname(attachment.url).toLowerCase();
    const contentType = attachment.contentType || '';
    const isImage = ALLOWED_IMAGE_EXTENSIONS.includes(ext) || contentType.startsWith('image/');
    
    logger.debug('Checking attachment', {
      url: attachment.url,
      extension: ext,
      content_type: contentType,
      is_image: isImage,
      filename: attachment.name,
    });
    
    return isImage;
  });

  logger.debug('Image attachment filter result', {
    total_attachments: message.attachments.size,
    image_attachments: imageAttachments.size,
  });

  if (imageAttachments.size === 0) {
    logger.debug('No image attachments found, skipping message');
    return;
  }

  logger.info('Processing image(s) from user', {
    user_id: message.author.id,
    username: message.author.username,
    attachment_count: imageAttachments.size,
  });

  // Process all images and find the best match
  const results: Array<{
    success: boolean;
    rank?: any;
    level?: number;
    confidence?: number;
    isProfile?: boolean;
    ocrText?: string;
    screenshotHash?: string;
    uniqueId?: string | null;
    accountUsername?: string | null;
    attachmentUrl: string;
    attachmentFile?: {
      data: Buffer;
      name: string;
      contentType: string;
    };
    profileData?: import('../services/visionProfileExtractor').ProfileData;
  }> = [];

  for (const attachment of imageAttachments.values()) {
    const result = await processImage({
      url: attachment.url,
      size: attachment.size,
      contentType: attachment.contentType,
      filename: attachment.name ?? null,
    });
    if (result.success && result.rank) {
      results.push({
        success: true,
        rank: result.rank,
        level: result.level,
        confidence: result.rank.confidence,
        isProfile: result.isProfile,
        ocrText: result.ocrText,
        screenshotHash: result.screenshotHash,
        uniqueId: result.uniqueId ?? null,
        accountUsername: result.accountUsername ?? null,
        attachmentUrl: result.attachmentUrl,
        attachmentFile: result.attachmentFile,
        profileData: result.profileData,
      });
    } else if (result.isProfile === false) {
      // Image was processed but is not a profile screenshot
      results.push({
        success: false,
        isProfile: false,
        screenshotHash: result.screenshotHash,
        attachmentUrl: result.attachmentUrl,
        attachmentFile: result.attachmentFile,
        profileData: result.profileData,
      });
    }
  }

  // Check if any images were invalid (not profile screenshots)
  const invalidImages = results.filter(r => r.isProfile === false);
  if (invalidImages.length > 0) {
    const firstInvalid = invalidImages[0];

    await sendErrorDM(
      message.author.id,
      "❌ Invalid format. Please upload a screenshot of your 8 Ball Pool **Profile** screen (showing your level, rank, and stats), not the main menu or other screens."
    );

    await logger.logAction({
      timestamp: new Date(),
      action_type: 'ocr_processed',
      user_id: message.author.id,
      username: message.author.username,
      success: false,
      error_message: 'Invalid image format - not a profile screenshot',
    });

    await verificationAuditService.recordEvent({
      userId: message.author.id,
      username: message.author.username,
      status: VerificationStatus.FAILURE,
      ocrUniqueId: firstInvalid?.uniqueId ?? null,
      screenshotHash: firstInvalid?.screenshotHash,
      attachmentUrl: firstInvalid?.attachmentUrl,
      attachmentFile: firstInvalid?.attachmentFile,
      messageId: message.id,
      reason: 'Invalid image format - not a profile screenshot',
    });

    // Delete the message
    try {
      await message.delete();
    } catch (error) {
      logger.warn('Failed to delete message after invalid format', { error });
    }

    return;
  }

  // If no successful matches, send error DM
  if (results.length === 0 || !results.some(r => r.success && r.rank)) {
    await sendErrorDM(
      message.author.id,
      "I couldn't read your screenshot clearly. Please upload a clearer image of your 8 Ball Pool profile showing your level and rank."
    );

    await logger.logAction({
      timestamp: new Date(),
      action_type: 'ocr_processed',
      user_id: message.author.id,
      username: message.author.username,
      success: false,
      error_message: 'OCR failed to extract rank information',
    });

    const firstAttempt = results[0];
    await verificationAuditService.recordEvent({
      userId: message.author.id,
      username: message.author.username,
      status: VerificationStatus.FAILURE,
      ocrUniqueId: firstAttempt?.uniqueId ?? null,
      screenshotHash: firstAttempt?.screenshotHash,
      attachmentUrl: firstAttempt?.attachmentUrl,
      attachmentFile: firstAttempt?.attachmentFile,
      messageId: message.id,
      reason: 'OCR failed to extract rank information',
    });

    // Delete the message
    try {
      await message.delete();
    } catch (error) {
      logger.warn('Failed to delete message after OCR failure', { error });
    }

    return;
  }

  // Find the best match (highest confidence)
  const bestMatch = results.reduce((best, current) => {
    if (!best || (current.confidence && current.confidence > (best.confidence || 0))) {
      return current;
    }
    return best;
  });

  if (!bestMatch.rank) {
    return;
  }

  const matchedRank = bestMatch.rank;
  let levelDetected = bestMatch.level ?? matchedRank.level_min;
  if (bestMatch.rank.level_extracted_from_image !== undefined && bestMatch.rank.level_extracted_from_image !== null) {
    levelDetected = bestMatch.rank.level_extracted_from_image;
  }

  const levelOrigin =
    bestMatch.rank.level_extracted_from_image !== undefined && bestMatch.rank.level_extracted_from_image !== null
      ? 'vision-api'
      : bestMatch.level !== undefined && bestMatch.level !== null
      ? 'vision-api'
      : 'rank-fallback';

  logger.info('Level selection summary', {
    user_id: message.author.id,
    level_detected: levelDetected,
    level_origin: levelOrigin,
    level_from_image: bestMatch.rank.level_extracted_from_image ?? null,
    level_from_text: bestMatch.level ?? null,
    rank_bounds: { min: matchedRank.level_min, max: matchedRank.level_max },
  });
  if (levelDetected < matchedRank.level_min) {
    logger.debug('Adjusted detected level up to minimum bound', {
      original_level: levelDetected,
      level_min: matchedRank.level_min,
    });
    levelDetected = matchedRank.level_min;
  } else if (matchedRank.level_max && levelDetected > matchedRank.level_max) {
    logger.debug('Adjusted detected level down to maximum bound', {
      original_level: levelDetected,
      level_max: matchedRank.level_max,
    });
    levelDetected = matchedRank.level_max;
  }
  const screenshotHash = bestMatch.screenshotHash;
  const uniqueId = bestMatch.uniqueId ?? null;
  if (!screenshotHash) {
    logger.error('Screenshot hash missing for processed image', { user_id: message.author.id });
    return;
  }

  try {
    await screenshotLockService.verifyLock({
      userId: message.author.id,
      screenshotHash,
      uniqueId,
    });
  } catch (conflictError) {
    if (conflictError instanceof ScreenshotLockConflictError) {
      logger.warn('Screenshot lock conflict detected', {
        reason: conflictError.reason,
        conflicting_user_id: conflictError.conflictUserId,
        current_user: message.author.id,
      });

      await sendErrorDM(
        message.author.id,
        '❌ This screenshot or 8 Ball Pool ID is already linked to another Discord user.'
      );

      const reasonText =
        conflictError.reason === 'HASH_CONFLICT'
          ? 'Screenshot hash already linked to another user'
          : 'OCR unique ID already linked to another user';

      await logger.logAction({
        timestamp: new Date(),
        action_type: 'ocr_processed',
        user_id: message.author.id,
        username: message.author.username,
        success: false,
        error_message: reasonText,
      });

      await verificationAuditService.recordEvent({
        userId: message.author.id,
        username: message.author.username,
        status: VerificationStatus.FAILURE,
        ocrUniqueId: uniqueId,
        screenshotHash,
        attachmentUrl: bestMatch.attachmentUrl,
      attachmentFile: bestMatch.attachmentFile,
        messageId: message.id,
        reason: reasonText,
      });

      try {
        await message.delete();
      } catch (error) {
        logger.warn('Failed to delete message after screenshot lock conflict', { error });
      }

      return;
    }

    logger.error('Error during screenshot conflict checks', { conflictError });
    await sendErrorDM(
      message.author.id,
      '❌ An internal error occurred while verifying your screenshot. Please try again later.'
    );
    return;
  }

  // Validate account using registration-validation.ts script
  if (uniqueId) {
    const accountUsername = (bestMatch.accountUsername && bestMatch.accountUsername !== 'UNKNOWN' && bestMatch.accountUsername.trim() !== '')
      ? bestMatch.accountUsername.trim()
      : (bestMatch.profileData?.username && 
          bestMatch.profileData.username !== 'UNKNOWN' && 
          bestMatch.profileData.username !== undefined &&
          bestMatch.profileData.username.trim() !== ''
          ? bestMatch.profileData.username.trim()
          : message.author.username);

    logger.info('🔍 Starting account validation', {
      discord_id: message.author.id,
      unique_id: uniqueId,
      username: accountUsername,
    });

    try {
      // Resolve script path - works in both dev and Docker
      // Try both .ts and .js versions
      const possiblePaths = [
        path.join(process.cwd(), 'backend/src/scripts/registration-validation.ts'),
        path.join(process.cwd(), 'backend/src/scripts/registration-validation.js'),
        path.join(process.cwd(), 'dist/backend/backend/src/scripts/registration-validation.ts'),
        path.join(process.cwd(), 'dist/backend/backend/src/scripts/registration-validation.js'),
        path.join(process.cwd(), 'services/verification-bot/../backend/src/scripts/registration-validation.ts'),
        path.join(process.cwd(), 'services/verification-bot/../backend/src/scripts/registration-validation.js'),
        path.resolve(__dirname, '../../../backend/src/scripts/registration-validation.ts'),
        path.resolve(__dirname, '../../../backend/src/scripts/registration-validation.js'),
      ];
      
      let validationScript: string | null = null;
      for (const scriptPath of possiblePaths) {
        try {
          if (fs.existsSync(scriptPath)) {
            validationScript = scriptPath;
            break;
          }
        } catch (e) {
          // Continue to next path
        }
      }
      
      if (validationScript) {
        logger.info('Running account validation script', { 
          unique_id: uniqueId, 
          username: accountUsername, 
          script: validationScript,
        });
        
        const isTypeScript = validationScript.endsWith('.ts');
        const command = isTypeScript ? 'npx' : 'node';
        const args = isTypeScript 
          ? ['tsx', validationScript, uniqueId, accountUsername]
          : [validationScript, uniqueId, accountUsername];
        
        // Run validation with timeout (don't block too long)
        await new Promise<void>((resolve) => {
          const validationProcess = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: process.cwd(),
            detached: false,
            env: {
              ...process.env,
              NODE_ENV: process.env.NODE_ENV || 'production'
            }
          });
          
          const timeout = setTimeout(() => {
            logger.warn('Account validation timeout - continuing anyway', { 
              unique_id: uniqueId,
              username: accountUsername 
            });
            validationProcess.kill('SIGKILL');
            resolve(); // Continue even if timeout
          }, 120000); // 2 minutes timeout
          
          let stdout = '';
          let stderr = '';
          
          validationProcess.stdout?.on('data', (data) => {
            stdout += data.toString();
          });
          
          validationProcess.stderr?.on('data', (data) => {
            stderr += data.toString();
          });
          
          validationProcess.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0) {
              logger.info('Account validation completed successfully', {
                unique_id: uniqueId,
                username: accountUsername,
                exit_code: code
              });
              resolve();
            } else {
              logger.warn('Account validation completed with non-zero exit code - continuing anyway', {
                unique_id: uniqueId,
                username: accountUsername,
                exit_code: code,
                stderr: stderr.substring(0, 500) // Log first 500 chars of stderr
              });
              resolve(); // Continue even if validation fails
            }
          });
          
          validationProcess.on('error', (error) => {
            clearTimeout(timeout);
            logger.warn('Account validation process error - continuing anyway', {
              unique_id: uniqueId,
              username: accountUsername,
              error: error.message
            });
            resolve(); // Continue even if process fails to start
          });
        });
      } else {
        logger.warn('Account validation script not found - skipping validation', {
          unique_id: uniqueId,
          username: accountUsername,
          tried_paths: possiblePaths
        });
      }
    } catch (error) {
      logger.warn('Account validation error - continuing anyway', {
        unique_id: uniqueId,
        username: accountUsername,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Continue with verification even if validation fails
    }
  }

  try {
    // Get guild member
    const member = await message.guild?.members.fetch(message.author.id);
    if (!member) {
      logger.error('Member not found in guild', { user_id: message.author.id, guild_id: message.guild?.id });
      return;
    }

    // Check if user has existing accounts to determine if this is a multi-account scenario
    const existingAccounts = await databaseService.getUserAccounts(message.author.id);
    const highestLevelAccount = existingAccounts.length > 0 
      ? existingAccounts.reduce((highest, account) => 
          account.level > highest.level ? account : highest, existingAccounts[0])
      : null;
    
    // Determine which account should determine the Discord role
    // Always use the highest level account across all verified accounts
    const roleLevel = highestLevelAccount && highestLevelAccount.level > levelDetected
      ? highestLevelAccount.level
      : levelDetected;
    const roleRankName = highestLevelAccount && highestLevelAccount.level > levelDetected
      ? highestLevelAccount.rank_name
      : matchedRank.rank_name;
    
    // Find the rank config for the role to assign
    const rankMatcherService = require('../services/rankMatcher').rankMatcher;
    const roleRankConfig = rankMatcherService.getRankByName(roleRankName);
    
    logger.info('Processing verification - determining Discord role from highest account', {
      user_id: message.author.id,
      existing_accounts_count: existingAccounts.length,
      new_account_level: levelDetected,
      new_account_rank: matchedRank.rank_name,
      highest_existing_level: highestLevelAccount?.level || null,
      highest_existing_rank: highestLevelAccount?.rank_name || null,
      role_level_selected: roleLevel,
      role_rank_selected: roleRankName,
      using_highest_account: highestLevelAccount && highestLevelAccount.level > levelDetected,
    });

    // Assign role based on the HIGHEST level account
    await roleManager.assignRankRole(member, roleRankConfig || {
      role_id: matchedRank.role_id,
      rank_name: matchedRank.rank_name,
      level_min: matchedRank.level_min,
      level_max: matchedRank.level_max,
    });

    // Update database
    await databaseService.upsertVerification({
      discord_id: message.author.id,
      username: message.author.username,
      rank_name: matchedRank.rank_name,
      level_detected: levelDetected,
      role_id_assigned: matchedRank.role_id,
    });

    await screenshotLockService.upsertLock({
      userId: message.author.id,
      screenshotHash,
      uniqueId,
    });

    // Log action
    await logger.logAction({
      timestamp: new Date(),
      action_type: 'verification_updated',
      user_id: message.author.id,
      username: message.author.username,
      rank_name: matchedRank.rank_name,
      level_detected: levelDetected,
      role_id_assigned: matchedRank.role_id,
      success: true,
    });

    // Get account username from profile data if available
    // Try accountUsername from bestMatch first, then fall back to profileData
    const accountUsername = (bestMatch.accountUsername && bestMatch.accountUsername !== 'UNKNOWN' && bestMatch.accountUsername.trim() !== '')
      ? bestMatch.accountUsername.trim()
      : (bestMatch.profileData?.username && 
          bestMatch.profileData.username !== 'UNKNOWN' && 
          bestMatch.profileData.username !== undefined &&
          bestMatch.profileData.username.trim() !== ''
          ? bestMatch.profileData.username.trim()
          : undefined);

    // Prepare metadata for embed - ensure all fields are properly set
    const embedMetadata = {
      rank_name: matchedRank.rank_name,
      level_detected: levelDetected,
      account_username: accountUsername || undefined,
      sendToPublicChannel: false,
    };

    // Log extracted data for debugging - comprehensive logging
    logger.info('📋 Preparing verification event metadata for embed', {
      discord_id: message.author.id,
      discord_username: message.author.username,
      level_detected: levelDetected,
      level_type: typeof levelDetected,
      rank_name: matchedRank.rank_name,
      rank_type: typeof matchedRank.rank_name,
      account_username: accountUsername || 'NOT_EXTRACTED',
      account_username_type: typeof accountUsername,
      profileData_username: bestMatch.profileData?.username || 'NOT_IN_PROFILEDATA',
      bestMatch_accountUsername: bestMatch.accountUsername || 'NOT_IN_BESTMATCH',
      unique_id: uniqueId,
      metadata_object: embedMetadata,
    });

    // Verify metadata before passing to embed
    if (!embedMetadata.rank_name || embedMetadata.rank_name === 'UNKNOWN') {
      logger.error('❌ CRITICAL: rank_name is missing or UNKNOWN in metadata!', {
        rank_name: embedMetadata.rank_name,
        matchedRank_rank_name: matchedRank.rank_name,
      });
    }
    if (embedMetadata.level_detected === undefined || embedMetadata.level_detected === null) {
      logger.error('❌ CRITICAL: level_detected is missing in metadata!', {
        level_detected: embedMetadata.level_detected,
        levelDetected_value: levelDetected,
      });
    }

    logger.info('📤 Sending verification event to audit service', {
      discord_id: message.author.id,
      metadata: embedMetadata,
    });

    await verificationAuditService.recordEvent({
      userId: message.author.id,
      username: message.author.username,
      status: VerificationStatus.SUCCESS,
      confidence: matchedRank.confidence,
      ocrUniqueId: uniqueId,
      screenshotHash,
      attachmentUrl: bestMatch.attachmentUrl,
      attachmentFile: bestMatch.attachmentFile,
      messageId: message.id,
      processingTimeMs: Date.now() - startedAt,
      metadata: embedMetadata,
    });

    logger.info('✅ Verification event sent to audit service', {
      discord_id: message.author.id,
    });

    // Generate profile URL
    const profileUrl = accountPortalSync.generateProfileUrl(message.author.id, uniqueId || undefined);

    // Save verification image to dedicated folder FIRST (before sync so filename can be included)
    let savedImageFilename: string | null = null;
    if (bestMatch.attachmentFile) {
      try {
        const fileExtension = path.extname(bestMatch.attachmentFile.name) || '.png';
        logger.info('💾 Attempting to save verification image', {
          discord_id: message.author.id,
          unique_id: uniqueId,
          level: levelDetected,
          rank: matchedRank.rank_name,
          file_extension: fileExtension,
          file_size: bestMatch.attachmentFile.data.length,
          has_buffer: !!bestMatch.attachmentFile.data,
          buffer_length: bestMatch.attachmentFile.data?.length || 0,
        });
        
        const savedFilename = await saveVerificationImage(
          bestMatch.attachmentFile.data,
          message.author.id,
          uniqueId,
          levelDetected,
          matchedRank.rank_name,
          fileExtension
        );
        
        if (savedFilename) {
          savedImageFilename = savedFilename;
          logger.info('✅ Verification image saved successfully - will be available in dashboard', { 
            filename: savedFilename,
            discord_id: message.author.id,
            unique_id: uniqueId,
            file_path: `/app/services/verification-bot/verifications/${savedFilename}`,
          });
        } else {
          logger.error('❌ Failed to save verification image - saveVerificationImage returned null', { 
            discord_id: message.author.id,
            unique_id: uniqueId,
            level: levelDetected,
            rank: matchedRank.rank_name,
          });
        }
      } catch (error) {
        logger.error('❌ Error saving verification image - exception thrown', {
          error: error instanceof Error ? error.message : String(error),
          error_stack: error instanceof Error ? error.stack : undefined,
          discord_id: message.author.id,
          unique_id: uniqueId,
        });
      }
    } else {
        logger.error('❌ Cannot save verification image - attachmentFile is missing', {
        discord_id: message.author.id,
        has_attachment_url: !!bestMatch.attachmentUrl,
        has_attachment_file: !!bestMatch.attachmentFile,
        attachment_url: bestMatch.attachmentUrl,
      });
    }

    // Sync to accounts portal (AFTER image is saved so we can include filename)
    if (uniqueId) {
      logger.info('🔄 Syncing account to rewards API', {
        discord_id: message.author.id,
        unique_id: uniqueId,
        level: levelDetected,
        rank_name: matchedRank.rank_name,
        verification_image_filename: savedImageFilename || 'NOT_SAVED',
      });

      try {
        // Use accountUsername from image if available, otherwise fall back to Discord username
        const syncUsername = accountUsername || message.author.username;
        
        logger.info('🔄 Preparing account sync with username', {
          discord_id: message.author.id,
          unique_id: uniqueId,
          account_username_from_image: accountUsername || 'NOT_EXTRACTED',
          discord_username: message.author.username,
          username_used_for_sync: syncUsername,
        });
        
        await accountPortalSync.syncAccount({
          discord_id: message.author.id,
          username: syncUsername,
          unique_id: uniqueId,
          level: levelDetected,
          rank_name: matchedRank.rank_name,
          avatar_url: message.author.avatarURL(),
          metadata: {
            rank_min: matchedRank.level_min,
            rank_max: matchedRank.level_max,
            confidence: matchedRank.confidence,
            verification_image_filename: savedImageFilename || undefined,
          },
        });
        logger.info('✅ Account synced to rewards API successfully', {
          discord_id: message.author.id,
          unique_id: uniqueId,
          api_response: 'success',
        });
      } catch (syncError) {
        logger.error('❌ Failed to sync account to rewards API', {
          error: syncError instanceof Error ? syncError.message : String(syncError),
          stack: syncError instanceof Error ? syncError.stack : undefined,
          discord_id: message.author.id,
          unique_id: uniqueId,
          api_url: process.env.REWARDS_API_URL || 'http://backend:2600',
        });
        // Don't fail verification if sync fails, but log it
      }
    } else {
      logger.warn('⚠️ Cannot sync account - uniqueId is missing', {
        discord_id: message.author.id,
      });
    }

    // Get all user accounts to determine if this is multi-account scenario
    const allUserAccounts = await databaseService.getUserAccounts(message.author.id);
    const userHasMultipleAccounts = allUserAccounts.length > 1;
    
    // Send DM confirmation
    await sendVerificationDM(message.author.id, {
      rankName: matchedRank.rank_name,
      levelMin: matchedRank.level_min,
      levelDetected,
      uniqueId,
      attachmentUrl: bestMatch.attachmentUrl,
      attachmentFile: bestMatch.attachmentFile ?? null,
      profileUrl,
      hasMultipleAccounts: userHasMultipleAccounts,
    });

    // Delete the processed screenshot
    try {
      await message.delete();
      logger.info('Message deleted after successful processing', { message_id: message.id });
    } catch (error) {
      logger.warn('Failed to delete message after processing', { error, message_id: message.id });
    }
  } catch (error) {
    logger.error('Error in verification process', {
      error,
      user_id: message.author.id,
      username: message.author.username,
      rank_name: matchedRank.rank_name,
    });

    // Send error DM to user
    await sendErrorDM(
      message.author.id,
      "An error occurred while processing your verification. Please try again or contact an administrator."
    );

    // Log error
    await logger.logAction({
      timestamp: new Date(),
      action_type: 'error',
      user_id: message.author.id,
      username: message.author.username,
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    await verificationAuditService.recordEvent({
      userId: message.author.id,
      username: message.author.username,
      status: VerificationStatus.FAILURE,
      confidence: matchedRank.confidence,
      ocrUniqueId: uniqueId,
      screenshotHash,
      attachmentUrl: bestMatch.attachmentUrl,
      attachmentFile: bestMatch.attachmentFile,
      messageId: message.id,
      processingTimeMs: Date.now() - startedAt,
      reason: error instanceof Error ? error.message : 'Unexpected verification error',
    });
  }
}

