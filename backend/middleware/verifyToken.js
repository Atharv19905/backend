const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: "Token missing" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, "SECRET_KEY");

        // ✅ IMPORTANT: ensure required fields exist
        if (
            decoded.role !== "super_admin" &&
            (!decoded.organization_id || !decoded.department_id)
        ) {
            return res.status(403).json({
                message: "Invalid token data"
            });
        }

        req.user = decoded;

        next();

    } catch (err) {
        res.status(401).json({ message: "Invalid token" });
    }
}

module.exports = verifyToken;