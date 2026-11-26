import nodemailer, { type Transporter } from "nodemailer";

const globalForMail = globalThis as { leaderboardMail?: Transporter };

/**
 * SMTP_URL in nodemailer's URL form: smtp://mailpit:1025 in dev,
 * smtps://user:pass@smtp.provider.com:465 in production.
 */
export function getTransport(): Transporter {
  if (globalForMail.leaderboardMail === undefined) {
    const url = process.env.SMTP_URL;
    if (url === undefined || url === "") throw new Error("SMTP_URL is not set");
    globalForMail.leaderboardMail = nodemailer.createTransport(url);
  }
  return globalForMail.leaderboardMail;
}

export function mailFrom(): string {
  const from = process.env.MAIL_FROM;
  if (from === undefined || from === "") throw new Error("MAIL_FROM is not set");
  return from;
}
