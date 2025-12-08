import express from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../services/LoggerService';
import DiscordNotificationService from '../services/DiscordNotificationService';
import WebSocketService from '../services/WebSocketService';
import { clearLeaderboardCache } from './leaderboard';
import { getRandom8BPAvatar } from '../utils/avatarUtils';

const router = express.Router();
const dbService = DatabaseService.getInstance();
const discordNotificationService = new DiscordNotificationService();

/**
 * Internal API endpoint for verification bot to sync verification data
 * POST /api/internal/verification/sync
 */
router.post('/sync', async (req, res): Promise<void> => {
	try {
		const { discord_id, username, unique_id, level, rank_name, avatar_url } = req.body;

		// Validate required fields
		if (!discord_id || !username || !unique_id || level === undefined || !rank_name) {
			res.status(400).json({
				success: false,
				error: 'Missing required fields: discord_id, username, unique_id, level, rank_name'
			});
			return;
		}

		logger.info('Verification sync request received', {
			action: 'verification_sync',
			discord_id,
			unique_id,
			level,
			rank_name
		});

		// Normalize unique_id - remove dashes for matching (database stores without dashes)
		const normalizedUniqueId = unique_id.replace(/-/g, '');

		// Check if registration exists by unique_id (try both with and without dashes) or discord_id
		let existingRegistration = await dbService.findRegistration({ eightBallPoolId: normalizedUniqueId });
		
		// If not found, try with dashes format
		if (!existingRegistration) {
			existingRegistration = await dbService.findRegistration({ eightBallPoolId: unique_id });
		}

		// Also check by discord_id
		if (!existingRegistration && discord_id) {
			existingRegistration = await dbService.findRegistration({ discordId: discord_id });
		}

		if (existingRegistration) {
			// Update existing registration with verification data
			// Preserve existing username - do not overwrite it
			// Only update level/rank if new values are higher
			const currentLevel = existingRegistration.account_level || 0;
			const shouldUpdateLevel = level > currentLevel;
			const shouldUpdateRank = shouldUpdateLevel; // If level is higher, rank should also be higher
			
			logger.info('Updating existing rewards registration with verification data', {
				eightBallPoolId: existingRegistration.eightBallPoolId,
				normalizedUniqueId,
				originalUniqueId: unique_id,
				discord_id,
				username_from_image: username,
				current_username: existingRegistration.username,
				current_level: currentLevel,
				new_level: level,
				should_update_level: shouldUpdateLevel,
				current_rank: existingRegistration.account_rank,
				new_rank: rank_name,
				should_update_rank: shouldUpdateRank,
			});

			// Update registration data - preserve username, only update level/rank if higher
			const updateData: any = {
				// Do NOT update username - preserve existing username from original account
				discordId: discord_id,
				verified_at: new Date()
			};
			
			// Only update level and rank if new values are higher
			if (shouldUpdateLevel) {
				updateData.account_level = level;
				updateData.account_rank = rank_name;
			}

			await dbService.updateRegistration(existingRegistration.eightBallPoolId, updateData);
			
			const finalLevel = shouldUpdateLevel ? level : existingRegistration.account_level;
			const finalRank = shouldUpdateRank ? rank_name : existingRegistration.account_rank;
			
		logger.info('Registration updated successfully with verification data', {
			eightBallPoolId: existingRegistration.eightBallPoolId,
			username_preserved: existingRegistration.username,
			account_level_updated: shouldUpdateLevel,
			final_account_level: finalLevel,
			account_rank_updated: shouldUpdateRank,
			final_account_rank: finalRank,
		});

		// Clear leaderboard cache and emit WebSocket event so frontends update
		clearLeaderboardCache();
		WebSocketService.emitLeaderboardDataUpdate({
			eightBallPoolId: existingRegistration.eightBallPoolId,
			account_level: finalLevel,
			account_rank: finalRank,
			username: existingRegistration.username
		});

		// Send Discord notification to registration channel
			// Use existing username (preserved) for display, not the username from the image
			try {
				await discordNotificationService.sendVerificationConfirmation(
					normalizedUniqueId,
					existingRegistration.username, // Use preserved username, not username from image
					finalLevel || level, // Use updated level if changed, otherwise current
					finalRank || rank_name, // Use updated rank if changed, otherwise current
					discord_id,
					existingRegistration.username // Use preserved username for Discord notification
				);
			} catch (notifError) {
				logger.warn('Failed to send verification confirmation notification', {
					error: notifError instanceof Error ? notifError.message : 'Unknown error',
					discord_id,
					unique_id: normalizedUniqueId
				});
				// Don't fail the sync if notification fails
			}

			res.json({
				success: true,
				registration_id: existingRegistration.id || existingRegistration.eightBallPoolId,
				message: 'Registration updated with verification data'
			});
			return;
		}

	// Create new registration
	logger.info('Creating new rewards registration from verification', {
		eightBallPoolId: unique_id,
		discord_id,
		username_from_image: username,
		level,
		rank_name
	});

	// Get a random avatar for new registrations
	const randomAvatar = getRandom8BPAvatar();
	logger.info('Assigning random avatar to new verification registration', {
		eightBallPoolId: normalizedUniqueId,
		avatarFilename: randomAvatar || 'none-available'
	});

	// Create new registration with random avatar
	const newRegistration = await dbService.createRegistration({
		eightBallPoolId: normalizedUniqueId, // Use normalized ID (no dashes)
		username: username,
		discordId: discord_id,
		account_level: level,
		account_rank: rank_name,
		verified_at: new Date(),
		registrationIp: 'verification-bot',
		deviceId: 'verification-bot',
		deviceType: 'bot',
		userAgent: 'verification-bot',
		lastLoginAt: new Date(),
		isActive: true,
		eight_ball_pool_avatar_filename: randomAvatar || null // Assign random avatar
	});

		// Clear leaderboard cache and emit WebSocket event so frontends update
		clearLeaderboardCache();
		WebSocketService.emitLeaderboardDataUpdate({
			eightBallPoolId: normalizedUniqueId,
			account_level: level,
			account_rank: rank_name,
			username: username
		});

		// Send Discord notification to registration channel
		try {
			await discordNotificationService.sendVerificationConfirmation(
				normalizedUniqueId,
				username,
				level,
				rank_name,
				discord_id,
				username // Discord username (using account username as fallback)
			);
		} catch (notifError) {
			logger.warn('Failed to send verification confirmation notification', {
				error: notifError instanceof Error ? notifError.message : 'Unknown error',
				discord_id,
				unique_id: normalizedUniqueId
			});
			// Don't fail the sync if notification fails
		}

		res.json({
			success: true,
			registration_id: newRegistration.id || newRegistration.eightBallPoolId,
			message: 'Registration created from verification'
		});

	} catch (error) {
		logger.error('Failed to sync verification to rewards', {
			action: 'verification_sync_error',
			error: error instanceof Error ? error.message : 'Unknown error',
			body: req.body
		});

		res.status(500).json({
			success: false,
			error: 'Failed to sync verification data'
		});
	}
});

export default router;

