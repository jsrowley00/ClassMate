import type { PracticeAttempt, ShortAnswerEvaluation } from "@shared/schema";

export type MasteryStatus = "developing" | "approaching" | "mastered";

export interface MasteryResult {
  status: MasteryStatus;
  explanation: string;
  recommendation: string;
  streakCount: number;
  distinctFormatsCorrect: string[];
  hasRecentMajorMistake: boolean;
  reasoningQualitySatisfied: boolean;
}

export async function evaluateObjectiveMastery(
  attempts: Array<PracticeAttempt & { evaluation?: ShortAnswerEvaluation }>
): Promise<MasteryResult> {
  if (attempts.length === 0) {
    return {
      status: "developing",
      explanation: "No attempts recorded yet. Start practicing to track your progress.",
      recommendation: "Take a practice test to begin demonstrating your understanding.",
      streakCount: 0,
      distinctFormatsCorrect: [],
      hasRecentMajorMistake: false,
      reasoningQualitySatisfied: true,
    };
  }

  const correctAttempts = attempts.filter(a => a.wasCorrect);
  const correctCount = correctAttempts.length;

  const distinctFormatsCorrect = Array.from(new Set(
    correctAttempts.map(a => a.questionFormat)
  ));

  let currentStreak = 0;
  for (let i = 0; i < attempts.length; i++) {
    if (attempts[i].wasCorrect) {
      currentStreak++;
    } else {
      break;
    }
  }

  const lastTwoAttempts = attempts.slice(0, 2);
  const hasMajorMistakeInRecentAttempts = lastTwoAttempts.some(attempt => {
    if (attempt.questionFormat === 'short_answer' && attempt.evaluation) {
      return attempt.evaluation.hasMajorMistake;
    }
    return !attempt.wasCorrect;
  });

  const hasLowReasoningQuality = attempts.some(attempt => {
    if (attempt.questionFormat === 'short_answer' && attempt.evaluation && attempt.wasCorrect) {
      return attempt.evaluation.reasoningQualityScore === 0;
    }
    return false;
  });

  if (
    correctCount >= 3 &&
    distinctFormatsCorrect.length >= 2 &&
    !hasMajorMistakeInRecentAttempts &&
    !hasLowReasoningQuality
  ) {
    return {
      status: "mastered",
      explanation: `You have demonstrated mastery with ${correctCount} correct demonstrations across ${distinctFormatsCorrect.length} different question formats. Your answers show consistent understanding with strong reasoning quality and no major conceptual mistakes in recent attempts.`,
      recommendation: "Excellent work! Continue practicing other objectives or challenge yourself with more advanced topics.",
      streakCount: currentStreak,
      distinctFormatsCorrect,
      hasRecentMajorMistake: false,
      reasoningQualitySatisfied: true,
    };
  }

  if (
    correctCount >= 2 &&
    (distinctFormatsCorrect.length >= 1 || correctCount >= 3) &&
    !hasMajorMistakeInRecentAttempts
  ) {
    return {
      status: "approaching",
      explanation: `You're making progress with ${correctCount} correct answer${correctCount > 1 ? 's' : ''} so far. ${
        distinctFormatsCorrect.length < 2
          ? `Try practicing with different question types to demonstrate deeper understanding.`
          : `Your understanding is improving but needs more consistency.`
      }`,
      recommendation: distinctFormatsCorrect.length < 2
        ? "Practice with different question formats (multiple choice, short answer, fill-in-blank) to show versatile understanding."
        : "Keep practicing to build consistency. Aim for a few more correct answers to demonstrate mastery.",
      streakCount: currentStreak,
      distinctFormatsCorrect,
      hasRecentMajorMistake: false,
      reasoningQualitySatisfied: !hasLowReasoningQuality,
    };
  }

  const hasAnyCorrect = correctCount > 0;
  const hasRecentMistakes = hasMajorMistakeInRecentAttempts;

  return {
    status: "developing",
    explanation: hasAnyCorrect
      ? `You have ${correctCount} correct answer${correctCount > 1 ? 's' : ''} but ${
          hasRecentMistakes
            ? 'your recent attempts show conceptual mistakes that need attention.'
            : 'need more consistent correct demonstrations to show mastery.'
        }`
      : "No correct answers yet. Keep practicing and learning from the material.",
    recommendation: hasRecentMistakes
      ? "Review the course materials carefully and focus on understanding key concepts rather than memorization."
      : "Take more practice tests and use the AI tutor if you need help understanding specific topics.",
    streakCount: currentStreak,
    distinctFormatsCorrect,
    hasRecentMajorMistake: hasRecentMistakes,
    reasoningQualitySatisfied: !hasLowReasoningQuality,
  };
}
