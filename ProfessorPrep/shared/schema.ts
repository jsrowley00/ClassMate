import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("student"), // "professor" or "student"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Courses table
export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  professorId: varchar("professor_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Course modules/chapters table (supports hierarchical structure)
export const courseModules = pgTable("course_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id, { onDelete: 'cascade' }),
  parentModuleId: varchar("parent_module_id").references((): any => courseModules.id, { onDelete: 'cascade' }), // For hierarchical modules (e.g., weeks under modules)
  name: text("name").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Course materials table (uploaded files)
export const courseMaterials = pgTable("course_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id, { onDelete: 'cascade' }),
  moduleId: varchar("module_id").references(() => courseModules.id, { onDelete: 'cascade' }),
  fileName: text("file_name").notNull(),
  fileType: varchar("file_type").notNull(), // "pdf", "docx", "image"
  fileUrl: text("file_url").notNull(),
  extractedText: text("extracted_text"), // Text content extracted from the file
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Course enrollments table
export const courseEnrollments = pgTable("course_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => users.id),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
});

// Practice tests table
export const practiceTests = pgTable("practice_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => users.id),
  testMode: varchar("test_mode").notNull(), // "multiple_choice", "short_answer", "fill_blank", "mixed"
  questions: jsonb("questions").notNull(), // Array of question objects
  answers: jsonb("answers"), // Student's answers
  score: integer("score"), // Percentage score
  completed: boolean("completed").default(false),
  selectedModuleIds: text("selected_module_ids").array(), // Module IDs that were selected for this test
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Chat sessions table
export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => users.id),
  title: text("title"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat messages table
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  role: varchar("role").notNull(), // "user" or "assistant"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Flashcard sets table
export const flashcardSets = pgTable("flashcard_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  selectedModuleIds: text("selected_module_ids").array(), // Module IDs selected for generation
  createdAt: timestamp("created_at").defaultNow(),
});

// Individual flashcards table
export const flashcards = pgTable("flashcards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  setId: varchar("set_id").notNull().references(() => flashcardSets.id, { onDelete: 'cascade' }),
  front: text("front").notNull(), // Question or term
  back: text("back").notNull(), // Answer or definition
  mastered: boolean("mastered").default(false), // Student progress tracking
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Learning objectives table - AI-generated objectives for each module
export const learningObjectives = pgTable("learning_objectives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").notNull().references(() => courseModules.id, { onDelete: 'cascade' }),
  objectives: text("objectives").array().notNull(), // Array of learning objective strings
  generatedAt: timestamp("generated_at").defaultNow(),
});

// Learning objective mastery tracking - tracks student progress on each objective
export const objectiveMastery = pgTable("objective_mastery", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: varchar("course_id").notNull().references(() => courses.id, { onDelete: 'cascade' }),
  moduleId: varchar("module_id").notNull().references(() => courseModules.id, { onDelete: 'cascade' }),
  objectiveIndex: integer("objective_index").notNull(), // Index in the objectives array
  objectiveText: text("objective_text").notNull(), // Snapshot of the objective text
  correctCount: integer("correct_count").notNull().default(0), // Times answered correctly
  totalCount: integer("total_count").notNull().default(0), // Total times encountered
  lastEncountered: timestamp("last_encountered").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations (must be defined after all tables)
export const usersRelations = relations(users, ({ many }) => ({
  coursesCreated: many(courses),
  enrollments: many(courseEnrollments),
  practiceTests: many(practiceTests),
  chatMessages: many(chatMessages),
  flashcardSets: many(flashcardSets),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  professor: one(users, {
    fields: [courses.professorId],
    references: [users.id],
  }),
  modules: many(courseModules),
  materials: many(courseMaterials),
  enrollments: many(courseEnrollments),
  practiceTests: many(practiceTests),
  chatSessions: many(chatSessions),
  flashcardSets: many(flashcardSets),
}));

export const courseModulesRelations = relations(courseModules, ({ one, many }) => ({
  course: one(courses, {
    fields: [courseModules.courseId],
    references: [courses.id],
  }),
  parentModule: one(courseModules, {
    fields: [courseModules.parentModuleId],
    references: [courseModules.id],
    relationName: "moduleHierarchy",
  }),
  childModules: many(courseModules, { relationName: "moduleHierarchy" }),
  materials: many(courseMaterials),
  learningObjectives: many(learningObjectives),
}));

export const courseMaterialsRelations = relations(courseMaterials, ({ one }) => ({
  course: one(courses, {
    fields: [courseMaterials.courseId],
    references: [courses.id],
  }),
  module: one(courseModules, {
    fields: [courseMaterials.moduleId],
    references: [courseModules.id],
  }),
}));

export const courseEnrollmentsRelations = relations(courseEnrollments, ({ one }) => ({
  course: one(courses, {
    fields: [courseEnrollments.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [courseEnrollments.studentId],
    references: [users.id],
  }),
}));

export const practiceTestsRelations = relations(practiceTests, ({ one }) => ({
  course: one(courses, {
    fields: [practiceTests.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [practiceTests.studentId],
    references: [users.id],
  }),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  course: one(courses, {
    fields: [chatSessions.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [chatSessions.studentId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

export const flashcardSetsRelations = relations(flashcardSets, ({ one, many }) => ({
  course: one(courses, {
    fields: [flashcardSets.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [flashcardSets.studentId],
    references: [users.id],
  }),
  flashcards: many(flashcards),
}));

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  set: one(flashcardSets, {
    fields: [flashcards.setId],
    references: [flashcardSets.id],
  }),
}));

export const learningObjectivesRelations = relations(learningObjectives, ({ one }) => ({
  module: one(courseModules, {
    fields: [learningObjectives.moduleId],
    references: [courseModules.id],
  }),
}));

export const objectiveMasteryRelations = relations(objectiveMastery, ({ one }) => ({
  student: one(users, {
    fields: [objectiveMastery.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [objectiveMastery.courseId],
    references: [courses.id],
  }),
  module: one(courseModules, {
    fields: [objectiveMastery.moduleId],
    references: [courseModules.id],
  }),
}));

// Zod schemas and types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof courses.$inferSelect;

export const insertCourseModuleSchema = createInsertSchema(courseModules).omit({
  id: true,
  createdAt: true,
});
export type InsertCourseModule = z.infer<typeof insertCourseModuleSchema>;
export type CourseModule = typeof courseModules.$inferSelect;

export const insertCourseMaterialSchema = createInsertSchema(courseMaterials).omit({
  id: true,
  uploadedAt: true,
});
export type InsertCourseMaterial = z.infer<typeof insertCourseMaterialSchema>;
export type CourseMaterial = typeof courseMaterials.$inferSelect;

export const insertCourseEnrollmentSchema = createInsertSchema(courseEnrollments).omit({
  id: true,
  enrolledAt: true,
});
export type InsertCourseEnrollment = z.infer<typeof insertCourseEnrollmentSchema>;
export type CourseEnrollment = typeof courseEnrollments.$inferSelect;

export const insertPracticeTestSchema = createInsertSchema(practiceTests).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertPracticeTest = z.infer<typeof insertPracticeTestSchema>;
export type PracticeTest = typeof practiceTests.$inferSelect;

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const insertFlashcardSetSchema = createInsertSchema(flashcardSets).omit({
  id: true,
  createdAt: true,
});
export type InsertFlashcardSet = z.infer<typeof insertFlashcardSetSchema>;
export type FlashcardSet = typeof flashcardSets.$inferSelect;

export const insertFlashcardSchema = createInsertSchema(flashcards).omit({
  id: true,
  createdAt: true,
});
export type InsertFlashcard = z.infer<typeof insertFlashcardSchema>;
export type Flashcard = typeof flashcards.$inferSelect;

export const generateFlashcardsRequestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  cardCount: z.number().int().min(5, "Minimum 5 cards").max(50, "Maximum 50 cards"),
  moduleIds: z.array(z.string()).optional(),
});
export type GenerateFlashcardsRequest = z.infer<typeof generateFlashcardsRequestSchema>;

export const insertLearningObjectiveSchema = createInsertSchema(learningObjectives).omit({
  id: true,
  generatedAt: true,
});
export type InsertLearningObjective = z.infer<typeof insertLearningObjectiveSchema>;
export type LearningObjective = typeof learningObjectives.$inferSelect;

export const insertObjectiveMasterySchema = createInsertSchema(objectiveMastery).omit({
  id: true,
  lastEncountered: true,
  updatedAt: true,
});
export type InsertObjectiveMastery = z.infer<typeof insertObjectiveMasterySchema>;
export type ObjectiveMastery = typeof objectiveMastery.$inferSelect;
