import express from 'express';
const router = express.Router();

import { loginUser, logoutUser } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { loginSchema } from '../validators/auth.validator.js';

router.post('/login', validate(loginSchema), loginUser);
router.post('/logout', logoutUser);

export default router;
