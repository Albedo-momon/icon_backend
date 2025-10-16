import { Router } from 'express';
import heroAdminRouter from './heroBanners';
import specialAdminRouter from './specialOffers';
import laptopAdminRouter from './laptopOffers';

const router = Router();

// Admin: hero banners CRUD under /admin/hero-banners
router.use('/hero-banners', heroAdminRouter);
// Admin: special offers CRUD under /admin/special-offers
router.use('/special-offers', specialAdminRouter);
// Admin: laptop offers CRUD under /admin/laptop-offers
router.use('/laptop-offers', laptopAdminRouter);

export default router;