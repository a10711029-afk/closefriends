import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
} from "node:crypto";

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function encodeBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function hkdfExtract(salt: Buffer, input: Buffer) {
  return createHmac("sha256", salt).update(input).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  const chunks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let counter = 1;
  while (Buffer.concat(chunks).length < length) {
    previous = createHmac("sha256", prk)
      .update(Buffer.concat([previous, info, Buffer.from([counter])]))
      .digest();
    chunks.push(previous);
    counter += 1;
  }
  return Buffer.concat(chunks).subarray(0, length);
}

function createVapidToken(endpoint: string, subject: string, publicKey: string, privateKey: string) {
  const publicBytes = decodeBase64Url(publicKey);
  const privateBytes = decodeBase64Url(privateKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32) {
    throw new Error("Invalid VAPID keys");
  }

  const header = encodeBase64Url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = encodeBase64Url(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  }));
  const unsigned = `${header}.${payload}`;
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: encodeBase64Url(publicBytes.subarray(1, 33)),
      y: encodeBase64Url(publicBytes.subarray(33, 65)),
      d: encodeBase64Url(privateBytes),
    },
    format: "jwk",
  });
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${encodeBase64Url(signature)}`;
}

function encryptPayload(payload: string, receiverPublicKey: string, authSecret: string) {
  const receiverKey = decodeBase64Url(receiverPublicKey);
  const auth = decodeBase64Url(authSecret);
  const sender = createECDH("prime256v1");
  sender.generateKeys();
  const senderKey = sender.getPublicKey(undefined, "uncompressed");
  const sharedSecret = sender.computeSecret(receiverKey);

  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    receiverKey,
    senderKey,
  ]);
  const inputKey = hkdfExpand(hkdfExtract(auth, sharedSecret), keyInfo, 32);
  const salt = randomBytes(16);
  const prk = hkdfExtract(salt, inputKey);
  const contentKey = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\0"), 12);
  const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);

  return Buffer.concat([salt, recordSize, Buffer.from([senderKey.length]), senderKey, encrypted]);
}

export async function sendWebPush(options: {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  subject: string;
}) {
  const body = encryptPayload(options.payload, options.p256dh, options.auth);
  const token = createVapidToken(
    options.endpoint,
    options.subject,
    options.vapidPublicKey,
    options.vapidPrivateKey,
  );
  const response = await fetch(options.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${token}, k=${options.vapidPublicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body,
  });
  if (!response.ok) {
    const error = new Error(`Push service returned ${response.status}`) as Error & { statusCode: number };
    error.statusCode = response.status;
    throw error;
  }
}
