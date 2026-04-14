import { env } from '../config/env.js';

export type SmsDeliveryResult = {
  delivered: boolean;
  provider: 'none' | 'twilio';
  simulated: boolean;
  messageId?: string;
};

function buildOtpMessage(otpCode: string): string {
  return env.otpMessageTemplate
    .replace(/\{\{OTP\}\}/g, otpCode)
    .replace(/\{\{MINUTES\}\}/g, String(env.otpExpiryMinutes));
}

async function sendViaTwilio(to: string, body: string): Promise<SmsDeliveryResult> {
  if (!env.twilioAccountSid || !env.twilioFromNumber) {
    throw new Error('Twilio is selected but required values are missing. Set TWILIO_ACCOUNT_SID and TWILIO_FROM_NUMBER');
  }

  if (!env.twilioAccountSid.startsWith('AC')) {
    throw new Error('TWILIO_ACCOUNT_SID must start with AC (Account SID). A User SID (US...) cannot be used for SMS API calls.');
  }

  const usingApiKey = Boolean(env.twilioApiKeySid && env.twilioApiKeySecret);
  const usingAuthToken = Boolean(env.twilioAuthToken);

  if (!usingApiKey && !usingAuthToken) {
    throw new Error(
      'Provide either TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET for Twilio authentication.'
    );
  }

  if (usingApiKey && !env.twilioApiKeySid.startsWith('SK')) {
    throw new Error('TWILIO_API_KEY_SID must start with SK.');
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Messages.json`;
  const authUser = usingApiKey ? env.twilioApiKeySid : env.twilioAccountSid;
  const authSecret = usingApiKey ? env.twilioApiKeySecret : env.twilioAuthToken;
  const auth = Buffer.from(`${authUser}:${authSecret}`).toString('base64');

  const formData = new URLSearchParams();
  formData.append('To', to);
  formData.append('From', env.twilioFromNumber);
  formData.append('Body', body);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });

  const data = (await response.json()) as { sid?: string; message?: string };

  if (!response.ok) {
    throw new Error(data.message ?? 'Twilio SMS delivery failed');
  }

  return {
    delivered: true,
    provider: 'twilio',
    simulated: false,
    messageId: data.sid
  };
}

export async function sendOtpSms(to: string, otpCode: string): Promise<SmsDeliveryResult> {
  const message = buildOtpMessage(otpCode);

  if (env.smsProvider === 'twilio') {
    return sendViaTwilio(to, message);
  }

  return {
    delivered: true,
    provider: 'none',
    simulated: true
  };
}
