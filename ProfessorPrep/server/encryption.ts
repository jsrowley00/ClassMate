import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY || process.env.SESSION_SECRET || process.env.CLERK_SECRET_KEY;
  if (!key) {
    console.warn('Warning: No encryption key found. Using fallback key - set TOKEN_ENCRYPTION_KEY for production.');
  }
  const effectiveKey = key || crypto.randomBytes(32).toString('hex');
  return crypto.createHash('sha256').update(effectiveKey).digest();
}

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptToken(encryptedToken: string): string {
  try {
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) {
      return encryptedToken;
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    return encryptedToken;
  }
}

export function isEncrypted(token: string): boolean {
  const parts = token.split(':');
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32;
}
