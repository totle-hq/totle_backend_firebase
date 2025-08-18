import { Sequelize, Op } from "sequelize";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { Session } from "../../Models/SessionModel.js";
import { Teachertopicstats } from "../../Models/TeachertopicstatsModel.js";
import { getProjections } from "../../utils/marketplacefunction.js";
import sequelize from "../../config/database.js";
import { redisClient } from "../../config/redis.js";
import { Language } from "../../Models/LanguageModel.js";
import { User } from "../../Models/UserModels/UserModel.js";

const CACHE_TTL = 300;

// Helper function to calculate median
function calculateMedian(values) {
  if (!values.length) return 0;
  
  values.sort((a, b) => a - b);
  const half = Math.floor(values.length / 2);
  
  if (values.length % 2) {
    return values[half];
  }
  
  return (values[half - 1] + values[half]) / 2;
}

export const getDomainEtaToPaid = async (req, res) => {
  try {
    const { domainId } = req.query;
    
    // 1. Get all topics in the domain
    const topics = await CatalogueNode.findAll({
      where: { 
        parent_id: domainId,
        is_topic: true 
      },
      attributes: ['node_id'],
      raw: true
    });

    if (!topics.length) {
      return res.json({ 
        averageDays: 0, 
        sampleSize: 0,
        message: "No topics found in this domain"
      });
    }

    const topicIds = topics.map(t => t.node_id);

    // 2. Find teachers who have completed ALL topics in this domain
    const qualifiedTeachers = await Teachertopicstats.findAll({
      attributes: ['teacher_id'],
      where: {
        topic_id: { [Op.in]: topicIds },
        status: 'completed'
      },
      group: ['teacher_id'],
      having: Sequelize.literal(`COUNT(DISTINCT topic_id) = ${topicIds.length}`),
      raw: true
    });

    if (!qualifiedTeachers.length) {
      return res.json({ 
        averageDays: 0, 
        sampleSize: 0,
        message: "No teachers have completed all topics in this domain"
      });
    }

    const teacherIds = qualifiedTeachers.map(t => t.teacher_id);

    // 3. Get their transition timelines (only for those who became paid)
    const transitions = await User.findAll({
      attributes: [
        'id',
        [Sequelize.fn('DATEDIFF', 
          Sequelize.col('paid_at'), 
          Sequelize.col('free_to_paid_started_at')
        ), 'days_to_paid']
      ],
      where: {
        id: { [Op.in]: teacherIds },
        paid_at: { [Op.not]: null },
        free_to_paid_started_at: { [Op.not]: null }
      },
      raw: true
    });

    if (!transitions.length) {
      return res.json({ 
        averageDays: 0, 
        sampleSize: 0,
        message: "No teachers have completed the free-to-paid transition"
      });
    }

    // 4. Calculate weighted average (weighted by number of topics completed)
    const teacherTopicCounts = await Teachertopicstats.findAll({
      attributes: [
        'teacher_id',
        [Sequelize.fn('COUNT', Sequelize.col('topic_id')), 'topic_count']
      ],
      where: {
        teacher_id: { [Op.in]: teacherIds },
        status: 'completed'
      },
      group: ['teacher_id'],
      raw: true
    });

    const weightedData = transitions.map(t => {
      const teacherCount = teacherTopicCounts.find(tc => tc.teacher_id === t.id)?.topic_count || 1;
      return {
        days: t.days_to_paid,
        weight: teacherCount
      };
    });

    const totalWeight = weightedData.reduce((sum, item) => sum + item.weight, 0);
    const weightedSum = weightedData.reduce((sum, item) => sum + (item.days * item.weight), 0);
    const averageDays = Math.round(weightedSum / totalWeight);

    // 5. Additional stats
    const minDays = Math.min(...weightedData.map(item => item.days));
    const maxDays = Math.max(...weightedData.map(item => item.days));
    const medianDays = calculateMedian(weightedData.map(item => item.days));

    res.json({ 
      averageDays,
      sampleSize: transitions.length,
      minDays,
      maxDays,
      medianDays,
      totalTeachersInDomain: qualifiedTeachers.length,
      teachersTransitioned: transitions.length,
      completionRate: parseFloat(((transitions.length / qualifiedTeachers.length) * 100).toFixed(1))
    });

  } catch (error) {
    console.error("Error calculating domain ETA:", error);
    res.status(500).json({ 
      error: "Failed to calculate domain ETA",
      details: error.message 
    });
  }
};



