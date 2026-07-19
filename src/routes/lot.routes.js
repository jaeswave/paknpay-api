const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createLot, getLotByShortCode, getLotById, updateLot, getLotStats } = require('../controllers/lot.controller');

router.get('/code/:code', getLotByShortCode);
router.get('/:id', protect, getLotById);
router.post('/', protect, createLot);
router.patch('/:id', protect, updateLot);
router.get('/:id/stats', protect, getLotStats);

module.exports = router;
