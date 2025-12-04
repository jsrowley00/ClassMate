import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import multer from "multer";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./clerkAuth";
import { generatePracticeTest, generateTutorResponse, categorizeQuestionsIntoTopics, evaluateShortAnswer, generateGlobalTutorResponse } from "./openai";
import { insertCourseSchema, updateCourseSchema, insertCourseModuleSchema, insertCourseEnrollmentSchema, generateFlashcardsRequestSchema } from "@shared/schema";
import { practiceTestLimiter, chatLimiter, flashcardLimiter, objectivesLimiter } from "./rateLimiting";
import mammoth from "mammoth";
import officeParser from "officeparser";
import tmp from "tmp";
import { writeFile, unlink } from "fs/promises";
import { sendCourseInvitationEmail } from "./email";
import { registerAdminRoutes } from "./adminRoutes";
import type { User } from "@shared/schema";

// Demo account IDs that bypass subscription requirements (for testing purposes)
const DEMO_ACCOUNT_IDS = ["49754447"]; // Jackson Rowley
const ADMIN_EMAILS = ["jsrowley00@gmail.com"]; // Admin emails that bypass subscription

// Helper function to check if a user has an active student subscription
function hasActiveStudentSubscription(user: User): boolean {
  // Admin emails always have access
  if (user.email && ADMIN_EMAILS.includes(user.email)) {
    return true;
  }
  
  // Demo accounts always have access
  if (DEMO_ACCOUNT_IDS.includes(user.id)) {
    return true;
  }
  
  // Check subscription status and expiration
  if (user.subscriptionStatus !== 'active') {
    return false;
  }
  
  if (!user.subscriptionExpiresAt) {
    return false;
  }
  
  const expiresAt = new Date(user.subscriptionExpiresAt);
  return expiresAt > new Date();
}

// Token storage for preview URLs (in production, use Redis or similar)
const previewTokens = new Map<string, { materialId: string; expiresAt: number }>();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(previewTokens.entries());
  for (const [token, data] of entries) {
    if (data.expiresAt < now) {
      previewTokens.delete(token);
    }
  }
}, 60000); // Clean up every minute

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Helper function to automatically generate learning objectives for a module
async function autoGenerateLearningObjectives(moduleId: string): Promise<void> {
  try {
    // Get the module
    const module = await storage.getCourseModule(moduleId);
    if (!module) {
      console.log(`Module ${moduleId} not found for auto-generating objectives`);
      return;
    }

    // Get materials for this module and its children
    const descendantIds = await storage.getModuleAndDescendantIds([moduleId], module.courseId);
    const allMaterials = await storage.getCourseMaterials(module.courseId);
    const moduleMaterials = allMaterials.filter(m => 
      m.moduleId && descendantIds.includes(m.moduleId)
    );

    // Only generate if there are materials with text
    if (moduleMaterials.length === 0) {
      console.log(`No materials found for module ${module.name} yet, skipping auto-generation`);
      return;
    }

    const materialTexts = moduleMaterials
      .filter(m => m.extractedText)
      .map(m => m.extractedText)
      .join('\n\n');

    if (!materialTexts) {
      console.log(`No text content available for module ${module.name} yet, skipping auto-generation`);
      return;
    }

    // Generate learning objectives using OpenAI
    const { generateLearningObjectives } = await import('./openai');
    const objectives = await generateLearningObjectives(
      module.name,
      module.description || '',
      materialTexts.substring(0, 3000)
    );

    // Save the learning objectives
    await storage.updateLearningObjectives(moduleId, objectives);
    console.log(`Auto-generated ${objectives.length} learning objectives for module ${module.name}`);
  } catch (error) {
    console.error(`Error auto-generating learning objectives for module ${moduleId}:`, error);
    // Don't throw - we don't want to break the main flow if objective generation fails
  }
}

