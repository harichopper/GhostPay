import 'react-native-get-random-values';

// Polyfill crypto and getRandomValues across all global scopes for algosdk & crypto operations
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {};
}
if (typeof global.crypto === 'undefined') {
  global.crypto = globalThis.crypto;
}

if (!globalThis.crypto.getRandomValues && typeof global.crypto.getRandomValues === 'function') {
  globalThis.crypto.getRandomValues = global.crypto.getRandomValues;
}
if (!global.crypto.getRandomValues && typeof globalThis.crypto.getRandomValues === 'function') {
  global.crypto.getRandomValues = globalThis.crypto.getRandomValues;
}

if (typeof window !== 'undefined') {
  if (typeof window.crypto === 'undefined') {
    window.crypto = globalThis.crypto;
  }
  if (!window.crypto.getRandomValues && globalThis.crypto.getRandomValues) {
    window.crypto.getRandomValues = globalThis.crypto.getRandomValues;
  }
}

import { Buffer } from 'buffer';

class CustomTextDecoder {
  encoding = 'utf-8';
  decode(buffer) {
    if (!buffer) return '';
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let str = '';
    for (let i = 0; i < uint8.length; i++) {
      str += String.fromCharCode(uint8[i]);
    }
    try {
      return decodeURIComponent(escape(str));
    } catch {
      return str;
    }
  }
}

class CustomTextEncoder {
  encoding = 'utf-8';
  encode(str = '') {
    const utf8 = unescape(encodeURIComponent(str));
    const result = new Uint8Array(utf8.length);
    for (let i = 0; i < utf8.length; i++) {
      result[i] = utf8.charCodeAt(i);
    }
    return result;
  }
}

// Attach polyfills to global scope before any module or route evaluates
globalThis.TextDecoder = CustomTextDecoder;
globalThis.TextEncoder = CustomTextEncoder;
if (typeof global !== 'undefined') {
  global.TextDecoder = CustomTextDecoder;
  global.TextEncoder = CustomTextEncoder;
}

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
  if (typeof global !== 'undefined') {
    global.Buffer = Buffer;
  }
}

// Now load Expo Router entry point after polyfills are active
import 'expo-router/entry';
