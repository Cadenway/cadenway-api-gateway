import {
  CompleteOAuthSignInInternalBody,
  FinishFederatedSignInInternalBody,
} from '@cadenway/contracts/validators/internal/identity-service';
import type { Request } from 'express';
import type { z } from 'zod';

const FLOW_COOKIE = '__Host-cw_federated_flow';
const RECEIPT_COOKIE = '__Host-cw_federated_receipt';

function flowSameSite(provider: 'oauth' | 'saml'): 'Lax' | 'None' {
  return provider === 'saml' ? 'None' : 'Lax';
}

/** Immediately expires a previous browser receipt. */
export const CLEARED_FEDERATED_RECEIPT_COOKIE: string = cookie(RECEIPT_COOKIE, '', 'Lax', 0);

function cookie(name: string, value: string, sameSite: 'Lax' | 'None', maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Secure; HttpOnly; SameSite=${sameSite}; Max-Age=${String(maxAge)}`;
}

function expiry(expiresAt: string, maximumSeconds: number): number {
  const remaining = Math.floor((Date.parse(expiresAt) - Date.now()) / 1000);
  return Math.max(0, Math.min(remaining, maximumSeconds));
}

/** Sets the flow binding on the Gateway host for up to ten minutes. */
export function federatedFlowCookie(
  binding: string,
  expiresAt: string,
  provider: 'oauth' | 'saml',
): string {
  return cookie(FLOW_COOKIE, binding, flowSameSite(provider), expiry(expiresAt, 600));
}

/** Establishes the short-lived receipt and expires the original flow binding. */
export function federatedContinuationCookies(
  receipt: string,
  expiresAt: string,
  provider: 'oauth' | 'saml',
): readonly string[] {
  return [
    cookie(RECEIPT_COOKIE, receipt, 'Lax', expiry(expiresAt, 120)),
    cookie(FLOW_COOKIE, '', flowSameSite(provider), 0),
  ];
}

function opaqueCookie(
  request: Request,
  name: string,
  schema: z.ZodType<string>,
): string | undefined {
  const cookies = request.cookies as Readonly<Record<string, unknown>> | undefined;
  const result = schema.safeParse(cookies?.[name]);
  return result.success ? result.data : undefined;
}

/** Accepts a candidate flow binding only from the dedicated HTTP-only cookie. */
export function readFederatedFlow(request: Request): string | undefined {
  return opaqueCookie(request, FLOW_COOKIE, CompleteOAuthSignInInternalBody.shape.browserBinding);
}

/** Accepts a candidate receipt only from the dedicated HTTP-only cookie. */
export function readFederatedReceipt(request: Request): string | undefined {
  return opaqueCookie(request, RECEIPT_COOKIE, FinishFederatedSignInInternalBody.shape.receipt);
}