export const upgradeToPaid = async (req, res) => {
  try {
    const { teacherId, nodeId } = req.body; 

    const record = await Teachertopicstats.findOne({
      where: {
        teacher_id: teacherId,
        node_id: nodeId,
        tier: 'free' 
      }
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found or already paid'
      });
    }

    const updatedRecord = await record.update({
      tier: 'paid',
      paid_at: new Date()
    });

    return res.status(200).json({
      success: true,
      message: 'Successfully upgraded to paid tier',
      data: updatedRecord
    });

  } catch (error) {
    console.error('Error upgrading to paid:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upgrade to paid tier',
      error: error.message
    });
  }
};

export const getTopEntities = async (req, res) => {
  try {
    const { entity, domainId, tier, level, language, range } = req.query;
    
    if (!['topic', 'domain'].includes(entity)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    const dateCondition = getDateRangeCondition(range || 'week');

    if (entity === 'topic') {
      const whereClauses = ["cn.is_topic = true"];
      const joinClauses = [
        `JOIN "user"."sessions" s ON cn.node_id = s.topic_id AND s.status = 'completed'`,
        `JOIN "catalog"."teacher_topic_stats" tts ON cn.node_id = tts.node_id`
      ];
      const params = {};

      if (domainId) {
        whereClauses.push("cn.parent_id = :domainId");
        params.domainId = domainId;
      }

      if (tier && tier !== 'all') {
        whereClauses.push("tts.tier = :tier");
        params.tier = tier;
      }

      if (level && level !== 'All') {
        whereClauses.push("tts.level = :level");
        params.level = level;
      }

      const query = `
        SELECT 
          cn.node_id,
          cn.name,
          COUNT(DISTINCT s.id) AS "sessionCount",
          COUNT(DISTINCT tts.teacher_id) AS "teacherCount"
        FROM "catalog"."catalogue_nodes" cn
        ${joinClauses.join('\n')}
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY cn.node_id
        ORDER BY "sessionCount" DESC
        LIMIT 10
      `;

      const results = await sequelize.query(query, {
        replacements: params,
        type: sequelize.QueryTypes.SELECT
      });

      const topicsWithSparklines = await Promise.all(
        results.map(async (item) => ({
          id: item.node_id,
          name: item.name,
          sessionCount: item.sessionCount,
          teacherCount: item.teacherCount,
          spark: await getTopicSparklineData(item.node_id, range)
        }))
      );

      return res.json(topicsWithSparklines);
    } else {
      const whereClauses = ["d.is_domain = true"];
      const joinClauses = [
        `JOIN "catalog"."catalogue_nodes" cn ON cn.parent_id = d.node_id AND cn.is_topic = true`,
        `JOIN "user"."sessions" s ON s.topic_id = cn.node_id AND s.status = 'completed'`,
        `JOIN "catalog"."teacher_topic_stats" tts ON cn.node_id = tts.node_id`
      ];
      const params = {};

      if (domainId) {
        whereClauses.push("d.parent_id = :domainId");
        params.domainId = domainId;
      }

      if (tier && tier !== 'all') {
        whereClauses.push("tts.tier = :tier");
        params.tier = tier;
      }

      if (level && level !== 'All') {
        whereClauses.push("tts.level = :level");
        params.level = level;
      }

      const query = `
        SELECT 
          d.node_id,
          d.name,
          COUNT(DISTINCT s.id) AS "sessionCount",
          COUNT(DISTINCT tts.teacher_id) AS "teacherCount"
        FROM "catalog"."catalogue_nodes" d
        ${joinClauses.join('\n')}
        WHERE ${whereClauses.join(' AND ')}
        ${dateCondition ? `AND ${dateCondition.replace(/s\./g, '')}` : ''}
        GROUP BY d.node_id
        ORDER BY "sessionCount" DESC
        LIMIT 10
      `;

      const results = await sequelize.query(query, {
        replacements: params,
        type: sequelize.QueryTypes.SELECT
      });

      const domainsWithSparklines = await Promise.all(
        results.map(async (item) => ({
          id: item.node_id,
          name: item.name,
          sessionCount: item.sessionCount,
          teacherCount: item.teacherCount,
          spark: await getDomainSparklineData(item.node_id, range)
        }))
      );

      return res.json(domainsWithSparklines);
    }

  } catch (error) {
    console.error("Error fetching top entities:", error);
    res.status(500).json({ 
      error: "Failed to fetch data",
      details: error.message,
      query: error.sql 
    });
  }
};

async function getTopicSparklineData(topicId, range) {
  const dateCondition = getDateRangeCondition(range);
  
  const query = `
    SELECT 
      ${getTimeGroup(range, 'sessions')} AS time_group,
      COUNT(id) AS value
    FROM "user"."sessions"
    WHERE 
      status = 'completed'
      AND topic_id = :topicId
      ${dateCondition ? `AND ${dateCondition.replace(/s\./g, '')}` : ''}
    GROUP BY time_group
    ORDER BY time_group
    LIMIT 10
  `;

  const results = await sequelize.query(query, {
    replacements: { topicId },
    type: sequelize.QueryTypes.SELECT
  });

  return results.map(r => r.value);
}

async function getDomainSparklineData(domainId, range) {
  const dateCondition = getDateRangeCondition(range);
  
  const query = `
    SELECT 
      ${getTimeGroup(range, 's')} AS time_group,
      COUNT(DISTINCT s.id) AS value
    FROM "catalog"."catalogue_nodes" cn
    JOIN "user"."sessions" s ON s.topic_id = cn.node_id AND s.status = 'completed'
    WHERE cn.parent_id = :domainId
    AND cn.is_topic = true
    ${dateCondition ? `AND ${dateCondition}` : ''}
    GROUP BY time_group
    ORDER BY time_group
    LIMIT 10
  `;

  const results = await sequelize.query(query, {
    replacements: { domainId },
    type: sequelize.QueryTypes.SELECT
  });

  return results.map(r => r.value);
}

function getTimeGroup(range, tableAlias = '') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  switch (range) {
    case 'today':
      return `DATE_TRUNC('hour', ${prefix}completed_at)`;
    case 'week':
      return `DATE(${prefix}completed_at)`;
    case 'month':
      return `DATE_TRUNC('day', ${prefix}completed_at)`;
    default:
      return `DATE(${prefix}completed_at)`;
  }
}

