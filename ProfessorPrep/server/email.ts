import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.warn('WARNING: RESEND_API_KEY is not set - emails will not be sent');
}

const resend = new Resend(apiKey);

const FROM_EMAIL = 'ClassMate <noreply@classmate.help>';

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
    console.log(`Attempting to send invitation email to ${recipientEmail}...`);
    console.log(`RESEND_API_KEY present: ${!!process.env.RESEND_API_KEY}`);
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `You've been invited to "${courseName}" on ClassMate`,
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      console.error(`Resend API error for ${recipientEmail}:`, JSON.stringify(error));
      throw new Error(error.message);
    }

    console.log(`Invitation email sent successfully to ${recipientEmail}, id: ${data?.id}`);
  } catch (error: any) {
    console.error(`Failed to send invitation email to ${recipientEmail}:`, error?.message || error);
    throw error;
  }
}

export async function sendStudyRoomInvitationEmail(
  recipientEmail: string,
  studyRoomName: string,
  inviterName: string,
  signUpUrl: string
): Promise<void> {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">You've Been Invited to a Study Room!</h2>
      <p>Hello,</p>
      <p><strong>${inviterName}</strong> has invited you to collaborate in their study room <strong>"${studyRoomName}"</strong> on ClassMate.</p>
      <p>As a collaborator, you'll be able to:</p>
      <ul>
        <li>View all flashcards in the study room</li>
        <li>Create your own flashcards to share</li>
        <li>Message other room members</li>
      </ul>
      <p>
        <a href="${signUpUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Join Study Room
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        Once you sign up or log in, you'll see the invitation waiting for you.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">
        This invitation was sent via ClassMate. If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
  `;

  const textContent = `
You've Been Invited to a Study Room!

Hello,

${inviterName} has invited you to collaborate in their study room "${studyRoomName}" on ClassMate.

As a collaborator, you'll be able to:
- View all flashcards in the study room
- Create your own flashcards to share
- Message other room members

Join Study Room: ${signUpUrl}

Once you sign up or log in, you'll see the invitation waiting for you.

This invitation was sent via ClassMate. If you didn't expect this email, you can safely ignore it.
  `;

  try {
    console.log(`Attempting to send study room invitation email to ${recipientEmail}...`);
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `${inviterName} invited you to study room "${studyRoomName}" on ClassMate`,
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      console.error(`Resend API error for ${recipientEmail}:`, JSON.stringify(error));
      throw new Error(error.message);
    }

    console.log(`Study room invitation email sent successfully to ${recipientEmail}, id: ${data?.id}`);
  } catch (error: any) {
    console.error(`Failed to send study room invitation email to ${recipientEmail}:`, error?.message || error);
    throw error;
  }
}
