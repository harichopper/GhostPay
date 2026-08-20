const envObj = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

export const API_BASE_URL = envObj?.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000';
export const X402_API_BASE_URL = envObj?.EXPO_PUBLIC_X402_API_URL || 'http://localhost:5000';
