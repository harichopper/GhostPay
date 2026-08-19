import 'react-native-get-random-values';
if (typeof globalThis.crypto === 'undefined' && typeof global.crypto !== 'undefined') {
  globalThis.crypto = global.crypto;
} else if (typeof globalThis.crypto === 'object' && typeof global.crypto === 'object') {
  if (!globalThis.crypto.getRandomValues && global.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues = global.crypto.getRandomValues;
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
