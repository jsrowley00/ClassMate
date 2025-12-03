# ClassMate - AI-Powered Study Guide Platform

## Overview
ClassMate is an AI-powered study guide platform designed to transform traditional study materials into interactive, AI-enhanced learning experiences. Professors can create courses, upload study materials, and manage students. Students can enroll in courses, utilize AI-generated practice tests and flashcards, and receive personalized AI tutoring based on course content. The platform aims to provide a comprehensive and intelligent learning environment.

## User Preferences
- Clean, educational interface prioritizing information density and reading comfort
- Consistent spacing using Tailwind units (4, 6, 8 for components)
- Inter font for optimal readability
- Professional blue primary color scheme
- Responsive design for mobile and desktop
- Accessible interactions with keyboard navigation support

## System Architecture
The platform is built with a clear separation of concerns, utilizing a modern web stack.

### UI/UX Decisions
The design emphasizes a clean, educational interface with a professional blue primary color scheme and the Inter font for optimal readability. It features responsive design for both mobile and desktop, accessible interactions with keyboard navigation, and a theme toggle for light/dark mode. UI components are built using Shadcn UI and styled with Tailwind CSS, adhering to consistent spacing guidelines. The platform includes role-based interfaces for professors and students, with intuitive navigation and visual cues for organization.

### Technical Implementations
- **AI-Powered Content Generation**: AI automatically generates SMART learning objectives from module materials, creates diverse flashcard sets, and generates practice test questions aligned with learning objectives.
- **Question Randomization & Variety**: Server-side shuffling ensures flashcards and practice tests appear in random order every time. AI generates varied question styles (scenario-based, definition, application, comparison, analysis) and uses different phrasings when assessing the same learning objective multiple times for better learning retention.
- **Personalized AI Tutoring**: The AI tutor employs Socratic teaching methods, provides short, focused responses, and can analyze student practice test results to offer targeted guidance on struggling topics. When students demonstrate understanding, the tutor offers an empathetic check-in and suggests trying a practice test to reinforce learning.
- **Hierarchical Module Structure**: Supports parent and child modules for organizing course materials, allowing easy reorganization of files between modules.
- **Automated Text Extraction**: Extracts text from uploaded PDF, DOCX, and PPTX files to power AI features. In-browser previews for DOCX and PPTX files are available via Google Docs Viewer.
- **Learning Objectives Integration**: Learning objectives guide flashcard and practice test generation with automatic fetching from selected or all modules. Module IDs are validated to prevent cross-course data leakage, and objectives are deduplicated to ensure concise AI prompts.
- **Analytics & Reporting**: AI categorizes missed questions into broad study topics and links them to learning objectives, providing professors with insights into curriculum areas needing reinforcement.

### Feature Specifications
- **Role-Based Access**: Separate portals for professors and students with distinct functionalities.
- **Course Management**: Professors can create courses, upload various material types (PDFs, Word docs, images, videos), and manage student enrollment.
- **Module Organization**: Organize course materials into hierarchical modules.
- **Student Enrollment**: Students can browse and enroll in courses.
- **Practice Tests**: Offers multiple test modes (multiple choice, short answer, fill-in-blank, mixed) with question randomization and module-based filtering.
- **AI-Generated Flashcards**: Students can create and study customizable flashcard sets with progress tracking.
- **AI Tutor Chat**: Real-time, Socratic AI tutor for personalized student support.
- **Study Materials Viewer**: Organized access to all uploaded course materials.
- **Student Management**: Professors can add or remove students by email. When adding students, the system checks subscription status:
  - Students with active subscriptions are immediately enrolled with "Enrolled" status
  - Students without subscriptions are added with "Pending" status and receive an invitation email
  - Non-users receive an invitation email and are auto-enrolled when they sign up and subscribe
  - The professor UI shows status badges (Enrolled/Pending/Invited) for each student
- **Admin Dashboard**: Platform admin dashboard accessible at `/admin` for users with admin email (jsrowley00@gmail.com). Features:
  - User management: view all users with search/sort, see subscription status and role
  - Platform metrics: total users, active subscribers, courses, practice tests, flashcard sets, chat sessions
  - AI usage tracking: monitor token usage and estimated costs per endpoint (practice tests, flashcards, tutor, global tutor)
  - AI cost tracking logs usage with input/output tokens and estimated costs per user
- **Onboarding Tutorial**: First-time users are shown an interactive guided tour that walks them through key features:
  - For students: sidebar navigation, Study Assistant chatbot, My Courses section, creating self-study rooms, uploading files, and organizing with modules
  - For professors: sidebar navigation, creating courses, adding modules, uploading materials, and inviting students
  - Users can re-access the tutorial anytime via the question mark (?) help icon in the header
  - Onboarding completion is tracked per role (hasSeenStudentOnboarding, hasSeenProfessorOnboarding fields in users table)
- **Canvas LMS Integration**: Professors can import study materials directly from their Canvas courses:
  - Personal Access Token (PAT) authentication - professors self-service connect without needing school IT admin involvement
  - Step-by-step instructions guide professors to create a Canvas access token from their Canvas settings
  - Browse Canvas courses where they are a teacher
  - View course files organized by Canvas modules
  - Select multiple files to import at once
  - Imported files are automatically processed (text extraction for DOCX/PPTX) and added to ClassMate modules
  - Supports PDF, Word docs, PowerPoint, images, and videos
  - Tokens are encrypted at rest using AES-256-GCM encryption

### System Design Choices
- **Frontend**: React with TypeScript, Wouter for routing, TanStack Query for data fetching, Shadcn UI for components, and Tailwind CSS for styling.
- **Backend**: Express.js server.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: Clerk for authentication (email/password and Google sign-in).
- **AI Integration**: OpenAI API for all AI-powered features (test generation, tutoring, objective generation, categorization).

## External Dependencies
- **Clerk**: For user authentication with email/password and Google sign-in options. Configure sign-in methods in the Clerk dashboard.
- **OpenAI API**: Powers AI-driven features including learning objective generation, flashcard creation, practice test question generation, and personalized AI tutoring.
- **PostgreSQL**: The primary database for storing all application data.
- **Google Docs Viewer**: Used for in-browser preview of DOCX and PPTX files.