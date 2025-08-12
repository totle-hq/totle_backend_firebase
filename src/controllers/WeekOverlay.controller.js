import { Session } from '../Models/SessionModel.js';
import { CatalogueNode } from '../Models/CatalogModels/catalogueNode.model.js';
import { Op } from 'sequelize';

export const getWeekBookings = async (req, res) => { // FIXED: Added req, res parameters
  try {
    const userId = req.user.id;
    
    // Current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 7 days from today
    const weekLater = new Date(today);
    weekLater.setDate(today.getDate() + 7);

    // Finding data from session model and topic from catalogue.node.model
    const sessions = await Session.findAll({
      where: {
        [Op.or]: [
          { teacher_id: userId },
          { student_id: userId }
        ],
        scheduled_at: {
          [Op.between]: [today, weekLater]
        }
      },
      include: [
        {
          model: CatalogueNode,
          as: "topic",
          attributes: ["node_id", "name"]
        }
      ],
      order: [["scheduled_at", "ASC"]]
    });

    // Now mapping the output value
    const formatted = sessions.map(session => {
      // Whether it is learner || teacher || Endeavour
      const isTeaching = session.teacher_id === userId;
      
      // Start date of session
      const startTime = new Date(session.scheduled_at);
      
      // Calculate actual end time using duration_minutes from Session model
      const endTime = new Date(startTime);
      endTime.setMinutes(startTime.getMinutes() + session.duration_minutes);

      // FIXED: Determine booking type including Endeavour
      let bookingType = "learn_booking";
      if (isTeaching) {
        bookingType = "teach_booking";
      }
      // Add logic for Endeavour bookings if you have a way to identify them
      // For example, if there's a session_type field:
      // if (session.session_type === 'endeavour') {
      //   bookingType = "endeavour_booking";
      // }

      // FIXED: Create proper title with fallback
      const topicName = session.topic?.name || "Untitled Session";
      const title = isTeaching 
        ? `${topicName}` 
        : `${topicName}`;
      
      return {
        id: session.id.toString(), //string format
        type: bookingType,
        title: title,
        start: startTime.toISOString(), // ISO string
        end: endTime.toISOString(),     // ISO string
        status: session.status
      };
    });
    // Check whether data is getting fetched or not
    console.log('Week bookings fetched:', formatted, 'sessions');
    // Response to the API
    res.json({ slots: formatted }); 

    
    
  } catch (error) { 
    console.error("Fetching WeekBookings error:", error);
    res.status(500).json({ error: "WEEK_BOOKINGS_FETCH_ERROR" });
  }
};