function getDateRangeCondition(range) {
  const now = new Date();
  let condition = '';

  switch (range) {
    case 'today':
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      condition = `completed_at >= '${todayStart.toISOString()}'`;
      break;
    case 'week':
      const weekStart = new Date(now.setDate(now.getDate() - 7));
      condition = `completed_at >= '${weekStart.toISOString()}'`;
      break;
    case 'month':
      const monthStart = new Date(now.setMonth(now.getMonth() - 1));
      condition = `completed_at >= '${monthStart.toISOString()}'`;
      break;
  }

  return condition;
}

export const getTrendData = async (req, res) => {
  try {
    const { entity, ids, range, tier, level, language } = req.query;
    
    if (!entity || !ids) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const entityIds = ids.split(',');

    // Filter for language if provided and not undefined
    let languageId;
    if (language && language !== 'all' && language !== 'undefined') {
      const languageRecord = await Language.findOne({
        where: { language_name: language },
        attributes: ["language_id"],
        raw: true,
      });
      if (!languageRecord) {
        return res.json([]);
      }
      languageId = languageRecord.language_id;
    }

    const results = [];
    const now = new Date();
    const baseDate = range === 'today' 
      ? new Date(now.setHours(0, 0, 0, 0)) 
      : new Date(now.setDate(now.getDate() - (range === 'week' ? 6 : 29)));

    // Base session filter
    const sessionWhere = { status: 'completed' };

    // Apply level filter if provided and not 'All' or 'undefined'
    if (level && level !== 'All' && level !== 'undefined') {
      sessionWhere.session_level = level;
    }

    // Apply tier filter if provided and not 'all' or 'undefined'
    if (tier && tier !== 'all' && tier !== 'undefined') {
      sessionWhere.session_tier = tier;
    }

    // Include teacher only if language filter is applied
    const sessionInclude = [];
    if (languageId) {
      sessionInclude.push({
        model: User,
        as: 'teacher',
        attributes: ['id'],
        required: true,
        where: { preferred_language_id: languageId }
      });
    }

    for (const id of entityIds) {
      const dataPoints = [];
      const intervals = range === 'today' ? 24 : (range === 'week' ? 7 : 30);

      for (let i = 0; i < intervals; i++) {
        const date = new Date(baseDate);
        if (range === 'today') {
          date.setHours(date.getHours() + i);
        } else {
          date.setDate(date.getDate() + i);
        }
        
        const nextDate = new Date(date);
        if (range === 'today') {
          nextDate.setHours(nextDate.getHours() + 1);
        } else {
          nextDate.setDate(nextDate.getDate() + 1);
        }

        // Build query options for this time period
        const queryOptions = {
          where: {
            ...sessionWhere,
            completed_at: { 
              [Op.gte]: date,
              [Op.lt]: nextDate
            }
          }
        };

        // Add entity-specific conditions
        if (entity === 'topic') {
          queryOptions.where.topic_id = id;
        } else {
          // For domain, include topic relationship
          queryOptions.include = [{
            model: CatalogueNode,
            as: 'topic',
            where: {
              parent_id: id,
              is_topic: true
            },
            required: true
          }];
        }

        // Add language filter includes if they exist
        if (sessionInclude.length > 0) {
          queryOptions.include = queryOptions.include || [];
          queryOptions.include.push(...sessionInclude);
        }

        const count = await Session.count(queryOptions);
        
        const formattedTime = range === 'today' 
          ? `${date.getHours().toString().padStart(2, '0')}:00`
          : `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`;
        
        dataPoints.push({
          t: formattedTime,
          v: count
        });
      }

      // Get entity name
      const entityRecord = await CatalogueNode.findByPk(id);
      
      results.push({
        id,
        name: entityRecord?.name || `Unknown ${entity}`,
        data: dataPoints
      });
    }

    res.json(results);
  } catch (error) {
    console.error("Error fetching trend data:", error);
    res.status(500).json({ 
      error: "Failed to fetch trend data",
      details: error.message
    });
  }
};
export const getSummary = async (req, res) => {
  try {
    const { domainId, topicId, tier, level, language } = req.query;

    // Filter for language if provided
    let languageId;
    if (language) {
      const languageRecord = await Language.findOne({
        where: { language_name: language },
        attributes: ["language_id"],
        raw: true,
      });
      if (!languageRecord) {
        return res.json({
          totals: { tillDate: 0, thatDay: 0, thatWeek: 0, thatMonth: 0 },
          projections: { nextDay: 0, nextWeek: 0, nextMonth: 0 },
          topics: [],
        });
      }
      languageId = languageRecord.language_id;
    }

    // Base session filter
    const sessionWhere = { status: "completed" };

    // Filter by session_level and session_tier (columns in Session table)
    if (level && level !== "All") sessionWhere.session_level = level;
    if (tier && tier !== "all") sessionWhere.session_tier = tier;

    // Filter by topic or domain
    let topics = [];
    if (topicId) {
      const topic = await CatalogueNode.findOne({
        where: { node_id: topicId, is_topic: true },
        attributes: ["node_id", "name"],
        raw: true,
      });
      if (topic) {
        topics = [topic];
        sessionWhere.topic_id = topicId;
      }
    } else if (domainId) {
      topics = await CatalogueNode.findAll({
        where: { parent_id: domainId, is_topic: true },
        attributes: ["node_id", "name"],
        raw: true,
      });

      if (!topics.length) {
        // Domain has no topics → all counts should be 0
        return res.json({
          totals: { tillDate: 0, thatDay: 0, thatWeek: 0, thatMonth: 0 },
          projections: { nextDay: 0, nextWeek: 0, nextMonth: 0 },
          topics: [],
        });
      }

      // Filter sessions by topic IDs
      sessionWhere.topic_id = topics.map((t) => t.node_id);
    }

    // Include teacher only for language filtering
    const sessionInclude = [
      {
        model: User,
        as: "teacher",
        attributes: ["id", "firstName"],
        required: true,
        where: languageId ? { preferred_language_id: languageId } : {},
      },
    ];

    // Helper function to get counts
    const getFilteredCount = async (extraWhere = {}) => {
      const result = await Session.findAll({
        attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("Session.id")), "id"]],
        where: { ...sessionWhere, ...extraWhere },
        include: sessionInclude,
        raw: true,
      });
      return result.length;
    };

    // Date ranges
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get counts
    const [total, todayCount, weekCount, monthCount] = await Promise.all([
      getFilteredCount(),
      getFilteredCount({ completed_at: { [Op.gte]: today } }),
      getFilteredCount({ completed_at: { [Op.gte]: weekStart } }),
      getFilteredCount({ completed_at: { [Op.gte]: monthStart } }),
    ]);

    // Get projections and topic details
    const projections = await getProjections(
      topicId || domainId || null,
      monthCount,
      { tier, level, languageId, sessionFilters: sessionWhere }
    );

    const topicDetails = await getTopicDetails(topics, { tier, level, languageId });

    // Return response
    res.json({
      totals: {
        tillDate: total,
        thatDay: todayCount,
        thatWeek: weekCount,
        thatMonth: monthCount,
      },
      projections: {
        nextDay: projections.nextDay,
        nextWeek: projections.nextWeek,
        nextMonth: projections.nextMonth,
      },
      topics: topicDetails,
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({
      error: "Failed to fetch summary",
      details: error.message,
    });
  }
};

