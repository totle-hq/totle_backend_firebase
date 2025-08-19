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

    // 1. CACHE KEY - Create a unique key for caching
    const cacheKey = `trend:${entity}:${ids}:${range}:${tier}:${level}:${language}`;
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const entityIds = ids.split(',');

    // 2. OPTIMIZED LANGUAGE FILTER - Fetch once at start
    let languageFilter = {};
    if (language && language !== 'all' && language !== 'undefined') {
      const languageRecord = await Language.findOne({
        where: { language_name: language },
        attributes: ["language_id"],
        raw: true,
      });
      if (!languageRecord) {
        await redisClient.set(cacheKey, JSON.stringify([]), 'EX', 60); // Cache empty
        return res.json([]);
      }
      languageFilter = { preferred_language_id: languageRecord.language_id };
    }

    // 3. BASE QUERY CONSTRUCTION
    const now = new Date();
    const baseDate = range === 'today' 
      ? new Date(now.setHours(0, 0, 0, 0)) 
      : new Date(now.setDate(now.getDate() - (range === 'week' ? 6 : 29)));

    const sessionWhere = { status: 'completed' };
    if (level && level !== 'All' && level !== 'undefined') sessionWhere.session_level = level;
    if (tier && tier !== 'all' && tier !== 'undefined') sessionWhere.session_tier = tier;

    // 4. BATCH FETCHING - Get all data at once then process
    const allSessions = await Session.findAll({
      where: sessionWhere,
      include: [
        {
          model: User,
          as: 'teacher',
          attributes: ['id'],
          required: !!languageFilter.preferred_language_id,
          where: languageFilter
        },
        ...(entity === 'domain' ? [{
          model: CatalogueNode,
          as: 'topic',
          where: {
            parent_id: { [Op.in]: entityIds },
            is_topic: true
          },
          required: true
        }] : [])
      ],
      attributes: [
        'topic_id',
        'completed_at',
        ...(entity === 'topic' ? [] : ['topic.parent_id'])
      ],
      raw: true
    });

    // 5. IN-MEMORY PROCESSING
    const results = await Promise.all(entityIds.map(async (id) => {
      const filteredSessions = allSessions.filter(s => 
        entity === 'topic' ? s.topic_id === id : s['topic.parent_id'] === id
      );

      const intervals = range === 'today' ? 24 : (range === 'week' ? 7 : 30);
      const dataPoints = [];

      for (let i = 0; i < intervals; i++) {
        const date = new Date(baseDate);
        range === 'today' ? date.setHours(date.getHours() + i) : date.setDate(date.getDate() + i);
        
        const nextDate = new Date(date);
        range === 'today' ? nextDate.setHours(nextDate.getHours() + 1) : nextDate.setDate(nextDate.getDate() + 1);

        const count = filteredSessions.filter(s => {
          const completedAt = new Date(s.completed_at);
          return completedAt >= date && completedAt < nextDate;
        }).length;

        dataPoints.push({
          t: range === 'today' 
            ? `${date.getHours().toString().padStart(2, '0')}:00`
            : `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`,
          v: count
        });
      }

      const entityRecord = await CatalogueNode.findByPk(id);
      return {
        id,
        name: entityRecord?.name || `Unknown ${entity}`,
        data: dataPoints
      };
    }));

    // 6. CACHE RESULTS
    await redisClient.set(cacheKey, JSON.stringify(results), 'EX', 300); // 5 min cache

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

    // SAFE CACHE KEY
    const safeTier = tier || 'all';
    const safeLevel = level || 'All';
    const safeLang = language || 'all';
    const cacheKey = `summary:${domainId || 'none'}:${topicId || 'none'}:${safeTier}:${safeLevel}:${safeLang}`;

    // 1. CHECK CACHE (totals + topics only)
    const cachedData = await redisClient.get(cacheKey);
    let cachedResult = cachedData ? JSON.parse(cachedData) : null;

    let topics = [];
    let countResults = {};

    if (!cachedResult) {
      // 2. LANGUAGE FILTER
      let languageFilter = {};
      if (language && language !== 'all') {
        const languageRecord = await Language.findOne({
          where: { language_name: language },
          attributes: ["language_id"],
          raw: true,
        });
        if (!languageRecord) {
          const emptyResult = {
            totals: { tillDate: 0, thatDay: 0, thatWeek: 0, thatMonth: 0 },
            topics: [],
          };
          await redisClient.set(cacheKey, JSON.stringify(emptyResult), 'EX', 60);
          return res.json({ ...emptyResult, projections: { nextDay: 0, nextWeek: 0, nextMonth: 0 } });
        }
        languageFilter = { preferred_language_id: languageRecord.language_id };
      }

      // 3. FETCH TOPICS
      if (topicId) {
        const topic = await CatalogueNode.findOne({
          where: { node_id: topicId, is_topic: true },
          attributes: ["node_id", "name"],
          raw: true,
        });
        topics = topic ? [topic] : [];
      } else if (domainId) {
        topics = await CatalogueNode.findAll({
          where: { parent_id: domainId, is_topic: true },
          attributes: ["node_id", "name"],
          raw: true,
        });
      }

      if (!topics.length && (topicId || domainId)) {
        const emptyResult = { totals: { tillDate: 0, thatDay: 0, thatWeek: 0, thatMonth: 0 }, topics: [] };
        await redisClient.set(cacheKey, JSON.stringify(emptyResult), 'EX', 300);
        return res.json({ ...emptyResult, projections: { nextDay: 0, nextWeek: 0, nextMonth: 0 } });
      }

      // 4. BASE FILTERS
      const sessionWhere = { status: "completed" };
      if (level && level !== "All") sessionWhere.session_level = level;
      if (tier && tier !== "all") sessionWhere.session_tier = tier;
      if (topics.length) sessionWhere.topic_id = topics.map(t => t.node_id);

      // 5. PARALLEL FETCH
      countResults = await getSessionCountsOptimized(sessionWhere, languageFilter);
      const [teacherStats, topicDetails] = await Promise.all([
        getTeacherStatsByTopicOptimized(topics.map(t => t.node_id), { languageId: languageFilter.preferred_language_id }),
        getTopicDetailsOptimized(topics, { tier, level, languageId: languageFilter.preferred_language_id })
      ]);

      cachedResult = {
        totals: countResults,
        topics: topicDetails,
      };

      // CACHE totals + topics only
      await redisClient.set(cacheKey, JSON.stringify(cachedResult), 'EX', 300);
    }

    // 6. ALWAYS CALCULATE PROJECTIONS LIVE
    const projections = await getProjections(
      cachedResult.totals.thatMonth,
      { tier, level, languageId: cachedResult.totals.languageId || undefined, sessionFilters: {} }
    );

    // 7. RETURN FULL RESULT
    res.json({
      ...cachedResult,
      projections
    });

  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch summary", details: error.message });
  }
};



