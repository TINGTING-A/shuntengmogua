import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as sodium from "libsodium-wrappers";

export interface E2EEKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface E2EEEncryptedData {
  ciphertext: string;
  nonce: string;
  version: number;
}

@Injectable()
export class E2EEService implements OnModuleInit {
  private readonly logger = new Logger(E2EEService.name);
  private ready = false;
  private keyPairs = new Map<string, E2EEKeyPair>();
  private sharedKeys = new Map<string, string>();

  async onModuleInit() {
    await sodium.ready;
    this.ready = true;
    this.logger.log("libsodium initialized, E2EE service ready");
  }

  private ensureReady(): void {
    if (!this.ready) throw new Error("E2EE service not initialized");
  }

  generateKeyPair(): E2EEKeyPair {
    this.ensureReady();
    const keyPair = sodium.crypto_box_keypair();
    return {
      publicKey: sodium.to_base64(keyPair.publicKey),
      privateKey: sodium.to_base64(keyPair.privateKey),
    };
  }

  registerKeyPair(userId: string): E2EEKeyPair {
    const existing = this.keyPairs.get(userId);
    if (existing) return existing;

    const keyPair = this.generateKeyPair();
    this.keyPairs.set(userId, keyPair);
    this.logger.log(`E2EE key pair registered for user: ${userId}`);
    return keyPair;
  }

  getPublicKey(userId: string): string | null {
    return this.keyPairs.get(userId)?.publicKey || null;
  }

  computeSharedKey(myPrivateKey: string, theirPublicKey: string): string {
    this.ensureReady();

    const cacheKey = `${myPrivateKey.substring(0, 20)}:${theirPublicKey.substring(0, 20)}`;
    const cached = this.sharedKeys.get(cacheKey);
    if (cached) return cached;

    const shared = sodium.crypto_box_beforenm(
      sodium.from_base64(theirPublicKey),
      sodium.from_base64(myPrivateKey),
    );
    const sharedBase64 = sodium.to_base64(shared);
    this.sharedKeys.set(cacheKey, sharedBase64);
    return sharedBase64;
  }

  encrypt(
    plaintext: string,
    sharedKey: string,
  ): E2EEEncryptedData {
    this.ensureReady();

    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const key = sodium.from_base64(sharedKey);

    const ciphertext = sodium.crypto_secretbox_easy(
      plaintext,
      nonce,
      key,
    );

    return {
      ciphertext: sodium.to_base64(ciphertext),
      nonce: sodium.to_base64(nonce),
      version: 1,
    };
  }

  decrypt(
    encrypted: E2EEEncryptedData,
    sharedKey: string,
  ): string {
    this.ensureReady();

    const key = sodium.from_base64(sharedKey);
    const ciphertext = sodium.from_base64(encrypted.ciphertext);
    const nonce = sodium.from_base64(encrypted.nonce);

    const decrypted = sodium.crypto_secretbox_open_easy(
      ciphertext,
      nonce,
      key,
    );

    return sodium.to_string(decrypted);
  }

  encryptForUser(
    plaintext: string,
    recipientUserId: string,
    senderUserId?: string,
  ): { encrypted: E2EEEncryptedData; senderPublicKey: string } | null {
    this.ensureReady();

    const recipientPubKey = this.getPublicKey(recipientUserId);
    if (!recipientPubKey) {
      this.logger.warn(`Recipient ${recipientUserId} has no public key`);
      return null;
    }

    const senderKeyPair = senderUserId
      ? this.keyPairs.get(senderUserId) || this.registerKeyPair(senderUserId)
      : null;

    const myPrivateKey = senderKeyPair?.privateKey;
    if (!myPrivateKey) return null;

    const sharedKey = this.computeSharedKey(myPrivateKey, recipientPubKey);
    const encrypted = this.encrypt(plaintext, sharedKey);

    return {
      encrypted,
      senderPublicKey: senderKeyPair!.publicKey,
    };
  }

  decryptFromUser(
    encrypted: E2EEEncryptedData,
    senderPublicKey: string,
    recipientUserId: string,
  ): string | null {
    this.ensureReady();

    const myKeyPair = this.keyPairs.get(recipientUserId);
    if (!myKeyPair) {
      this.logger.warn(`Recipient ${recipientUserId} has no key pair`);
      return null;
    }

    try {
      const sharedKey = this.computeSharedKey(myKeyPair.privateKey, senderPublicKey);
      return this.decrypt(encrypted, sharedKey);
    } catch (error: any) {
      this.logger.error(`E2EE decrypt failed: ${error.message}`);
      return null;
    }
  }

  generateSymmetricKey(): string {
    this.ensureReady();
    return sodium.to_base64(sodium.crypto_secretbox_keygen());
  }

  encryptSymmetric(plaintext: string, keyBase64: string): E2EEEncryptedData {
    return this.encrypt(plaintext, keyBase64);
  }

  decryptSymmetric(encrypted: E2EEEncryptedData, keyBase64: string): string {
    return this.decrypt(encrypted, keyBase64);
  }

  signMessage(message: string, userId: string): string | null {
    this.ensureReady();
    const keyPair = this.keyPairs.get(userId);
    if (!keyPair) return null;

    const signature = sodium.crypto_sign_detached(
      message,
      sodium.from_base64(keyPair.privateKey),
    );
    return sodium.to_base64(signature);
  }
}
