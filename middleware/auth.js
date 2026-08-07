const jwt = require('jsonwebtoken');

module.exports = (role) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Attach user info to request
      req.user = {
        id: decoded.id,
        role: decoded.role,
        name: decoded.name,
        email: decoded.email
      };
      
      // Check role if specified
      if (role && decoded.role !== role) {
        return res.status(403).json({ 
          error: 'Access denied. Required role: ' + role 
        });
      }
      
      next();
      
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
};
