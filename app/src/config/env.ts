import { Platform } from 'react-native';

const defaultApiUrl = 'http://192.168.0.127:4000';
const envApiUrl = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
	?.EXPO_PUBLIC_API_URL;

export const API_BASE_URL = envApiUrl ?? defaultApiUrl;