async function getTeacherStatsByTopic(topicIds, filters) {
  try {
    // Build the base query
    let query = `
      SELECT 
        tts.node_id, 
        COUNT(tts.teacher_id) AS total,
        COUNT(CASE WHEN tts.tier = 'paid' THEN 1 END) AS paid,
        COUNT(CASE WHEN tts.tier = 'free' THEN 1 END) AS free
      FROM 
        "catalog"."teacher_topic_stats" tts
    `;

    // Add JOIN if language filter is provided
    if (filters.languageId) {
      query += `
        INNER JOIN "user"."users" u ON tts.teacher_id = u.id AND u.preferred_language_id = :languageId
      `;
    }

    // Add WHERE conditions
    query += `
      WHERE 
        tts.node_id IN (:topicIds)
      GROUP BY 
        tts.node_id
    `;

    // Execute the query
    const results = await sequelize.query(query, {
      replacements: {
        topicIds: topicIds,
        languageId: filters.languageId
      },
      type: Sequelize.QueryTypes.SELECT
    });

    // Format the results
    return results.reduce((acc, row) => {
      acc[row.node_id] = {
        qualified: row.total,
        paid: row.paid,
        free: row.free
      };
      return acc;
    }, {});
  } catch (error) {
    console.error('Error in getTeacherStatsByTopic:', error);
    throw error;
  }
}
async function getSessionCountsByTopic(topicIds, filters) {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Build the WHERE conditions
  let whereConditions = [
    `topic_id IN (:topicIds)`,
    `status = 'completed'`
  ];

  // Add level filter if provided
  if (filters.level && filters.level !== 'All') {
    whereConditions.push(`session_level = :level`);
  }

  // Add tier filter if provided
  if (filters.tier && filters.tier !== 'all') {
    whereConditions.push(`session_tier = :tier`);
  }

  // Build the complete SQL query
  let query;
  if (filters.languageId) {
    // Query with language filter (includes JOIN with users table)
    query = `
      SELECT 
        s.topic_id,
        COUNT(s.id) AS total,
        COUNT(CASE WHEN s.completed_at >= :today THEN 1 END) AS today,
        COUNT(CASE WHEN s.completed_at >= :weekStart THEN 1 END) AS week,
        COUNT(CASE WHEN s.completed_at >= :monthStart THEN 1 END) AS month
      FROM 
        "user".sessions s
      INNER JOIN 
        "user".users u ON s.teacher_id = u.id AND u.preferred_language_id = :languageId
      WHERE 
        ${whereConditions.map(cond => cond.replace(/^(topic_id|status|session_level|session_tier)/, 's.$1')).join(' AND ')}
      GROUP BY 
        s.topic_id
    `;
  } else {
    // Query without language filter (no JOIN needed)
    query = `
      SELECT 
        topic_id,
        COUNT(id) AS total,
        COUNT(CASE WHEN completed_at >= :today THEN 1 END) AS today,
        COUNT(CASE WHEN completed_at >= :weekStart THEN 1 END) AS week,
        COUNT(CASE WHEN completed_at >= :monthStart THEN 1 END) AS month
      FROM 
        "user".sessions
      WHERE 
        ${whereConditions.join(' AND ')}
      GROUP BY 
        topic_id
    `;
  }

  // Prepare replacements object
  const replacements = {
    topicIds: topicIds,
    today: today.toISOString(),
    weekStart: weekStart.toISOString(),
    monthStart: monthStart.toISOString()
  };

  // Add optional filter values if they exist
  if (filters.level && filters.level !== 'All') {
    replacements.level = filters.level;
  }
  if (filters.tier && filters.tier !== 'all') {
    replacements.tier = filters.tier;
  }
  if (filters.languageId) {
    replacements.languageId = filters.languageId;
  }

  // Execute the query
  const results = await sequelize.query(query, {
    replacements: replacements,
    type: Sequelize.QueryTypes.SELECT
  });

  // Format the results
  return results.reduce((acc, row) => {
    acc[row.topic_id] = {
      today: parseInt(row.today, 10),
      week: parseInt(row.week, 10),
      month: parseInt(row.month, 10),
      total: parseInt(row.total, 10)
    };
    return acc;
  }, {});
}
async function getTopicDetails(topics, filters) {
  if (!topics.length) return [];

  const topicIds = topics.map(t => t.node_id);
  
  const [sessionCounts, teacherStats, progressionStats] = await Promise.all([
    getSessionCountsByTopic(topicIds, filters),
    getTeacherStatsByTopic(topicIds, filters),
    getProgressionStatsByTopic(topicIds)
  ]);

  const details = await Promise.all(
    topics.map(async topic => {
      const monthSessions = sessionCounts[topic.node_id]?.month || 0;
      const projections = await getProjections(topic.node_id, monthSessions, filters);

      return {
        topicId: topic.node_id,
        topicName: topic.name,
        sessions: sessionCounts[topic.node_id] || { today: 0, week: 0, month: 0, total: 0 },
        teachers: teacherStats[topic.node_id] || { qualified: 0, paid: 0, free: 0 },
        etaToPaid: progressionStats[topic.node_id] || 0,
        projections: projections || { nextDay: 0, nextWeek: 0, nextMonth: 0 }
      };
    })
  );

  return details.sort((a, b) => b.projections.nextWeek - a.projections.nextWeek);
}



