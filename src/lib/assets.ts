import { prisma } from '../db/prisma';
import { getS3PublicBase, deleteObjectKey } from './s3';

export function extractS3Key(publicUrl: string): string | null {
  const base = (getS3PublicBase() || '').replace(/\/+$/, '');
  const url = (publicUrl || '').trim();
  if (!base || !url) return null;
  const prefix = `${base}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.substring(prefix.length);
  return key || null;
}

export async function isAssetKeyInUse(
  key: string,
  exclude: { heroId?: string; specialId?: string; laptopId?: string }
): Promise<boolean> {
  if (!key) return false;
  const url = `${getS3PublicBase().replace(/\/+$/, '')}/${key}`;
  // Phase 1: only check hero banners, excluding the current id
  const heroWhere: any = { imageUrl: url };
  if (exclude?.heroId) heroWhere.NOT = { id: exclude.heroId };
  const hero = await prisma.heroBanner.findFirst({ where: heroWhere });
  if (hero) return true;
  // TODO: Extend checks for special offers and laptop offers in phase 2
  // const special = await prisma.specialOffer.findFirst({ where: { imageUrl: url, NOT: { id: exclude.specialId } } });
  // if (special) return true;
  // const laptop = await prisma.laptopOffer.findFirst({ where: { imageUrl: url, NOT: { id: exclude.laptopId } } });
  // if (laptop) return true;
  return false;
}

export async function maybeDeleteOldAsset(
  entity: 'hero' | 'special' | 'laptop',
  oldUrl: string,
  excludeIds: { heroId?: string; specialId?: string; laptopId?: string }
): Promise<{ deleted: boolean; key?: string; error?: Error; reason?: 'invalid_domain' | 'in_use' | 'error' }> {
  const oldKey = extractS3Key(oldUrl);
  if (!oldKey) {
    return { deleted: false, reason: 'invalid_domain' };
  }
  const inUse = await isAssetKeyInUse(oldKey, excludeIds);
  if (inUse) {
    return { deleted: false, key: oldKey, reason: 'in_use' };
  }
  try {
    await deleteObjectKey(oldKey);
    return { deleted: true, key: oldKey };
  } catch (err: any) {
    return { deleted: false, key: oldKey, error: err, reason: 'error' };
  }
}