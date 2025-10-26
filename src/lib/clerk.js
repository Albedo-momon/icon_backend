"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchClerkUserInfo = fetchClerkUserInfo;
const auth_1 = require("../config/auth");
const logger_1 = require("../config/logger");
async function fetchClerkUserInfo(userId) {
    try {
        const secret = auth_1.authConfig.clerkSecretKey;
        if (!secret) {
            logger_1.logger.warn('CLERK_SECRET_KEY not configured; cannot fetch user info from Clerk');
            return null;
        }
        const resp = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
            headers: {
                Authorization: `Bearer ${secret}`,
            },
        });
        if (!resp.ok) {
            logger_1.logger.warn({ status: resp.status }, 'Failed to fetch Clerk user');
            return null;
        }
        const data = await resp.json();
        const primaryId = data?.primary_email_address_id;
        const emails = Array.isArray(data?.email_addresses) ? data.email_addresses : [];
        const primary = emails.find((e) => e?.id === primaryId);
        const fallback = emails[0];
        const email = primary?.email_address || fallback?.email_address;
        const name = [data?.first_name, data?.last_name].filter(Boolean).join(' ') || undefined;
        return { email, name };
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Error fetching Clerk user info');
        return null;
    }
}