export const getReverseMappingLoad = async (req, res) => {
  try {
    const { topicId } = req.query;

    if (!topicId) {
      return res.status(400).json({ error: 'Topic ID is required' });
    }

    // Count Bridger-level free tier teachers for this topic
    const bridgerCount = await Teachertopicstats.count({
      where: {
        node_id: topicId,
        level: 'Bridger',
        tier:"free",
        [Op.or]: [
          { paid_at: null }, 
          { paid_at: { [Op.gt]: new Date() } } 
        ]
      }
    });

    res.json({ queuedFreeLearners: bridgerCount || 0 });

  } catch (error) {
    console.error('Error fetching reverse load:', error);
    res.status(500).json({
      error: 'Failed to fetch Bridger count',
      details: error.message
    });
  }
}




async function getProgressionStatsByTopic(topicIds) {
  const results = await Teachertopicstats.findAll({
    attributes: [
      'node_id',
      [Sequelize.fn('AVG', 
        Sequelize.literal('EXTRACT(EPOCH FROM (paid_at - created_at))/86400')
      ), 'avgDays']
    ],
    where: { 
      node_id: topicIds,
      tier: 'paid',
      paid_at: { [Op.ne]: null }
    },
    group: ['node_id'],
    raw: true
  });

  return results.reduce((acc, row) => {
    acc[row.node_id] = parseFloat(row.avgDays).toFixed(1);
    return acc;
  }, {});
}