// Optimized counting function
async function getSessionCountsOptimized(whereClause, languageFilter) {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const query = `
    SELECT 
      COUNT(*) AS total,
      COUNT(CASE WHEN completed_at >= :today THEN 1 END) AS today,
      COUNT(CASE WHEN completed_at >= :weekStart THEN 1 END) AS week,
      COUNT(CASE WHEN completed_at >= :monthStart THEN 1 END) AS month
    FROM "user".sessions s
    ${languageFilter.preferred_language_id ? 
      'JOIN "user".users u ON s.teacher_id = u.id AND u.preferred_language_id = :languageId' : ''}
    WHERE ${buildWhereClause(whereClause)}
  `;

  const replacements = {
    today: today.toISOString(),
    weekStart: weekStart.toISOString(),
    monthStart: monthStart.toISOString(),
    ...(languageFilter.preferred_language_id ? { languageId: languageFilter.preferred_language_id } : {}),
    ...whereClause
  };

  const [results] = await sequelize.query(query, {
    replacements,
    type: Sequelize.QueryTypes.SELECT
  });

  return {
    tillDate: parseInt(results.total, 10),
    thatDay: parseInt(results.today, 10),
    thatWeek: parseInt(results.week, 10),
    thatMonth: parseInt(results.month, 10)
  };
}

