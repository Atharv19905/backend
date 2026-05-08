const verifySuperAdmin = (req, res, next) => {
    if (req.user.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied" });
    }
    next();
};

module.exports = verifySuperAdmin