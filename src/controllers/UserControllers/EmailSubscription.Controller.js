import { Op } from "sequelize";
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


export const getAllSubscriptions = async (req, res) => {
  const {
    search = "",
    status = "",
    sortBy = "subscribedAt",
    order = "desc",
    page = 1,
    limit = 20,
  } = req.query;

  const whereClause = {};
  if (search) {
    whereClause.email = { [Op.iLike]: `%${search}%` };
  }
  if (status) {
    whereClause.subscriptionStatus = status;
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const subscriptions = await EmailSubscription.findAll({
      where: whereClause,
      order: [[sortBy, order]],
      limit: parseInt(limit),
      offset,
    });

    return res.status(200).json(subscriptions);
  } catch (err) {
    console.error("Fetch subscriptions error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};