export const getTeacherStats = async (req, res) => {
  try {
    const { topicId } = req.query;
    
    if (!topicId || topicId===undefined) {
      return res.status(400).json({ error: 'topicId required' });
    }
    
    const stats = await Teachertopicstats.findAll({
      where: { node_id: topicId },
      attributes: [
        [Sequelize.fn('COUNT', Sequelize.col('teacher_id')), 'total'],
        [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN tier = 'paid' THEN 1 END`)), 'paid'],
        [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN tier = 'free' THEN 1 END`)), 'free'],
        [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN level = 'Bridger' THEN 1 END`)), 'bridger'],
        [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN level = 'Expert' THEN 1 END`)), 'expert'],
        [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN level = 'Master' THEN 1 END`)), 'master'],
        [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN level = 'Legend' THEN 1 END`)), 'legend']
      ]
    });
    
    res.json({
      qualifiedTotal: stats[0]?.get('total') || 0,
      paidTier: stats[0]?.get('paid') || 0,
      freeTier: stats[0]?.get('free') || 0,
      levels: {
        Bridger: stats[0]?.get('bridger') || 0,
        Expert: stats[0]?.get('expert') || 0,
        Master: stats[0]?.get('master') || 0,
        Legend: stats[0]?.get('legend') || 0
      }
    });
  } catch (error) {
    console.error("Error fetching teacher stats:", error);
    res.status(500).json({ error: "Failed to fetch teacher stats" });
  }
};

