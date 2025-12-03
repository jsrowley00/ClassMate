import { storage } from "./storage";

const CANVAS_CLIENT_ID = process.env.CANVAS_CLIENT_ID || "";
const CANVAS_CLIENT_SECRET = process.env.CANVAS_CLIENT_SECRET || "";

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id?: number;
  workflow_state: string;
}

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  items_count: number;
  items_url: string;
}

export interface CanvasModuleItem {
  id: number;
  title: string;
  type: string;
  content_id?: number;
  url?: string;
  external_url?: string;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  url: string;
  size: number;
  content_type: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasFolder {
  id: number;
  name: string;
  full_name: string;
  files_count: number;
  folders_count: number;
}

export interface CanvasEnrollment {
  id: number;
  user_id: number;
  course_id: number;
  type: string;
  enrollment_state: string;
  user: {
    id: number;
    name: string;
    login_id?: string;
    email?: string;
    sortable_name?: string;
  };
}

export interface CanvasStudent {
  id: number;
  name: string;
  email: string;
  enrollmentState: string;
}

export function getCanvasOAuthUrl(canvasUrl: string, redirectUri: string, state: string): string {
  const baseUrl = canvasUrl.startsWith('https://') ? canvasUrl : `https://${canvasUrl}`;
  const params = new URLSearchParams({
    client_id: CANVAS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    state: state,
    scope: 'url:GET|/api/v1/courses url:GET|/api/v1/courses/:course_id/modules url:GET|/api/v1/courses/:course_id/modules/:module_id/items url:GET|/api/v1/courses/:course_id/files url:GET|/api/v1/files/:id',
  });
  return `${baseUrl}/login/oauth2/auth?${params.toString()}`;
}

export async function exchangeCanvasCode(
  canvasUrl: string,
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const baseUrl = canvasUrl.startsWith('https://') ? canvasUrl : `https://${canvasUrl}`;
  
  const response = await fetch(`${baseUrl}/login/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CANVAS_CLIENT_ID,
      client_secret: CANVAS_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code: code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange Canvas code: ${error}`);
  }

  return response.json();
}

export async function refreshCanvasToken(
  canvasUrl: string,
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const baseUrl = canvasUrl.startsWith('https://') ? canvasUrl : `https://${canvasUrl}`;
  
  const response = await fetch(`${baseUrl}/login/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CANVAS_CLIENT_ID,
      client_secret: CANVAS_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Canvas token: ${error}`);
  }

  return response.json();
}

async function canvasApiRequest(
  canvasUrl: string,
  accessToken: string,
  endpoint: string
): Promise<any> {
  const baseUrl = canvasUrl.startsWith('https://') ? canvasUrl : `https://${canvasUrl}`;
  
  const response = await fetch(`${baseUrl}/api/v1${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canvas API error: ${error}`);
  }

  return response.json();
}

export async function getCanvasCourses(
  canvasUrl: string,
  accessToken: string
): Promise<CanvasCourse[]> {
  return canvasApiRequest(canvasUrl, accessToken, '/courses?enrollment_type=teacher&per_page=100');
}

export async function getCanvasModules(
  canvasUrl: string,
  accessToken: string,
  courseId: number
): Promise<CanvasModule[]> {
  return canvasApiRequest(canvasUrl, accessToken, `/courses/${courseId}/modules?per_page=100`);
}

export async function getCanvasModuleItems(
  canvasUrl: string,
  accessToken: string,
  courseId: number,
  moduleId: number
): Promise<CanvasModuleItem[]> {
  return canvasApiRequest(canvasUrl, accessToken, `/courses/${courseId}/modules/${moduleId}/items?per_page=100`);
}

export async function getCanvasCourseFiles(
  canvasUrl: string,
  accessToken: string,
  courseId: number
): Promise<CanvasFile[]> {
  return canvasApiRequest(canvasUrl, accessToken, `/courses/${courseId}/files?per_page=100`);
}

export async function getCanvasFile(
  canvasUrl: string,
  accessToken: string,
  fileId: number
): Promise<CanvasFile> {
  return canvasApiRequest(canvasUrl, accessToken, `/files/${fileId}`);
}

export async function getCanvasCourseFolders(
  canvasUrl: string,
  accessToken: string,
  courseId: number
): Promise<CanvasFolder[]> {
  return canvasApiRequest(canvasUrl, accessToken, `/courses/${courseId}/folders?per_page=100`);
}

export async function getCanvasFolderFiles(
  canvasUrl: string,
  accessToken: string,
  folderId: number
): Promise<CanvasFile[]> {
  return canvasApiRequest(canvasUrl, accessToken, `/folders/${folderId}/files?per_page=100`);
}

export async function downloadCanvasFile(
  canvasUrl: string,
  accessToken: string,
  fileId: number
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const file = await getCanvasFile(canvasUrl, accessToken, fileId);
  
  const response = await fetch(file.url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  
  return {
    buffer,
    filename: file.display_name || file.filename,
    contentType: file.content_type,
  };
}

export function isCanvasConfigured(): boolean {
  return Boolean(CANVAS_CLIENT_ID && CANVAS_CLIENT_SECRET);
}

// Validate a Personal Access Token by making a test API call
export async function validateCanvasToken(
  canvasUrl: string,
  accessToken: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const baseUrl = canvasUrl.startsWith('https://') ? canvasUrl : `https://${canvasUrl}`;
    
    const response = await fetch(`${baseUrl}/api/v1/users/self`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid access token. Please check your token and try again.' };
    } else if (response.status === 403) {
      return { valid: false, error: 'Access denied. The token may not have sufficient permissions.' };
    } else {
      return { valid: false, error: `Canvas returned an error (${response.status}). Please check your Canvas URL.` };
    }
  } catch (error: any) {
    if (error.message?.includes('fetch failed') || error.message?.includes('ENOTFOUND')) {
      return { valid: false, error: 'Could not connect to Canvas. Please check your Canvas URL is correct.' };
    }
    return { valid: false, error: `Connection failed: ${error.message}` };
  }
}

interface CanvasUser {
  id: number;
  name: string;
  sortable_name?: string;
  email?: string;
  login_id?: string;
}

export async function getCanvasCourseStudents(
  canvasUrl: string,
  accessToken: string,
  courseId: number
): Promise<CanvasStudent[]> {
  // Use the Course Users endpoint with include[]=email to get actual email addresses
  // The Enrollments endpoint does NOT return email addresses
  const users: CanvasUser[] = await canvasApiRequest(
    canvasUrl, 
    accessToken, 
    `/courses/${courseId}/users?enrollment_type[]=student&include[]=email&per_page=100`
  );
  
  return users
    .filter(u => u.email || u.login_id)
    .map(u => ({
      id: u.id,
      name: u.name,
      email: (u.email || u.login_id || '').toLowerCase().trim(),
      enrollmentState: 'active',
    }));
}
