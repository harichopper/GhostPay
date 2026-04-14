import { Platform } from 'react-native';

const defaultApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
const envApiUrl = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
	?.EXPO_PUBLIC_API_URL;

export const API_BASE_URL = envApiUrl ?? defaultApiUrl;
