import CtaTracking from "../Models/ctaTracking.js";

export const trackCtaClick = async (req, res) => {
  const { pageName , buttonName } = req.body;

  if (!pageName || !buttonName) {
    return res.status(400).json({ message: 'pageName or buttonName is required' });
  }

  try {
    const [cta, created] = await CtaTracking.findOrCreate({
      where: { pageName , buttonName },
      defaults: { clickCount: 1 },
    });

    if (!created) {
      cta.clickCount += 1;
      await cta.save();
    }

    res.status(200).json({ message: 'CTA tracked successfully', data: cta });
  } catch (error) {
    console.error('CTA track error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAllCtaData = async (req, res) => {
  try {
    const allData = await CtaTracking.findAll();
    res.status(200).json(allData);
  } catch (error) {
    console.error('Error fetching CTA data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
