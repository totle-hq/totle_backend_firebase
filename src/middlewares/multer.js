import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(), // store in memory
  limits: {
    fileSize: 2 * 1024 * 1024, // 5 MB max size (optional)
  },
});

export default upload;
