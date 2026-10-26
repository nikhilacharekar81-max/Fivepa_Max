import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface GatewayConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  webhookId: string;
  primary: boolean;
}

export interface EnvironmentGateways {
  paypal: GatewayConfig;
  stripe: GatewayConfig;
  razorpay: GatewayConfig;
}

export interface PaymentGatewaysState {
  production: EnvironmentGateways;
  sandbox: EnvironmentGateways;
}

const DEFAULT_GATEWAY: GatewayConfig = {
  enabled: false,
  clientId: '',
  clientSecret: '',
  webhookId: '',
  primary: false
};

const DEFAULT_ENV_GATEWAYS: EnvironmentGateways = {
  paypal: { ...DEFAULT_GATEWAY, primary: true },
  stripe: { ...DEFAULT_GATEWAY },
  razorpay: { ...DEFAULT_GATEWAY }
};

const DEFAULT_STATE: PaymentGatewaysState = {
  production: JSON.parse(JSON.stringify(DEFAULT_ENV_GATEWAYS)),
  sandbox: JSON.parse(JSON.stringify(DEFAULT_ENV_GATEWAYS))
};

const ALGORITHM = 'aes-256-cbc';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.GATEWAY_ENCRYPTION_KEY;
  if (!keyHex || keyHex.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: GATEWAY_ENCRYPTION_KEY secret is required in production.');
    }
    return crypto.createHash('sha256').update('dev_mode_fixed_gateway_encryption_key_12345').digest();
  }
  return crypto.createHash('sha256').update(keyHex).digest();
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext || plaintext.trim() === '' || plaintext.includes('••••')) return plaintext;
  if (plaintext.startsWith('enc:')) return plaintext;
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `enc:gcm:${iv.toString('hex')}:${tag}:${encrypted}`;
  } catch (err) {
    console.error('[PaymentGateway] Encryption error (failing closed):', err);
    throw err;
  }
}

export function decryptSecret(ciphertext: string): string {
  if (!ciphertext || !ciphertext.startsWith('enc:')) {
    return ciphertext; // Plaintext fallback for migration
  }
  try {
    const key = getEncryptionKey();
    if (ciphertext.startsWith('enc:gcm:')) {
      const parts = ciphertext.split(':');
      if (parts.length !== 5) {
        throw new Error('Malformed GCM encrypted secret format.');
      }
      const iv = Buffer.from(parts[2], 'hex');
      const tag = Buffer.from(parts[3], 'hex');
      const encryptedText = parts[4];
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } else {
      // Legacy CBC format: enc:<iv>:<ciphertext>
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new Error('Malformed CBC encrypted secret format.');
      }
      const iv = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
  } catch (err) {
    console.error('[PaymentGateway] Decryption error:', err);
    throw new Error(`Failed to decrypt payment gateway secret: ${(err as Error).message}`);
  }
}

export class PaymentGatewayManager {
  private state: PaymentGatewaysState;

