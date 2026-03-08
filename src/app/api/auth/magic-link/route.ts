// src/app/api/auth/magic-link/route.ts
import { prisma } from "@/lib/db";
import { success, error, serverError, parseBody } from "@/lib/api-helpers";
import crypto from "crypto";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const { email } = await parseBody<{ email: string }>(request);
    if (!email) return error("Email is required");

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Always return success to avoid revealing whether email exists
    if (!user || !user.active) {
      return success({ message: "If an account exists, a login link has been sent." });
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { magicToken: token, magicTokenExp: expiry },
    });

    // Build the magic link URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const magicLink = `${baseUrl}/auth/verify?email=${encodeURIComponent(email)}&token=${token}`;

    // Send email (configure SMTP in .env)
    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || "FieldFlow <noreply@fieldflow.app>",
        to: email,
        subject: "Your FieldFlow Login Link",
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="display: inline-block; width: 40px; height: 40px; border-radius: 10px; background: #d4901a; color: white; font-weight: 800; font-size: 20px; line-height: 40px; font-family: Georgia, serif;">F</div>
              <h1 style="font-family: Georgia, serif; font-size: 22px; margin-top: 10px; color: #1a1a1a;">FieldFlow</h1>
            </div>
            <p style="color: #555; font-size: 15px; line-height: 1.6;">Hi ${user.name},</p>
            <p style="color: #555; font-size: 15px; line-height: 1.6;">Click the button below to log in to FieldFlow. This link expires in 15 minutes.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLink}" style="display: inline-block; padding: 14px 36px; background: #245a1e; color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px;">Log In to FieldFlow</a>
            </div>
            <p style="color: #999; font-size: 13px;">If you didn't request this link, you can safely ignore this email.</p>
          </div>
        `,
      });
    } else {
      // No SMTP configured — log the link for development
      console.log("\n========================================");
      console.log("MAGIC LINK (no SMTP configured):");
      console.log(magicLink);
      console.log("========================================\n");
    }

    return success({ message: "If an account exists, a login link has been sent." });
  } catch (err) {
    return serverError(err);
  }
}
