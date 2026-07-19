const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { login, signupOwner, createAttendant, getMe, updateLotId, getLotAttendants, addAttendant, removeAttendant } = require('../controllers/attendant.controller');

router.post('/login', login);
router.post('/signup', signupOwner); // one call: creates lot + owner attendant together
router.post('/create', createAttendant);
router.get('/me', protect, getMe);
router.patch('/:id/lot', protect, updateLotId);
router.get('/lot/:lotId', protect, getLotAttendants);
router.post('/add', protect, addAttendant);
router.patch('/:id/remove', protect, removeAttendant);

module.exports = router;
