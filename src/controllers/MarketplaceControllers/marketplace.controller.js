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
    const { entity, domainId, tier, level, range } = req.query;

    if (!['topic', 'domain'].includes(entity)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    if (entity === 'topic') {
      const where = { is_topic: true };
      if (domainId) where.parent_id = domainId;

      const include = [
        {
          model: Session,
          as: 'sessions',
          required: true,
          where: { status: 'completed' },
          attributes: [],
        },
        {
          model: Teachertopicstats,
          as: 'teacherStats',
          required: true,
          where: {
            ...(tier && tier !== 'all' ? { tier } : {}),
            ...(level && level !== 'All' ? { level } : {}),
          },
          attributes: [],
        },
      ];

      const topics = await CatalogueNode.findAll({
        where,
        attributes: [
          'node_id',
          'name',
          [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('sessions.id'))), 'sessionCount'],
          [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('teacherStats.teacher_id'))), 'teacherCount'],
        ],
        include,
        group: ['CatalogueNode.node_id'],
        order: [[Sequelize.literal('"sessionCount"'), 'DESC']],
        limit: 10,
        raw: true,
      });

      const topicsWithSparklines = await Promise.all(
        topics.map(async (item) => ({
          id: item.node_id,
          name: item.name,
          sessionCount: item.sessionCount,
          teacherCount: item.teacherCount,
          spark: await getTopicSparklineData(item.node_id, range),
        }))
      );

      return res.json(topicsWithSparklines);
    } else {
      // For domains
      const where = { is_domain: true };
      if (domainId) where.parent_id = domainId;

      const include = [
        {
          model: CatalogueNode,
          as: 'topics',
          required: true,
          where: { is_topic: true },
          include: [
            {
              model: Session,
              as: 'sessions',
              required: true,
              where: { status: 'completed' },
              attributes: [],
            },
            {
              model: Teachertopicstats,
              as: 'teacherStats',
              required: true,
              where: {
                ...(tier && tier !== 'all' ? { tier } : {}),
                ...(level && level !== 'All' ? { level } : {}),
              },
              attributes: [],
            },
          ],
          attributes: [],
        },
      ];

      const domains = await CatalogueNode.findAll({
        where,
        attributes: [
          'node_id',
          'name',
          [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('topics->sessions.id'))), 'sessionCount'],
          [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('topics->teacherStats.teacher_id'))), 'teacherCount'],
        ],
        include,
        group: ['CatalogueNode.node_id'],
        order: [[Sequelize.literal('"sessionCount"'), 'DESC']],
        limit: 10,
        raw: true,
      });

      const domainsWithSparklines = await Promise.all(
        domains.map(async (item) => ({
          id: item.node_id,
          name: item.name,
          sessionCount: item.sessionCount,
          teacherCount: item.teacherCount,
          spark: await getDomainSparklineData(item.node_id, range),
        }))
      );

      return res.json(domainsWithSparklines);
    }
  } catch (error) {
    console.error("Error fetching top entities:", error);
    res.status(500).json({
      error: "Failed to fetch data",
      details: error.message,
    });
  }
};



