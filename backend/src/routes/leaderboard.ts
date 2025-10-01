import express from 'express';
import { ClaimRecord } from '../models/ClaimRecord';
import { Registration } from '../models/Registration';
import { logger } from '../services/LoggerService';

const router = express.Router();

// Get leaderboard
router.get('/', async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '7d';
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Calculate date range based on timeframe
    const days = getDaysFromTimeframe(timeframe);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get claim statistics grouped by user
    const leaderboardData = await ClaimRecord.aggregate([
      {
        $match: {
          claimedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$eightBallPoolId',
          totalClaims: { $sum: 1 },
          successfulClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          totalItemsClaimed: { $sum: { $size: '$itemsClaimed' } },
          lastClaimed: { $max: '$claimedAt' }
        }
      },
      {
        $sort: { totalItemsClaimed: -1, successfulClaims: -1 }
      },
      {
        $limit: limit
      }
    ]);

    // Get user details for each entry
    const leaderboard = await Promise.all(
      leaderboardData.map(async (entry) => {
        const registration = await Registration.findByEightBallPoolId(entry._id);
        return {
          rank: 0, // Will be set below
          eightBallPoolId: entry._id,
          username: registration?.username || 'Unknown',
          totalClaims: entry.totalClaims,
          successfulClaims: entry.successfulClaims,
          totalItemsClaimed: entry.totalItemsClaimed,
          successRate: entry.totalClaims > 0 
            ? Math.round((entry.successfulClaims / entry.totalClaims) * 100) 
            : 0,
          lastClaimed: entry.lastClaimed
        };
      })
    );

    // Set ranks
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    res.json({
      timeframe,
      period: `${days} days`,
      totalUsers: leaderboard.length,
      leaderboard
    });

  } catch (error) {
    logger.error('Failed to retrieve leaderboard', {
      action: 'leaderboard_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timeframe: req.query.timeframe
    });

    res.status(500).json({
      error: 'Failed to retrieve leaderboard'
    });
  }
});

// Get user's ranking
router.get('/user/:eightBallPoolId', async (req, res) => {
  try {
    const { eightBallPoolId } = req.params;
    const timeframe = req.query.timeframe as string || '7d';
    
    const days = getDaysFromTimeframe(timeframe);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's stats
    const userStats = await ClaimRecord.aggregate([
      {
        $match: {
          eightBallPoolId,
          claimedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$eightBallPoolId',
          totalClaims: { $sum: 1 },
          successfulClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          totalItemsClaimed: { $sum: { $size: '$itemsClaimed' } },
          lastClaimed: { $max: '$claimedAt' }
        }
      }
    ]);

    if (userStats.length === 0) {
      return res.status(404).json({
        error: 'No claims found for this user in the specified timeframe'
      });
    }

    const userStat = userStats[0];
    
    // Get user's rank
    const usersWithMoreItems = await ClaimRecord.aggregate([
      {
        $match: {
          claimedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$eightBallPoolId',
          totalItemsClaimed: { $sum: { $size: '$itemsClaimed' } }
        }
      },
      {
        $match: {
          totalItemsClaimed: { $gt: userStat.totalItemsClaimed }
        }
      },
      {
        $count: 'count'
      }
    ]);

    const rank = (usersWithMoreItems[0]?.count || 0) + 1;

    // Get user registration details
    const registration = await Registration.findByEightBallPoolId(eightBallPoolId);

    res.json({
      rank,
      eightBallPoolId,
      username: registration?.username || 'Unknown',
      totalClaims: userStat.totalClaims,
      successfulClaims: userStat.successfulClaims,
      totalItemsClaimed: userStat.totalItemsClaimed,
      successRate: userStat.totalClaims > 0 
        ? Math.round((userStat.successfulClaims / userStat.totalClaims) * 100) 
        : 0,
      lastClaimed: userStat.lastClaimed,
      timeframe,
      period: `${days} days`
    });

  } catch (error) {
    logger.error('Failed to retrieve user ranking', {
      action: 'user_ranking_error',
      eightBallPoolId: req.params.eightBallPoolId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to retrieve user ranking'
    });
  }
});

// Get leaderboard statistics
router.get('/stats', async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '7d';
    const days = getDaysFromTimeframe(timeframe);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get overall statistics
    const stats = await ClaimRecord.aggregate([
      {
        $match: {
          claimedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalClaims: { $sum: 1 },
          successfulClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          totalItemsClaimed: { $sum: { $size: '$itemsClaimed' } },
          uniqueUsers: { $addToSet: '$eightBallPoolId' }
        }
      },
      {
        $project: {
          _id: 0,
          totalClaims: 1,
          successfulClaims: 1,
          totalItemsClaimed: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          successRate: {
            $cond: [
              { $gt: ['$totalClaims', 0] },
              { $multiply: [{ $divide: ['$successfulClaims', '$totalClaims'] }, 100] },
              0
            ]
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalClaims: 0,
      successfulClaims: 0,
      totalItemsClaimed: 0,
      uniqueUsers: 0,
      successRate: 0
    };

    res.json({
      timeframe,
      period: `${days} days`,
      ...result,
      successRate: Math.round(result.successRate)
    });

  } catch (error) {
    logger.error('Failed to retrieve leaderboard statistics', {
      action: 'leaderboard_stats_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to retrieve leaderboard statistics'
    });
  }
});

// Helper function to get days from timeframe string
function getDaysFromTimeframe(timeframe: string): number {
  const timeframes: { [key: string]: number } = {
    '1d': 1,
    '7d': 7,
    '14d': 14,
    '28d': 28,
    '30d': 30,
    '90d': 90,
    '1y': 365
  };

  return timeframes[timeframe] || 7;
}

export default router;

