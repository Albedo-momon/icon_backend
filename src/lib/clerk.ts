import { authConfig } from '../config/auth';
import { logger } from '../config/logger';

export interface ClerkUserInfo {
  // With exactOptionalPropertyTypes enabled, optional props do not implicitly include undefined.
  // Explicitly allow undefined so assignments like `email: string | undefined` are valid.
  email?: string | undefined;
  name?: string | undefined;
}

export async function fetchClerkUserInfo(userId: string): Promise<ClerkUserInfo | null> {
  try {
    const secret = authConfig.clerkSecretKey;
    if (!secret) {
      logger.warn('CLERK_SECRET_KEY not configured; cannot fetch user info from Clerk');
      return null;
    }
    const resp = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status }, 'Failed to fetch Clerk user');
      return null;
    }
    const data: any = await resp.json();
    const primaryId = data?.primary_email_address_id;
    const emails: any[] = Array.isArray(data?.email_addresses) ? data.email_addresses : [];
    const primary = emails.find((e) => e?.id === primaryId);
    const fallback = emails[0];
    const email: string | undefined = primary?.email_address || fallback?.email_address;
    const name: string | undefined = [data?.first_name, data?.last_name].filter(Boolean).join(' ') || undefined;
    return { email, name };
  } catch (error) {
    logger.error({ error }, 'Error fetching Clerk user info');
    return null;
  }
}