// Middleware to check if student has valid active access (not expired)
async function checkStudentAccess(req: any, res: any, next: any) {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Professors always have access
    if (user.role === 'professor') {
      return next();
    }

    // Admin emails bypass subscription checks
    if (user.email && ADMIN_EMAILS.includes(user.email)) {
      return next();
    }

    // Demo accounts bypass subscription checks
    if (DEMO_ACCOUNT_IDS.includes(userId)) {
      return next();
    }

    // Check if student has active access that hasn't expired
    if (user.subscriptionStatus !== 'active') {
      return res.status(403).json({ 
        message: "Your access has not been activated. Please complete payment.",
        accessExpired: false,
        requiresPayment: true
      });
    }

    if (!user.subscriptionExpiresAt) {
      return res.status(403).json({ 
        message: "Your access period is not set. Please contact support.",
        accessExpired: true
      });
    }

    const expiresAt = new Date(user.subscriptionExpiresAt);
    if (expiresAt <= new Date()) {
      return res.status(403).json({ 
        message: "Your 4 months has ended. You can view past materials, or resubscribe to be added to new materials or courses.",
        accessExpired: true,
        expiresAt: user.subscriptionExpiresAt
      });
    }

    // Access is valid
    next();
  } catch (error) {
    console.error("Error checking student access:", error);
    return res.status(500).json({ message: "Failed to verify access" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Admin routes
  registerAdminRoutes(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/auth/set-role', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role } = req.body;

      if (!role || !["professor", "student"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const existingUser = await storage.getUser(userId);
      const isAdminEmail = existingUser?.email && ADMIN_EMAILS.includes(existingUser.email);
      
      if (role === "student" && !DEMO_ACCOUNT_IDS.includes(userId) && !isAdminEmail) {
        // Check if user has an active subscription to switch to student
        if (!existingUser?.subscriptionStatus || existingUser.subscriptionStatus !== 'active') {
          return res.status(403).json({ 
            message: "Students must subscribe to access ClassMate. Please complete the payment process.",
            requiresPayment: true
          });
        }
      }

      if (role === "professor" && !DEMO_ACCOUNT_IDS.includes(userId) && !isAdminEmail) {
        // Allow first-time role selection (no role yet) OR users who already have professor access
        // Only block if they have a role AND don't have professor access (trying to switch back without permission)
        if (existingUser?.role && !existingUser?.hasProfessorAccess) {
          return res.status(403).json({ 
            message: "You don't have professor access. Please sign up as a professor first."
          });
        }
      }

      // If setting professor role, also grant professor access permanently
      const updateData: any = { id: userId, role };
      if (role === "professor") {
        updateData.hasProfessorAccess = true;
      }

      const user = await storage.upsertUser(updateData);

      res.json(user);
    } catch (error) {
      console.error("Error setting role:", error);
      res.status(500).json({ message: "Failed to set role" });
    }
  });

  // Become a professor (grant professor access without switching role)
  app.post('/api/auth/become-professor', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const user = await storage.upsertUser({
        id: userId,
        hasProfessorAccess: true,
      });

      res.json(user);
    } catch (error) {
      console.error("Error becoming professor:", error);
      res.status(500).json({ message: "Failed to enable professor access" });
    }
  });

  // Mark onboarding as complete
  app.post('/api/auth/complete-onboarding', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role } = req.body;

      if (!role || !["professor", "student"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const updateData: any = { id: userId };
      if (role === "student") {
        updateData.hasSeenStudentOnboarding = true;
      } else {
        updateData.hasSeenProfessorOnboarding = true;
      }

      const user = await storage.upsertUser(updateData);
      res.json(user);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Course routes
  app.get('/api/courses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (user?.role === "professor") {
        const courses = await storage.getCoursesByProfessor(userId);
        res.json(courses);
      } else {
        const courses = await storage.getCourses();
        res.json(courses);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get('/api/courses/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const course = await storage.getCourse(id);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      res.json(course);
    } catch (error) {
      console.error("Error fetching course:", error);
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  app.post('/api/courses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (user?.role !== "professor") {
        return res.status(403).json({ message: "Only professors can create courses" });
      }

      const validated = insertCourseSchema.parse({
        ...req.body,
        professorId: userId,
        ownerId: userId,
        courseType: "professor",
      });

      const course = await storage.createCourse(validated);
      res.status(201).json(course);
    } catch (error: any) {
      console.error("Error creating course:", error);
      res.status(400).json({ message: error.message || "Failed to create course" });
    }
  });

  app.patch('/api/courses/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const course = await storage.getCourse(id);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.ownerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to update this course" });
      }

      const validated = updateCourseSchema.parse(req.body);
      
      // Reject empty payloads - require at least one field to update
      if (Object.keys(validated).length === 0) {
        return res.status(400).json({ message: "At least one field must be provided to update" });
      }

      const updatedCourse = await storage.updateCourse(id, validated);
      res.json(updatedCourse);
    } catch (error: any) {
      console.error("Error updating course:", error);
      res.status(400).json({ message: error.message || "Failed to update course" });
    }
  });

  app.delete('/api/courses/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const course = await storage.getCourse(id);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.ownerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to delete this course" });
      }

      await storage.deleteCourse(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting course:", error);
      res.status(500).json({ message: "Failed to delete course" });
    }
  });

  // Migrate/reprocess existing materials to extract text
  app.post('/api/courses/:id/materials/reprocess', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const course = await storage.getCourse(id);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.ownerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to reprocess materials" });
      }

      const materials = await storage.getCourseMaterials(id);
      let processed = 0;
      let errors = 0;
      const affectedModuleIds = new Set<string>();

      for (const material of materials) {
        // Skip if already has extracted text
        if (material.extractedText && material.extractedText.length > 10) {
          continue;
        }

        try {
          // Skip if using object storage (no base64 data to process)
          if (material.storageKey && !material.fileUrl) {
            console.log(`Skipping ${material.fileName}: using object storage`);
            continue;
          }
          
          // Decode base64 data URL
          const base64Match = material.fileUrl?.match(/^data:([^;]+);base64,(.+)$/);
          if (!base64Match) {
            console.log(`Skipping ${material.fileName}: not a base64 data URL`);
            continue;
          }

          const fileBuffer = Buffer.from(base64Match[2], 'base64');
          let extractedText = "";

          if (material.fileType === "pdf") {
            const { PDFParse } = await import("pdf-parse");
            const parser = new PDFParse({ data: fileBuffer });
            const result = await parser.getText();
            extractedText = result.text || "";
            await parser.destroy();
          } else if (material.fileType === "docx") {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            extractedText = result.value || "";
          } else if (material.fileType === "pptx") {
            const tmpFile = tmp.fileSync({ postfix: '.pptx' });
            try {
              await writeFile(tmpFile.name, fileBuffer);
              const text = await officeParser.parseOfficeAsync(tmpFile.name);
              extractedText = text || "";
            } finally {
              tmpFile.removeCallback();
            }
          }

          if (extractedText) {
            await storage.updateCourseMaterial(material.id, { extractedText });
            processed++;
            console.log(`Extracted ${extractedText.length} chars from ${material.fileName}`);
            // Track affected modules for objective regeneration
            if (material.moduleId) {
              affectedModuleIds.add(material.moduleId);
            }
          }
        } catch (error) {
          console.error(`Error processing ${material.fileName}:`, error);
          errors++;
        }
      }

      // Auto-generate learning objectives for affected modules
      for (const moduleId of Array.from(affectedModuleIds)) {
        setImmediate(() => autoGenerateLearningObjectives(moduleId));
      }

      res.json({ 
        message: `Reprocessed ${processed} materials with ${errors} errors`,
        processed,
        errors,
        total: materials.length 
      });
    } catch (error: any) {
      console.error("Error reprocessing materials:", error);
      res.status(500).json({ message: error.message || "Failed to reprocess materials" });
    }
  });

  // Module routes
  app.get('/api/courses/:id/modules', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const modules = await storage.getCourseModules(id);
      res.json(modules);
    } catch (error) {
      console.error("Error fetching modules:", error);
      res.status(500).json({ message: "Failed to fetch modules" });
    }
  });

  app.post('/api/courses/:id/modules', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const course = await storage.getCourse(id);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.ownerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to create modules" });
      }

      const validated = insertCourseModuleSchema.parse({
        ...req.body,
        courseId: id,
      });

      const module = await storage.createCourseModule(validated);
      
      // Auto-generate learning objectives in background (after materials are uploaded)
      setImmediate(() => autoGenerateLearningObjectives(module.id));
      
      res.status(201).json(module);
    } catch (error: any) {
      console.error("Error creating module:", error);
      res.status(400).json({ message: error.message || "Failed to create module" });
    }
  });

  app.delete('/api/courses/:courseId/modules/:moduleId', isAuthenticated, async (req: any, res) => {
    try {
      const { courseId, moduleId } = req.params;
      const userId = req.user.claims.sub;
      const course = await storage.getCourse(courseId);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.ownerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to delete modules" });
      }

      await storage.deleteCourseModule(moduleId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting module:", error);
      res.status(500).json({ message: "Failed to delete module" });
    }
  });

  // Course materials routes
  app.get('/api/courses/:id/materials', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const course = await storage.getCourse(id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Check if user is owner (professor or self-study room creator) or enrolled student
      const isOwner = course.ownerId === userId;
      const isEnrolled = await storage.isEnrolled(userId, id);
      
      if (!isOwner && !isEnrolled) {
        return res.status(403).json({ message: "Access denied. You must be enrolled in this course or be the owner." });
      }

      const materials = await storage.getCourseMaterials(id);
      res.json(materials);
    } catch (error) {
      console.error("Error fetching materials:", error);
      res.status(500).json({ message: "Failed to fetch materials" });
    }
  });

  // Generate preview token for a material
  app.post('/api/materials/:id/preview-token', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const material = await storage.getCourseMaterial(id);
      
      if (!material) {
        return res.status(404).json({ message: "Material not found" });
      }

      // Check if user has access to this material's course
      const course = await storage.getCourse(material.courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      const userId = req.user.claims.sub;
      const isEnrolled = await storage.isEnrolled(userId, material.courseId);
      const isOwner = course.ownerId === userId;

      if (!isEnrolled && !isOwner) {
        return res.status(403).json({ message: "You don't have access to this material" });
      }

      // Generate token (valid for 5 minutes)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
      
      previewTokens.set(token, {
        materialId: id,
        expiresAt,
      });

      res.json({ token, expiresAt });
    } catch (error) {
      console.error("Error generating preview token:", error);
      res.status(500).json({ message: "Failed to generate preview token" });
    }
  });

  // Serve material file with token (no authentication required)
  app.get('/api/materials/preview/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const tokenData = previewTokens.get(token);

      if (!tokenData) {
        return res.status(404).json({ message: "Invalid or expired token" });
      }

      if (tokenData.expiresAt < Date.now()) {
        previewTokens.delete(token);
        return res.status(404).json({ message: "Token expired" });
      }

      const material = await storage.getCourseMaterial(tokenData.materialId);
      if (!material) {
        return res.status(404).json({ message: "Material not found" });
      }

      // Handle object storage materials
      if (material.storageKey) {
        const { objectStorageService } = await import('./objectStorage');
        res.setHeader('Content-Type', material.contentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${material.fileName}"`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');
        await objectStorageService.streamToResponse(material.storageKey, res);
        return;
      }

      // Handle legacy base64 data URL
      if (!material.fileUrl) {
        return res.status(400).json({ message: "No file data available" });
      }
      
      const base64Match = material.fileUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) {
        return res.status(400).json({ message: "Invalid file format" });
      }

      const mimeType = base64Match[1];
      const base64Data = base64Match[2];
      const fileBuffer = Buffer.from(base64Data, 'base64');

      // Set appropriate headers
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${material.fileName}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Access-Control-Allow-Origin', '*'); // Allow external viewers
      res.setHeader('Cache-Control', 'no-cache'); // Don't cache preview files
      
      res.send(fileBuffer);
    } catch (error) {
      console.error("Error serving preview file:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  app.post('/api/courses/:id/materials', isAuthenticated, upload.array('files', 10), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { moduleId } = req.body; // Optional moduleId from form data
      
      const course = await storage.getCourse(id);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Allow both professors (for professor courses) and owners (for self-study rooms)
      if (course.ownerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to upload materials to this course" });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const materials = [];
      for (const file of files) {
        let fileType = "other";
        if (file.mimetype === "application/pdf") {
          fileType = "pdf";
        } else if (file.mimetype.includes("word") || file.originalname.endsWith(".docx")) {
          fileType = "docx";
        } else if (file.mimetype.includes("presentation") || file.originalname.endsWith(".pptx") || file.originalname.endsWith(".ppt")) {
          fileType = "pptx";
        } else if (file.mimetype.startsWith("image/")) {
          fileType = "image";
        } else if (file.mimetype.startsWith("video/")) {
          fileType = "video";
        }

        // For now, store as base64 data URL
        const fileUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        
        // Extract text based on file type
        let extractedText = "";
        
        try {
          if (fileType === "pdf") {
            // Extract text from PDF using dynamic import
            const { PDFParse } = await import("pdf-parse");
            const parser = new PDFParse({ data: file.buffer });
            const result = await parser.getText();
            extractedText = result.text || "";
            await parser.destroy();
          } else if (fileType === "docx") {
            // Extract text from DOCX
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            extractedText = result.value || "";
          } else if (fileType === "pptx") {
            // Extract text from PPTX using temporary file
            const tmpFile = tmp.fileSync({ postfix: '.pptx' });
            try {
              await writeFile(tmpFile.name, file.buffer);
              const text = await officeParser.parseOfficeAsync(tmpFile.name);
              extractedText = text || "";
            } finally {
              tmpFile.removeCallback();
            }
          }
          // For images and videos, no text extraction needed
        } catch (extractError) {
          console.error(`Error extracting text from ${file.originalname}:`, extractError);
          // Continue with empty text if extraction fails
          extractedText = "";
        }

        const material = await storage.createCourseMaterial({
          courseId: id,
          moduleId: moduleId || null, // Assign to module if provided
          fileName: file.originalname,
          fileType,
          fileUrl,
          extractedText,
        });

        materials.push(material);
      }

      // Auto-generate learning objectives if materials were uploaded to a module
      if (moduleId) {
        setImmediate(() => autoGenerateLearningObjectives(moduleId));
      }

      res.status(201).json(materials);
    } catch (error: any) {
      console.error("Error uploading materials:", error);
      res.status(500).json({ message: error.message || "Failed to upload materials" });
    }
  });

  app.patch('/api/courses/:courseId/materials/:materialId', isAuthenticated, async (req: any, res) => {
    try {
      const { courseId, materialId } = req.params;
      const { moduleId } = req.body;
      const userId = req.user.claims.sub;
      
      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.ownerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to update materials" });
      }

      // Validate that the material belongs to this course
      const material = await storage.getCourseMaterial(materialId);
      if (!material) {
        return res.status(404).json({ message: "Material not found" });
      }
      if (material.courseId !== courseId) {
        return res.status(403).json({ message: "Material does not belong to this course" });
      }

      // Validate moduleId if provided (and not null)
      if (moduleId !== null && moduleId !== undefined && moduleId !== "") {
        const modules = await storage.getCourseModules(courseId);
        const moduleExists = modules.some(m => m.id === moduleId);
        if (!moduleExists) {
          return res.status(400).json({ message: "Invalid module ID" });
        }
      }

      // Normalize moduleId (convert empty string to null)
      const normalizedModuleId = (moduleId === "" || moduleId === null || moduleId === undefined) ? null : moduleId;
      await storage.updateCourseMaterial(materialId, { moduleId: normalizedModuleId });
      
      // Auto-generate learning objectives if material was moved to a module
      if (normalizedModuleId) {
        setImmediate(() => autoGenerateLearningObjectives(normalizedModuleId));
      }
      
      res.status(200).json({ message: "Material updated successfully" });
    } catch (error) {
      console.error("Error updating material:", error);
      res.status(500).json({ message: "Failed to update material" });
    }
  });

  app.delete('/api/courses/:courseId/materials/:materialId', isAuthenticated, async (req: any, res) => {
    try {
      const { courseId, materialId } = req.params;
      const userId = req.user.claims.sub;
      const course = await storage.getCourse(courseId);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.ownerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to delete materials" });
      }

      await storage.deleteCourseMaterial(materialId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting material:", error);
      res.status(500).json({ message: "Failed to delete material" });
    }
  });

  // Enrollment routes - Student
  app.get('/api/student/enrolled-courses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const courses = await storage.getEnrolledCourses(userId);
      res.json(courses);
    } catch (error) {
      console.error("Error fetching enrolled courses:", error);
      res.status(500).json({ message: "Failed to fetch enrolled courses" });
    }
  });

  // Self-study room routes - Student
  app.get('/api/student/self-study-rooms', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rooms = await storage.getSelfStudyRooms(userId);
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching self-study rooms:", error);
      res.status(500).json({ message: "Failed to fetch self-study rooms" });
    }
  });

  app.post('/api/student/self-study-rooms', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, description } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ message: "Room name is required" });
      }

      const room = await storage.createCourse({
        name: name.trim(),
        description: description?.trim() || null,
        courseType: "self-study",
        professorId: null,
        ownerId: userId,
        startDate: null,
        endDate: null,
      });

      res.status(201).json(room);
    } catch (error) {
      console.error("Error creating self-study room:", error);
      res.status(500).json({ message: "Failed to create self-study room" });
    }
  });

  app.get('/api/courses/available', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const courses = await storage.getAvailableCourses(userId);
      res.json(courses);
    } catch (error) {
      console.error("Error fetching available courses:", error);
      res.status(500).json({ message: "Failed to fetch available courses" });
    }
  });

  app.post('/api/courses/:id/enroll', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const course = await storage.getCourse(id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      const alreadyEnrolled = await storage.isEnrolled(userId, id);
      if (alreadyEnrolled) {
        return res.status(400).json({ message: "Already enrolled in this course" });
      }

      const enrollment = await storage.enrollStudent({
        courseId: id,
        studentId: userId,
      });

      res.status(201).json(enrollment);
    } catch (error: any) {
      console.error("Error enrolling in course:", error);
      res.status(400).json({ message: error.message || "Failed to enroll in course" });
    }
  });

  // Enrollment routes - Professor
  app.get('/api/courses/:id/students', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const course = await storage.getCourse(id);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.professorId !== userId) {
        return res.status(403).json({ message: "Only the course professor can view enrolled students" });
      }

      // Get enrolled students with their status
      const studentsWithStatus = await storage.getEnrolledStudentsWithStatus(id);
      
      // Also get pending invitations (users who haven't signed up yet)
      const invitations = await storage.getCourseInvitations(id);
      const pendingInvitations = invitations
        .filter(inv => inv.status === "pending")
        .map(inv => ({
          id: inv.id,
          email: inv.email,
          enrollmentStatus: "invited",
          invitedAt: inv.invitedAt,
          isInvitation: true,
        }));

      res.json({ students: studentsWithStatus, invitations: pendingInvitations });
    } catch (error) {
      console.error("Error fetching enrolled students:", error);
      res.status(500).json({ message: "Failed to fetch enrolled students" });
    }
  });

  app.post('/api/courses/:id/students', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { email } = req.body;
      const userId = req.user.claims.sub;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const course = await storage.getCourse(id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.professorId !== userId) {
        return res.status(403).json({ message: "Only the course professor can add students" });
      }

      // Get the professor's name for the invitation email
      const professor = await storage.getUser(userId);
      const professorName = professor?.firstName && professor?.lastName 
        ? `${professor.firstName} ${professor.lastName}` 
        : professor?.email || "Your Professor";

      // Check if user exists
      const student = await storage.getUserByEmail(email.toLowerCase());
      
      if (student) {
        // User exists - check if already enrolled
        const existingEnrollment = await storage.getEnrollment(student.id, id);
        if (existingEnrollment) {
          return res.status(400).json({ message: "User is already enrolled in this course" });
        }

        // Check if student has active subscription
        const hasSubscription = hasActiveStudentSubscription(student);
        const status = hasSubscription ? "enrolled" : "pending";

        await storage.enrollStudent({
          courseId: id,
          studentId: student.id,
          status,
        });

        if (!hasSubscription) {
          // Send invitation email to the student
          try {
            const signUpUrl = process.env.REPLIT_DEV_DOMAIN 
              ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
              : 'https://classmate.help';
            await sendCourseInvitationEmail(email, course.name, professorName, signUpUrl);
          } catch (emailError) {
            console.error("Failed to send invitation email:", emailError);
            // Continue even if email fails - enrollment is still created
          }
        }

        res.status(201).json({ 
          message: hasSubscription 
            ? "Student enrolled successfully" 
            : "Student added with pending status. Invitation email sent.",
          student: { ...student, enrollmentStatus: status },
          status,
        });
      } else {
        // User doesn't exist - check if already invited
        const existingInvitation = await storage.getCourseInvitation(id, email.toLowerCase());
        if (existingInvitation && existingInvitation.status === "pending") {
          return res.status(400).json({ message: "An invitation has already been sent to this email" });
        }

        // Create invitation for non-existent user
        await storage.createCourseInvitation({
          courseId: id,
          email: email.toLowerCase(),
          status: "pending",
        });

        // Send invitation email
        try {
          const signUpUrl = process.env.REPLIT_DEV_DOMAIN 
            ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
            : 'https://classmate.help';
          await sendCourseInvitationEmail(email, course.name, professorName, signUpUrl);
        } catch (emailError) {
          console.error("Failed to send invitation email:", emailError);
          // Continue even if email fails - invitation is still created
        }

        res.status(201).json({ 
          message: "Invitation sent to email. Student will be enrolled when they sign up and subscribe.",
          status: "invited",
          email: email.toLowerCase(),
        });
      }
    } catch (error: any) {
      console.error("Error adding student:", error);
      res.status(500).json({ message: error.message || "Failed to add student" });
    }
  });

  app.post('/api/courses/:id/enrollments/batch', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { emails } = req.body;
      const userId = req.user.claims.sub;

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: "No emails provided" });
      }

      const course = await storage.getCourse(id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.professorId !== userId) {
        return res.status(403).json({ message: "Only the course professor can add students" });
      }

      const professor = await storage.getUser(userId);
      const professorName = professor?.firstName && professor?.lastName 
        ? `${professor.firstName} ${professor.lastName}` 
        : professor?.email || "Your professor";

      const results = {
        enrolled: [] as string[],
        invited: [] as string[],
        skipped: [] as { email: string; reason: string }[],
      };

      for (const email of emails) {
        try {
          const normalizedEmail = email.toLowerCase().trim();
          
          const student = await storage.getUserByEmail(normalizedEmail);
          
          if (student) {
            const existingEnrollment = await storage.getEnrollment(student.id, id);
            if (existingEnrollment) {
              results.skipped.push({ email: normalizedEmail, reason: "Already enrolled" });
              continue;
            }

            const hasSubscription = student.subscriptionStatus === "active" ||
              (student.subscriptionExpiresAt && new Date(student.subscriptionExpiresAt) > new Date()) ||
              student.email === "jsrowley00@gmail.com";

            const status = hasSubscription ? "enrolled" : "pending";

            await storage.enrollStudent({
              studentId: student.id,
              courseId: id,
              status,
            });

            if (status === "enrolled") {
              results.enrolled.push(normalizedEmail);
            } else {
              results.invited.push(normalizedEmail);
            }
          } else {
            const existingInvitation = await storage.getCourseInvitation(id, normalizedEmail);
            if (existingInvitation && existingInvitation.status === "pending") {
              results.skipped.push({ email: normalizedEmail, reason: "Already invited" });
              continue;
            }

            await storage.createCourseInvitation({
              courseId: id,
              email: normalizedEmail,
              status: "pending",
            });

            try {
              const signUpUrl = process.env.REPLIT_DEV_DOMAIN 
                ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
                : 'https://classmate.help';
              await sendCourseInvitationEmail(normalizedEmail, course.name, professorName, signUpUrl);
            } catch (emailError) {
              console.error("Failed to send invitation email:", emailError);
            }

            results.invited.push(normalizedEmail);
          }
        } catch (err: any) {
          console.error(`Error processing email ${email}:`, err);
          results.skipped.push({ email, reason: err.message || "Processing error" });
        }
      }

      res.status(200).json({
        message: `Processed ${emails.length} email(s)`,
        enrolled: results.enrolled,
        invited: results.invited,
        skipped: results.skipped,
      });
    } catch (error: any) {
      console.error("Error batch adding students:", error);
      res.status(500).json({ message: error.message || "Failed to add students" });
    }
  });

  app.delete('/api/courses/:courseId/students/:studentId', isAuthenticated, async (req: any, res) => {
    try {
      const { courseId, studentId } = req.params;
      const userId = req.user.claims.sub;
      const course = await storage.getCourse(courseId);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.professorId !== userId) {
        return res.status(403).json({ message: "Only the course professor can remove students" });
      }

      await storage.unenrollStudent(studentId, courseId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing student:", error);
      res.status(500).json({ message: "Failed to remove student" });
    }
  });

  app.delete('/api/courses/:courseId/invitations/:invitationId', isAuthenticated, async (req: any, res) => {
    try {
      const { courseId, invitationId } = req.params;
      const userId = req.user.claims.sub;
      const course = await storage.getCourse(courseId);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.professorId !== userId) {
        return res.status(403).json({ message: "Only the course professor can remove invitations" });
      }

      const invitation = await storage.getCourseInvitationById(invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.courseId !== courseId) {
        return res.status(400).json({ message: "Invitation does not belong to this course" });
      }

      await storage.deleteCourseInvitation(invitationId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing invitation:", error);
      res.status(500).json({ message: "Failed to remove invitation" });
    }
  });

  // Practice test routes
  app.post('/api/courses/:id/practice/generate', isAuthenticated, checkStudentAccess, practiceTestLimiter, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { testMode, questionCount: rawQuestionCount, moduleIds } = req.body;
      const userId = req.user.claims.sub;

      // Validate and coerce questionCount
      const questionCount = parseInt(String(rawQuestionCount || 10));
      if (isNaN(questionCount) || questionCount < 5 || questionCount > 20) {
        return res.status(400).json({ 
          message: "Invalid question count. Please select between 5 and 20 questions." 
        });
      }

      const course = await storage.getCourse(id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Check if user is owner (professor or self-study room creator) or enrolled student
      const isOwner = course.ownerId === userId;
      const isEnrolled = await storage.isEnrolled(userId, id);
      
      if (!isOwner && !isEnrolled) {
        return res.status(403).json({ message: "Access denied. You must be enrolled in this course or be the owner to generate practice tests." });
      }

      const allMaterials = await storage.getCourseMaterials(id);
      if (allMaterials.length === 0) {
        return res.status(400).json({ message: "No study materials available for this course yet. Please wait for your professor to upload materials." });
      }

      // Get all course modules for validation and filtering
      const courseModules = await storage.getCourseModules(id);
      const validModuleIds = new Set(courseModules.map(m => m.id));

      // Validate and filter moduleIds if provided
      let expandedModuleIds: string[] = [];
      if (moduleIds && Array.isArray(moduleIds) && moduleIds.length > 0) {
        // Ensure all provided moduleIds belong to this course
        const invalidModules = moduleIds.filter((mid: string) => !validModuleIds.has(mid));
        if (invalidModules.length > 0) {
          return res.status(400).json({ 
            message: "Some selected modules do not belong to this course" 
          });
        }
        // Expand to include child modules using only validated IDs
        expandedModuleIds = await storage.getModuleAndDescendantIds(moduleIds, id);
      }
      
      const materials = expandedModuleIds && expandedModuleIds.length > 0
        ? allMaterials.filter(m => m.moduleId && expandedModuleIds.includes(m.moduleId))
        : allMaterials;

      if (materials.length === 0) {
        return res.status(400).json({ message: "No study materials found for the selected modules. Please select different modules or add materials to them." });
      }

      const combinedContent = materials
        .map(m => m.extractedText || "")
        .filter(text => text && text.length > 10)
        .join("\n\n")
        .substring(0, 30000);

      if (!combinedContent || combinedContent.length < 100) {
        return res.status(400).json({ message: "Not enough course content available to generate a meaningful practice test. The selected materials may not have text content." });
      }

      // Fetch learning objectives for selected modules (or all modules if none selected)
      let learningObjectives: string[] = [];
      const moduleIdsToFetch = expandedModuleIds.length > 0
        ? expandedModuleIds
        : courseModules.map(m => m.id);
      
      if (moduleIdsToFetch.length > 0) {
        const objectivesData = await Promise.all(
          moduleIdsToFetch.map((moduleId: string) => storage.getLearningObjectives(moduleId))
        );
        // Combine all objectives from all modules and deduplicate
        const allObjectives = objectivesData
          .filter(obj => obj !== null)
          .flatMap(obj => obj!.objectives);
        learningObjectives = Array.from(new Set(allObjectives));
      }

      const questions = await generatePracticeTest(combinedContent, testMode, questionCount, learningObjectives, userId);

      if (!questions || questions.length === 0) {
        return res.status(500).json({ message: "Failed to generate practice questions. Please try again." });
      }

      const practiceTest = await storage.createPracticeTest({
        courseId: id,
        studentId: userId,
        testMode,
        questions: questions as any,
        answers: null,
        score: null,
        completed: false,
        selectedModuleIds: moduleIds && Array.isArray(moduleIds) && moduleIds.length > 0 ? moduleIds : null,
      });

      res.status(201).json(practiceTest);
    } catch (error: any) {
      console.error("Error generating practice test:", error);
      res.status(500).json({ message: error.message || "Failed to generate practice test" });
    }
  });

  app.post('/api/practice-tests/:id/submit', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { answers } = req.body;
      const userId = req.user.claims.sub;

      const test = await storage.getPracticeTest(id);
      if (!test) {
        return res.status(404).json({ message: "Practice test not found" });
      }

      if (test.studentId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const questions = test.questions as any[];
      let correctCount = 0;

      // Get all modules for the course to determine module order
      const allModules = await storage.getCourseModules(test.courseId);

      // Get all learning objectives for the course to map objective indices
      const courseObjectives = await storage.getLearningObjectivesByCourse(test.courseId);
      
      // Create a map: moduleId -> objectives array
      const objectivesMap = new Map<string, { moduleId: string; objectives: string[] }>();
      courseObjectives.forEach(obj => {
        objectivesMap.set(obj.moduleId, { moduleId: obj.moduleId, objectives: obj.objectives });
      });

      // Track mastery for each question and log detailed attempts
      for (let idx = 0; idx < questions.length; idx++) {
        const question = questions[idx];
        const rawAnswer = answers[idx];
        const normalizedAnswer = (rawAnswer === null || rawAnswer === undefined) ? '' : String(rawAnswer);
        let wasCorrect = false;

        if (normalizedAnswer && question.correctAnswer) {
          if (normalizedAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim()) {
            correctCount++;
            wasCorrect = true;
          }
        }

        // Create detailed practice attempt record for each question
        const questionId = `${test.id}-q${idx}`;
        const questionFormat = question.type || test.testMode;
        
        const attempt = await storage.createPracticeAttempt({
          practiceTestId: test.id,
          studentId: userId,
          courseId: test.courseId,
          questionId,
          questionText: question.question || '',
          questionFormat,
          objectiveIndices: question.objectiveIndices || [],
          moduleIds: test.selectedModuleIds || [],
          studentAnswer: normalizedAnswer,
          correctAnswer: question.correctAnswer || '',
          wasCorrect,
        });

        // If this is a short answer question, evaluate reasoning quality
        if (questionFormat === 'short_answer') {
          try {
            const evaluation = await evaluateShortAnswer(
              question.question || '',
              question.correctAnswer || '',
              normalizedAnswer
            );
            
            await storage.createShortAnswerEvaluation({
              attemptId: attempt.id,
              reasoningQualityScore: evaluation.reasoningQualityScore,
              hasMajorMistake: evaluation.hasMajorMistake,
              evaluationNotes: evaluation.evaluationNotes,
            });
          } catch (evalError) {
            console.error('Error evaluating short answer:', evalError);
          }
        }

        // Update objective mastery if this question has objective tags
        // WATERFALL APPROACH: Only update the first non-mastered objective from selectedModuleIds
        if (question.objectiveIndices && Array.isArray(question.objectiveIndices) && test.selectedModuleIds && test.selectedModuleIds.length > 0) {
          // Build list of candidate (moduleId, objectiveIndex) pairs sorted by module order
          const candidatePairs: Array<{
            moduleId: string;
            objectiveIndex: number;
            objectiveText: string;
          }> = [];
          
          // Sort modules by their order in the course structure
          const sortedModuleIds = test.selectedModuleIds
            .map(moduleId => ({
              id: moduleId,
              order: allModules.findIndex(m => m.id === moduleId)
            }))
            .sort((a, b) => a.order - b.order)
            .map(m => m.id);
          
          // For each module (in order), check all objective indices from the question
          for (const moduleId of sortedModuleIds) {
            const moduleObjectives = objectivesMap.get(moduleId);
            if (!moduleObjectives) continue;
            
            for (const objectiveIndex of question.objectiveIndices) {
              // Check if this objective index is valid for this module
              if (objectiveIndex >= 0 && objectiveIndex < moduleObjectives.objectives.length) {
                candidatePairs.push({
                  moduleId,
                  objectiveIndex,
                  objectiveText: moduleObjectives.objectives[objectiveIndex],
                });
              }
            }
          }
          
          // Find the first non-mastered objective and update only that one
          let updated = false;
          for (const pair of candidatePairs) {
            const currentMastery = await storage.getObjectiveMastery(
              userId,
              pair.moduleId,
              pair.objectiveIndex
            );
            
            // Skip if already mastered
            if (currentMastery?.status === 'mastered') {
              continue;
            }
            
            // Update this objective and stop
            await storage.updateObjectiveMastery(
              userId,
              test.courseId,
              pair.moduleId,
              pair.objectiveIndex,
              pair.objectiveText,
              wasCorrect
            );
            updated = true;
            break;
          }
          
          // Fallback: if all are mastered, still update the first one
          if (!updated && candidatePairs.length > 0) {
            const first = candidatePairs[0];
            await storage.updateObjectiveMastery(
              userId,
              test.courseId,
              first.moduleId,
              first.objectiveIndex,
              first.objectiveText,
              wasCorrect
            );
          }
        }
      }

      const score = Math.round((correctCount / questions.length) * 100);

      const updatedTest = await storage.updatePracticeTest(id, {
        answers: answers as any,
        score,
        completed: true,
        completedAt: new Date(),
      });

      res.json(updatedTest);
    } catch (error) {
      console.error("Error submitting practice test:", error);
      res.status(500).json({ message: "Failed to submit practice test" });
    }
  });

  // Get student's learning objective mastery/progress for a course
  app.get('/api/courses/:id/student-progress', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      // Check if student is enrolled in the course
      const isEnrolled = await storage.isEnrolled(userId, id);
      if (!isEnrolled) {
        return res.status(403).json({ message: "Not enrolled in this course" });
      }

      // Get ALL modules for this course
      const allModules = await storage.getCourseModules(id);
      
      // Get canonical learning objectives for the entire course
      const courseObjectives = await storage.getLearningObjectivesByCourse(id);
      
      // Create a map: moduleId -> objectives array for quick lookup
      const objectivesMap = new Map<string, string[]>();
      courseObjectives.forEach(obj => {
        objectivesMap.set(obj.moduleId, obj.objectives);
      });
      
      // Get student's mastery data
      const masteryData = await storage.getStudentObjectiveMastery(userId, id);
      const { evaluateObjectiveMastery } = await import('./masteryRubric');
      
      // Create a map for quick lookup: moduleId-objectiveIndex -> full mastery data
      const masteryMap = new Map<string, typeof masteryData[0]>();
      masteryData.forEach(m => {
        const key = `${m.moduleId}-${m.objectiveIndex}`;
        masteryMap.set(key, m);
      });

      // Build response for ALL modules using canonical objectives
      const progress = await Promise.all(allModules.map(async (module) => {
        const moduleObjectives = objectivesMap.get(module.id);
        
        // Check if this module has objectives defined
        const hasObjectivesDefined = moduleObjectives !== undefined;
        
        if (!hasObjectivesDefined) {
          // Module has no objectives generated yet
          return {
            moduleId: module.id,
            objectivesDefined: false,
            objectives: [],
          };
        }
        
        // Map each objective with its mastery data
        const objectivesWithMastery = await Promise.all(moduleObjectives.map(async (objectiveText, index) => {
          const key = `${module.id}-${index}`;
          const mastery = masteryMap.get(key);
          
          // Get detailed mastery evaluation
          let status = 'developing';
          let explanation = 'No attempts recorded yet. Start practicing to track your progress.';
          let recommendation = 'Take a practice test to begin demonstrating your understanding.';
          
          if (mastery) {
            const attempts = await storage.getPracticeAttemptsForObjective(userId, module.id, index);
            const masteryResult = await evaluateObjectiveMastery(attempts);
            status = masteryResult.status;
            explanation = masteryResult.explanation;
            recommendation = masteryResult.recommendation;
          }
          
          // Always return objective data, even if no mastery exists yet
          return {
            moduleId: module.id,
            objectiveIndex: index,
            objectiveText,
            correctCount: mastery?.correctCount || 0,
            totalCount: mastery?.totalCount || 0,
            masteryPercentage: mastery && mastery.totalCount > 0 
              ? Math.round((mastery.correctCount / mastery.totalCount) * 100)
              : 0,
            lastEncountered: mastery?.lastEncountered || null,
            status,
            explanation,
            recommendation,
          };
        }));

        return {
          moduleId: module.id,
          objectivesDefined: true,
          objectives: objectivesWithMastery,
        };
      }));

      // Return ALL modules with their canonical objectives
      res.json({ progress });
    } catch (error) {
      console.error("Error getting student progress:", error);
      res.status(500).json({ message: "Failed to get student progress" });
    }
  });

  // Helper function to extract topics from question text
  function extractTopicFromQuestion(questionText: string): string {
    // Remove common question starters
    let topic = questionText
      .replace(/^(what|which|who|when|where|why|how|is|are|does|do|can|will|would|should)\s+/i, '')
      .replace(/\?$/, '');
    
    // Extract key phrases (first meaningful part before common separators)
    const parts = topic.split(/[,;:]/);
    topic = parts[0];
    
    // Limit to first 50 chars for readability
    if (topic.length > 50) {
      topic = topic.substring(0, 47) + '...';
    }
    
    return topic.trim() || 'General concept';
  }

  // Analytics routes
  app.get('/api/courses/:id/analytics/practice-tests', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const course = await storage.getCourse(id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Only professors can view analytics
      if (course.professorId !== userId) {
        return res.status(403).json({ message: "Only the course professor can view analytics" });
      }

      // Get all practice tests for this course with student info
      const allTests = await storage.getCoursePracticeTests(id);
      
      // Filter to completed tests only
      const completedTests = allTests.filter(t => t.completed && t.score !== null);

      if (completedTests.length === 0) {
        return res.json({
          summary: {
            totalTests: 0,
            averageScore: 0,
            participatingStudents: 0,
          },
          students: [],
          recentTests: [],
        });
      }

      // Calculate summary statistics
      const totalTests = completedTests.length;
      const totalScore = completedTests.reduce((sum, t) => sum + (t.score || 0), 0);
      const averageScore = Math.round(totalScore / totalTests);
      const uniqueStudents = new Set(completedTests.map(t => t.studentId));
      const participatingStudents = uniqueStudents.size;

      // Calculate per-student statistics
      const studentStats = new Map<string, { 
        studentId: string;
        student: any;
        totalTests: number; 
        totalScore: number; 
        averageScore: number;
        missedTopics: Map<string, number>; // topic -> count
      }>();

      for (const test of completedTests) {
        if (!studentStats.has(test.studentId)) {
          studentStats.set(test.studentId, {
            studentId: test.studentId,
            student: test.student,
            totalTests: 0,
            totalScore: 0,
            averageScore: 0,
            missedTopics: new Map(),
          });
        }

        const stats = studentStats.get(test.studentId)!;
        stats.totalTests++;
        stats.totalScore += test.score || 0;

        // Extract missed topics
        if (Array.isArray(test.questions) && test.answers) {
          const questions = test.questions as any[];
          const answersObj = test.answers as any;
          
          questions.forEach((q, idx) => {
            if (!q || !q.question || !q.correctAnswer) return;
            
            const studentAnswer = answersObj[idx];
            if (studentAnswer == null) return;
            
            const studentAnswerStr = String(studentAnswer).trim();
            const correctAnswerStr = String(q.correctAnswer).trim();
            
            if (studentAnswerStr && studentAnswerStr.toLowerCase() !== correctAnswerStr.toLowerCase()) {
              // Extract topic from question
              const topic = extractTopicFromQuestion(q.question);
              const currentCount = stats.missedTopics.get(topic) || 0;
              stats.missedTopics.set(topic, currentCount + 1);
            }
          });
        }
      }

      // Calculate average scores and identify struggling students
      const students = Array.from(studentStats.values()).map(stats => {
        stats.averageScore = Math.round(stats.totalScore / stats.totalTests);
        const studentName = stats.student.firstName && stats.student.lastName
          ? `${stats.student.firstName} ${stats.student.lastName}`
          : stats.student.email;
        
        // Sort topics by frequency
        const sortedTopicsWithCount = Array.from(stats.missedTopics.entries())
          .sort((a, b) => b[1] - a[1]) // Sort by count descending
          .map(([topic, count]) => ({ topic, count }));
        
        // Top 3 for summary
        const topMissedTopics = sortedTopicsWithCount.slice(0, 3).map(item => item.topic);
        
        return {
          studentId: stats.studentId,
          studentName: studentName || "Unknown",
          studentEmail: stats.student.email || "Unknown",
          totalTests: stats.totalTests,
          averageScore: stats.averageScore,
          isStruggling: stats.averageScore < 70,
          topMissedTopics: topMissedTopics,
          allMissedTopics: sortedTopicsWithCount, // All topics with counts for detailed view
        };
      }).sort((a, b) => a.averageScore - b.averageScore); // Sort by score (struggling first)

      // Get all modules for this course to map IDs to names
      const modules = await storage.getCourseModules(id);
      const moduleMap = new Map(modules.map(m => [m.id, m.name]));

      // Group recent activity by student
      const studentTestActivity = new Map<string, {
        studentId: string;
        studentName: string;
        studentEmail: string;
        totalTests: number;
        averageScore: number;
        tests: Array<{
          id: string;
          score: number;
          testMode: string;
          questionCount: number;
          completedAt: Date | null;
          moduleNames: string[];
        }>;
      }>();

      for (const test of completedTests) {
        const studentName = test.student.firstName && test.student.lastName
          ? `${test.student.firstName} ${test.student.lastName}`
          : test.student.email;

        if (!studentTestActivity.has(test.studentId)) {
          studentTestActivity.set(test.studentId, {
            studentId: test.studentId,
            studentName: studentName || "Unknown",
            studentEmail: test.student.email || "Unknown",
            totalTests: 0,
            averageScore: 0,
            tests: [],
          });
        }

        // Map module IDs to module names
        const moduleNames = test.selectedModuleIds && Array.isArray(test.selectedModuleIds)
          ? test.selectedModuleIds.map(id => moduleMap.get(id) || "Unknown Module").filter(Boolean)
          : [];

        const activity = studentTestActivity.get(test.studentId)!;
        activity.tests.push({
          id: test.id,
          score: test.score || 0,
          testMode: test.testMode,
          questionCount: Array.isArray(test.questions) ? test.questions.length : 0,
          completedAt: test.completedAt,
          moduleNames: moduleNames.length > 0 ? moduleNames : ["All Modules"],
        });
      }

      // Calculate averages and sort tests by date
      const recentActivity = Array.from(studentTestActivity.values()).map(activity => {
        const totalScore = activity.tests.reduce((sum, t) => sum + t.score, 0);
        activity.averageScore = Math.round(totalScore / activity.tests.length);
        activity.totalTests = activity.tests.length;
        // Sort tests by completion date (most recent first)
        activity.tests.sort((a, b) => {
          if (!a.completedAt || !b.completedAt) return 0;
          return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
        });
        return activity;
      }).sort((a, b) => b.totalTests - a.totalTests); // Sort by most active students first

      // Collect all missed questions for AI categorization
      const allMissedQuestions: Array<{
        questionText: string;
        studentName: string;
        studentEmail: string;
        studentId: string;
      }> = [];

      for (const test of completedTests) {
        const studentName = test.student.firstName && test.student.lastName
          ? `${test.student.firstName} ${test.student.lastName}`
          : test.student.email;

        if (Array.isArray(test.questions) && test.answers) {
          const questions = test.questions as any[];
          const answersObj = test.answers as any;
          
          questions.forEach((q, idx) => {
            if (!q || !q.question || !q.correctAnswer) return;
            
            const studentAnswer = answersObj[idx];
            if (studentAnswer == null) return;
            
            const studentAnswerStr = String(studentAnswer).trim();
            const correctAnswerStr = String(q.correctAnswer).trim();
            
            if (studentAnswerStr && studentAnswerStr.toLowerCase() !== correctAnswerStr.toLowerCase()) {
              allMissedQuestions.push({
                questionText: q.question,
                studentName: studentName || "Unknown",
                studentEmail: test.student.email || "Unknown",
                studentId: test.studentId,
              });
            }
          });
        }
      }

      // Use AI to categorize missed questions based on learning objectives or broad topics
      let topicsByMisses: Array<{
        category: string;
        description: string;
        totalMisses: number;
        questions: Array<{
          questionText: string;
          studentName: string;
          studentEmail: string;
          studentId: string;
        }>;
      }> = [];
      let usesLearningObjectives = false;

      if (allMissedQuestions.length > 0) {
        // Try to get learning objectives for all modules in this course
        const allLearningObjectives = await storage.getLearningObjectivesByCourse(id);
        const modules = await storage.getCourseModules(id);
        
        // Build learning objectives data with module names
        const learningObjectivesData = allLearningObjectives
          .map(lo => {
            const module = modules.find(m => m.id === lo.moduleId);
            if (!module || !lo.objectives || lo.objectives.length === 0) return null;
            return {
              moduleName: module.name,
              objectives: lo.objectives,
            };
          })
          .filter((item): item is { moduleName: string; objectives: string[] } => item !== null);

        let categorizedTopics;

        if (learningObjectivesData.length > 0) {
          // Use learning objectives to categorize missed questions
          const { matchQuestionsToLearningObjectives } = await import('./openai');
          try {
            categorizedTopics = await matchQuestionsToLearningObjectives(
              learningObjectivesData,
              allMissedQuestions
            );
            usesLearningObjectives = true;
          } catch (error) {
            console.error("Error matching questions to learning objectives, falling back to general categorization:", error);
            // Fall back to general categorization if learning objectives approach fails
            const materials = await storage.getCourseMaterials(id);
            const combinedContent = materials
              .map(m => m.extractedText || "")
              .filter(text => text && text.length > 10)
              .join("\n\n")
              .substring(0, 8000);

            const { categorizeQuestionsIntoTopics } = await import('./openai');
            categorizedTopics = await categorizeQuestionsIntoTopics(
              combinedContent || "General course content",
              allMissedQuestions
            );
            usesLearningObjectives = false;
          }
        } else {
          // No learning objectives available, use general categorization
          const materials = await storage.getCourseMaterials(id);
          const combinedContent = materials
            .map(m => m.extractedText || "")
            .filter(text => text && text.length > 10)
            .join("\n\n")
            .substring(0, 8000);

          const { categorizeQuestionsIntoTopics } = await import('./openai');
          categorizedTopics = await categorizeQuestionsIntoTopics(
            combinedContent || "General course content",
            allMissedQuestions
          );
          usesLearningObjectives = false;
        }

        // Convert to format expected by frontend
        topicsByMisses = categorizedTopics.map(topic => ({
          category: topic.category,
          description: topic.description,
          totalMisses: topic.questions.length,
          questions: topic.questions,
        })).sort((a, b) => b.totalMisses - a.totalMisses); // Sort by most missed
      }

      res.json({
        summary: {
          totalTests,
          averageScore,
          participatingStudents,
        },
        students,
        recentActivity,
        topicsByMisses,
        usesLearningObjectives, // Indicates whether topics represent learning objectives or generic categories
      });
    } catch (error: any) {
      console.error("Error fetching practice test analytics:", error);
      res.status(500).json({ message: error.message || "Failed to fetch analytics" });
    }
  });

  // Individual student analytics
  app.get('/api/courses/:courseId/students/:studentId/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const { courseId, studentId } = req.params;
      const userId = req.user.claims.sub;

      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Only professors can view student analytics
      if (course.professorId !== userId) {
        return res.status(403).json({ message: "Only the course professor can view student analytics" });
      }

      // Verify student is enrolled in the course
      const isEnrolled = await storage.isEnrolled(studentId, courseId);
      if (!isEnrolled) {
        return res.status(404).json({ message: "Student not enrolled in this course" });
      }

      // Get student info
      const student = await storage.getUser(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Get all practice tests for this student in this course
      const allTests = await storage.getPracticeTests(studentId, courseId);
      // Defensive filter to ensure we only include tests for this specific course
      const courseTests = allTests.filter(t => t.courseId === courseId);
      const completedTests = courseTests.filter(t => t.completed && t.score !== null);

      // Sort by completedAt descending to get most recent first
      const sortedTests = completedTests.sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return dateB - dateA;
      });

      // Calculate practice test statistics
      const practiceTestStats = {
        totalTests: completedTests.length,
        averageScore: completedTests.length > 0
          ? Math.round(completedTests.reduce((sum, t) => sum + (t.score || 0), 0) / completedTests.length)
          : 0,
        recentTests: sortedTests.slice(0, 5).map(test => ({
          id: test.id,
          testMode: test.testMode,
          score: test.score,
          completedAt: test.completedAt,
          questionCount: Array.isArray(test.questions) ? test.questions.length : 0,
        })),
      };

      // Get learning objectives progress
      const allModules = await storage.getCourseModules(courseId);
      const courseObjectives = await storage.getLearningObjectivesByCourse(courseId);
      
      // Create a map: moduleId -> objectives array
      const objectivesMap = new Map<string, string[]>();
      courseObjectives.forEach(obj => {
        objectivesMap.set(obj.moduleId, obj.objectives);
      });
      
      // Get student's mastery data
      const masteryData = await storage.getStudentObjectiveMastery(studentId, courseId);
      const { evaluateObjectiveMastery } = await import('./masteryRubric');
      
      // Create a map for quick lookup: moduleId-objectiveIndex -> mastery data
      const masteryMap = new Map<string, typeof masteryData[0]>();
      masteryData.forEach(m => {
        const key = `${m.moduleId}-${m.objectiveIndex}`;
        masteryMap.set(key, m);
      });

      // Build learning objectives progress
      const learningObjectivesProgress = await Promise.all(allModules.map(async (module) => {
        const moduleObjectives = objectivesMap.get(module.id);
        
        if (!moduleObjectives) {
          return {
            moduleId: module.id,
            moduleName: module.name,
            objectivesDefined: false,
            objectives: [],
          };
        }
        
        // Map each objective with its mastery data
        const objectivesWithMastery = await Promise.all(moduleObjectives.map(async (objectiveText, index) => {
          const key = `${module.id}-${index}`;
          const mastery = masteryMap.get(key);
          
          let status = 'not_started';
          let correctCount = 0;
          let totalAttempts = 0;
          
          if (mastery) {
            const attempts = await storage.getPracticeAttemptsForObjective(studentId, module.id, index);
            const evaluation = await evaluateObjectiveMastery(attempts);
            status = evaluation.status;
            correctCount = mastery.correctCount || 0;
            totalAttempts = mastery.totalCount || 0;
          }
          
          return {
            objectiveIndex: index,
            objectiveText,
            status,
            correctCount,
            totalAttempts,
          };
        }));
        
        return {
          moduleId: module.id,
          moduleName: module.name,
          objectivesDefined: true,
          objectives: objectivesWithMastery,
        };
      }));

      // Calculate summary stats for learning objectives
      const totalObjectives = learningObjectivesProgress.reduce((sum, module) => 
        sum + (module.objectivesDefined ? module.objectives.length : 0), 0
      );
      const masteredObjectives = learningObjectivesProgress.reduce((sum, module) => 
        sum + module.objectives.filter(obj => obj.status === 'mastered').length, 0
      );

      res.json({
        student: {
          id: student.id,
          email: student.email,
          firstName: student.firstName,
          lastName: student.lastName,
        },
        practiceTests: practiceTestStats,
        learningObjectives: {
          summary: {
            totalObjectives,
            masteredObjectives,
            masteryPercentage: totalObjectives > 0 
              ? Math.round((masteredObjectives / totalObjectives) * 100)
              : 0,
          },
          modules: learningObjectivesProgress,
        },
      });
    } catch (error: any) {
      console.error("Error fetching student analytics:", error);
      res.status(500).json({ message: error.message || "Failed to fetch student analytics" });
    }
  });

  // Chat routes
  app.get('/api/courses/:id/chat', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const course = await storage.getCourse(id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Check if user is owner (professor or self-study room creator) or enrolled student
      const isOwner = course.ownerId === userId;
      const isEnrolled = await storage.isEnrolled(userId, id);
      
      if (!isOwner && !isEnrolled) {
        return res.status(403).json({ message: "Access denied. You must be enrolled in this course or be the owner to use the AI tutor." });
      }

      const session = await storage.getChatSession(id, userId);
      if (!session) {
        // No existing session - return empty array (session will be created when user sends first message)
        return res.json([]);
      }

      const messages = await storage.getChatMessages(session.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  // POST creates new messages (and session if needed) - requires active access
  app.post('/api/courses/:id/chat', isAuthenticated, checkStudentAccess, chatLimiter, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const userId = req.user.claims.sub;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ message: "Message cannot be empty" });
      }

      const course = await storage.getCourse(id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Check if user is owner (professor or self-study room creator) or enrolled student
      const isOwner = course.ownerId === userId;
      const isEnrolled = await storage.isEnrolled(userId, id);
      
      if (!isOwner && !isEnrolled) {
        return res.status(403).json({ message: "Access denied. You must be enrolled in this course or be the owner to use the AI tutor." });
      }

      let session = await storage.getChatSession(id, userId);
      if (!session) {
        session = await storage.createChatSession({
          courseId: id,
          studentId: userId,
          title: "Chat Session",
        });
      }

      // Save user message
      await storage.createChatMessage({
        sessionId: session.id,
        senderId: userId,
        role: "user",
        content: message.trim(),
      });

      // Get course materials
      const materials = await storage.getCourseMaterials(id);
      const combinedContent = materials
        .map(m => m.extractedText || "")
        .filter(text => text && text.length > 10)
        .join("\n\n")
        .substring(0, 30000);

      if (!combinedContent || combinedContent.length < 100) {
        const fallbackResponse = "I don't have access to any course materials yet. Please ask your professor to upload study materials so I can help you better.";
        await storage.createChatMessage({
          sessionId: session.id,
          senderId: userId,
          role: "assistant",
          content: fallbackResponse,
        });
        return res.status(201).json({ success: true });
      }

      // Get conversation history (excluding the message we just saved)
      const previousMessages = await storage.getChatMessages(session.id);
      const conversationHistory = previousMessages
        .slice(0, -1)
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      // Get student's recent practice test results to identify areas where they need help
      const practiceTests = await storage.getPracticeTests(userId, id);
      const completedTests = practiceTests
        .filter(test => test.completed && test.score !== null)
        .sort((a, b) => {
          const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 3); // Get 3 most recent tests

      // Extract questions they got wrong from recent tests with timestamp ordering
      const missedQuestionsWithTimestamp: { 
        question: string; 
        studentAnswer: string; 
        correctAnswer: string;
        testDate: number;
      }[] = [];
      
      for (const test of completedTests) {
        // Validate that questions exists and is an array
        if (!Array.isArray(test.questions)) {
          continue;
        }

        // Validate that answers exists and is an object (stored as object with numeric keys, not array)
        const answersObj = test.answers as any;
        if (!answersObj || typeof answersObj !== 'object') {
          continue;
        }

        const questions = test.questions as any[];
        const testDate = test.completedAt ? new Date(test.completedAt).getTime() : 0;
        
        questions.forEach((q, idx) => {
          // Skip if question data is malformed
          if (!q || typeof q !== 'object' || !q.question) {
            return;
          }

          // Skip if correctAnswer is missing or empty (malformed question)
          const correctAnswer = q.correctAnswer;
          if (!correctAnswer || String(correctAnswer).trim() === "") {
            return;
          }

          // Get student answer from object using index as key
          const studentAnswerRaw = answersObj[idx];
          
          // Skip if answer is null/undefined (unanswered)
          if (studentAnswerRaw == null) {
            return;
          }

          // Normalize both answers: trim whitespace and convert to lowercase for comparison
          const studentAnswer = String(studentAnswerRaw).trim();
          const correctAnswerStr = String(correctAnswer).trim();
          
          // Skip empty student answers (unanswered questions)
          if (!studentAnswer) {
            return;
          }
          
          // Check if they got it wrong (case-insensitive, whitespace-normalized comparison)
          if (studentAnswer.toLowerCase() !== correctAnswerStr.toLowerCase()) {
            missedQuestionsWithTimestamp.push({
              question: q.question,
              studentAnswer: studentAnswer,
              correctAnswer: correctAnswerStr,
              testDate: testDate,
            });
          }
        });
      }

      // Sort by test date (most recent first) and limit to 5 most recent
      const recentMissedQuestions = missedQuestionsWithTimestamp
        .sort((a, b) => b.testDate - a.testDate)
        .slice(0, 5)
        .map(({ question, studentAnswer, correctAnswer }) => ({
          question,
          studentAnswer,
          correctAnswer,
        }));

      // Fetch all learning objectives for the course
      const allObjectives = await storage.getLearningObjectivesByCourse(id);
      const learningObjectives = allObjectives.flatMap(obj => obj.objectives);

      // Fetch student's mastery progress for all objectives
      const masteryRecords = await storage.getStudentObjectiveMastery(userId, id);
      
      // Sort by objectiveIndex to ensure waterfall ordering (earliest objectives first)
      const sortedMasteryRecords = masteryRecords.sort((a, b) => a.objectiveIndex - b.objectiveIndex);

      // Generate AI response with awareness of what the student struggled with AND their mastery progress
      const aiResponse = await generateTutorResponse(
        message.trim(), 
        combinedContent, 
        conversationHistory,
        recentMissedQuestions,
        learningObjectives,
        sortedMasteryRecords,
        userId
      );

      // Save AI message
      await storage.createChatMessage({
        sessionId: session.id,
        senderId: userId,
        role: "assistant",
        content: aiResponse,
      });

      res.status(201).json({ success: true });
    } catch (error: any) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ message: error.message || "Failed to send chat message. Please try again." });
    }
  });

  // Global tutor routes - cross-course AI guidance
  
  // Create a new global chat session
  app.post('/api/global-tutor/sessions/new', isAuthenticated, checkStudentAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const session = await storage.createChatSession({
        courseId: null,
        studentId: userId,
        sessionType: "global",
        title: `Chat ${new Date().toLocaleDateString()}`,
      });

      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating global chat session:", error);
      res.status(500).json({ message: "Failed to create chat session" });
    }
  });

  // Get all global chat sessions for the user
  app.get('/api/global-tutor/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getAllGlobalChatSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching global chat sessions:", error);
      res.status(500).json({ message: "Failed to fetch chat sessions" });
    }
  });

  app.get('/api/global-tutor/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.query;

      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      // Verify session belongs to user and is global
      const session = await storage.getChatSessionById(sessionId as string);
      if (!session || session.studentId !== userId || session.sessionType !== "global") {
        return res.status(404).json({ message: "Session not found" });
      }

      const messages = await storage.getChatMessages(session.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching global tutor messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post('/api/global-tutor/chat', isAuthenticated, checkStudentAccess, chatLimiter, async (req: any, res) => {
    try {
      const { message, sessionId } = req.body;
      const userId = req.user.claims.sub;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ message: "Message cannot be empty" });
      }

      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      // Verify session belongs to user and is global
      const session = await storage.getChatSessionById(sessionId);
      if (!session || session.studentId !== userId || session.sessionType !== "global") {
        return res.status(404).json({ message: "Session not found" });
      }

      // Get existing messages to check if this is the first user message
      const existingMessages = await storage.getChatMessages(session.id);
      const isFirstMessage = existingMessages.filter(m => m.role === "user").length === 0;

      // If first message, update session title with message preview
      if (isFirstMessage) {
        const titlePreview = message.trim().slice(0, 50) + (message.trim().length > 50 ? "..." : "");
        await storage.updateChatSession(session.id, { title: titlePreview });
      }

      // Save user message
      await storage.createChatMessage({
        sessionId: session.id,
        senderId: userId,
        role: "user",
        content: message.trim(),
      });

      // Fetch all enrolled courses
      const enrolledCourses = await storage.getEnrolledCourses(userId);
      
      if (enrolledCourses.length === 0) {
        const fallbackResponse = "You're not enrolled in any courses yet. Once you enroll in courses, I can help you prioritize which ones to focus on and track your mastery across all subjects!";
        await storage.createChatMessage({
          sessionId: session.id,
          senderId: userId,
          role: "assistant",
          content: fallbackResponse,
        });
        return res.status(201).json({ success: true });
      }

      // Fetch cross-course mastery data
      const crossCourseMastery = await Promise.all(
        enrolledCourses.map(async (course) => {
          const masteryRecords = await storage.getStudentObjectiveMastery(userId, course.id);
          const learningObjectives = await storage.getLearningObjectivesByCourse(course.id);
          
          // Calculate course-level stats
          const totalObjectives = masteryRecords.length;
          const mastered = masteryRecords.filter(m => m.status === 'mastered').length;
          const approaching = masteryRecords.filter(m => m.status === 'approaching').length;
          const developing = masteryRecords.filter(m => m.status === 'developing').length;
          
          return {
            courseId: course.id,
            courseName: course.name,
            courseDescription: course.description || '',
            totalObjectives,
            mastered,
            approaching,
            developing,
            masteryRecords: masteryRecords.sort((a, b) => a.objectiveIndex - b.objectiveIndex),
            learningObjectives,
          };
        })
      );

      // Get conversation history (excluding the message we just saved)
      const previousMessages = await storage.getChatMessages(session.id);
      const conversationHistory = previousMessages
        .slice(0, -1)
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      // Generate AI response with cross-course awareness
      const aiResponse = await generateGlobalTutorResponse(
        message.trim(),
        conversationHistory,
        crossCourseMastery,
        userId
      );

      // Save AI message
      await storage.createChatMessage({
        sessionId: session.id,
        senderId: userId,
        role: "assistant",
        content: aiResponse,
      });

      res.status(201).json({ success: true });
    } catch (error: any) {
      console.error("Error sending global tutor message:", error);
      res.status(500).json({ message: error.message || "Failed to send message. Please try again." });
    }
  });

  // Flashcard routes
  // Generate flashcards for a course
  app.post('/api/courses/:id/flashcards/generate', isAuthenticated, checkStudentAccess, flashcardLimiter, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      // Validate request body
      const validation = generateFlashcardsRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: validation.error.errors[0].message 
        });
      }

      const { title, cardCount, moduleIds } = validation.data;

      const course = await storage.getCourse(id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Check if user is owner (professor or self-study room creator) or enrolled student
      const isOwner = course.ownerId === userId;
      const isEnrolled = await storage.isEnrolled(userId, id);
      if (!isOwner && !isEnrolled) {
        return res.status(403).json({ message: "You must be enrolled in this course or be the owner to generate flashcards" });
      }

      // Get all course modules for validation and filtering
      const courseModules = await storage.getCourseModules(id);
      const validModuleIds = new Set(courseModules.map(m => m.id));

      // Validate and filter moduleIds if provided
      let expandedModuleIds: string[] = [];
      if (moduleIds && moduleIds.length > 0) {
        // Ensure all provided moduleIds belong to this course
        const invalidModules = moduleIds.filter((mid: string) => !validModuleIds.has(mid));
        if (invalidModules.length > 0) {
          return res.status(400).json({ 
            message: "Some selected modules do not belong to this course" 
          });
        }
        // Expand to include child modules using only validated IDs
        expandedModuleIds = await storage.getModuleAndDescendantIds(moduleIds, id);
      }

      // Get course materials and filter by modules if specified
      let materials = await storage.getCourseMaterials(id);
      if (expandedModuleIds.length > 0) {
        materials = materials.filter(m => m.moduleId && expandedModuleIds.includes(m.moduleId));
      }

      if (materials.length === 0) {
        return res.status(400).json({ 
          message: moduleIds && moduleIds.length > 0 
            ? "No materials found in selected modules" 
            : "No study materials available for this course" 
        });
      }

      const combinedContent = materials
        .map(m => m.extractedText || "")
        .filter(text => text && text.length > 10)
        .join("\n\n")
        .substring(0, 30000);

      if (!combinedContent || combinedContent.length < 100) {
        return res.status(400).json({ message: "Not enough text content in study materials to generate flashcards" });
      }

      // Fetch learning objectives for selected modules (or all modules if none selected)
      let learningObjectives: string[] = [];
      const moduleIdsToFetch = expandedModuleIds.length > 0
        ? expandedModuleIds
        : courseModules.map(m => m.id);
      
      if (moduleIdsToFetch.length > 0) {
        const objectivesData = await Promise.all(
          moduleIdsToFetch.map((moduleId: string) => storage.getLearningObjectives(moduleId))
        );
        // Combine all objectives from all modules and deduplicate
        const allObjectives = objectivesData
          .filter(obj => obj !== null)
          .flatMap(obj => obj!.objectives);
        learningObjectives = Array.from(new Set(allObjectives));
      }

      // Generate flashcards using AI
      const { generateFlashcards } = await import('./openai');
      const flashcardItems = await generateFlashcards(combinedContent, cardCount, learningObjectives, userId);

      if (!flashcardItems || flashcardItems.length === 0) {
        return res.status(500).json({ message: "Failed to generate flashcards. Please try again." });
      }

      // Validate flashcard content
      const validFlashcards = flashcardItems.filter(
        card => card.front && card.front.trim() && card.back && card.back.trim()
      );

      if (validFlashcards.length === 0) {
        return res.status(500).json({ message: "Generated flashcards were invalid. Please try again." });
      }

      // Create flashcard set
      const flashcardSet = await storage.createFlashcardSet({
        courseId: id,
        studentId: userId,
        title,
        selectedModuleIds: moduleIds && moduleIds.length > 0 ? moduleIds : null,
      });

      // Create individual flashcards
      for (let i = 0; i < validFlashcards.length; i++) {
        await storage.createFlashcard({
          setId: flashcardSet.id,
          front: validFlashcards[i].front.trim(),
          back: validFlashcards[i].back.trim(),
          mastered: false,
          orderIndex: i,
        });
      }

      res.status(201).json(flashcardSet);
    } catch (error: any) {
      console.error("Error generating flashcards:", error);
      res.status(500).json({ message: error.message || "Failed to generate flashcards. Please try again." });
    }
  });

  // Get all flashcard sets for a course
  app.get('/api/courses/:id/flashcards', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const course = await storage.getCourse(id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Check if user is owner (professor or self-study room creator) or enrolled student
      const isOwner = course.ownerId === userId;
      const isEnrolled = await storage.isEnrolled(userId, id);
      if (!isOwner && !isEnrolled) {
        return res.status(403).json({ message: "You must be enrolled in this course or be the owner to view flashcards" });
      }

      const flashcardSets = await storage.getFlashcardSets(userId, id);
      res.json(flashcardSets);
    } catch (error) {
      console.error("Error fetching flashcard sets:", error);
      res.status(500).json({ message: "Failed to fetch flashcard sets" });
    }
  });

  // Get flashcards in a set
  app.get('/api/flashcards/sets/:setId', isAuthenticated, async (req: any, res) => {
    try {
      const { setId } = req.params;
      const userId = req.user.claims.sub;

      const flashcardSet = await storage.getFlashcardSet(setId);
      if (!flashcardSet) {
        return res.status(404).json({ message: "Flashcard set not found" });
      }

      // Verify the set belongs to the user
      if (flashcardSet.studentId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const flashcards = await storage.getFlashcards(setId);
      res.json({ set: flashcardSet, flashcards });
    } catch (error) {
      console.error("Error fetching flashcards:", error);
      res.status(500).json({ message: "Failed to fetch flashcards" });
    }
  });

  // Update flashcard mastery status
  app.patch('/api/flashcards/:id/mastered', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { mastered } = req.body;
      const userId = req.user.claims.sub;

      // Get the flashcard and its set to verify ownership
      const flashcards = await storage.getFlashcards(id); // This will be empty if ID is wrong
      
      // We need to get the set first to verify ownership
      // Let's do a more direct approach - just update and handle errors
      const updatedCard = await storage.updateFlashcard(id, { mastered });
      
      res.json(updatedCard);
    } catch (error) {
      console.error("Error updating flashcard:", error);
      res.status(500).json({ message: "Failed to update flashcard" });
    }
  });

  // Delete a flashcard set
  app.delete('/api/flashcards/sets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const flashcardSet = await storage.getFlashcardSet(id);
      if (!flashcardSet) {
        return res.status(404).json({ message: "Flashcard set not found" });
      }

      // Verify the set belongs to the user
      if (flashcardSet.studentId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteFlashcardSet(id);
      res.json({ message: "Flashcard set deleted successfully" });
    } catch (error) {
      console.error("Error deleting flashcard set:", error);
      res.status(500).json({ message: "Failed to delete flashcard set" });
    }
  });

  // Update a flashcard set (rename)
  app.patch('/api/flashcards/sets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { title } = req.body;
      const userId = req.user.claims.sub;

      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ message: "Title is required" });
      }

      const flashcardSet = await storage.getFlashcardSet(id);
      if (!flashcardSet) {
        return res.status(404).json({ message: "Flashcard set not found" });
      }

      // Verify the set belongs to the user
      if (flashcardSet.studentId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedSet = await storage.updateFlashcardSet(id, { title: title.trim() });
      res.json(updatedSet);
    } catch (error) {
      console.error("Error updating flashcard set:", error);
      res.status(500).json({ message: "Failed to update flashcard set" });
    }
  });

  // Learning objectives routes
  // Auto-generate objectives for all modules in a course that have materials
  app.post('/api/courses/:id/learning-objectives/generate-all', isAuthenticated, objectivesLimiter, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const course = await storage.getCourse(id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      if (course.ownerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to generate learning objectives" });
      }
      
      // Get all modules and materials for this course
      const modules = await storage.getCourseModules(id);
      const materials = await storage.getCourseMaterials(id);
      
      let generated = 0;
      let skipped = 0;
      
      for (const module of modules) {
        // Check if module already has objectives
        const existingObjectives = await storage.getLearningObjectives(module.id);
        if (existingObjectives && existingObjectives.objectives.length > 0) {
          skipped++;
          continue;
        }
        
        // Check if module has materials with text
        const descendantIds = await storage.getModuleAndDescendantIds([module.id], id);
        const moduleMaterials = materials.filter(m => 
          m.moduleId && descendantIds.includes(m.moduleId) && m.extractedText
        );
        
        if (moduleMaterials.length === 0) {
          skipped++;
          continue;
        }
        
        // Generate objectives in background
        setImmediate(() => autoGenerateLearningObjectives(module.id));
        generated++;
      }
      
      res.json({ 
        message: `Generating objectives for ${generated} modules (${skipped} skipped)`,
        generated,
        skipped
      });
    } catch (error) {
      console.error("Error generating all learning objectives:", error);
      res.status(500).json({ message: "Failed to generate learning objectives" });
    }
  });

  // Generate learning objectives for a module
  app.post('/api/modules/:moduleId/learning-objectives/generate', isAuthenticated, objectivesLimiter, async (req: any, res) => {
    try {
      const { moduleId } = req.params;
      const userId = req.user.claims.sub;

      // Get the module using getCourseModule
      const module = await storage.getCourseModule(moduleId);
      if (!module) {
        return res.status(404).json({ message: "Module not found" });
      }

      // Get the course and verify professor access
      const course = await storage.getCourse(module.courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.ownerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to generate learning objectives" });
      }

      // Get materials for this module and its children
      const allModules = await storage.getCourseModules(module.courseId);
      const descendantIds = await storage.getModuleAndDescendantIds([moduleId], module.courseId);
      
      // Get all materials for the module and descendants
      const allMaterials = await storage.getCourseMaterials(module.courseId);
      const moduleMaterials = allMaterials.filter(m => 
        m.moduleId && descendantIds.includes(m.moduleId)
      );

      if (moduleMaterials.length === 0) {
        return res.status(400).json({ message: "No materials found for this module. Please upload materials first." });
      }

      // Extract text from materials
      const materialTexts = moduleMaterials
        .filter(m => m.extractedText)
        .map(m => m.extractedText)
        .join('\n\n');

      if (!materialTexts) {
        return res.status(400).json({ message: "No text content available. Please ensure materials have been processed." });
      }

      // Generate learning objectives using OpenAI
      const { generateLearningObjectives } = await import('./openai');
      
      const objectives = await generateLearningObjectives(
        module.name,
        module.description || '',
        materialTexts.substring(0, 3000)
      );

      // Save or update the learning objectives
      const savedObjectives = await storage.updateLearningObjectives(moduleId, objectives);
      
      res.json(savedObjectives);
    } catch (error) {
      console.error("Error generating learning objectives:", error);
      res.status(500).json({ message: "Failed to generate learning objectives" });
    }
  });

  // Get learning objectives for a module
  app.get('/api/modules/:moduleId/learning-objectives', isAuthenticated, async (req: any, res) => {
    try {
      const { moduleId } = req.params;
      const objectives = await storage.getLearningObjectives(moduleId);
      res.json(objectives || null);
    } catch (error) {
      console.error("Error fetching learning objectives:", error);
      res.status(500).json({ message: "Failed to fetch learning objectives" });
    }
  });

  // Get all learning objectives for a course
  app.get('/api/courses/:id/learning-objectives', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const objectives = await storage.getLearningObjectivesByCourse(id);
      res.json(objectives);
    } catch (error) {
      console.error("Error fetching course learning objectives:", error);
      res.status(500).json({ message: "Failed to fetch learning objectives" });
    }
  });

  // ============ STRIPE PAYMENT ROUTES ============
  
  // Get Stripe publishable key for frontend
  app.get('/api/stripe/config', async (req, res) => {
    try {
      const { getStripePublishableKey } = await import('./stripeClient');
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe config:", error);
      res.status(500).json({ message: "Failed to get Stripe configuration" });
    }
  });

  // Get available subscription products and prices
  app.get('/api/stripe/products', async (req, res) => {
    try {
      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();
      
      const products = await stripe.products.list({ active: true, limit: 20 });
      const prices = await stripe.prices.list({ active: true, limit: 100 });
      
      const productsWithPrices = products.data.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        metadata: product.metadata,
        prices: prices.data
          .filter(price => price.product === product.id)
          .map(price => ({
            id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            recurring: price.recurring,
            active: price.active,
            metadata: price.metadata,
          }))
      }));

      res.json({ products: productsWithPrices });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Create checkout session for student signup
  app.post('/api/stripe/create-checkout-session', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { priceId } = req.body;

      if (!priceId) {
        return res.status(400).json({ message: "Price ID is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { stripeService } = await import('./stripeService');
      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email || '', userId);
        await storage.upsertUser({
          id: userId,
          stripeCustomerId: customer.id,
        });
        customerId = customer.id;
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'payment',
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/checkout/cancel`,
        allow_promotion_codes: true,
        metadata: {
          userId: userId,
        },
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  // Verify checkout session and activate student access
  app.post('/api/stripe/verify-session', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      const { getUncachableStripeClient } = await import('./stripeClient');
      const { stripeService } = await import('./stripeService');
      const stripe = await getUncachableStripeClient();

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ message: "Payment not completed" });
      }

      if (session.metadata?.userId !== userId) {
        return res.status(403).json({ message: "Session does not belong to this user" });
      }

      const paymentId = session.payment_intent as string;
      
      // Get the duration from the session/product metadata
      const durationMonths = await stripeService.getDurationFromSession(sessionId);
      
      const user = await stripeService.activateStudentAccess(userId, paymentId, durationMonths);

      res.json({ 
        success: true, 
        paymentId,
        status: 'active',
        expiresAt: user.subscriptionExpiresAt
      });
    } catch (error: any) {
      console.error("Error verifying session:", error);
      res.status(500).json({ message: error.message || "Failed to verify session" });
    }
  });

  // Get current user's access status
  app.get('/api/stripe/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.stripePaymentId) {
        return res.json({ 
          subscription: null,
          status: null,
          expiresAt: null,
          isActive: false
        });
      }

      const isActive = user.subscriptionStatus === 'active' && 
        user.subscriptionExpiresAt && 
        new Date(user.subscriptionExpiresAt) > new Date();
      
      res.json({ 
        paymentId: user.stripePaymentId,
        status: user.subscriptionStatus,
        expiresAt: user.subscriptionExpiresAt,
        isActive
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // Create customer portal session for managing subscription
  app.post('/api/stripe/create-portal-session', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "No Stripe customer found" });
      }

      const { stripeService } = await import('./stripeService');
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        `${baseUrl}/student`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ message: error.message || "Failed to create portal session" });
    }
  });

  // ================== CANVAS INTEGRATION ROUTES ==================

  // Check Canvas connection status
  app.get('/api/canvas/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      res.json({
        isConfigured: true,
        isConnected: Boolean(user?.canvasAccessToken && user?.canvasUrl),
        canvasUrl: user?.canvasUrl || null,
      });
    } catch (error) {
      console.error("Error checking Canvas status:", error);
      res.status(500).json({ message: "Failed to check Canvas status" });
    }
  });

  // Connect Canvas with Personal Access Token
  app.post('/api/canvas/connect', isAuthenticated, async (req: any, res) => {
    try {
      const { canvasUrl, accessToken } = req.body;
      
      if (!canvasUrl) {
        return res.status(400).json({ message: "Canvas URL is required" });
      }
      if (!accessToken) {
        return res.status(400).json({ message: "Access token is required" });
      }

      // Validate the token before saving
      const { validateCanvasToken } = await import('./canvas');
      const validation = await validateCanvasToken(canvasUrl, accessToken);
      
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error || "Invalid Canvas credentials" });
      }

      // Encrypt and save the token
      const { encryptToken } = await import('./encryption');
      const userId = req.user.claims.sub;
      
      await storage.upsertUser({
        id: userId,
        canvasUrl: canvasUrl,
        canvasAccessToken: encryptToken(accessToken),
        canvasRefreshToken: null,
        canvasTokenExpiresAt: null,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error connecting Canvas:", error);
      res.status(500).json({ message: "Failed to connect to Canvas" });
    }
  });

  // Disconnect Canvas
  app.post('/api/canvas/disconnect', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      await storage.upsertUser({
        id: userId,
        canvasUrl: null,
        canvasAccessToken: null,
        canvasRefreshToken: null,
        canvasTokenExpiresAt: null,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting Canvas:", error);
      res.status(500).json({ message: "Failed to disconnect Canvas" });
    }
  });

  // Get Canvas courses
  app.get('/api/canvas/courses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.canvasAccessToken || !user?.canvasUrl) {
        return res.status(400).json({ message: "Canvas not connected" });
      }

      const { decryptToken } = await import('./encryption');
      const { getCanvasCourses } = await import('./canvas');
      const accessToken = decryptToken(user.canvasAccessToken);
      const courses = await getCanvasCourses(user.canvasUrl, accessToken);
      
      // Filter to only active courses where user is a teacher
      const activeCourses = courses.filter(c => c.workflow_state === 'available');
      
      res.json(activeCourses);
    } catch (error: any) {
      console.error("Error fetching Canvas courses:", error);
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        return res.status(401).json({ message: "Canvas session expired. Please reconnect." });
      }
      res.status(500).json({ message: "Failed to fetch Canvas courses" });
    }
  });

  // Get files for a Canvas course
  app.get('/api/canvas/courses/:courseId/files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { courseId } = req.params;

      if (!user?.canvasAccessToken || !user?.canvasUrl) {
        return res.status(400).json({ message: "Canvas not connected" });
      }

      const { decryptToken } = await import('./encryption');
      const { getCanvasCourseFiles, getCanvasModules, getCanvasModuleItems } = await import('./canvas');
      const accessToken = decryptToken(user.canvasAccessToken);
      
      // Get all files from the course
      const files = await getCanvasCourseFiles(user.canvasUrl, accessToken, parseInt(courseId));
      
      // Also get module structure for context
      const modules = await getCanvasModules(user.canvasUrl, accessToken, parseInt(courseId));
      
      // Get items for each module
      const modulesWithItems = await Promise.all(
        modules.map(async (module) => {
          try {
            const items = await getCanvasModuleItems(user.canvasUrl!, accessToken, parseInt(courseId), module.id);
            return { ...module, items };
          } catch {
            return { ...module, items: [] };
          }
        })
      );

      res.json({ files, modules: modulesWithItems });
    } catch (error: any) {
      console.error("Error fetching Canvas course files:", error);
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        return res.status(401).json({ message: "Canvas session expired. Please reconnect." });
      }
      res.status(500).json({ message: "Failed to fetch Canvas files" });
    }
  });

  // Get students for a Canvas course
  app.get('/api/canvas/courses/:courseId/students', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { courseId } = req.params;

      if (!user?.canvasAccessToken || !user?.canvasUrl) {
        return res.status(400).json({ message: "Canvas not connected" });
      }

      const { decryptToken } = await import('./encryption');
      const { getCanvasCourseStudents } = await import('./canvas');
      const accessToken = decryptToken(user.canvasAccessToken);
      
      const students = await getCanvasCourseStudents(user.canvasUrl, accessToken, parseInt(courseId));
      
      res.json(students);
    } catch (error: any) {
      console.error("Error fetching Canvas students:", error);
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        return res.status(401).json({ message: "Canvas session expired. Please reconnect." });
      }
      res.status(500).json({ message: "Failed to fetch Canvas students" });
    }
  });

  // Import module structure and files from Canvas to ClassMate
  // Supports selective import: only creates selected modules and imports selected files
  app.post('/api/canvas/import-structure', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { 
        canvasCourseId, 
        classmateCourseId, 
        selectedModuleIds,  // Array of Canvas module IDs to create
        selectedFileIds,    // Array of Canvas file content IDs to import
        fileCanvasModuleMapping  // Record<fileId, canvasModuleId> - which Canvas module each file belongs to
      } = req.body;

      if (!user?.canvasAccessToken || !user?.canvasUrl) {
        return res.status(400).json({ message: "Canvas not connected" });
      }

      if (!canvasCourseId || !classmateCourseId) {
        return res.status(400).json({ message: "Canvas course ID and ClassMate course ID are required" });
      }

      // At least modules or files must be selected
      const hasModules = selectedModuleIds && Array.isArray(selectedModuleIds) && selectedModuleIds.length > 0;
      const hasFiles = selectedFileIds && Array.isArray(selectedFileIds) && selectedFileIds.length > 0;
      
      if (!hasModules && !hasFiles) {
        return res.status(400).json({ message: "No modules or files selected" });
      }

      const { decryptToken } = await import('./encryption');
      const { getCanvasModules, downloadCanvasFile } = await import('./canvas');
      const accessToken = decryptToken(user.canvasAccessToken);
      
      // Get existing ClassMate modules to prevent duplicates
      const existingModules = await storage.getCourseModules(classmateCourseId);
      const existingModuleNames = new Set(existingModules.map(m => m.name.toLowerCase().trim()));
      
      // Get Canvas modules
      const canvasModules = await getCanvasModules(user.canvasUrl, accessToken, canvasCourseId);
      
      // Sort by position and filter to only selected modules
      const selectedModuleIdsSet = new Set(selectedModuleIds || []);
      const modulesToProcess = hasModules 
        ? canvasModules.filter(m => selectedModuleIdsSet.has(m.id)).sort((a, b) => a.position - b.position)
        : [];
      
      // Create mapping of Canvas module ID to ClassMate module ID
      const canvasToClassmateModuleMapping: Record<number, string> = {};
      let modulesCreated = 0;
      let modulesSkipped = 0;

      // Track modules created in this request to prevent duplicates within the same import
      const modulesCreatedInThisRequest: Record<string, string> = {}; // normalizedName -> classmateModuleId
      
      for (const canvasModule of modulesToProcess) {
        const normalizedName = canvasModule.name.toLowerCase().trim();
        
        // Check if a module with this name already exists (either pre-existing or created earlier in this request)
        if (existingModuleNames.has(normalizedName)) {
          // Find the existing module to get its ID
          const existingModule = existingModules.find(m => m.name.toLowerCase().trim() === normalizedName);
          const existingId = existingModule?.id || modulesCreatedInThisRequest[normalizedName];
          
          if (existingId) {
            canvasToClassmateModuleMapping[canvasModule.id] = existingId;
            modulesSkipped++;
          }
        } else {
          // Create a ClassMate module with the same name
          const classmateModule = await storage.createCourseModule({
            courseId: classmateCourseId,
            name: canvasModule.name,
            description: null,
            parentModuleId: null,
          });
          
          canvasToClassmateModuleMapping[canvasModule.id] = classmateModule.id;
          existingModuleNames.add(normalizedName);
          modulesCreatedInThisRequest[normalizedName] = classmateModule.id;
          modulesCreated++;
        }
      }

      // Now import the selected files (if any)
      const importedFiles: Array<{ filename: string; materialId: string; moduleId: string | null }> = [];
      const errors: Array<{ fileId: number; error: string }> = [];

      if (hasFiles) {
        for (const fileId of selectedFileIds) {
          try {
            // Download file from Canvas
            const { buffer, filename, contentType } = await downloadCanvasFile(
              user.canvasUrl,
              accessToken,
              fileId
            );

            // Determine file type
            const ext = filename.split('.').pop()?.toLowerCase();
            let fileType: string;
            if (ext === 'pdf') {
              fileType = 'pdf';
            } else if (['doc', 'docx'].includes(ext || '')) {
              fileType = 'document';
            } else if (['ppt', 'pptx'].includes(ext || '')) {
              fileType = 'presentation';
            } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
              fileType = 'image';
            } else if (['mp4', 'webm', 'mov'].includes(ext || '')) {
              fileType = 'video';
            } else {
              fileType = 'other';
            }

            // Extract text if possible
            let extractedText = '';
            if (ext === 'pdf') {
              try {
                const { PDFParse } = await import('pdf-parse');
                const parser = new PDFParse({ data: buffer });
                const result = await parser.getText();
                extractedText = result.text || '';
                await parser.destroy();
              } catch (e) {
                console.error('Error extracting text from pdf:', e);
              }
            } else if (ext === 'docx') {
              try {
                const mammoth = await import('mammoth');
                const result = await mammoth.extractRawText({ buffer });
                extractedText = result.value;
              } catch (e) {
                console.error('Error extracting text from docx:', e);
              }
            } else if (ext === 'pptx') {
              try {
                const officeparser = await import('officeparser');
                extractedText = await officeparser.parseOfficeAsync(buffer);
              } catch (e) {
                console.error('Error extracting text from pptx:', e);
              }
            }

            // Determine target module: use the Canvas module mapping to find the ClassMate module
            const canvasModuleId = fileCanvasModuleMapping?.[fileId];
            const targetModuleId = canvasModuleId ? canvasToClassmateModuleMapping[canvasModuleId] : null;

            // Try to use object storage, fall back to base64 if not available
            const { objectStorageService } = await import('./objectStorage');
            let materialData: any = {
              courseId: classmateCourseId,
              moduleId: targetModuleId,
              fileName: filename,
              fileType,
              extractedText,
            };

            if (await objectStorageService.isAvailable()) {
              const storageKey = objectStorageService.generateStorageKey(classmateCourseId, filename);
              const { sizeBytes } = await objectStorageService.uploadBuffer(buffer, storageKey, contentType);
              materialData.fileUrl = null;
              materialData.storageKey = storageKey;
              materialData.contentType = contentType;
              materialData.sizeBytes = sizeBytes;
            } else {
              // Fall back to base64
              const base64 = buffer.toString('base64');
              materialData.fileUrl = `data:${contentType};base64,${base64}`;
            }

            // Create course material
            const material = await storage.createCourseMaterial(materialData);

            importedFiles.push({ filename, materialId: material.id, moduleId: targetModuleId });
          } catch (fileError: any) {
            console.error(`Error importing file ${fileId}:`, fileError);
            errors.push({ fileId, error: fileError.message });
          }
        }
      }

      res.json({
        success: true,
        modulesCreated,
        modulesSkipped,
        filesImported: importedFiles.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Error importing Canvas structure:", error);
      res.status(500).json({ message: error.message || "Failed to import" });
    }
  });

  // Import files from Canvas to ClassMate
  // Supports both single module import and mapped import (files to their respective modules)
  app.post('/api/canvas/import', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { fileIds, classmateModuleId, classmateCourseId, fileModuleMapping } = req.body;
      // fileModuleMapping: optional Record<string (fileId), string (classmateModuleId)> for mapped imports

      if (!user?.canvasAccessToken || !user?.canvasUrl) {
        return res.status(400).json({ message: "Canvas not connected" });
      }

      if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ message: "No files selected" });
      }

      if (!classmateCourseId) {
        return res.status(400).json({ message: "ClassMate course ID is required" });
      }

      const { decryptToken } = await import('./encryption');
      const { downloadCanvasFile } = await import('./canvas');
      const accessToken = decryptToken(user.canvasAccessToken);
      const importedFiles = [];
      const errors = [];
      const modulesWithNewContent = new Set<string>();

      for (const fileId of fileIds) {
        try {
          // Download file from Canvas
          const { buffer, filename, contentType } = await downloadCanvasFile(
            user.canvasUrl,
            accessToken,
            fileId
          );

          // Determine file type
          let fileType = 'other';
          if (contentType.includes('pdf')) fileType = 'pdf';
          else if (contentType.includes('word') || filename.endsWith('.docx') || filename.endsWith('.doc')) fileType = 'docx';
          else if (contentType.includes('presentation') || filename.endsWith('.pptx') || filename.endsWith('.ppt')) fileType = 'pptx';
          else if (contentType.includes('image')) fileType = 'image';
          else if (contentType.includes('video')) fileType = 'video';

          // Extract text for supported file types
          let extractedText: string | null = null;
          if (fileType === 'pdf') {
            try {
              const { PDFParse } = await import('pdf-parse');
              const parser = new PDFParse({ data: buffer });
              const result = await parser.getText();
              extractedText = result.text || '';
              await parser.destroy();
            } catch (e) {
              console.error(`Error extracting text from ${filename}:`, e);
            }
          } else if (fileType === 'docx') {
            try {
              const result = await mammoth.extractRawText({ buffer });
              extractedText = result.value;
            } catch (e) {
              console.error(`Error extracting text from ${filename}:`, e);
            }
          } else if (fileType === 'pptx') {
            try {
              const tmpFile = tmp.fileSync({ postfix: '.pptx' });
              await writeFile(tmpFile.name, buffer);
              extractedText = await officeParser.parseOfficeAsync(tmpFile.name);
              await unlink(tmpFile.name);
            } catch (e) {
              console.error(`Error extracting text from ${filename}:`, e);
            }
          }

          // Determine target module: use mapping if provided, otherwise use single module
          const targetModuleId = fileModuleMapping?.[fileId.toString()] || classmateModuleId || null;

          // Try to use object storage, fall back to base64 if not available
          const { objectStorageService } = await import('./objectStorage');
          let materialData: any = {
            courseId: classmateCourseId,
            moduleId: targetModuleId,
            fileName: filename,
            fileType,
            extractedText,
          };

          if (await objectStorageService.isAvailable()) {
            const storageKey = objectStorageService.generateStorageKey(classmateCourseId, filename);
            const { sizeBytes } = await objectStorageService.uploadBuffer(buffer, storageKey, contentType);
            materialData.fileUrl = null;
            materialData.storageKey = storageKey;
            materialData.contentType = contentType;
            materialData.sizeBytes = sizeBytes;
          } else {
            // Fall back to base64
            const base64Data = buffer.toString('base64');
            materialData.fileUrl = `data:${contentType};base64,${base64Data}`;
          }

          // Create course material
          const material = await storage.createCourseMaterial(materialData);

          importedFiles.push({ filename, materialId: material.id, moduleId: targetModuleId });

          // Track modules that got new content
          if (targetModuleId) {
            modulesWithNewContent.add(targetModuleId);
          }
        } catch (fileError: any) {
          console.error(`Error importing file ${fileId}:`, fileError);
          errors.push({ fileId, error: fileError.message });
        }
      }

      // Auto-generate learning objectives for all modules that got new content
      for (const moduleId of Array.from(modulesWithNewContent)) {
        autoGenerateLearningObjectives(moduleId);
      }

      res.json({
        success: true,
        imported: importedFiles,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Error importing Canvas files:", error);
      res.status(500).json({ message: error.message || "Failed to import files" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
