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
  if (!ciphertext || ciphertext.trim() === '') {
    return '';
  }
  if (!ciphertext.startsWith('enc:gcm:')) {
    throw new Error('Fail closed: Gateway credential must be GCM encrypted.');
  }
  try {
    const key = getEncryptionKey();
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
  } catch (err) {
    console.error('[PaymentGateway] Decryption authentication error:', err);
    throw new Error(`Failed to decrypt payment gateway secret: ${(err as Error).message}`);
  }
}

export class PaymentGatewayManager {
  private state: PaymentGatewaysState;

  constructor() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
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

  public async verifyPayoutSettlement(params: { method: string; providerReference: string; amount: number; payoutId: string }): Promise<{ verified: boolean; providerTxId: string; status: string }> {
    const isProd = process.env.NODE_ENV === 'production';
    const env = isProd ? 'production' : 'sandbox';
    const ref = params.providerReference ? params.providerReference.trim() : '';

    let gwName: 'paypal' | 'stripe' | 'razorpay' | null = null;
    const lowerMethod = params.method.toLowerCase();
    if (lowerMethod.includes('paypal')) gwName = 'paypal';
    else if (lowerMethod.includes('stripe')) gwName = 'stripe';
    else if (lowerMethod.includes('razorpay') || lowerMethod.includes('upi')) gwName = 'razorpay';

    const gw = gwName ? this.getGateway(gwName, env) : null;
    const hasCredentials = gw && gw.enabled && gw.clientId && gw.clientSecret;

    if (!hasCredentials) {
      if (isProd) {
        throw new Error(`Payout provider configuration missing or disabled for method "${params.method}" in production. Settlement verification fails closed.`);
      }
      const simAllowed = process.env.PAYMENT_SIMULATION_ENABLED === 'true';
      if (!simAllowed) {
        throw new Error(`Payout provider credentials missing for method "${params.method}". Enable provider credentials or configure PAYMENT_SIMULATION_ENABLED=true for explicit development simulation.`);
      }
      if (!ref || ref.startsWith('MOCK') || ref.startsWith('SYNTHETIC') || ref.startsWith('GW-SETTLE-SIM')) {
        return {
          verified: true,
          providerTxId: ref || `SIM-TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
          status: 'settled'
        };
      }
    }

    if (!ref) {
      throw new Error('Provider transaction reference is required for payout settlement verification.');
    }

    try {
      if (gwName === 'stripe' && gw && gw.clientSecret) {
        const response = await fetch(`https://api.stripe.com/v1/transfers/${ref}`, {
          headers: { 'Authorization': `Bearer ${gw.clientSecret}` }
        });
        if (!response.ok) {
          throw new Error(`Stripe transfer lookup failed with status ${response.status}`);
        }
        const data: any = await response.json();
        if (data.currency?.toLowerCase() !== 'usd') {
          throw new Error('Payout currency mismatch: expected USD');
        }
        if (Math.abs(Number(data.amount) / 100 - params.amount) > 0.01) {
          throw new Error('Payout amount mismatch with provider record');
        }
        return { verified: true, providerTxId: data.id, status: 'settled' };
      }

      return {
        verified: true,
        providerTxId: ref,
        status: 'settled'
      };
    } catch (err: any) {
      console.error(`[PaymentGateways] Provider settlement verification error for payout ${params.payoutId}:`, err.message);
      if (isProd) {
        throw new Error(`Provider payout settlement verification failed: ${err.message}`);
      }
      throw err;
    }
  }

  public async createCheckoutSession(params: {
    gateway: 'stripe' | 'paypal' | 'razorpay';
    amount: number;
    currency: string;
    userId: string;
    orderId?: string;
    purpose?: string;
    checkoutId: string;
  }): Promise<{ providerSessionId: string; checkoutUrl: string }> {
    const isProd = process.env.NODE_ENV === 'production';
    const env = isProd ? 'production' : 'sandbox';
    
    if (params.currency !== 'USD') {
      throw new Error('Only USD currency is supported for payment checkout sessions.');
    }
    if (params.amount < 1.00) {
      throw new Error('Minimum checkout amount is $1.00 USD.');
    }

    const gw = this.getGateway(params.gateway, env);
    const hasCredentials = gw && gw.enabled && gw.clientId && gw.clientSecret;

    if (!hasCredentials) {
      if (isProd) {
        throw new Error(`Payment gateway "${params.gateway.toUpperCase()}" is not enabled or configured in production environment. Checkout fails closed.`);
      }
      const simAllowed = process.env.PAYMENT_SIMULATION_ENABLED === 'true';
      if (!simAllowed) {
        throw new Error(`Payment gateway "${params.gateway.toUpperCase()}" credentials missing. Set gateway credentials or configure PAYMENT_SIMULATION_ENABLED=true for explicit development simulation.`);
      }
      const simProviderSessionId = `sess_sim_${params.gateway}_${crypto.randomBytes(12).toString('hex')}`;
      const checkoutUrl = `/checkout/pay?session_id=${params.checkoutId}&gateway=${params.gateway}&amount=${params.amount}&simulated=true`;
      return { providerSessionId: simProviderSessionId, checkoutUrl };
    }

    try {
      if (params.gateway === 'stripe') {
        const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${gw.clientSecret}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            'mode': 'payment',
            'success_url': `https://fivepa.app/checkout/success?session_id=${params.checkoutId}`,
            'cancel_url': `https://fivepa.app/checkout/cancel?session_id=${params.checkoutId}`,
            'client_reference_id': params.checkoutId,
            'line_items[0][price_data][currency]': 'usd',
            'line_items[0][price_data][unit_amount]': String(Math.round(params.amount * 100)),
            'line_items[0][price_data][product_data][name]': `FivePA ${params.purpose || 'Deposit'}`,
            'line_items[0][quantity]': '1',
            'metadata[userId]': params.userId,
            'metadata[checkoutId]': params.checkoutId
          }).toString()
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Stripe provider error (${response.status}): ${errText}`);
        }
        const data: any = await response.json();
        return {
          providerSessionId: data.id,
          checkoutUrl: data.url || `/checkout/pay?session_id=${params.checkoutId}`
        };
      } else if (params.gateway === 'paypal') {
        const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${gw.clientId}:${gw.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'grant_type=client_credentials'
        });
        if (!tokenRes.ok) throw new Error('PayPal auth handshake failed.');
        const tokenData: any = await tokenRes.json();
        const orderRes = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
              reference_id: params.checkoutId,
              amount: { currency_code: 'USD', value: params.amount.toFixed(2) }
            }]
          })
        });
        if (!orderRes.ok) throw new Error('PayPal order creation failed.');
        const orderData: any = await orderRes.json();
        const approveLink = orderData.links?.find((l: any) => l.rel === 'approve')?.href;
        return {
          providerSessionId: orderData.id,
          checkoutUrl: approveLink || `/checkout/pay?session_id=${params.checkoutId}`
        };
      } else {
        throw new Error(`Unsupported payment provider "${params.gateway}".`);
      }
    } catch (err: any) {
      console.error(`[PaymentGateways] Real provider checkout session creation failed for ${params.gateway}:`, err.message);
      if (isProd) {
        throw new Error(`Payment gateway provider error: ${err.message}`);
      }
      throw err;
    }
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
