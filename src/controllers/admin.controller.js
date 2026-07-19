const jwt = require('jsonwebtoken');

// Simple shared-secret admin login — no separate Admin collection needed
// for a solo-operator MVP. Set ADMIN_SECRET in your .env to whatever you
// want; anyone who enters it gets a platform_admin token.
const adminLogin = async (req, res) => {
  try {
    const { secret } = req.body;
    if (!process.env.ADMIN_SECRET) {
      return res.status(500).json({ message: 'ADMIN_SECRET is not configured on the server' });
    }
    if (secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ message: 'Incorrect admin secret' });
    }

    const token = jwt.sign({ role: 'platform_admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ message: 'Admin login successful', token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { adminLogin };
