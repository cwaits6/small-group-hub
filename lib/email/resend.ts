import { Resend } from "resend";
import { siteConfig } from "@/lib/config";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendInviteEmail(
  email: string,
  name: string,
  magicLink: string
) {
  const { error } = await getResend().emails.send({
    from: siteConfig.email.from,
    to: email,
    subject: `You're invited to ${siteConfig.name}!`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: ${siteConfig.colors.primary}; font-size: 28px;">Welcome, ${name}!</h1>
        <p style="font-size: 18px; line-height: 1.6; color: #44403c;">
          Your request to join <strong>${siteConfig.name}</strong> has been approved!
        </p>
        <p style="font-size: 18px; line-height: 1.6; color: #44403c;">
          Click the button below to set up your password and get started.
        </p>
        <a href="${magicLink}"
           style="display: inline-block; background-color: ${siteConfig.colors.primary}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; margin-top: 20px;">
          Set Up My Account
        </a>
        <p style="font-size: 14px; color: #78716c; margin-top: 40px;">
          If the button doesn't work, copy and paste this link into your browser:<br />
          <a href="${magicLink}" style="color: ${siteConfig.colors.primaryLight};">${magicLink}</a>
        </p>
        <p style="font-size: 14px; color: #78716c; margin-top: 20px;">
          &mdash; The ${siteConfig.name} Team
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send invite email:", error);
    throw error;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  resetLink: string
) {
  const { error } = await getResend().emails.send({
    from: siteConfig.email.from,
    to: email,
    subject: `Reset your ${siteConfig.name} password`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: ${siteConfig.colors.primary}; font-size: 28px;">Reset Your Password</h1>
        <p style="font-size: 18px; line-height: 1.6; color: #44403c;">
          We received a request to reset your password for <strong>${siteConfig.name}</strong>.
        </p>
        <p style="font-size: 18px; line-height: 1.6; color: #44403c;">
          Click the button below to choose a new password.
        </p>
        <a href="${resetLink}"
           style="display: inline-block; background-color: ${siteConfig.colors.primary}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; margin-top: 20px;">
          Reset Password
        </a>
        <p style="font-size: 14px; color: #78716c; margin-top: 40px;">
          If you didn't request this, you can safely ignore this email.<br />
          If the button doesn't work, copy and paste this link into your browser:<br />
          <a href="${resetLink}" style="color: ${siteConfig.colors.primaryLight};">${resetLink}</a>
        </p>
        <p style="font-size: 14px; color: #78716c; margin-top: 20px;">
          &mdash; The ${siteConfig.name} Team
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send password reset email:", error);
    throw error;
  }
}

export async function sendEventReminderEmail(
  email: string,
  name: string,
  eventTitle: string,
  eventDate: string,
  eventLocation: string | null
) {
  const { error } = await getResend().emails.send({
    from: siteConfig.email.from,
    to: email,
    subject: `Reminder: ${eventTitle} is coming up!`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: ${siteConfig.colors.primary}; font-size: 28px;">Event Reminder</h1>
        <p style="font-size: 18px; line-height: 1.6; color: #44403c;">
          Hi ${name}, just a reminder that <strong>${eventTitle}</strong> is coming up!
        </p>
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 18px; margin: 0; color: #44403c;">
            <strong>When:</strong> ${eventDate}
          </p>
          ${eventLocation ? `<p style="font-size: 18px; margin: 8px 0 0; color: #44403c;"><strong>Where:</strong> ${eventLocation}</p>` : ""}
        </div>
        <a href="${siteConfig.url}/events"
           style="display: inline-block; background-color: ${siteConfig.colors.primary}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; margin-top: 20px;">
          View Event
        </a>
        <p style="font-size: 14px; color: #78716c; margin-top: 40px;">
          &mdash; The ${siteConfig.name} Team
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send event reminder:", error);
    throw error;
  }
}
