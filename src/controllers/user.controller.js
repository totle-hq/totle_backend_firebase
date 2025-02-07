

export const profileSetUp = (req, res) => {
    res.json({
      message: "✅ Authenticated Successfully!",
      user: req.user, // Firebase user info
    });
}
  