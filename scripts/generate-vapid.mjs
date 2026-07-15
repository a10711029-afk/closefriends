import { createECDH } from "node:crypto";

const keys = createECDH("prime256v1");
keys.generateKeys();

console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + keys.getPublicKey().toString("base64url"));
console.log("VAPID_PRIVATE_KEY=" + keys.getPrivateKey().toString("base64url"));
console.log("VAPID_SUBJECT=mailto:teu-email@dominio.pt");
