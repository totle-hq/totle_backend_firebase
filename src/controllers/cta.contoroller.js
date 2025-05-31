
import { CTATracking } from '../Models/ctaTracking.js';

const trackCTA = async (req, res) => {
  const { page, cta_name } = req.body;

  if (!page || !cta_name) {
    return res.status(400).json({ error: 'Missing page or cta_name' });
  }

  try {
    const tracked = await CTATracking.create({ page, cta_name });
    res.status(200).json({ message: 'CTA tracked successfully', tracked });
  } catch (error) {
    console.error('Error tracking CTA:', error);
    res.status(500).json({ error: 'Failed to track CTA' });
  }
};

export { trackCTA };
