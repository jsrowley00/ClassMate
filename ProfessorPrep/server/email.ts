// Replit Mail integration for sending course invitation emails
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { z } from "zod";

// Zod schema matching the backend implementation
export const zSmtpMessage = z.object({
  to: z
    .union([z.string().email(), z.array(z.string().email())])
    .describe("Recipient email address(es)"),
  cc: z
    .union([z.string().email(), z.array(z.string().email())])
    .optional()
    .describe("CC recipient email address(es)"),
  subject: z.string().describe("Email subject"),
  text: z.string().optional().describe("Plain text body"),
  html: z.string().optional().describe("HTML body"),
  attachments: z
    .array(
      z.object({
        filename: z.string().describe("File name"),
        content: z.string().describe("Base64 encoded content"),
        contentType: z.string().optional().describe("MIME type"),
        encoding: z
          .enum(["base64", "7bit", "quoted-printable", "binary"])
          .default("base64"),
      })
    )
    .optional()
    .describe("Email attachments"),
});

export type SmtpMessage = z.infer<typeof zSmtpMessage>;

async function getAuthToken(): Promise<{ authToken: string; hostname: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    throw new Error("REPLIT_CONNECTORS_HOSTNAME not found");
  }

  const { stdout } = await promisify(execFile)(
    "replit",
    ["identity", "create", "--audience", `https://${hostname}`],
    { encoding: "utf8" }
  );

  const replitToken = stdout.trim();
  if (!replitToken) {
    throw new Error("Replit Identity Token not found for repl/depl");
  }

  return { authToken: `Bearer ${replitToken}`, hostname };
}

export async function sendEmail(message: SmtpMessage): Promise<{
  accepted: string[];
  rejected: string[];
  pending?: string[];
  messageId: string;
  response: string;
}> {
  const { hostname, authToken } = await getAuthToken();

  const response = await fetch(`https://${hostname}/api/v2/mailer/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Replit-Authentication": authToken,
    },
    body: JSON.stringify({
      to: message.to,
      cc: message.cc,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to send email");
  }

  return await response.json();
}

// Course invitation email template
export async function sendCourseInvitationEmail(
  recipientEmail: string,
  courseName: string,
  professorName: string,
  signUpUrl: string
): Promise<void> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">You've Been Invited to a Course!</h2>
      <p>Hello,</p>
      <p><strong>${professorName}</strong> has invited you to join their course <strong>"${courseName}"</strong> on ClassMate.</p>
      <p>ClassMate is an AI-powered study platform that helps you learn more effectively with:</p>
      <ul>
        <li>AI-generated practice tests</li>
        <li>Smart flashcards</li>
        <li>Personal AI tutor</li>
      </ul>
      <p>
        <a href="${signUpUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Join ClassMate
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        Once you sign up and subscribe, you'll automatically be enrolled in the course.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">
        This invitation was sent via ClassMate. If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
  `;

  const textContent = `
You've Been Invited to a Course!

Hello,

${professorName} has invited you to join their course "${courseName}" on ClassMate.

ClassMate is an AI-powered study platform that helps you learn more effectively with:
- AI-generated practice tests
- Smart flashcards
- Personal AI tutor

Join ClassMate: ${signUpUrl}

Once you sign up and subscribe, you'll automatically be enrolled in the course.

This invitation was sent via ClassMate. If you didn't expect this email, you can safely ignore it.
  `;

  try {
    await sendEmail({
      to: recipientEmail,
      subject: `You've been invited to "${courseName}" on ClassMate`,
      html: htmlContent,
      text: textContent,
    });
    console.log(`Invitation email sent to ${recipientEmail}`);
  } catch (error) {
    console.error(`Failed to send invitation email to ${recipientEmail}:`, error);
    throw error;
  }
}
