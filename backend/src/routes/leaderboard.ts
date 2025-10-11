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

    // LAYER 4: Get claim statistics grouped by user with deduplication
    // Group by user AND date to prevent same-day duplicates from inflating counts
    const leaderboardData = await ClaimRecord.aggregate([
      {
        $match: {
          claimedAt: { $gte: startDate }
        }
      },
      {
        // First group by user AND date to deduplicate same-day claims
        $group: {
          _id: {
            userId: '$eightBallPoolId',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$claimedAt' } }
          },
          totalClaims: { $sum: 1 },
          successfulClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          itemsClaimed: { $first: '$itemsClaimed' }, // Take first claim of the day
          lastClaimed: { $max: '$claimedAt' }
        }
      },
      {
        // Now group by user to get totals (counting unique days)
        $group: {
          _id: '$_id.userId',
          totalClaims: { $sum: 1 }, // Count unique days
          successfulClaims: { $sum: '$successfulClaims' },
          totalClaimsActual: { $sum: '$totalClaims' }, // Sum actual claim counts
          failedClaims: { $sum: { $subtract: ['$totalClaims', '$successfulClaims'] } },
          totalItemsClaimed: { $sum: { $size: '$itemsClaimed' } },
          lastClaimed: { $max: '$lastClaimed' }
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
          failedClaims: entry.failedClaims || 0,
          totalItemsClaimed: entry.totalItemsClaimed,
          successRate: entry.totalClaimsActual > 0 
            ? Math.round((entry.successfulClaims / entry.totalClaimsActual) * 100) 
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
router.get('/user/:eightBallPoolId', async (req, res): Promise<void> => {
  try {
    const { eightBallPoolId } = req.params;
    const timeframe = req.query.timeframe as string || '7d';
    
    const days = getDaysFromTimeframe(timeframe);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's stats with deduplication
    const userStats = await ClaimRecord.aggregate([
      {
        $match: {
          eightBallPoolId,
          claimedAt: { $gte: startDate }
        }
      },
      {
        // Group by date to deduplicate same-day claims
        $group: {
          _id: {
            userId: '$eightBallPoolId',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$claimedAt' } }
          },
          totalClaims: { $sum: 1 },
          successfulClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          itemsClaimed: { $first: '$itemsClaimed' },
          lastClaimed: { $max: '$claimedAt' }
        }
      },
      {
        // Aggregate to user level
        $group: {
          _id: '$_id.userId',
          totalClaims: { $sum: 1 }, // Count unique days
          successfulClaims: { $sum: '$successfulClaims' },
          totalClaimsActual: { $sum: '$totalClaims' }, // Sum actual claim counts
          failedClaims: { $sum: { $subtract: ['$totalClaims', '$successfulClaims'] } },
          totalItemsClaimed: { $sum: { $size: '$itemsClaimed' } },
          lastClaimed: { $max: '$lastClaimed' }
        }
      }
    ]);

    if (userStats.length === 0) {
      res.status(404).json({
        error: 'No claims found for this user in the specified timeframe'
      });
      return;
    }

    const userStat = userStats[0];
    
    // Get user's rank with deduplication
    const usersWithMoreItems = await ClaimRecord.aggregate([
      {
        $match: {
          claimedAt: { $gte: startDate }
        }
      },
      {
        // Group by user AND date to deduplicate
        $group: {
          _id: {
            userId: '$eightBallPoolId',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$claimedAt' } }
          },
          itemsClaimed: { $first: '$itemsClaimed' }
        }
      },
      {
        // Group by user
        $group: {
          _id: '$_id.userId',
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
      failedClaims: userStat.failedClaims || 0,
      totalItemsClaimed: userStat.totalItemsClaimed,
      successRate: userStat.totalClaimsActual > 0 
        ? Math.round((userStat.successfulClaims / userStat.totalClaimsActual) * 100) 
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

    // Get overall statistics with deduplication
    const stats = await ClaimRecord.aggregate([
      {
        $match: {
          claimedAt: { $gte: startDate }
        }
      },
      {
        // Group by user AND date to deduplicate
        $group: {
          _id: {
            userId: '$eightBallPoolId',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$claimedAt' } }
          },
          totalClaims: { $sum: 1 },
          successfulClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          itemsClaimed: { $first: '$itemsClaimed' },
          userId: { $first: '$eightBallPoolId' }
        }
      },
      {
        // Group to overall stats
        $group: {
          _id: null,
          totalClaims: { $sum: 1 }, // Count unique user-days
          totalClaimsActual: { $sum: '$totalClaims' }, // Sum actual claim counts
          successfulClaims: { $sum: '$successfulClaims' },
          failedClaims: { $sum: { $subtract: ['$totalClaims', '$successfulClaims'] } },
          totalItemsClaimed: { $sum: { $size: '$itemsClaimed' } },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          _id: 0,
          totalClaims: 1,
          successfulClaims: 1,
          failedClaims: 1,
          totalItemsClaimed: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          successRate: {
            $cond: [
              { $gt: ['$totalClaimsActual', 0] },
              { $multiply: [{ $divide: ['$successfulClaims', '$totalClaimsActual'] }, 100] },
              0
            ]
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalClaims: 0,
      successfulClaims: 0,
      failedClaims: 0,
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



