import PlatformCtaTracking from "../Models/PlatformCtaTracking.js";

export const savePlatformCta = async (req, res) => {
  const { userEmail, buttonName, pageName } = req.body;

  if (!userEmail || !buttonName) {
    return res.sendStatus(204);
  }

  try {
    await PlatformCtaTracking.create({
      userEmail,
      buttonName,
      pageName,
    });

    res.sendStatus(204); 
  } catch (error) {
    
    res.sendStatus(204);
  }
};