async function getTopicSparklineData(topicId, range) {
  const dateCondition = getDateRangeCondition(range);

  const results = await Session.findAll({
    where: {
      status: 'completed',
      topic_id: topicId,
      ...(dateCondition ? { completed_at: { [Op.gte]: new Date(dateCondition.split('>= ')[1].replace(/'/g, '')) } } : {}),
    },
    attributes: [
      [Sequelize.literal(getTimeGroup(range, 'sessions')), 'time_group'],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'value'],
    ],
    group: ['time_group'],
    order: [Sequelize.literal('time_group')],
    raw: true,
  });

  return results.map(r => r.value);
}



async function getDomainSparklineData(domainId, range) {
  const dateCondition = getDateRangeCondition(range);

  const results = await Session.findAll({
    where: {
      status: 'completed',
      ...(dateCondition ? { completed_at: { [Op.gte]: new Date(dateCondition.split('>= ')[1].replace(/'/g, '')) } } : {}),
    },
    include: [
      {
        model: CatalogueNode,
        as: 'topic',
        where: { parent_id: domainId, is_topic: true },
        attributes: [],
      },
    ],
    attributes: [
      [Sequelize.literal(getTimeGroup(range, 's')), 'time_group'],
      [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('s.id'))), 'value'],
    ],
    group: ['time_group'],
    order: [Sequelize.literal('time_group')],
    raw: true,
  });

  const buckets = buildTimeBuckets(range);
  const valuesByTime = Object.fromEntries(
    results.map(r => [formatTimeKey(r.time_group, range), parseInt(r.value, 10)])
  );

  return buckets.map(t => valuesByTime[t] || 0);
}



function buildTimeBuckets(range) {
  const now = new Date();
  let buckets = [];

  if (range === 'today') {
    
    for (let h = 0; h < 24; h++) {
      const d = new Date(now);
      d.setHours(h, 0, 0, 0);
      buckets.push(d.toISOString().slice(0, 13) + ':00'); // "YYYY-MM-DDTHH:00"
    }
  } else if (range === 'week') {

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      buckets.push(d.toISOString().slice(0, 10));
    }
  } else if (range === 'month') {

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      buckets.push(d.toISOString().slice(0, 10)); // "YYYY-MM-DD"
    }
  }

  return buckets;
}


function formatTimeKey(dbValue, range) {
  const d = new Date(dbValue);
  if (range === 'today') {
    return d.toISOString().slice(0, 13) + ':00';
  } else {
    return d.toISOString().slice(0, 10);
  }
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

function getDateRangeCondition(range, alias = '') {
  const now = new Date();
  const prefix = alias ? `${alias}.` : '';
  let condition = '';

  switch (range) {
    case 'today': {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      condition = `${prefix}completed_at >= '${todayStart.toISOString()}'`;
      break;
    }
    case 'week': {
      const weekStart = new Date();
      weekStart.setDate(now.getDate() - 7);
      condition = `${prefix}completed_at >= '${weekStart.toISOString()}'`;
      break;
    }
    case 'month': {
      const monthStart = new Date();
      monthStart.setMonth(now.getMonth() - 1);
      condition = `${prefix}completed_at >= '${monthStart.toISOString()}'`;
      break;
    }
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

async function fetchReverseLoadsMap(topicIds) {
  if (!topicIds || !topicIds.length) return {};
  const rows = await Teachertopicstats.findAll({
    attributes: [
      'node_id',
      [Sequelize.fn('COUNT', Sequelize.col('node_id')), 'cnt']
    ],
    where: {
      node_id: topicIds,
      level: 'Bridger',
      tier: 'free',
      [Sequelize.Op.or]: [
        { paid_at: null },
        { paid_at: { [Sequelize.Op.gt]: new Date() } }
      ]
    },
    group: ['node_id'],
    raw: true
  });

  const map = {};
  rows.forEach(r => { map[r.node_id] = Number(r.cnt) || 0; });
 
  topicIds.forEach(id => { if (map[id] == null) map[id] = 0; });
  return map;
}

export const getSummary = async (req, res) => {
  try {
    const { domainId, topicId, tier, level, language } = req.query;
    const safeTier = tier || 'all';
    const safeLevel = level || 'All';
    const safeLang = language || 'all';
    const cacheKey = `summary:${domainId || 'none'}:${topicId || 'none'}:${safeTier}:${safeLevel}:${safeLang}`;
    const cachedData = await redisClient.get(cacheKey);
    let cachedResult = cachedData ? JSON.parse(cachedData) : null;
    let topics = [];
    let countResults = {};
    if (!cachedResult) {

      let teacherIdsForLanguage = null;
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

        const teacherRecords = await User.findAll({
          where: { preferred_language_id: languageRecord.language_id },
          attributes: ['id'],
          raw: true
        });
        teacherIdsForLanguage = teacherRecords.map(u => u.id);

        if (!teacherIdsForLanguage.length) {
          const emptyResult = {
            totals: { tillDate: 0, thatDay: 0, thatWeek: 0, thatMonth: 0 },
            topics: [],
          };
          await redisClient.set(cacheKey, JSON.stringify(emptyResult), 'EX', 60);
          return res.json({ ...emptyResult, projections: { nextDay: 0, nextWeek: 0, nextMonth: 0 } });
        }
      }

    
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

 
      const sessionWhere = { status: "completed" };
      if (level && level !== "All") sessionWhere.session_level = level;
      if (tier && tier !== "all") sessionWhere.session_tier = tier;
      if (topics.length) sessionWhere.topic_id = topics.map(t => t.node_id);

      countResults = await getSessionCountsOptimized(sessionWhere, teacherIdsForLanguage);
      const topicIdsArr = topics.map(t => t.node_id);

      const [teacherStats, topicDetails, revLoadMap] = await Promise.all([
        getTeacherStatsByTopicOptimized(topicIdsArr, teacherIdsForLanguage), 
        getTopicDetailsOptimized(topics, { tier, level, teacherIds: teacherIdsForLanguage }),
        fetchReverseLoadsMap(topicIdsArr) 
      ]);

      const topicsWithRevLoad = (topicDetails || []).map(t => ({
        ...t,
        revLoad: revLoadMap[t.topicId] || 0
      }));

      cachedResult = {
        totals: countResults,
        topics: topicsWithRevLoad,
      };

    
      await redisClient.set(cacheKey, JSON.stringify(cachedResult), 'EX', 300);
    } else {

      if (cachedResult.topics?.length && cachedResult.topics[0]?.revLoad === undefined) {
        const ids = cachedResult.topics.map(t => t.topicId).filter(Boolean);
        const revLoadMap = await fetchReverseLoadsMap(ids);
        cachedResult.topics = cachedResult.topics.map(t => ({
          ...t,
          revLoad: revLoadMap[t.topicId] || 0
        }));
        await redisClient.set(cacheKey, JSON.stringify(cachedResult), 'EX', 300);
      }
    }


    const projections = await getProjections(
      cachedResult.totals.thatMonth,
      { tier, level, languageId: cachedResult.totals.languageId || undefined, sessionFilters: {} }
    );

 
    const topicsWithPerTopicProj = await Promise.all(
      (cachedResult.topics || []).map(async (t) => {
        try {
          const month = t.sessions?.month ?? 0;
          const perTopicProj = await getProjections(month, {
            tier,
            level,
            languageId: cachedResult.totals.languageId || undefined,
            sessionFilters: { topic_id: t.topicId } 
          });
          return { ...t, projections: perTopicProj };
        } catch (e) {
   
          return { ...t, projections: { nextDay: 0, nextWeek: 0, nextMonth: 0 } };
        }
      })
    );


    return res.json({
      ...cachedResult,
      topics: topicsWithPerTopicProj,
      projections
    });

  } catch (error) {
    console.error("Error fetching summary:", error);
    return res.status(500).json({ error: "Failed to fetch summary", details: error.message });
  }
};




async function getSessionCountsOptimized(whereClause, teacherIds) {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const where = { ...whereClause };
  if (teacherIds?.length) where.teacher_id = { [Op.in]: teacherIds };

  const results = await Session.findAll({
    where,
    attributes: [
      [Sequelize.fn('COUNT', Sequelize.col('*')), 'total'],
      [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN completed_at >= '${today.toISOString()}' THEN 1 END`)), 'today'],
      [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN completed_at >= '${weekStart.toISOString()}' THEN 1 END`)), 'week'],
      [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN completed_at >= '${monthStart.toISOString()}' THEN 1 END`)), 'month'],
    ],
    raw: true,
  });

  const row = results[0] || {};
  return {
    tillDate: parseInt(row.total || 0, 10),
    thatDay: parseInt(row.today || 0, 10),
    thatWeek: parseInt(row.week || 0, 10),
    thatMonth: parseInt(row.month || 0, 10),
  };
}



async function getTeacherStatsByTopicOptimized(topicIds, teacherIds) {
  if (!topicIds.length) return {};

  const where = { node_id: topicIds };
  if (teacherIds?.length) where.teacher_id = { [Op.in]: teacherIds };

  const results = await Teachertopicstats.findAll({
    where,
    attributes: [
      'node_id',
      [Sequelize.fn('COUNT', Sequelize.col('teacher_id')), 'total'],
      [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN tier = 'paid' THEN 1 END`)), 'paid'],
      [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN tier = 'free' THEN 1 END`)), 'free'],
    ],
    group: ['node_id'],
    raw: true,
  });

  return results.reduce((acc, row) => {
    acc[row.node_id] = {
      qualified: Number(row.total) || 0,
      paid: Number(row.paid) || 0,
      free: Number(row.free) || 0,
    };
    return acc;
  }, {});
}


async function getSessionCountsByTopicOptimized(topicIds, filters) {
  if (!topicIds.length) return {};

  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const where = { topic_id: topicIds };
  if (filters.teacherIds?.length) where.teacher_id = { [Op.in]: filters.teacherIds };
  if (filters.level && filters.level !== 'All') where.session_level = filters.level;
  if (filters.tier && filters.tier !== 'all') where.session_tier = filters.tier;

  const results = await Session.findAll({
    where,
    attributes: [
      'topic_id',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
      [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN completed_at >= '${today.toISOString()}' THEN 1 END`)), 'today'],
      [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN completed_at >= '${weekStart.toISOString()}' THEN 1 END`)), 'week'],
      [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN completed_at >= '${monthStart.toISOString()}' THEN 1 END`)), 'month'],
    ],
    group: ['topic_id'],
    raw: true,
  });

  return results.reduce((acc, row) => {
    acc[row.topic_id] = {
      today: Number(row.today) || 0,
      week: Number(row.week) || 0,
      month: Number(row.month) || 0,
      total: Number(row.total) || 0,
    };
    return acc;
  }, {});
}


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

async function getTopicDetailsOptimized(topics, filters) {
  if (!topics.length) return [];

  const topicIds = topics.map(t => t.node_id);
  const [sessionCounts, teacherStats] = await Promise.all([
    getSessionCountsByTopicOptimized(topicIds, filters),
    getTeacherStatsByTopicOptimized(topicIds, filters.teacherIds)
  ]);

  return topics.map(topic => ({
    topicId: topic.node_id,
    topicName: topic.name,
    sessions: sessionCounts[topic.node_id] || { today: 0, week: 0, month: 0, total: 0 },
    teachers: teacherStats[topic.node_id] || { qualified: 0, paid: 0, free: 0 }
  }));
}





export const getReverseMappingLoad = async (req, res) => {
  try {
    const { topicId } = req.query;

    if (!topicId) {
      return res.status(400).json({ error: 'Topic ID is required' });
    }

  
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