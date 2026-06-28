function getHealth(_req, res) {
  return res.status(200).json({
    status: "ok",
    service: "finsight-backend",
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  getHealth,
};
