const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('./auth');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate secure randomized unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Cache metadata of uploaded encrypted files
const fileMetadata = {};

// Upload encrypted file endpoint (protected)
router.post('/upload', auth.authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, size, mimetype, filename } = req.file;
    const fileId = filename.split('.')[0];

    fileMetadata[fileId] = {
      fileId,
      originalName: originalname,
      size,
      mimeType: mimetype,
      filename,
      uploadedBy: req.user.username,
      uploadedAt: new Date().toISOString()
    };

    res.status(201).json({
      message: 'Encrypted file uploaded successfully',
      fileId,
      size,
      mimeType: mimetype
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Download encrypted file endpoint (protected)
router.get('/download/:fileId', auth.authenticateToken, (req, res) => {
  try {
    const { fileId } = req.params;
    const metadata = fileMetadata[fileId];

    if (!metadata) {
      return res.status(404).json({ error: 'File not found or metadata missing' });
    }

    const filePath = path.join(UPLOADS_DIR, metadata.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Encrypted file not found on disk' });
    }

    // Set headers to trigger browser download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.originalName}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

module.exports = router;
