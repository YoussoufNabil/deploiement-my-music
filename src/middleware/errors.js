function notFound(req, res) {
  res.status(404).json({ error: 'Resource not found.' });
}

function errorHandler(error, req, res, _next) {
  console.error(error);
  if (res.headersSent) return;

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 50 MB.' });
  }
  if (error.name === 'MulterError') {
    return res.status(400).json({ error: error.message });
  }
  if (error.status && error.status < 500) {
    return res.status(error.status).json({ error: error.message });
  }
  return res.status(500).json({ error: 'Internal server error.' });
}

module.exports = { notFound, errorHandler };
