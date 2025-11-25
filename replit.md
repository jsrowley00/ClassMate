# ClassMate - AI-Powered Study Guide Platform

## Overview
ClassMate is an AI-powered educational platform designed to transform traditional course materials into interactive learning experiences. It enables professors to upload various study materials (PDFs, Word docs, PowerPoint, images, videos) which are then processed to generate AI-enhanced study tools such as practice tests, flashcards, and personalized tutoring. The platform supports hierarchical course organization, automatic learning objective generation, and intelligent question randomization. Students can also create "Self-Study Rooms" to utilize all AI tools with their own materials, even if their professors don't use ClassMate. The business model involves a one-time student fee for 4-month access, while professors use the platform for free.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
**Technology Stack**: React with TypeScript, Wouter for routing, and TanStack Query for server state. UI is built with Shadcn UI components and Tailwind CSS, following a "New York" style.
**Design Philosophy**: Clean, educational interface inspired by Notion, Quizlet, and Khan Academy, prioritizing readability and minimal distractions. Uses Inter font and a professional blue color scheme.
**Component Architecture**: Role-specific navigation for professors (course management, analytics) and students (course navigation, study tools). Student dashboard distinguishes between professor-led and self-study courses. A collapsible "Study Assistant" provides quick access to global and course-specific AI tutors.
**State Management**: TanStack Query manages server state with custom handling for 401 errors.

### Backend Architecture
**Server Framework**: Express.js with TypeScript.
**Database Layer**: Drizzle ORM with Neon's serverless PostgreSQL, utilizing connection pooling.
**Course Management**: Supports optional start/end dates with robust validation.
**File Processing**: Multer handles uploads (10MB limit), with `mammoth` and `officeparser` for text extraction from DOCX and PPTX.
**Authentication & Sessions**: Replit Auth (OpenID Connect) via passport.js, with PostgreSQL-backed sessions (`connect-pg-simple`). Role-based access control (professor/student).
**Permissions Architecture**: Dual ownership model with `ownerId` (for course management) and `professorId` (for professor-only features like enrollment management). Access control checks `ownerId OR isEnrolled` for student-facing features and `professorId` for professor-specific features.

### AI Integration Architecture
**OpenAI Integration**: All AI features use GPT-4o-mini via the OpenAI API.
**Core AI Capabilities**:
1.  **Learning Objective Generation**: Automatic creation of SMART objectives from materials.
2.  **Practice Test Generation**: Diverse question types (MCQ, short answer, fill-in-blank) aligned with objectives, with server-side randomization.
3.  **Flashcard Generation**: Customizable flashcards from course materials.
4.  **AI Tutor**: Socratic teaching, provides targeted guidance based on practice test results and mastery data.
5.  **Analytics Processing**: Categorizes missed questions using learning objectives or broader topics.
**AI Rate Limiting**: User-based rate limiting per feature (e.g., 15 practice tests/hr, 50 AI chat messages/hr) to manage OpenAI API costs, tracking authenticated user IDs.
**Preview System**: Secure token-based preview URLs for DOCX/PPTX via Google Docs Viewer.

### Data Architecture
**Hierarchical Module System**: Supports parent-child relationships for course material organization.
**Learning Objectives Integration**: Objectives guide all AI-generated content and mastery tracking. Mastery uses a waterfall progression.
**AI Tutor Mastery Integration**: Tutor accesses student mastery data (objectives, rubric blockers, demonstration counts) to provide personalized recommendations (e.g., practice tests for demonstrations, flashcards for concepts).
**Global Study Assistant (Meta Tutor)**: A cross-course AI tutor that helps students prioritize learning across all enrolled courses, accessing all mastery data. Supports multi-session chats.
**Multi-Session Chat Architecture**: Chat sessions stored in DB with `session_type` ("course" or "global"), unique IDs, and auto-generated titles.

## External Dependencies
*   **Replit Auth**: OpenID Connect authentication, user provisioning, session, and role management.
*   **OpenAI API**: Core AI functionalities using `OPENAI_API_KEY` and GPT-4o-mini.
*   **Neon Serverless PostgreSQL**: Primary database with `DATABASE_URL`, connection pooling via `@neondatabase/serverless`.
*   **Third-party Libraries**:
    *   **Document Processing**: `mammoth`, `officeparser`, `tmp`.
    *   **UI Components**: Radix UI, Tailwind CSS, `class-variance-authority`.
    *   **Build Tools**: Vite, esbuild.
*   **Session Storage**: PostgreSQL table via `connect-pg-simple`.
*   **Stripe Integration**: Payment processing via Stripe Checkout and `stripe-replit-sync` for product/price sync and webhooks. One-time $40 payment for 4-month student access with expiration tracking. Users table includes `stripeCustomerId`, `stripePaymentId`, `subscriptionStatus`, and `subscriptionExpiresAt` fields. Access expiration enforced via `checkStudentAccess` middleware on all AI-powered endpoints.