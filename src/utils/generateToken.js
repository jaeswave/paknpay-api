const generateSessionToken = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = 'PRK-';
  for (let i = 0; i < 4; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
};

module.exports = { generateSessionToken };
