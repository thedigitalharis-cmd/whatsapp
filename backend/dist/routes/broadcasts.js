"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const broadcastController_1 = require("../controllers/broadcastController");
const router = (0, express_1.Router)();
router.get('/', broadcastController_1.getBroadcasts);
router.post('/', broadcastController_1.createBroadcast);
router.post('/:id/launch', broadcastController_1.launchBroadcast);
router.post('/:id/pause', broadcastController_1.pauseBroadcast);
router.get('/:id/stats', broadcastController_1.getBroadcastStats);
exports.default = router;
//# sourceMappingURL=broadcasts.js.map