import { EmailSubscription } from "../../Models/UserModels/EmailSubscription.Model.js";


export const Subscribe = async (req, res) => {
  const { email } = req.body;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  try {
    const [subscriber, created] = await EmailSubscription.findOrCreate({
      where: { email },
      defaults: {
        subscriptionStatus: "subscribed",
      },
    });

    if (!created && subscriber.subscriptionStatus === "unsubscribed") {
      await subscriber.update({ subscriptionStatus: "subscribed" });
    }

    // Set HttpOnly cookie
    // res.cookie(COOKIE_NAME, email, COOKIE_OPTIONS);

    return res.status(200).json({
      message: created ? "Subscribed successfully" : "Already subscribed",
    });
  } catch (err) {
    console.error("Subscription error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


export const Unsubscribe = async (req, res) => {
  const email = req.cookies[COOKIE_NAME];


  if (!email) {
    return res.status(400).json({ message: "No email cookie found" });
  }

  try {
    const updated = await EmailSubscription.update(
      { subscriptionStatus: "unsubscribed" },
      { where: { email } }
    );

    res.clearCookie(COOKIE_NAME);
    return res.status(200).json({ message: "Unsubscribed successfully" });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
