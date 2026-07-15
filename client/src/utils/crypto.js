// Helpers for client-side End-to-End Encryption (E2EE) using Web Crypto API

// Helper to convert string to Uint8Array
function stringToUint8Array(str) {
  return new TextEncoder().encode(str);
}

// Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  return window.btoa(binary);
}

// Convert Base64 to Uint8Array
function base64ToUint8Array(base64) {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives a 256-bit AES-GCM key from a room password and room ID (acting as a deterministic salt).
 * @param {string} password - The room password entered by the user
 * @param {string} roomId - The room ID (used to make the salt unique per room)
 * @returns {Promise<CryptoKey>} - The derived cryptographic key
 */
export async function deriveRoomKey(password, roomId) {
  const pwBytes = stringToUint8Array(password);
  
  // Use room ID padded/processed as a salt.
  // Web Crypto PBKDF2 requires salt to be at least 8 bytes, so we hash or pad the roomId.
  const saltBytes = stringToUint8Array(roomId.padEnd(8, 'salt-padding'));

  // Import the password as a raw key material
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    pwBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive the AES-GCM key
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // key is not extractable (highly secure)
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a text message using the derived CryptoKey.
 * @param {string} text - Plain text message
 * @param {CryptoKey} key - Derived AES-GCM room key
 * @returns {Promise<{iv: string, ciphertext: string}>} - JSON-friendly encrypted object
 */
export async function encryptText(text, key) {
  const textBytes = stringToUint8Array(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV is standard for GCM

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    textBytes
  );

  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBuffer)
  };
}

/**
 * Decrypts a text message using the derived CryptoKey.
 * @param {{iv: string, ciphertext: string}} encryptedData - The encrypted object
 * @param {CryptoKey} key - Derived AES-GCM room key
 * @returns {Promise<string>} - Decrypted plain text
 */
export async function decryptText(encryptedData, key) {
  try {
    const iv = base64ToUint8Array(encryptedData.iv);
    const ciphertext = base64ToUint8Array(encryptedData.ciphertext);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed. Incorrect key/password?', error);
    return '[Encrypted Message - Decryption Failed]';
  }
}

/**
 * Encrypts a file (ArrayBuffer) using the derived CryptoKey.
 * Returns a new ArrayBuffer containing: [12-byte IV] + [Ciphertext Bytes]
 * @param {ArrayBuffer} fileBuffer - The raw file buffer
 * @param {CryptoKey} key - Derived AES-GCM room key
 * @returns {Promise<ArrayBuffer>} - The encrypted package
 */
export async function encryptFile(fileBuffer, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    fileBuffer
  );

  // Combine IV and Ciphertext into one continuous array buffer
  const encryptedBytes = new Uint8Array(iv.byteLength + ciphertextBuffer.byteLength);
  encryptedBytes.set(iv, 0);
  encryptedBytes.set(new Uint8Array(ciphertextBuffer), iv.byteLength);

  return encryptedBytes.buffer;
}

/**
 * Decrypts a file package (ArrayBuffer: 12-byte IV + Ciphertext) using the derived CryptoKey.
 * @param {ArrayBuffer} encryptedPackageBuffer - The combined encrypted package buffer
 * @param {CryptoKey} key - Derived AES-GCM room key
 * @returns {Promise<ArrayBuffer>} - The decrypted raw file bytes
 */
export async function decryptFile(encryptedPackageBuffer, key) {
  const packageBytes = new Uint8Array(encryptedPackageBuffer);
  
  // Extract IV (first 12 bytes)
  const iv = packageBytes.slice(0, 12);
  
  // Extract Ciphertext (everything after 12 bytes)
  const ciphertext = packageBytes.slice(12);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    ciphertext
  );

  return decryptedBuffer;
}
