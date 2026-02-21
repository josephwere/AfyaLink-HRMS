import crypto from 'crypto';
const ALGO = 'aes-256-gcm';

export function encrypt(text, key){
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, Buffer.from(key,'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('hex');
}

export function decrypt(encHex, key){
  const data = Buffer.from(encHex,'hex');
  const iv = data.slice(0,12);
  const tag = data.slice(12,28);
  const encrypted = data.slice(28);
  const decipher = crypto.createDecipheriv(ALGO, Buffer.from(key,'hex'), iv);
  decipher.setAuthTag(tag);
  const txt = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  return txt;
}

// derive key from passphrase using PBKDF2 with provided salt
export function deriveKeyFromPassword(password, salt='afyalink_salt_2025', iterations=150000){
  return crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
}

// Re-encrypt settings when admin changes password: decrypt using oldKey, encrypt using newKey
export function reencryptSettings(doc, oldKey, newKey){
  const out = JSON.parse(JSON.stringify(doc)); // clone plain object
  // handle stripe secret
  try{
    if(out.stripe && out.stripe._enc){
      const plain = decrypt(out.stripe._enc, oldKey);
      out.stripe._enc = encrypt(plain, newKey);
    }
  }catch(e){ throw new Error('Failed to re-encrypt stripe: ' + e.message); }

  try{
    if(out.mpesa && out.mpesa._enc){
      const plain = decrypt(out.mpesa._enc, oldKey);
      out.mpesa._enc = encrypt(plain, newKey);
    }
  }catch(e){ throw new Error('Failed to re-encrypt mpesa: ' + e.message); }

  try{
    if(out.flutterwave && out.flutterwave._enc){
      const plain = decrypt(out.flutterwave._enc, oldKey);
      out.flutterwave._enc = encrypt(plain, newKey);
    }
  }catch(e){ throw new Error('Failed to re-encrypt flutterwave: ' + e.message); }

  return out;
}