export const getPaidETA = async (req, res) => {
  try {
    const { topicId } = req.query;
    
    // First check if any paid teachers exist for this topic
    const hasPaidTeachers = await Teachertopicstats.count({
      where: { 
        node_id: topicId,
        tier: 'paid',
        paid_at: { [Op.ne]: null }
      }
    });

    if (!hasPaidTeachers) {
      return res.json({
        averageDays: 'N/A'
      });
    }

    // Calculate average days if teachers exist
    const result = await Teachertopicstats.findOne({
      where: { 
        node_id: topicId,
        tier: 'paid',
        paid_at: { [Op.ne]: null }
      },
      attributes: [
        [Sequelize.fn('AVG', 
          Sequelize.literal(`EXTRACT(EPOCH FROM (paid_at - created_at))/86400`)
        ), 'averageDays']
      ]
    });
    
    const averageDays = result?.get('averageDays');
    const formattedValue = averageDays ? Math.floor(parseFloat(averageDays).toFixed(1)) : 'N/A';
    
    res.json({
      averageDays: formattedValue
    });
  } catch (error) {
    console.error("Error fetching ETA:", error);
    res.status(500).json({ error: "Failed to fetch ETA" });
  }
};

export const getLanguageDemand = async (req, res) => {
  const { topicId } = req.query;
  
  try {
    if (!topicId || topicId === undefined) {
      return res.status(400).json({ error: 'topicId required' });
    }

    const topic = await CatalogueNode.findOne({
      where: { 
        node_id: topicId,
        is_topic: true 
      }
    });
    
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }

    const qualifiedTeachers = await Teachertopicstats.findAll({
      where: { node_id: topicId },
      include: [{
        model: User,
        as: 'teacher',
        attributes: ['id', 'preferred_language_id']
      }],
      raw: true,
      nest: true
    });

    if (qualifiedTeachers.length === 0) {
      return res.json({
        preferredBreakdown: [],
        shortageHint: "No qualified teachers found for this topic."
      });
    }

    const languages = await Language.findAll();
    const languageMap = new Map(languages.map(lang => [lang.language_id, lang.language_name]));

    const languageCounts = {};
    let totalTeachers = 0;

    qualifiedTeachers.forEach(teacherRecord => {
      const langId = teacherRecord.teacher?.preferred_language_id;
      if (langId) {
        languageCounts[langId] = (languageCounts[langId] || 0) + 1;
        totalTeachers++;
      }
    });

    const preferredBreakdown = Object.entries(languageCounts).map(([langId, count]) => ({
      language: languageMap.get(parseInt(langId)) || `Unknown (ID: ${langId})`,
      percent: Math.round((count / totalTeachers) * 100)
    })).sort((a, b) => b.percent - a.percent);

    const highDemandLangs = preferredBreakdown.filter(lang => lang.percent > 40);
    let shortageHint = null;
    
    if (highDemandLangs.length > 0) {
      shortageHint = `High demand for ${highDemandLangs.map(l => l.language).join(', ')} teachers in this topic.`;
    }

    return res.json({
      preferredBreakdown,
      shortageHint
    });

  } catch (err) {
    console.error("Error fetching teacher language demand:", err);
    return res.status(500).json({ error: err.message });
  }
};

const inMemoryCache = new Map();
async function cacheGet(key) {
  try {
    const value = await redisClient.get(key);
    if (value) return JSON.parse(value);
  } catch (err) {
    return inMemoryCache.get(key);
  }
}

async function cacheSet(key, data) {
  try {
    await redisClient.set(key, JSON.stringify(data), "EX", CACHE_TTL);
  } catch (err) {
    inMemoryCache.set(key, data);
    setTimeout(() => inMemoryCache.delete(key), CACHE_TTL * 1000);
  }
}

export const getDomains = async (req, res) => {
  const key = 'catalogue:domains:all';
  const cached = await cacheGet(key);
  if (cached) return res.json(cached);

  try {
    const domains = await CatalogueNode.findAll({
      where: { 
        is_domain: true,
        status: 'active'
      },
      order: [['name', 'ASC']],
      attributes: [
        'node_id', 
        'name', 
        'description',
        'session_count',
        'metadata'
      ] 
    });

    await cacheSet(key, domains);
    return res.json(domains);
  } catch (err) {
    console.error("Error fetching domains:", err);
    return res.status(500).json({ error: err.message });
  }
};