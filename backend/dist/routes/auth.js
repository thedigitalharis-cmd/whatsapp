"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/register', authController_1.register);
router.post('/login', authController_1.login);
router.post('/logout', auth_1.authMiddleware, authController_1.logout);
router.post('/refresh', authController_1.refreshToken);
router.get('/profile', auth_1.authMiddleware, authController_1.getProfile);
router.post('/2fa/setup', auth_1.authMiddleware, authController_1.setup2FA);
router.post('/2fa/verify', auth_1.authMiddleware, authController_1.verify2FA);
exports.default = router;
//# sourceMappingURL=auth.js.map