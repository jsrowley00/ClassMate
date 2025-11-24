# Design Guidelines: AI Study Guide Platform

## Design Approach
**System-Based Educational Design** inspired by Notion's clarity + Quizlet's study focus + Khan Academy's educational accessibility. Prioritizing information density, reading comfort, and distraction-free learning environments.

## Core Design Principles
1. **Clarity Over Decoration** - Clean interfaces that prioritize content comprehension
2. **Role-Specific UX** - Distinct experiences for professors (management) and students (learning)
3. **Focus-Friendly** - Minimal distractions during study/test modes
4. **Accessible Learning** - High contrast, readable typography, clear CTAs

## Typography
- **Primary Font**: Inter or Public Sans (Google Fonts) - excellent readability for extended study sessions
- **Headings**: font-semibold to font-bold, sizes: text-3xl (h1), text-2xl (h2), text-xl (h3)
- **Body Text**: text-base (16px) with relaxed line-height (leading-relaxed) for comfortable reading
- **UI Elements**: text-sm for labels, text-xs for metadata

## Layout System
**Spacing Units**: Consistent use of Tailwind units 2, 4, 6, 8, 12, 16 for padding/margins
- **Component spacing**: p-4 to p-6 for cards, p-8 for page containers
- **Section spacing**: gap-6 for grids, gap-4 for lists
- **Page margins**: max-w-7xl mx-auto px-4 for content containment

## Component Library

### Navigation & Layout
**Professor Dashboard**:
- Sidebar navigation (w-64) with course list, upload materials, settings
- Top bar with notifications and profile
- Main content area for course management, student analytics

**Student Dashboard**:
- Horizontal tab navigation for: My Courses, Study Mode, Practice Tests, AI Tutor
- Course cards grid showing enrolled classes with progress indicators
- Quick access to recent study materials

### Core Components

**File Upload Zone**:
- Drag-and-drop area with border-2 border-dashed border-gray-300
- Supported format icons (PDF, DOCX, images) displayed prominently
- File list with name, size, remove option after upload
- Upload progress bars

**AI Tutor Chat Interface**:
- Fixed-height conversation area (h-96 to h-[600px]) with overflow-y-auto
- Student messages: right-aligned, rounded-lg, distinct background
- AI responses: left-aligned, includes source citations from study materials
- Input area fixed at bottom with send button

**Practice Test Interface**:
- Clean, focused layout with timer in top-right (when applicable)
- Test mode selector (Multiple Choice, Short Answer, Fill-in-Blank, Mixed)
- Single question per view with "Next" navigation
- Progress indicator showing question number (e.g., "5 of 20")
- Submit button with confirmation modal

**Course Cards**:
- Hover-elevated cards (shadow-md hover:shadow-lg transition)
- Course name (text-lg font-semibold), professor name (text-sm text-gray-600)
- Enrollment count or progress bar for students
- Action buttons: "View Materials" or "Manage Course"

**Study Material Viewer**:
- Document viewer pane with PDF/image rendering
- Table of contents sidebar for multi-section materials
- Annotation tools: highlight, note-taking (future expansion)
- Download/print options

### Forms & Inputs
- Rounded inputs (rounded-md) with focus:ring-2 for accessibility
- Clear labels (text-sm font-medium mb-1)
- Consistent button hierarchy:
  - Primary: solid background for main actions
  - Secondary: outline for alternative actions
  - Tertiary: text-only for minor actions

### Data Display
**Student Progress Dashboard**:
- Stats cards showing: Tests Taken, Average Score, Study Time
- Recent activity list with timestamps
- Performance charts (line graph for score trends)

**Professor Analytics**:
- Student performance table with sorting
- Material engagement metrics
- Test score distributions

## Images
**Hero Image**: Yes - Education-themed imagery on landing/login page
- Clean, bright study environment or abstract learning graphics
- Placement: Full-width hero section (h-96) with overlay for login/signup CTAs
- Ensure buttons have backdrop-blur-sm for readability over image

**Supporting Images**:
- Default course thumbnails (colorful, abstract patterns)
- Professor/student avatar placeholders
- Empty state illustrations for courses with no materials

## Interactions
**Minimal Animations** - Use sparingly:
- Subtle transitions on card hovers (transform scale-105)
- Smooth scrolling in chat interface
- Loading spinners for AI generation/file processing
- Success/error toast notifications (slide-in from top-right)

## Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation support (tab order, enter/space activation)
- High contrast mode compatibility
- Focus indicators on all interactive elements (ring-2)

## Mobile Considerations
- Sidebar navigation converts to hamburger menu on mobile
- Stack course cards to single column on sm screens
- Touch-friendly button sizes (min-h-12)
- Bottom navigation for key student actions on mobile