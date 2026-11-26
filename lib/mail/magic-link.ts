import { MAGIC_LINK_TTL_SECONDS } from "@/lib/auth/config";

import { getTransport, mailFrom } from "./transport";

const minutes = MAGIC_LINK_TTL_SECONDS / 60;

/** The message itself, separate from sending so it can be tested. */
export function magicLinkMessage(url: string) {
  return {
    subject: "Your Leaderboard sign-in link",
    text: [
      "Tap the link below to sign in to Leaderboard:",
      "",
      url,
      "",
      `It works once and expires in ${minutes} minutes.`,
      "If you didn't ask for it, ignore this email.",
    ].join("\n"),
    html: `<p>Tap the button to sign in to Leaderboard.</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#171717;color:#ffffff;text-decoration:none;font-weight:600">Sign in</a></p>
<p style="color:#6b7280;font-size:14px">It works once and expires in ${minutes} minutes. If you didn't ask for it, ignore this email.</p>`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function sendMagicLinkEmail({ email, url }: { email: string; url: string }) {
  await getTransport().sendMail({
    from: mailFrom(),
    to: email,
    ...magicLinkMessage(url),
  });
}
