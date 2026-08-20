import { Platform } from 'react-native';

const defaultApiUrl = 'https://temporary-quick-nitrogen-5tqiukf.vercel.app';
const envApiUrl = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
	?.EXPO_PUBLIC_API_URL;

export const API_BASE_URL = envApiUrl ?? defaultApiUrl;
