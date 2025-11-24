import {
  users,
  courses,
  courseModules,
  courseMaterials,
  courseEnrollments,
  practiceTests,
  chatSessions,
  chatMessages,
  flashcardSets,
  flashcards,
  learningObjectives,
  objectiveMastery,
  type User,
  type UpsertUser,
  type Course,
  type InsertCourse,
  type CourseModule,
  type InsertCourseModule,
  type CourseMaterial,
  type InsertCourseMaterial,
  type CourseEnrollment,
  type InsertCourseEnrollment,
  type PracticeTest,
  type InsertPracticeTest,
  type ChatSession,
  type InsertChatSession,
  type ChatMessage,
  type InsertChatMessage,
  type FlashcardSet,
  type InsertFlashcardSet,
  type Flashcard,
  type InsertFlashcard,
  type LearningObjective,
  type InsertLearningObjective,
  type ObjectiveMastery,
  type InsertObjectiveMastery,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Course operations
  getCourses(): Promise<Course[]>;
  getCoursesByProfessor(professorId: string): Promise<Course[]>;
  getCourse(id: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  deleteCourse(id: string): Promise<void>;

  // Module operations
  getCourseModules(courseId: string): Promise<CourseModule[]>;
  getCourseModule(id: string): Promise<CourseModule | undefined>;
  createCourseModule(module: InsertCourseModule): Promise<CourseModule>;
  updateCourseModule(id: string, data: Partial<CourseModule>): Promise<CourseModule>;
  deleteCourseModule(id: string): Promise<void>;
  getModuleAndDescendantIds(moduleIds: string[], courseId: string): Promise<string[]>;

  // Course material operations
  getCourseMaterials(courseId: string): Promise<CourseMaterial[]>;
  getCourseMaterial(id: string): Promise<CourseMaterial | undefined>;
  createCourseMaterial(material: InsertCourseMaterial): Promise<CourseMaterial>;
  updateCourseMaterial(id: string, data: Partial<CourseMaterial>): Promise<CourseMaterial>;
  deleteCourseMaterial(id: string): Promise<void>;

  // Enrollment operations
  getEnrolledCourses(studentId: string): Promise<Course[]>;
  getEnrolledStudents(courseId: string): Promise<User[]>;
  getAvailableCourses(studentId: string): Promise<Course[]>;
  isEnrolled(studentId: string, courseId: string): Promise<boolean>;
  enrollStudent(enrollment: InsertCourseEnrollment): Promise<CourseEnrollment>;
  unenrollStudent(studentId: string, courseId: string): Promise<void>;

  // Practice test operations
  getPracticeTests(studentId: string, courseId?: string): Promise<PracticeTest[]>;
  getCoursePracticeTests(courseId: string): Promise<Array<PracticeTest & { student: User }>>;
  createPracticeTest(test: InsertPracticeTest): Promise<PracticeTest>;
  getPracticeTest(id: string): Promise<PracticeTest | undefined>;
  updatePracticeTest(id: string, data: Partial<PracticeTest>): Promise<PracticeTest>;

  // Chat operations
  getChatSession(courseId: string, studentId: string): Promise<ChatSession | undefined>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Flashcard operations
  getFlashcardSets(studentId: string, courseId?: string): Promise<FlashcardSet[]>;
  getFlashcardSet(id: string): Promise<FlashcardSet | undefined>;
  createFlashcardSet(set: InsertFlashcardSet): Promise<FlashcardSet>;
  deleteFlashcardSet(id: string): Promise<void>;
  getFlashcards(setId: string): Promise<Flashcard[]>;
  createFlashcard(card: InsertFlashcard): Promise<Flashcard>;
  updateFlashcard(id: string, data: Partial<Flashcard>): Promise<Flashcard>;
  deleteFlashcard(id: string): Promise<void>;

  // Learning objectives operations
  getLearningObjectives(moduleId: string): Promise<LearningObjective | undefined>;
  getLearningObjectivesByCourse(courseId: string): Promise<LearningObjective[]>;
  createLearningObjectives(objectives: InsertLearningObjective): Promise<LearningObjective>;
  updateLearningObjectives(moduleId: string, objectives: string[]): Promise<LearningObjective>;
  deleteLearningObjectives(moduleId: string): Promise<void>;

  // Objective mastery operations
  updateObjectiveMastery(
    studentId: string,
    courseId: string,
    moduleId: string,
    objectiveIndex: number,
    objectiveText: string,
    wasCorrect: boolean
  ): Promise<void>;
  getStudentObjectiveMastery(studentId: string, courseId: string): Promise<ObjectiveMastery[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Course operations
  async getCourses(): Promise<Course[]> {
    return await db.select().from(courses).orderBy(desc(courses.createdAt));
  }

  async getCoursesByProfessor(professorId: string): Promise<Course[]> {
    return await db
      .select()
      .from(courses)
      .where(eq(courses.professorId, professorId))
      .orderBy(desc(courses.createdAt));
  }

  async getCourse(id: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course;
  }

  async createCourse(courseData: InsertCourse): Promise<Course> {
    const [course] = await db.insert(courses).values(courseData).returning();
    return course;
  }

  async deleteCourse(id: string): Promise<void> {
    await db.delete(courses).where(eq(courses.id, id));
  }

  // Module operations
  async getCourseModules(courseId: string): Promise<CourseModule[]> {
    return await db
      .select()
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId))
      .orderBy(courseModules.orderIndex);
  }

  async getCourseModule(id: string): Promise<CourseModule | undefined> {
    const [module] = await db
      .select()
      .from(courseModules)
      .where(eq(courseModules.id, id));
    return module;
  }

  async createCourseModule(moduleData: InsertCourseModule): Promise<CourseModule> {
    const [module] = await db.insert(courseModules).values(moduleData).returning();
    return module;
  }

  async updateCourseModule(id: string, data: Partial<CourseModule>): Promise<CourseModule> {
    const [module] = await db
      .update(courseModules)
      .set(data)
      .where(eq(courseModules.id, id))
      .returning();
    return module;
  }

  async deleteCourseModule(id: string): Promise<void> {
    await db.delete(courseModules).where(eq(courseModules.id, id));
  }

  // Get all descendant module IDs (including the module itself and all its children)
  async getModuleAndDescendantIds(moduleIds: string[], courseId: string): Promise<string[]> {
    const allModules = await this.getCourseModules(courseId);
    const result = new Set<string>(moduleIds);
    
    // For each selected module, find all its children recursively
    const findChildren = (parentId: string) => {
      const children = allModules.filter(m => m.parentModuleId === parentId);
      children.forEach(child => {
        result.add(child.id);
        findChildren(child.id); // Recursive call for nested children
      });
    };
    
    moduleIds.forEach(findChildren);
    return Array.from(result);
  }

  // Course material operations
  async getCourseMaterials(courseId: string): Promise<CourseMaterial[]> {
    return await db
      .select()
      .from(courseMaterials)
      .where(eq(courseMaterials.courseId, courseId))
      .orderBy(desc(courseMaterials.uploadedAt));
  }

  async getCourseMaterial(id: string): Promise<CourseMaterial | undefined> {
    const [material] = await db
      .select()
      .from(courseMaterials)
      .where(eq(courseMaterials.id, id));
    return material;
  }

  async createCourseMaterial(materialData: InsertCourseMaterial): Promise<CourseMaterial> {
    const [material] = await db.insert(courseMaterials).values(materialData).returning();
    return material;
  }

  async updateCourseMaterial(id: string, data: Partial<CourseMaterial>): Promise<CourseMaterial> {
    const [material] = await db
      .update(courseMaterials)
      .set(data)
      .where(eq(courseMaterials.id, id))
      .returning();
    return material;
  }

  async deleteCourseMaterial(id: string): Promise<void> {
    await db.delete(courseMaterials).where(eq(courseMaterials.id, id));
  }

  // Enrollment operations
  async getEnrolledCourses(studentId: string): Promise<Course[]> {
    const enrollments = await db
      .select({ course: courses })
      .from(courseEnrollments)
      .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
      .where(eq(courseEnrollments.studentId, studentId));
    return enrollments.map((e) => e.course);
  }

  async getEnrolledStudents(courseId: string): Promise<User[]> {
    const enrollments = await db
      .select({ user: users })
      .from(courseEnrollments)
      .innerJoin(users, eq(courseEnrollments.studentId, users.id))
      .where(eq(courseEnrollments.courseId, courseId));
    return enrollments.map((e) => e.user);
  }

  async getAvailableCourses(studentId: string): Promise<Course[]> {
    const allCourses = await db.select().from(courses);
    const enrolledCourses = await this.getEnrolledCourses(studentId);
    const enrolledIds = new Set(enrolledCourses.map((c) => c.id));
    return allCourses.filter((c) => !enrolledIds.has(c.id));
  }

  async isEnrolled(studentId: string, courseId: string): Promise<boolean> {
    const [enrollment] = await db
      .select()
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.studentId, studentId),
          eq(courseEnrollments.courseId, courseId)
        )
      );
    return !!enrollment;
  }

  async enrollStudent(enrollmentData: InsertCourseEnrollment): Promise<CourseEnrollment> {
    const [enrollment] = await db.insert(courseEnrollments).values(enrollmentData).returning();
    return enrollment;
  }

  async unenrollStudent(studentId: string, courseId: string): Promise<void> {
    await db
      .delete(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.studentId, studentId),
          eq(courseEnrollments.courseId, courseId)
        )
      );
  }

  // Practice test operations
  async getPracticeTests(studentId: string, courseId?: string): Promise<PracticeTest[]> {
    if (courseId) {
      return await db
        .select()
        .from(practiceTests)
        .where(
          and(
            eq(practiceTests.studentId, studentId),
            eq(practiceTests.courseId, courseId)
          )
        )
        .orderBy(desc(practiceTests.createdAt));
    }

    return await db
      .select()
      .from(practiceTests)
      .where(eq(practiceTests.studentId, studentId))
      .orderBy(desc(practiceTests.createdAt));
  }

  async getCoursePracticeTests(courseId: string): Promise<Array<PracticeTest & { student: User }>> {
    const results = await db
      .select({
        test: practiceTests,
        student: users,
      })
      .from(practiceTests)
      .innerJoin(users, eq(practiceTests.studentId, users.id))
      .where(eq(practiceTests.courseId, courseId))
      .orderBy(desc(practiceTests.createdAt));

    return results.map(r => ({
      ...r.test,
      student: r.student,
    }));
  }

  async createPracticeTest(testData: InsertPracticeTest): Promise<PracticeTest> {
    const [test] = await db.insert(practiceTests).values(testData).returning();
    return test;
  }

  async getPracticeTest(id: string): Promise<PracticeTest | undefined> {
    const [test] = await db.select().from(practiceTests).where(eq(practiceTests.id, id));
    return test;
  }

  async updatePracticeTest(id: string, data: Partial<PracticeTest>): Promise<PracticeTest> {
    const [test] = await db
      .update(practiceTests)
      .set(data)
      .where(eq(practiceTests.id, id))
      .returning();
    return test;
  }

  // Chat operations
  async getChatSession(courseId: string, studentId: string): Promise<ChatSession | undefined> {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.courseId, courseId),
          eq(chatSessions.studentId, studentId)
        )
      );
    return session;
  }

  async createChatSession(sessionData: InsertChatSession): Promise<ChatSession> {
    const [session] = await db.insert(chatSessions).values(sessionData).returning();
    return session;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);
  }

  async createChatMessage(messageData: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values(messageData).returning();
    return message;
  }

  // Flashcard operations
  async getFlashcardSets(studentId: string, courseId?: string): Promise<FlashcardSet[]> {
    if (courseId) {
      return await db
        .select()
        .from(flashcardSets)
        .where(
          and(
            eq(flashcardSets.studentId, studentId),
            eq(flashcardSets.courseId, courseId)
          )
        )
        .orderBy(desc(flashcardSets.createdAt));
    }

    return await db
      .select()
      .from(flashcardSets)
      .where(eq(flashcardSets.studentId, studentId))
      .orderBy(desc(flashcardSets.createdAt));
  }

  async getFlashcardSet(id: string): Promise<FlashcardSet | undefined> {
    const [set] = await db.select().from(flashcardSets).where(eq(flashcardSets.id, id));
    return set;
  }

  async createFlashcardSet(setData: InsertFlashcardSet): Promise<FlashcardSet> {
    const [set] = await db.insert(flashcardSets).values(setData).returning();
    return set;
  }

  async deleteFlashcardSet(id: string): Promise<void> {
    await db.delete(flashcardSets).where(eq(flashcardSets.id, id));
  }

  async getFlashcards(setId: string): Promise<Flashcard[]> {
    return await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.setId, setId))
      .orderBy(flashcards.orderIndex);
  }

  async createFlashcard(cardData: InsertFlashcard): Promise<Flashcard> {
    const [card] = await db.insert(flashcards).values(cardData).returning();
    return card;
  }

  async updateFlashcard(id: string, data: Partial<Flashcard>): Promise<Flashcard> {
    const [card] = await db
      .update(flashcards)
      .set(data)
      .where(eq(flashcards.id, id))
      .returning();
    return card;
  }

  async deleteFlashcard(id: string): Promise<void> {
    await db.delete(flashcards).where(eq(flashcards.id, id));
  }

  // Learning objectives operations
  async getLearningObjectives(moduleId: string): Promise<LearningObjective | undefined> {
    const [objective] = await db
      .select()
      .from(learningObjectives)
      .where(eq(learningObjectives.moduleId, moduleId));
    return objective;
  }

  async getLearningObjectivesByCourse(courseId: string): Promise<LearningObjective[]> {
    const modules = await db
      .select()
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId));
    
    const moduleIds = modules.map(m => m.id);
    if (moduleIds.length === 0) return [];

    const objectives = await db
      .select()
      .from(learningObjectives)
      .where(eq(learningObjectives.moduleId, moduleIds[0]));
    
    // Get objectives for all modules
    const allObjectives: LearningObjective[] = [];
    for (const moduleId of moduleIds) {
      const [obj] = await db
        .select()
        .from(learningObjectives)
        .where(eq(learningObjectives.moduleId, moduleId));
      if (obj) allObjectives.push(obj);
    }
    
    return allObjectives;
  }

  async createLearningObjectives(objectivesData: InsertLearningObjective): Promise<LearningObjective> {
    const [objective] = await db
      .insert(learningObjectives)
      .values(objectivesData)
      .returning();
    return objective;
  }

  async updateLearningObjectives(moduleId: string, objectives: string[]): Promise<LearningObjective> {
    // First check if objectives exist for this module
    const existing = await this.getLearningObjectives(moduleId);
    
    if (existing) {
      // Update existing
      const [updated] = await db
        .update(learningObjectives)
        .set({ objectives, generatedAt: new Date() })
        .where(eq(learningObjectives.moduleId, moduleId))
        .returning();
      return updated;
    } else {
      // Create new
      return await this.createLearningObjectives({ moduleId, objectives });
    }
  }

  async deleteLearningObjectives(moduleId: string): Promise<void> {
    await db.delete(learningObjectives).where(eq(learningObjectives.moduleId, moduleId));
  }

  // Objective mastery operations
  async updateObjectiveMastery(
    studentId: string,
    courseId: string,
    moduleId: string,
    objectiveIndex: number,
    objectiveText: string,
    wasCorrect: boolean
  ): Promise<void> {
    // Check if a mastery record already exists for this student/objective
    const [existing] = await db
      .select()
      .from(objectiveMastery)
      .where(
        and(
          eq(objectiveMastery.studentId, studentId),
          eq(objectiveMastery.moduleId, moduleId),
          eq(objectiveMastery.objectiveIndex, objectiveIndex)
        )
      );

    if (existing) {
      // Update existing record
      await db
        .update(objectiveMastery)
        .set({
          correctCount: wasCorrect ? existing.correctCount + 1 : existing.correctCount,
          totalCount: existing.totalCount + 1,
          lastEncountered: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(objectiveMastery.id, existing.id));
    } else {
      // Create new record
      await db.insert(objectiveMastery).values({
        studentId,
        courseId,
        moduleId,
        objectiveIndex,
        objectiveText,
        correctCount: wasCorrect ? 1 : 0,
        totalCount: 1,
      });
    }
  }

  async getStudentObjectiveMastery(studentId: string, courseId: string): Promise<ObjectiveMastery[]> {
    return await db
      .select()
      .from(objectiveMastery)
      .where(
        and(
          eq(objectiveMastery.studentId, studentId),
          eq(objectiveMastery.courseId, courseId)
        )
      );
  }
}

export const storage = new DatabaseStorage();
