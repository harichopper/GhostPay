import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export type EmailDeliveryResult = {
  delivered: boolean;
  provider: 'gmail' | 'none';
  simulated: boolean;
  messageId?: string;
};

function buildOtpEmailHtml(otpCode: string, expiryMinutes: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>GhostPay OTP</title>
</head>
<body style="margin:0;padding:0;background-color:#0A0C10;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0C10;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:linear-gradient(145deg,#111417,#0F1A2A);border-radius:20px;border:1px solid rgba(0,245,255,0.15);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:36px 40px 20px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(0,245,255,0.08);border:1px solid rgba(0,245,255,0.25);border-radius:12px;padding:10px 22px;">
                    <span style="color:#00F5FF;font-size:22px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">
                      👻 GHOSTPAY
                    </span>
                  </td>
                </tr>
              </table>
              <p style="color:rgba(185,202,202,0.6);font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:14px 0 0;">
                Secure Wallet Verification
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(0,245,255,0.3),transparent);"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 12px;">
              <p style="color:#E9FEFF;font-size:16px;line-height:1.7;margin:0 0 24px;">
                Your GhostPay verification code is ready. Use it to link your wallet and enable secure, zero-data payments.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="background:rgba(0,245,255,0.06);border:1px solid rgba(0,245,255,0.3);border-radius:16px;padding:28px 20px;">
                    <p style="color:rgba(185,202,202,0.6);font-size:11px;letter-spacing:2.5px;text-transform:uppercase;margin:0 0 12px;">
                      One-Time Password
                    </p>
                    <p style="color:#00F5FF;font-size:48px;font-weight:900;letter-spacing:14px;margin:0;text-shadow:0 0 20px rgba(0,245,255,0.4);">
                      ${otpCode}
                    </p>
                    <p style="color:rgba(185,202,202,0.5);font-size:12px;margin:14px 0 0;">
                      Expires in <strong style="color:#E9FEFF;">${expiryMinutes} minutes</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:rgba(255,171,0,0.06);border:1px solid rgba(255,171,0,0.2);border-radius:12px;padding:14px 18px;">
                    <p style="color:#FFD166;font-size:13px;margin:0;line-height:1.6;">
                      ⚠️ <strong>Never share this code.</strong> GhostPay will never ask for your OTP via phone or chat.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(0,245,255,0.15),transparent);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 40px 32px;">
              <p style="color:rgba(185,202,202,0.35);font-size:11px;margin:0;line-height:1.8;">
                You received this because a wallet verification was requested on the GhostPay network.<br/>
                If you did not request this, you can safely ignore this email.<br/><br/>
                <span style="color:rgba(0,245,255,0.3);">GhostPay · Algorand Blockchain · Testnet</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOtpEmailText(otpCode: string, expiryMinutes: number): string {
  return [
    'GhostPay — Wallet Verification',
    '================================',
    '',
    `Your one-time verification code is: ${otpCode}`,
    `This code expires in ${expiryMinutes} minutes.`,
    '',
    'Never share this code with anyone.',
    'If you did not request this, ignore this email.',
    '',
    'GhostPay · Algorand Blockchain'
  ].join('\n');
}

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.gmailUser,
      pass: env.gmailAppPassword
    }
  });
}

export async function sendOtpEmail(to: string, otpCode: string): Promise<EmailDeliveryResult> {
  if (!env.gmailUser || !env.gmailAppPassword) {
    // Simulate in dev when Gmail not configured
    console.log(`\n--- [SIMULATED EMAIL OTP] ---`);
    console.log(`To: ${to}`);
    console.log(`OTP: ${otpCode}`);
    console.log(`-----------------------------\n`);
    return { delivered: true, provider: 'none', simulated: true };
  }

  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: `"GhostPay 👻" <${env.gmailUser}>`,
    to,
    subject: `${otpCode} — Your GhostPay Verification Code`,
    text: buildOtpEmailText(otpCode, env.otpExpiryMinutes),
    html: buildOtpEmailHtml(otpCode, env.otpExpiryMinutes)
  });

  return {
    delivered: true,
    provider: 'gmail',
    simulated: false,
    messageId: info.messageId
  };
}