// Helper to build WHERE clause safely
function buildWhereClause(conditions) {
  return Object.entries(conditions)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `s.${key} IN (:${key})`;
      }
      return `s.${key} = :${key}`;
    })
    .join(' AND ');
}

// Optimized teacher stats
async function getTeacherStatsByTopicOptimized(topicIds, filters) {
  if (!topicIds.length) return {};

  const query = `
    SELECT 
      tts.node_id,
      COUNT(tts.teacher_id) AS total,
      COUNT(CASE WHEN tts.tier = 'paid' THEN 1 END) AS paid,
      COUNT(CASE WHEN tts.tier = 'free' THEN 1 END) AS free
    FROM "catalog"."teacher_topic_stats" tts
    ${filters.languageId ? 'JOIN "user"."users" u ON tts.teacher_id = u.id AND u.preferred_language_id = :languageId' : ''}
    WHERE tts.node_id IN (:topicIds)
    GROUP BY tts.node_id
  `;

  const results = await sequelize.query(query, {
    replacements: {
      topicIds,
      languageId: filters.languageId
    },
    type: Sequelize.QueryTypes.SELECT
  });

  return results.reduce((acc, row) => {
    acc[row.node_id] = {
      qualified: row.total,
      paid: row.paid,
      free: row.free
    };
    return acc;
  }, {});
}

// Optimized topic details
async function getTopicDetailsOptimized(topics, filters) {
  if (!topics.length) return [];

  const topicIds = topics.map(t => t.node_id);
  const [sessionCounts, teacherStats] = await Promise.all([
    getSessionCountsByTopicOptimized(topicIds, filters),
    getTeacherStatsByTopicOptimized(topicIds, filters)
  ]);

  return topics.map(topic => ({
    topicId: topic.node_id,
    topicName: topic.name,
    sessions: sessionCounts[topic.node_id] || { today: 0, week: 0, month: 0, total: 0 },
    teachers: teacherStats[topic.node_id] || { qualified: 0, paid: 0, free: 0 }
  }));
}


async function getSessionCountsByTopicOptimized(topicIds, filters) {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const query = `
    SELECT 
      s.topic_id,
      COUNT(s.id) AS total,   -- FIXED: qualified column
      COUNT(CASE WHEN s.completed_at >= :today THEN 1 END) AS today,
      COUNT(CASE WHEN s.completed_at >= :weekStart THEN 1 END) AS week,
      COUNT(CASE WHEN s.completed_at >= :monthStart THEN 1 END) AS month
    FROM "user".sessions s
    ${filters.languageId ? 'JOIN "user"."users" u ON s.teacher_id = u.id AND u.preferred_language_id = :languageId' : ''}
    WHERE s.topic_id IN (:topicIds)
    ${filters.level && filters.level !== 'All' ? 'AND s.session_level = :level' : ''}
    ${filters.tier && filters.tier !== 'all' ? 'AND s.session_tier = :tier' : ''}
    GROUP BY s.topic_id
  `;

  const results = await sequelize.query(query, {
    replacements: {
      topicIds,
      today: today.toISOString(),
      weekStart: weekStart.toISOString(),
      monthStart: monthStart.toISOString(),
      ...(filters.languageId ? { languageId: filters.languageId } : {}),
      ...(filters.level && filters.level !== 'All' ? { level: filters.level } : {}),
      ...(filters.tier && filters.tier !== 'all' ? { tier: filters.tier } : {})
    },
    type: Sequelize.QueryTypes.SELECT
  });

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