  constructor() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.loadFromDisk();
  }

  public loadFromState(parsed: any) {
    if (parsed && typeof parsed === 'object') {
      const decryptGw = (gw: any): GatewayConfig => {
        const conf: GatewayConfig = { ...DEFAULT_GATEWAY, ...(gw || {}) };
        if (conf.clientSecret) {
          conf.clientSecret = decryptSecret(conf.clientSecret);
        }
        return conf;
      };
      this.state = {
        production: {
          paypal: decryptGw(parsed.production?.paypal),
          stripe: decryptGw(parsed.production?.stripe),
          razorpay: decryptGw(parsed.production?.razorpay)
        },
        sandbox: {
          paypal: decryptGw(parsed.sandbox?.paypal),
          stripe: decryptGw(parsed.sandbox?.stripe),
          razorpay: decryptGw(parsed.sandbox?.razorpay)
        }
      };
    }
  }

  private loadFromDisk() {
    // Deprecated: Payment gateways are now loaded from PostgreSQL via hydrateStoreFromPostgres()
  }

  public getState(): PaymentGatewaysState {
    return this.state;
  }

  public getGateway(gatewayName: 'paypal' | 'stripe' | 'razorpay', env: 'production' | 'sandbox' = 'sandbox'): GatewayConfig {
    return this.state[env]?.[gatewayName];
  }

  public getEncryptedState(): PaymentGatewaysState {
    return {
      production: {
        paypal: { ...this.state.production.paypal, clientSecret: encryptSecret(this.state.production.paypal.clientSecret) },
        stripe: { ...this.state.production.stripe, clientSecret: encryptSecret(this.state.production.stripe.clientSecret) },
        razorpay: { ...this.state.production.razorpay, clientSecret: encryptSecret(this.state.production.razorpay.clientSecret) }
      },
      sandbox: {
        paypal: { ...this.state.sandbox.paypal, clientSecret: encryptSecret(this.state.sandbox.paypal.clientSecret) },
        stripe: { ...this.state.sandbox.stripe, clientSecret: encryptSecret(this.state.sandbox.stripe.clientSecret) },
        razorpay: { ...this.state.sandbox.razorpay, clientSecret: encryptSecret(this.state.sandbox.razorpay.clientSecret) }
      }
    };
  }

  public async saveToDatabase(): Promise<void> {
    const secureState = this.getEncryptedState();
    const { postgresStore } = await import('../../db/postgresStore.js');
    await postgresStore.savePaymentGateways(secureState);
  }

  public saveToDisk() {
    this.saveToDatabase().catch(err => {
      console.error('[PaymentGatewayManager] Failed to save payment gateways in background:', err);
    });
  }

  public getMaskedState(): PaymentGatewaysState {
    const maskSecret = (secret: string) => {
      if (!secret || secret.trim() === '') return '';
      return '••••••••••••••••';
    };

    const maskEnv = (envGw: EnvironmentGateways): EnvironmentGateways => ({
      paypal: { ...envGw.paypal, clientSecret: maskSecret(envGw.paypal.clientSecret) },
      stripe: { ...envGw.stripe, clientSecret: maskSecret(envGw.stripe.clientSecret) },
      razorpay: { ...envGw.razorpay, clientSecret: maskSecret(envGw.razorpay.clientSecret) }
    });

    return {
      production: maskEnv(this.state.production),
      sandbox: maskEnv(this.state.sandbox)
    };
  }

  public async updateGateway(env: 'production' | 'sandbox', gatewayName: 'paypal' | 'stripe' | 'razorpay', updates: Partial<GatewayConfig>): Promise<EnvironmentGateways> {
    if (env !== 'production' && env !== 'sandbox') throw new Error('Invalid environment.');
    if (!['paypal', 'stripe', 'razorpay'].includes(gatewayName)) throw new Error('Invalid gateway.');

    const envState = this.state[env];
    const current = envState[gatewayName];

    let secret = current.clientSecret;
    if (updates.clientSecret !== undefined) {
      if (updates.clientSecret && !updates.clientSecret.includes('••••')) {
        secret = encryptSecret(updates.clientSecret);
      }
    }

    const nextPrimary = updates.primary !== undefined ? Boolean(updates.primary) : current.primary;

    if (nextPrimary) {
      envState.paypal.primary = gatewayName === 'paypal';
      envState.stripe.primary = gatewayName === 'stripe';
      envState.razorpay.primary = gatewayName === 'razorpay';
    }

    envState[gatewayName] = {
      enabled: updates.enabled !== undefined ? Boolean(updates.enabled) : current.enabled,
      clientId: updates.clientId !== undefined ? String(updates.clientId).trim() : current.clientId,
      clientSecret: secret,
      webhookId: updates.webhookId !== undefined ? String(updates.webhookId).trim() : current.webhookId,
      primary: nextPrimary
    };

    await this.saveToDatabase();
    return this.state[env];
  }

  public testConnection(env: 'production' | 'sandbox', gatewayName: 'paypal' | 'stripe' | 'razorpay'): { success: boolean; message: string } {
    const envState = this.state[env];
    const gw = envState[gatewayName];

    if (!gw.enabled) {
      return { success: false, message: `${gatewayName.toUpperCase()} (${env}) is currently disabled. Enable the gateway before testing connection.` };
    }
    if (!gw.clientId || !gw.clientSecret) {
      return { success: false, message: `Missing Client ID or Client Secret for ${gatewayName.toUpperCase()} (${env}).` };
    }

    return {
      success: false,
      message: `${gatewayName.toUpperCase()} (${env}) configuration structure is valid and securely stored. Live API handshake endpoint is not yet activated.`
    };
  }
}

export const paymentGatewayManager = new PaymentGatewayManager();
