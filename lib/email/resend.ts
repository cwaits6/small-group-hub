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

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeLink(link: string): string {
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsafe scheme");
    }
    return url.href;
  } catch {
    throw new Error(`Invalid or unsafe joinLink: ${link}`);
  }
}

export async function sendFamilyInviteEmail(
  email: string,
  inviterName: string,
  familyMemberName: string,
  joinLink: string
) {
  const safeInviterName = escapeHtml(inviterName);
  const safeFamilyMemberName = escapeHtml(familyMemberName);
  const safeJoinLink = sanitizeLink(joinLink);

  const { error } = await getResend().emails.send({
    from: siteConfig.email.from,
    to: email,
    subject: `${safeInviterName} added you to their household on ${siteConfig.name}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: ${siteConfig.colors.primary}; font-size: 28px;">You've been invited!</h1>
        <p style="font-size: 18px; line-height: 1.6; color: #44403c;">
          <strong>${safeInviterName}</strong> has added <strong>${safeFamilyMemberName}</strong> to their household
          on <strong>${siteConfig.name}</strong> and would like to invite you to create your own account.
        </p>
        <p style="font-size: 18px; line-height: 1.6; color: #44403c;">
          Click the button below to sign up and join your household.
        </p>
        <a href="${safeJoinLink}"
           style="display: inline-block; background-color: ${siteConfig.colors.primary}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; margin-top: 20px;">
          Create My Account
        </a>
        <p style="font-size: 14px; color: #78716c; margin-top: 40px;">
          If the button doesn't work, copy and paste this link into your browser:<br />
          <a href="${safeJoinLink}" style="color: ${siteConfig.colors.primaryLight};">${safeJoinLink}</a>
        </p>
        <p style="font-size: 14px; color: #78716c; margin-top: 20px;">
          &mdash; The ${siteConfig.name} Team
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send family invite email:", error);
    throw error;
  }
}

export async function sendFeedbackEmail(
  to: string[],
  senderName: string,
  senderEmail: string | null,
  type: "idea" | "problem",
  message: string
) {
  const kind = type === "problem" ? "Something's broken" : "An idea";
  const safeSenderName = escapeHtml(senderName);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

  const { error } = await getResend().emails.send({
    from: siteConfig.email.from,
    to,
    ...(senderEmail ? { replyTo: senderEmail } : {}),
    subject: `${siteConfig.name} feedback from ${senderName}: ${kind}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: ${siteConfig.colors.primary}; font-size: 28px;">Member feedback</h1>
        <p style="font-size: 18px; line-height: 1.6; color: #44403c;">
          <strong>${safeSenderName}</strong>${senderEmail ? ` (${escapeHtml(senderEmail)})` : ""}
          sent feedback from the Settings page.
        </p>
        <p style="font-size: 16px; color: #78716c; margin: 0;">Type: <strong>${kind}</strong></p>
        <div style="background: #F3F7FB; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 18px; line-height: 1.6; margin: 0; color: #44403c;">${safeMessage}</p>
        </div>
        <p style="font-size: 14px; color: #78716c; margin-top: 40px;">
          Reply to this email to answer them directly.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send feedback email:", error);
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
