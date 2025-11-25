# ClassMate - AI-Powered Study Guide Platform

## Overview

ClassMate is an AI-powered educational platform that transforms traditional course materials into interactive learning experiences. Professors upload study materials (PDFs, Word docs, PowerPoint, images, videos) which are then processed to generate AI-enhanced study tools. Students can access AI-generated practice tests, flashcards, and personalized tutoring based on their professor's actual course content. The platform features hierarchical course organization through modules, automatic learning objective generation, and intelligent question randomization to ensure varied, effective study sessions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**: React with TypeScript, utilizing Wouter for client-side routing and TanStack Query for server state management. The UI is built with Shadcn UI components styled using Tailwind CSS, following a "New York" style configuration.

**Design Philosophy**: Clean, educational interface inspired by Notion's clarity, Quizlet's study focus, and Khan Academy's accessibility. The design prioritizes information density and reading comfort with minimal distractions during study/test modes. Uses Inter font for optimal readability during extended study sessions, with a professional blue primary color scheme.

**Component Architecture**: Role-specific experiences with separate sidebar navigation for professors (course management, material uploads, analytics) and students (course navigation, study tools). Student sidebar features a collapsible "Study Assistant" menu with quick access to global tutor ("New Chat") and all course-specific AI tutors. Course pages use a tab-based layout with a dedicated sidebar for navigating between Overview, Materials, Practice Tests, Flashcards, and AI Tutor sections. Student dashboard displays only enrolled courses (professors add students to courses rather than students browsing and self-enrolling).

**State Management**: TanStack Query handles all server state with configured defaults for no refetching on window focus and infinite stale time. Custom query functions handle 401 errors with configurable behavior (return null or throw).

### Backend Architecture

**Server Framework**: Express.js with TypeScript, running in ESNext module format. Custom middleware logs API requests with duration and response summaries (truncated to 80 characters).

**Database Layer**: Drizzle ORM with Neon's serverless PostgreSQL driver. Connection pooling via `@neondatabase/serverless` with WebSocket support for serverless environments. Database schema includes comprehensive tables for users, courses, modules, materials, enrollments, practice tests, chat sessions, flashcards, and learning objectives.

**Course Management**: Courses include optional start and end date fields for tracking academic terms or course schedules. Professors can set dates during course creation or edit them later via the course detail page. Date validation ensures end dates cannot precede start dates. The update endpoint uses hardened Zod validation with robust date parsing, rejecting invalid date strings, empty payloads, and chronological violations.

**File Processing**: Multer middleware handles file uploads with 10MB limit and memory storage. Text extraction supports PDF, DOCX, and PPTX formats using `mammoth` and `officeparser` libraries. Temporary files created with `tmp` library for processing, then cleaned up after extraction.

**Authentication & Sessions**: Replit Auth implements OpenID Connect authentication with passport.js. Session management uses `connect-pg-simple` for PostgreSQL-backed sessions with 1-week TTL. Role-based access control distinguishes professors from students, with dedicated endpoints for role selection and switching.

### AI Integration Architecture

**OpenAI Integration**: All AI features powered by OpenAI API (configured to use GPT-4o-mini model for faster and cheaper token usage). Core AI capabilities include:

1. **Learning Objective Generation**: Automatically creates SMART learning objectives from uploaded course materials, analyzing text content to identify key concepts and skills students should master.

2. **Practice Test Generation**: Generates diverse question types (multiple choice, short answer, fill-in-blank) aligned with learning objectives. Server-side shuffling ensures randomization on every test attempt. AI varies question styles (scenario-based, definition, application, comparison) to prevent repetition.

3. **Flashcard Generation**: Creates flashcard sets from course materials with customizable parameters for difficulty and focus areas.

4. **AI Tutor**: Socratic teaching method implementation providing short, focused responses. Can analyze practice test results to offer targeted guidance on struggling topics.

5. **Analytics Processing**: Categorizes missed questions intelligently based on available data. When learning objectives are present, uses `matchQuestionsToLearningObjectives` to map questions to specific objectives. Falls back to `categorizeQuestionsIntoTopics` for broad topic categorization when objectives are unavailable. API response includes `usesLearningObjectives` flag to indicate which method was used, enabling appropriate UI labeling.

**AI Rate Limiting**: User-based rate limiting protects against excessive OpenAI API costs using `express-rate-limit` middleware. Limits are calculated to balance user experience with cost control using GPT-4o-mini pricing:
- Practice Tests: 15 per hour (~$0.30/hour max)
- AI Chat Messages: 50 per hour (~$0.75/hour max)
- Flashcard Generation: 15 per hour (~$0.30/hour max)
- Learning Objectives: 100 per hour (~$1.00/hour max, higher limit since auto-generated during material uploads)

