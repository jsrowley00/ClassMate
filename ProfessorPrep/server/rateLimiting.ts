import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

// Rate limiting for AI-powered features to prevent excessive API costs
// These limits are per authenticated user

// Helper to identify users by their authenticated ID
// Note: All AI endpoints require authentication, so user ID will always be present
const getUserKey = (req: Request): string => {
  const user = req.user as any;
  if (!user?.claims?.sub) {
    throw new Error('User ID not found - authentication required');
  }
  return user.claims.sub;
};

// Practice test generation - allow 15 tests per hour
// Reasoning: Each test uses ~1000-2000 tokens with GPT-4o-mini (~$0.01-0.02/test)
// 15 tests/hour = ~$0.30/hour max per user
export const practiceTestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,
  keyGenerator: getUserKey,
  handler: (req, res) => {
    res.status(429).json({
      message: "You've generated too many practice tests. Please try again in an hour.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI tutor chat - allow 50 messages per hour
// Reasoning: Each message uses ~500-1500 tokens with GPT-4o-mini (~$0.005-0.015/message)
// 50 messages/hour = ~$0.75/hour max per user
export const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  keyGenerator: getUserKey,
  handler: (req, res) => {
    res.status(429).json({
      message: "You've sent too many chat messages. Please try again in an hour.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Flashcard generation - allow 15 sets per hour
// Reasoning: Each set uses ~1000-2000 tokens with GPT-4o-mini (~$0.01-0.02/set)
// 15 sets/hour = ~$0.30/hour max per user
export const flashcardLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,
  keyGenerator: getUserKey,
  handler: (req, res) => {
    res.status(429).json({
      message: "You've generated too many flashcard sets. Please try again in an hour.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Learning objectives generation - allow 30 per hour (professors might batch process)
// Reasoning: Each generation uses ~500-1000 tokens with GPT-4o-mini (~$0.005-0.01/generation)
// 30 generations/hour = ~$0.30/hour max per professor
export const objectivesLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  keyGenerator: getUserKey,
  handler: (req, res) => {
    res.status(429).json({
      message: "You've generated too many learning objectives. Please try again in an hour.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});
