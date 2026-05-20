const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const controller = require('../controllers/announcement.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 50 * 1024 * 1024
  }
});

router.post('/create', auth, upload.array('media', 5), controller.createAnnouncement);
router.get('/feed', auth, controller.getAnnouncementFeed);
router.get('/:id', auth, controller.getAnnouncementById);
router.put('/:id', auth, upload.array('media', 5), controller.updateAnnouncement);
router.delete('/:id', auth, controller.deleteAnnouncement);
router.post('/:id/like', auth, controller.likeAnnouncement);
router.post('/:id/view', auth, controller.viewAnnouncement);

module.exports = router;