Rate limits track authenticated user IDs (not IP addresses) for accurate per-user enforcement. Exceeded limits return 429 status with clear user-friendly error messages.

**Preview System**: Secure preview URL generation using token-based authentication. Tokens stored in-memory Map with expiration times, periodically cleaned up (60-second intervals). Supports DOCX and PPTX previews via Google Docs Viewer.

### Data Architecture

**Hierarchical Module System**: Supports parent-child relationships for organizing course materials. Modules can be reorganized, and files can be moved between modules. Queries include descendant module ID fetching to support multi-level hierarchies.

**Learning Objectives Integration**: Learning objectives guide all AI-generated content. Automatic fetching from selected modules or all course modules. Module ID validation prevents cross-course objective access. Objective mastery tracking uses waterfall progression: multi-objective questions update only the first non-mastered objective in course structure order, ensuring students master earlier concepts before progress moves to later ones.

**AI Tutor Mastery Integration**: The AI tutor has complete access to student mastery tracking data, enabling personalized guidance based on exact progress. The tutor receives:
1. Complete mastery status for all learning objectives (Developing/Approaching/Mastered)
2. Explicit rubric blocker flags (hasRecentMajorMistake, reasoningQualitySatisfied)
3. Demonstration counts and question format diversity per objective
4. Waterfall priority identification (earliest non-mastered objective)

The tutor provides targeted recommendations based on specific gaps:
- For conceptual mistakes: Suggests reviewing materials and focusing on understanding
- For low reasoning quality: Recommends explaining thinking more clearly
- For format diversity: Directs students to practice tests with different question types
- For demonstration counts: Encourages consistent practice test attempts

Study tool recommendations are personalized to each student's needs:
- Practice Tests: Critical for building demonstrations and trying multiple formats
- Flashcards: Helpful for memorizing key terms and concepts
- AI Tutor: Best for deep conceptual understanding when stuck on topics

**Global Study Assistant (Meta Tutor)**: A cross-course AI tutor that helps students prioritize their learning across all enrolled courses. The global tutor:
1. Accesses mastery data for all courses simultaneously (completion rates, priority objectives, rubric blockers)
2. Recommends which course to focus on next based on developing objectives and overall progress
3. Provides course-level strategy and balanced progress guidance
4. Uses GPT-4o-mini for cost-effective cross-course recommendations
5. Supports ChatGPT-style multi-session management - students can create multiple concurrent conversations, each appearing as a separate sidebar tab

**Multi-Session Chat Architecture**: Chat sessions are stored in the database with a `session_type` field ("course" or "global") to differentiate between course-specific and cross-course conversations. Global sessions have nullable `courseId` to enable student-wide context. Each global session has a unique ID and auto-generated title (derived from first message, 50-char preview). Students access the global tutor via "Study Assistant" collapsible menu in the sidebar, which displays:
- "New Chat" button to create fresh sessions
- All existing global chat sessions (sorted by last updated)
- Separator divider
- Course-specific AI tutors for each enrolled course

The global tutor route accepts optional session ID (`/global-tutor/:sessionId?`). When visiting `/global-tutor` without an ID, a new session is automatically created and the user is navigated to `/global-tutor/:sessionId`. Session creation invalidates the sidebar query to immediately display the new session. All sessions are scoped by user ID for security.

**Security Considerations**: Module ID validation ensures students can only access materials from courses they're enrolled in. Preview tokens expire and are cleaned periodically. Session cookies are HTTP-only, secure, and have 1-week max age.

## External Dependencies

**Replit Auth**: Provides OpenID Connect authentication with automatic user provisioning. Handles user sessions, profile data (email, name, profile image), and role management (professor/student designation).

**OpenAI API**: Core dependency for all AI-powered features. Requires `OPENAI_API_KEY` environment variable. Powers learning objective generation, practice test question creation, flashcard generation, AI tutoring conversations, and analytics categorization. Configured to use GPT-4o-mini model for faster and cheaper token usage.

**Neon Serverless PostgreSQL**: Primary database using Neon's serverless PostgreSQL offering. Requires `DATABASE_URL` environment variable. Database may suspend during inactivity and requires wake-up queries before use. Connection pooling configured via `@neondatabase/serverless` package with WebSocket support.

**Third-party Libraries**:
- **Document Processing**: `mammoth` (DOCX text extraction), `officeparser` (PPTX parsing), `tmp` (temporary file management)
- **UI Components**: Radix UI primitives (@radix-ui/*) for accessible component foundation
- **Styling**: Tailwind CSS with PostCSS, class-variance-authority for variant management
- **Build Tools**: Vite for frontend bundling, esbuild for server bundling
- **Development Tools**: Replit-specific plugins for runtime error overlay, cartographer, and dev banner

**Session Storage**: PostgreSQL table created by `connect-pg-simple` for storing Express sessions, eliminating need for Redis or similar services.