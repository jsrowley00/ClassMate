import type { Express, Request, Response } from "express";
import { db } from "./db";
import { users, courses, courseEnrollments, practiceTests, chatSessions, flashcardSets, aiUsageLogs } from "@shared/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { isAuthenticated } from "./clerkAuth";
import { storage } from "./storage";

const ADMIN_EMAILS = ["jsrowley00@gmail.com"];

function isAdmin(email: string | null | undefined): boolean {
  return email ? ADMIN_EMAILS.includes(email) : false;
}

export function registerAdminRoutes(app: Express) {
  app.get("/api/admin/users", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const currentUser = await storage.getUser(userId);
      if (!isAdmin(currentUser?.email)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        hasProfessorAccess: users.hasProfessorAccess,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionExpiresAt: users.subscriptionExpiresAt,
        stripeCustomerId: users.stripeCustomerId,
        createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt));

      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/metrics", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const currentUser = await storage.getUser(userId);
      if (!isAdmin(currentUser?.email)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const [totalUsersResult] = await db.select({ count: count() }).from(users);
      
      const [activeSubscribersResult] = await db.select({ count: count() })
        .from(users)
        .where(eq(users.subscriptionStatus, 'active'));
      
      const [professorsResult] = await db.select({ count: count() })
        .from(users)
        .where(eq(users.role, 'professor'));
      
      const [studentsResult] = await db.select({ count: count() })
        .from(users)
        .where(eq(users.role, 'student'));
      
      const [coursesResult] = await db.select({ count: count() }).from(courses);
      
      const [practiceTestsResult] = await db.select({ count: count() }).from(practiceTests);
      
      const [chatSessionsResult] = await db.select({ count: count() }).from(chatSessions);
      
      const [flashcardSetsResult] = await db.select({ count: count() }).from(flashcardSets);

      const [totalAiCostResult] = await db.select({ 
        total: sql<number>`COALESCE(SUM(${aiUsageLogs.estimatedCostCents}), 0)` 
      }).from(aiUsageLogs);

      res.json({
        totalUsers: totalUsersResult?.count || 0,
        activeSubscribers: activeSubscribersResult?.count || 0,
        professors: professorsResult?.count || 0,
        students: studentsResult?.count || 0,
        totalCourses: coursesResult?.count || 0,
        totalPracticeTests: practiceTestsResult?.count || 0,
        totalChatSessions: chatSessionsResult?.count || 0,
        totalFlashcardSets: flashcardSetsResult?.count || 0,
        totalAiCostCents: totalAiCostResult?.total || 0,
      });
    } catch (error) {
      console.error("Error fetching admin metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  app.get("/api/admin/ai-usage", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const currentUser = await storage.getUser(userId);
      if (!isAdmin(currentUser?.email)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const usageByUser = await db.select({
        userId: aiUsageLogs.userId,
        userEmail: users.email,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        totalInputTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.inputTokens}), 0)`,
        totalOutputTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.outputTokens}), 0)`,
        totalCostCents: sql<number>`COALESCE(SUM(${aiUsageLogs.estimatedCostCents}), 0)`,
        callCount: count(),
      })
        .from(aiUsageLogs)
        .leftJoin(users, eq(aiUsageLogs.userId, users.id))
        .groupBy(aiUsageLogs.userId, users.email, users.firstName, users.lastName)
        .orderBy(desc(sql`SUM(${aiUsageLogs.estimatedCostCents})`));

      const usageByEndpoint = await db.select({
        endpoint: aiUsageLogs.endpoint,
        totalInputTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.inputTokens}), 0)`,
        totalOutputTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.outputTokens}), 0)`,
        totalCostCents: sql<number>`COALESCE(SUM(${aiUsageLogs.estimatedCostCents}), 0)`,
        callCount: count(),
      })
        .from(aiUsageLogs)
        .groupBy(aiUsageLogs.endpoint)
        .orderBy(desc(sql`SUM(${aiUsageLogs.estimatedCostCents})`));

      const recentLogs = await db.select({
        id: aiUsageLogs.id,
        userId: aiUsageLogs.userId,
        userEmail: users.email,
        endpoint: aiUsageLogs.endpoint,
        inputTokens: aiUsageLogs.inputTokens,
        outputTokens: aiUsageLogs.outputTokens,
        estimatedCostCents: aiUsageLogs.estimatedCostCents,
        createdAt: aiUsageLogs.createdAt,
      })
        .from(aiUsageLogs)
        .leftJoin(users, eq(aiUsageLogs.userId, users.id))
        .orderBy(desc(aiUsageLogs.createdAt))
        .limit(100);

      res.json({
        byUser: usageByUser,
        byEndpoint: usageByEndpoint,
        recentLogs,
      });
    } catch (error) {
      console.error("Error fetching AI usage:", error);
      res.status(500).json({ message: "Failed to fetch AI usage" });
    }
  });

  app.get("/api/admin/check", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ isAdmin: false });
      }

      const currentUser = await storage.getUser(userId);
      res.json({ isAdmin: isAdmin(currentUser?.email) });
    } catch (error) {
      res.status(500).json({ isAdmin: false });
    }
  });

  app.get("/api/admin/users/:userId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const adminUserId = (req as any).user?.claims?.sub;
      if (!adminUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const currentUser = await storage.getUser(adminUserId);
      if (!isAdmin(currentUser?.email)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const targetUserId = req.params.userId;

      const [targetUser] = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        hasProfessorAccess: users.hasProfessorAccess,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionExpiresAt: users.subscriptionExpiresAt,
        stripeCustomerId: users.stripeCustomerId,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, targetUserId));

      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const userAiUsage = await db.select({
        endpoint: aiUsageLogs.endpoint,
        totalInputTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.inputTokens}), 0)`,
        totalOutputTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.outputTokens}), 0)`,
        totalCostCents: sql<number>`COALESCE(SUM(${aiUsageLogs.estimatedCostCents}), 0)`,
        callCount: count(),
      })
        .from(aiUsageLogs)
        .where(eq(aiUsageLogs.userId, targetUserId))
        .groupBy(aiUsageLogs.endpoint)
        .orderBy(desc(sql`SUM(${aiUsageLogs.estimatedCostCents})`));

      const [totalAiUsage] = await db.select({
        totalInputTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.inputTokens}), 0)`,
        totalOutputTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.outputTokens}), 0)`,
        totalCostCents: sql<number>`COALESCE(SUM(${aiUsageLogs.estimatedCostCents}), 0)`,
        callCount: count(),
      })
        .from(aiUsageLogs)
        .where(eq(aiUsageLogs.userId, targetUserId));

      const userFlashcardSets = await db.select({
        id: flashcardSets.id,
        title: flashcardSets.title,
        courseId: flashcardSets.courseId,
        courseName: courses.name,
        createdAt: flashcardSets.createdAt,
      })
        .from(flashcardSets)
        .leftJoin(courses, eq(flashcardSets.courseId, courses.id))
        .where(eq(flashcardSets.studentId, targetUserId))
        .orderBy(desc(flashcardSets.createdAt));

      const userPracticeTests = await db.select({
        id: practiceTests.id,
        courseId: practiceTests.courseId,
        courseName: courses.name,
        score: practiceTests.score,
        questions: practiceTests.questions,
        completed: practiceTests.completed,
        createdAt: practiceTests.createdAt,
      })
        .from(practiceTests)
        .leftJoin(courses, eq(practiceTests.courseId, courses.id))
        .where(eq(practiceTests.studentId, targetUserId))
        .orderBy(desc(practiceTests.createdAt));

      const userChatSessions = await db.select({
        id: chatSessions.id,
        title: chatSessions.title,
        sessionType: chatSessions.sessionType,
        courseId: chatSessions.courseId,
        courseName: courses.name,
        createdAt: chatSessions.createdAt,
      })
        .from(chatSessions)
        .leftJoin(courses, eq(chatSessions.courseId, courses.id))
        .where(eq(chatSessions.studentId, targetUserId))
        .orderBy(desc(chatSessions.createdAt));

      const enrolledCourses = await db.select({
        courseId: courseEnrollments.courseId,
        courseName: courses.name,
        courseType: courses.courseType,
        enrolledAt: courseEnrollments.enrolledAt,
      })
        .from(courseEnrollments)
        .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
        .where(eq(courseEnrollments.studentId, targetUserId))
        .orderBy(desc(courseEnrollments.enrolledAt));

      const ownedCourses = await db.select({
        id: courses.id,
        name: courses.name,
        courseType: courses.courseType,
        createdAt: courses.createdAt,
      })
        .from(courses)
        .where(eq(courses.ownerId, targetUserId))
        .orderBy(desc(courses.createdAt));

      res.json({
        user: targetUser,
        aiUsage: {
          byEndpoint: userAiUsage,
          totals: totalAiUsage || { totalInputTokens: 0, totalOutputTokens: 0, totalCostCents: 0, callCount: 0 },
        },
        flashcardSets: userFlashcardSets,
        practiceTests: userPracticeTests,
        chatSessions: userChatSessions,
        enrolledCourses,
        ownedCourses,
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(500).json({ message: "Failed to fetch user details" });
    }
  });
}
