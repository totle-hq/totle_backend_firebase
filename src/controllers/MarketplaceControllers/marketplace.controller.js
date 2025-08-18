import { Sequelize, Op } from "sequelize";
import { PresentNodeStats } from "../../Models/analytics/PresentNodeStatsmodel.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { Session } from "../../Models/SessionModel.js";
import { Teachertopicstats } from "../../Models/TeachertopicstatsModel.js";
import { getProjections } from "../../utils/marketplacefunction.js";
import sequelize from "../../config/database.js";
import { redisClient } from "../../config/redis.js";
import { Language } from "../../Models/LanguageModel.js";
import { User } from "../../Models/UserModels/UserModel.js";

const CACHE_TTL = 300; 

export const getSearchTopics = async (req, res) => {
  try {
    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const topTopics = await PresentNodeStats.findAll({
      attributes: [
        'node_id',
        [Sequelize.fn('SUM', Sequelize.col('searchCount')), 'totalSearchCount']
      ],
      include: [
        {
          model: CatalogueNode,
          as: 'node',
          attributes: ['node_id', 'name']
        }
      ],
      where: {
        createdAt: { [Op.gte]: sevenDaysAgo } // Only last 7 days
      },
      group: ['PresentNodeStats.node_id', 'node.node_id'],
      order: [[Sequelize.literal('"totalSearchCount"'), 'DESC']],
      limit: 10
    });

    res.json({ success: true, data: topTopics });
  } catch (error) {
    console.error("Error fetching top active topics:", error);
    res.status(500).json({ error: "Failed to fetch top active topics" });
  }
};






export const getTopActiveTopics = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(today);
    monthStart.setDate(1);

    // Get top topics by session activity
    const topTopics = await Session.findAll({
      attributes: [
        "topic_id",
        [Sequelize.fn("COUNT", Sequelize.col("topic_id")), "totalSessions"],
        [Sequelize.fn("COUNT", Sequelize.literal(`CASE WHEN DATE("completed_at") = DATE('${today.toISOString()}') THEN 1 END`)), "todaySessions"],
        [Sequelize.fn("COUNT", Sequelize.literal(`CASE WHEN "completed_at" >= '${weekStart.toISOString()}' THEN 1 END`)), "weekSessions"],
        [Sequelize.fn("COUNT", Sequelize.literal(`CASE WHEN "completed_at" >= '${monthStart.toISOString()}' THEN 1 END`)), "monthSessions"],
      ],
      where: { status: "completed" },
      include: [{
        model: CatalogueNode,
        as: "topic",
        attributes: ["node_id", "name", "description"],
      }],
      group: ["topic_id", "topic.node_id", "topic.name"],
      order: [[Sequelize.literal('COUNT("topic_id")'), "DESC"]],
      limit: 10,
    });

    const topicIds = topTopics.map(t => t.topic_id);

    // Teacher stats: paid/free count and level breakdown
    const [teacherStats, searchStats, progressionStats, levelStats] = await Promise.all([
      Teachertopicstats.findAll({
        where: { node_id: topicIds },
        attributes: [
          'node_id',
          [Sequelize.fn('COUNT', Sequelize.col('teacher_id')), 'totalTeachers'],
          [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN tier = 'paid' THEN 1 END`)), 'paidTeachers'],
          [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN tier = 'free' THEN 1 END`)), 'unpaidTeachers'],
        ],
        group: ['node_id']
      }),
      PresentNodeStats.findAll({
        where: { node_id: topicIds },
        attributes: ['node_id', 'searchCount']
      }),
      Teachertopicstats.findAll({
        where: { 
          node_id: topicIds,
          tier: 'paid',
          paid_at: { [Sequelize.Op.ne]: null }
        },
        attributes: [
          'node_id',
          [Sequelize.fn('AVG', 
            Sequelize.literal(`EXTRACT(EPOCH FROM ("paid_at" - "created_at"))/86400`)
          ), 'avgDaysToPaid']
        ],
        group: ['node_id']
      }),
      // New query for level breakdown
      Teachertopicstats.findAll({
        where: { node_id: topicIds },
        attributes: [
          'node_id',
          [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN level = 'Bridger' THEN 1 END`)), 'bridgerCount'],
          [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN level = 'Expert' THEN 1 END`)), 'expertCount'],
          [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN level = 'Master' THEN 1 END`)), 'masterCount'],
          [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN level = 'Legend' THEN 1 END`)), 'legendCount'],
        ],
        group: ['node_id']
      })
    ]);

    // Assemble the response with level breakdown
    const response = await Promise.all(topTopics.map(async (t) => {
      const topicStats = teacherStats.find(ts => ts.node_id === t.topic_id);
      const progression = progressionStats.find(ps => ps.node_id === t.topic_id);
      const levels = levelStats.find(ls => ls.node_id === t.topic_id);

      return {
        topic_id: t.topic_id,
        topic_name: t.topic?.name || null,
        topic_description: t.topic?.description,
        searchvolume: searchStats.find(s => s.node_id === t.topic_id)?.searchCount || 0,
        sessions_delivered: {
          today: parseInt(t.get("todaySessions"), 10),
          this_week: parseInt(t.get("weekSessions"), 10),
          this_month: parseInt(t.get("monthSessions"), 10),
          total: parseInt(t.get("totalSessions"), 10)
        },
        teacher_stats: {
          total: parseInt(topicStats?.get?.('totalTeachers') || 0, 10),
          paid: parseInt(topicStats?.get?.('paidTeachers') || 0, 10),
          unpaid: parseInt(topicStats?.get?.('unpaidTeachers') || 0, 10),
          levels: {
            bridger: parseInt(levels?.get?.('bridgerCount') || 0, 10),
            expert: parseInt(levels?.get?.('expertCount') || 0, 10),
            master: parseInt(levels?.get?.('masterCount') || 0, 10),
            legend: parseInt(levels?.get?.('legendCount') || 0, 10)
          },
          progression_stats: {
            avg_days_to_paid: progression?.get?.('avgDaysToPaid') 
              ? parseFloat(progression.get('avgDaysToPaid')).toFixed(1) 
              : 0
          }
        },
        projected_demand: await getProjections(
          t.topic_id,
          parseInt(t.get("monthSessions"), 10)
        )
      };
    }));

    return res.status(200).json({ success: true, data: response });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch data",
      details: error.message 
    });
  }
};
export const getTopActiveDomains = async (req, res) => {
  try {
    // Date setup
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(today);
    monthStart.setDate(1);

    // 1. Get top topics with session counts
    const topTopics = await Session.findAll({
      attributes: [
        "topic_id",
        [Sequelize.fn("COUNT", Sequelize.col("topic_id")), "totalSessions"],
        [Sequelize.fn("COUNT", Sequelize.literal(`CASE WHEN DATE("completed_at") = DATE('${today.toISOString()}') THEN 1 END`)), "todaySessions"],
        [Sequelize.fn("COUNT", Sequelize.literal(`CASE WHEN "completed_at" >= '${weekStart.toISOString()}' THEN 1 END`)), "weekSessions"],
        [Sequelize.fn("COUNT", Sequelize.literal(`CASE WHEN "completed_at" >= '${monthStart.toISOString()}' THEN 1 END`)), "monthSessions"],
      ],
      where: { status: "completed" },
      include: [{
        model: CatalogueNode,
        as: "topic",
        attributes: ["node_id", "name", "description", "parent_id"],
      }],
      group: ["topic_id", "topic.node_id", "topic.name", "topic.parent_id"],
    });

    if (!topTopics.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    // 2. Get all parent nodes (subjects) of these topics
    const subjectIds = [...new Set(topTopics.map(t => t.topic?.parent_id).filter(Boolean))];
    const subjects = await CatalogueNode.findAll({
      where: { node_id: subjectIds },
      attributes: ['node_id', 'parent_id', 'name', 'is_domain'],
      include: [{
        model: CatalogueNode,
        as: 'parent',
        attributes: ['node_id', 'name', 'is_domain'],
        required: false
      }]
    });

    // 3. Identify all domains
    const domainsMap = new Map();
    const topicDomainMap = new Map();

    for (const topic of topTopics) {
      if (!topic.topic?.parent_id) continue;
      
      const subject = subjects.find(s => s.node_id === topic.topic.parent_id);
      if (!subject) continue;

      if (subject.is_domain) {
        domainsMap.set(subject.node_id, {
          id: subject.node_id,
          name: subject.name
        });
        topicDomainMap.set(topic.topic_id, subject.node_id);
      } 
      else if (subject.parent?.is_domain) {
        domainsMap.set(subject.parent.node_id, {
          id: subject.parent.node_id,
          name: subject.parent.name
        });
        topicDomainMap.set(topic.topic_id, subject.parent.node_id);
      }
    }

    const domainIds = Array.from(domainsMap.keys());
    if (domainIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // 4. Get all topics that belong to these domains (through subjects)
    const domainTopics = await CatalogueNode.findAll({
      where: {
        parent_id: subjects.map(s => s.node_id),
        is_topic: true
      },
      attributes: ['node_id', 'parent_id']
    });

    // 5. Get search stats for all domains and their topics
    const allSearchStats = await PresentNodeStats.findAll({
      where: {
        [Sequelize.Op.or]: [
          { node_id: domainIds },
          { node_id: domainTopics.map(t => t.node_id) }
        ]
      },
      attributes: ['node_id', 'searchCount']
    });

    // 6. Calculate search volume per domain
    const domainSearchCounts = new Map(domainIds.map(id => [id, 0]));
    
    allSearchStats.forEach(stat => {
      if (domainIds.includes(stat.node_id)) {
        const current = domainSearchCounts.get(stat.node_id) || 0;
        domainSearchCounts.set(stat.node_id, current + (stat.searchCount || 0));
      } 
      else {
        const topic = domainTopics.find(t => t.node_id === stat.node_id);
        if (topic) {
          const subject = subjects.find(s => s.node_id === topic.parent_id);
          if (subject) {
            const domainId = subject.is_domain ? subject.node_id : subject.parent?.node_id;
            if (domainId) {
              const current = domainSearchCounts.get(domainId) || 0;
              domainSearchCounts.set(domainId, current + (stat.searchCount || 0));
            }
          }
        }
      }
    });

    // 7. Get teacher stats including level breakdown and weighted progression stats
    const topicIds = topTopics.map(t => t.topic_id);
    const [teacherStats, progressionStats, levelStats] = await Promise.all([
      Teachertopicstats.findAll({
        where: { node_id: topicIds },
        attributes: [
          'node_id',
          [Sequelize.fn('COUNT', Sequelize.col('teacher_id')), 'totalTeachers'],
          [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN tier = 'paid' THEN 1 END`)), 'paidTeachers'],
          [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN tier = 'free' THEN 1 END`)), 'unpaidTeachers'],
        ],
        group: ['node_id']
      }),
      // Modified to include teacher count for weighted average
      Teachertopicstats.findAll({
        where: { 
          node_id: topicIds,
          tier: 'paid',
          paid_at: { [Sequelize.Op.ne]: null }
        },
        attributes: [
          'node_id',
          [Sequelize.fn('AVG', 
            Sequelize.literal(`EXTRACT(EPOCH FROM (paid_at - created_at))/86400`)
          ), 'avgDaysToPaid'],
          [Sequelize.fn('COUNT', Sequelize.col('teacher_id')), 'teacherCount']
        ],
        group: ['node_id']
      }),
      // Teacher level breakdown
      Teachertopicstats.findAll({
        where: { node_id: topicIds },
        attributes: [
          'node_id',
          [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN level = 'Bridger' THEN 1 END`)), 'bridgerCount'],
          [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN level = 'Expert' THEN 1 END`)), 'expertCount'],
          [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN level = 'Master' THEN 1 END`)), 'masterCount'],
          [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN level = 'Legend' THEN 1 END`)), 'legendCount'],
        ],
        group: ['node_id']
      })
    ]);

    // 8. Get projections
    const projectionsMap = {};
    await Promise.all(
      topTopics.map(async t => {
        const monthSessions = parseInt(t.get("monthSessions"), 10);
        let projection = await getProjections(t.topic_id, monthSessions);
        projectionsMap[t.topic_id] = {
          next_day: Number(projection?.next_day) || 0,
          next_week: Number(projection?.next_week) || 0,
          next_month: Number(projection?.next_month) || 0
        };
      })
    );

    // 9. Aggregate data by domain
    const domainDataMap = {};
    
    // Initialize domains
    domainIds.forEach(domainId => {
      const domain = domainsMap.get(domainId);
      domainDataMap[domainId] = {
        domain_id: domainId,
        domain_name: domain.name,
        searchvolume: domainSearchCounts.get(domainId) || 0,
        sessions_delivered: { today: 0, this_week: 0, this_month: 0, total: 0 },
        teacher_stats: { 
          total: 0, 
          paid: 0, 
          unpaid: 0,
          levels: {
            bridger: 0,
            expert: 0,
            master: 0,
            legend: 0
          },
          progression_stats: { avg_days_to_paid: 0 } 
        },
        projected_demand: { next_day: 0, next_week: 0, next_month: 0 },
        _progression_values: [] // Now stores {value, weight} objects
      };
    });

    // Aggregate topic data into domains
    topTopics.forEach(t => {
      const domainId = topicDomainMap.get(t.topic_id);
      if (!domainId || !domainDataMap[domainId]) return;

      const domainData = domainDataMap[domainId];
      
      // Sessions
      domainData.sessions_delivered.today += parseInt(t.get("todaySessions"), 10);
      domainData.sessions_delivered.this_week += parseInt(t.get("weekSessions"), 10);
      domainData.sessions_delivered.this_month += parseInt(t.get("monthSessions"), 10);
      domainData.sessions_delivered.total += parseInt(t.get("totalSessions"), 10);

      // Projections
      const proj = projectionsMap[t.topic_id] || { next_day: 0, next_week: 0, next_month: 0 };
      domainData.projected_demand.next_day += proj.next_day;
      domainData.projected_demand.next_week += proj.next_week;
      domainData.projected_demand.next_month += proj.next_month;

      // Teacher stats
      const topicStats = teacherStats.find(ts => ts.node_id === t.topic_id);
      if (topicStats) {
        domainData.teacher_stats.total += parseInt(topicStats.get('totalTeachers') || 0, 10);
        domainData.teacher_stats.paid += parseInt(topicStats.get('paidTeachers') || 0, 10);
        domainData.teacher_stats.unpaid += parseInt(topicStats.get('unpaidTeachers') || 0, 10);
      }

      // Teacher levels
      const levelStat = levelStats.find(ls => ls.node_id === t.topic_id);
      if (levelStat) {
        domainData.teacher_stats.levels.bridger += parseInt(levelStat.get('bridgerCount') || 0, 10);
        domainData.teacher_stats.levels.expert += parseInt(levelStat.get('expertCount') || 0, 10);
        domainData.teacher_stats.levels.master += parseInt(levelStat.get('masterCount') || 0, 10);
        domainData.teacher_stats.levels.legend += parseInt(levelStat.get('legendCount') || 0, 10);
      }

      // Progression data (for weighted average)
      const progression = progressionStats.find(ps => ps.node_id === t.topic_id);
      if (progression?.get('avgDaysToPaid')) {
        domainData._progression_values.push({
          value: parseFloat(progression.get('avgDaysToPaid')),
          weight: parseInt(progression.get('teacherCount'))|| 1
        });
      }
    });

    // Calculate weighted average days to paid
    Object.values(domainDataMap).forEach(domain => {
      if (domain._progression_values.length) {
        const totalWeight = domain._progression_values.reduce((sum, item) => sum + item.weight, 0);
        const weightedSum = domain._progression_values.reduce((sum, item) => sum + (item.value * item.weight), 0);
        domain.teacher_stats.progression_stats.avg_days_to_paid = 
          parseFloat((weightedSum / totalWeight).toFixed(1));
      }
      delete domain._progression_values;
    });

    // Convert to array and sort
    const domainArray = Object.values(domainDataMap).sort(
      (a, b) => b.sessions_delivered.total - a.sessions_delivered.total
    );

    return res.status(200).json({ success: true, data: domainArray });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch top domains",
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
      tier: 'paid'
  
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
      // Topic logic
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
      teacherCount: item.teacherCount,  // Now included
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

// Separate function for topic sparklines
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

// Updated time group function
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

// Updated date range condition
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
// Replace all dayjs usage with native Date:

// Example replacement for getTrendData:
export const getTrendData = async (req, res) => {
  try {
    const { entity, ids, range } = req.query;
    const entityIds = ids.split(',');
    
    if (!entity || !ids) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const results = [];
    const now = new Date();
    const baseDate = range === 'today' ? 
      new Date(now.setHours(0, 0, 0, 0)) : 
      new Date(now.setDate(now.getDate() - (range === 'week' ? 6 : 29)));
    
    for (const id of entityIds) {
      // Skip database queries for mock IDs and return mock data
      if (id.startsWith('topic_') || id.startsWith('domain_')) {
        results.push({
          id,
          name: `Mock ${id.replace('_', ' ')}`,
          data: Array.from({length: range === 'today' ? 24 : (range === 'week' ? 7 : 30)}, 
            (_, i) => ({
              t: range === 'today' ? `${i}:00` : `Day ${i+1}`,
              v: Math.floor(20 + Math.random() * 100)
            }))
        });
        continue;
      }

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
        
        let count;
        if (entity === 'topic') {
          // Count sessions for a single topic
          count = await Session.count({
            where: {
              topic_id: id,
              status: 'completed',
              completed_at: { 
                [Op.gte]: date,
                [Op.lt]: nextDate
              }
            }
          });
        } else {
          // Count sessions for all topics in this domain
          count = await Session.count({
            include: [{
              model: CatalogueNode,
              as: 'topic',
              where: {
                parent_id: id,
                is_topic: true
              },
              required: true
            }],
            where: {
              status: 'completed',
              completed_at: { 
                [Op.gte]: date,
                [Op.lt]: nextDate
              }
            }
          });
        }
        
        const formattedTime = range === 'today' 
          ? `${date.getHours().toString().padStart(2, '0')}:00`
          : `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`;
        
        dataPoints.push({
          t: formattedTime,
          v: count
        });
      }
      
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
    console.log("Tier:", tier);

    // 1. Handle language filter (fetch languageId from Language table if needed)
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

    // 2. Prepare filters
    const sessionWhere = { status: "completed" };
    const teacherStatsWhere = {};
    const hasTeacherFilters = (tier && tier !== "all") || (level && level !== "All");

    if (level && level !== "All") {
      teacherStatsWhere.level = level;
    }

    // 3. Get topics
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
        include: [{
          model: Teachertopicstats,
          where: teacherStatsWhere,
          required: hasTeacherFilters,
          attributes: []
        }],
        raw: true
      });
      if (topics.length) {
        sessionWhere.topic_id = topics.map((t) => t.node_id);
      }
    }

    // 4. Build include with teacher and topicStats
    const sessionInclude = [{
      model: User,
      as: "teacher",
      attributes: [],
      required: true,
      where: languageId ? { preferred_language_id: languageId } : {},
      include: [{
        model: Teachertopicstats,
        as: "topicStats",
        where: teacherStatsWhere,
        required: hasTeacherFilters,
        attributes: []
      }]
    }];

    // Extra filtering logic based on tier & paidAt
    if (tier && tier !== "all") {
      if (tier === "free") {
        // sessions before teacher upgraded
        sessionWhere["$teacher.topicStats.paid_at$"] = {
          [Op.or]: [
            { [Op.is]: null }, // never upgraded
            { [Op.gt]: Sequelize.col("Session.completed_at") } // upgraded later
          ]
        };
      }
      if (tier === "paid") {
        // sessions after upgrade
        sessionWhere["$teacher.topicStats.paid_at$"] = {
          [Op.lte]: Sequelize.col("Session.completed_at")
        };
      }
    }

    // 5. Helper for distinct count
    const getFilteredCount = async (whereClause = {}) => {
      const result = await Session.findAll({
        attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("Session.id")), "id"]],
        where: { ...sessionWhere, ...whereClause },
        include: sessionInclude,
        raw: true,
      });
      return result.length;
    };

    // 6. Date ranges
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // 7. Counts
    const [total, todayCount, weekCount, monthCount] = await Promise.all([
      getFilteredCount(),
      getFilteredCount({ completed_at: { [Op.gte]: today } }),
      getFilteredCount({ completed_at: { [Op.gte]: weekStart } }),
      getFilteredCount({ completed_at: { [Op.gte]: monthStart } }),
    ]);

    // 8. Projections + Topic details
    const projections = await getProjections(
      topicId || domainId || null,
      monthCount,
      { tier, level, languageId, sessionFilters: sessionWhere }
    );

    const topicDetails = await getTopicDetails(topics, { tier, level, languageId });

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




// Helper functions

async function getBaseCounts(sessionWhere, filters) {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const includeOptions = [];
  const teacherWhere = applyTeacherFilters(filters);
  if (Object.keys(teacherWhere).length > 0) {
    includeOptions.push({
      model: User,
      as: 'teacher',
      where: teacherWhere,
      required: true,
      attributes: []
    });
  }

  const baseQueryOptions = {
    where: sessionWhere,
    include: includeOptions
  };

  const [total, todayCount, weekCount, monthCount] = await Promise.all([
    Session.count(baseQueryOptions),
    Session.count({ ...baseQueryOptions, where: { ...sessionWhere, completed_at: { [Op.gte]: today } }}),
    Session.count({ ...baseQueryOptions, where: { ...sessionWhere, completed_at: { [Op.gte]: weekStart } }}),
    Session.count({ ...baseQueryOptions, where: { ...sessionWhere, completed_at: { [Op.gte]: monthStart } }})
  ]);

  const projections = await getProjections(
    sessionWhere.topic_id?.length === 1 ? sessionWhere.topic_id[0] : null,
    monthCount,
    filters
  );

  return {
    totals: {
      tillDate: total,
      thatDay: todayCount,
      thatWeek: weekCount,
      thatMonth: monthCount
    },
    projections: {
      nextDay: projections.nextDay,
      nextWeek: projections.nextWeek,
      nextMonth: projections.nextMonth
    }
  };
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

async function getSessionCountsByTopic(topicIds, filters) {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const include = [];
  const teacherWhere = applyTeacherFilters(filters);
  if (Object.keys(teacherWhere).length > 0) {
    include.push({
      model: User,
      as: 'teacher',
      where: teacherWhere,
      required: true,
      attributes: []
    });
  }

  const results = await Session.findAll({
    attributes: [
      'topic_id',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
      [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN completed_at >= '${today.toISOString()}' THEN 1 END`)), 'today'],
      [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN completed_at >= '${weekStart.toISOString()}' THEN 1 END`)), 'week'],
      [Sequelize.fn('COUNT', Sequelize.literal(`CASE WHEN completed_at >= '${monthStart.toISOString()}' THEN 1 END`)), 'month']
    ],
    where: { 
      topic_id: topicIds,
      status: 'completed'
    },
    include,
    group: ['topic_id'],
    raw: true
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

async function getTeacherStatsByTopic(topicIds, filters = {}) {
  const where = { node_id: topicIds };
  
  if (filters.tier) where.tier = filters.tier;
  if (filters.level) where.level = filters.level;
  if (filters.languageId) where.preferred_language_id = filters.languageId;

  const results = await Teachertopicstats.findAll({
    attributes: [
      'node_id',
      [Sequelize.fn('COUNT', Sequelize.col('teacher_id')), 'total'],
      [Sequelize.fn('COUNT', Sequelize.literal('CASE WHEN tier = \'paid\' THEN 1 END')), 'paid'],
      [Sequelize.fn('COUNT', Sequelize.literal('CASE WHEN tier = \'free\' THEN 1 END')), 'free']
    ],
    where,
    group: ['node_id'],
    raw: true
  });

  return results.reduce((acc, row) => {
    acc[row.node_id] = {
      qualified: parseInt(row.total, 10),
      paid: parseInt(row.paid, 10),
      free: parseInt(row.free, 10)
    };
    return acc;
  }, {});
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

function applyTeacherFilters(filters) {
  if (!filters) return {};
  
  const { tier, level, languageId } = filters;
  const where = {};
  
  if (tier && tier !== 'all') where['$teacher.tier$'] = tier;
  if (level && level !== 'All') where['$teacher.level$'] = level;
  if (languageId) where['$teacher.preferred_language_id$'] = languageId;
  
  return where;
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
    
    res.json({
      averageDays: Math.floor(parseFloat(result?.get('averageDays') || '0').toFixed(1))
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

    // 1. Verify the topic exists
    const topic = await CatalogueNode.findOne({
      where: { 
        node_id: topicId,
        is_topic: true 
      }
    });
    
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }

    // 2. Get all teachers qualified for this topic
    const qualifiedTeachers = await Teachertopicstats.findAll({
      where: { node_id: topicId },
      include: [{
        model: User,
        as: 'teacher',
        attributes: ['id', 'preferred_language_id']
      }],
      raw: true,  // Add this to get plain objects
      nest: true   // This nests the included models
    });

    if (qualifiedTeachers.length === 0) {
      return res.json({
        preferredBreakdown: [],
        shortageHint: "No qualified teachers found for this topic."
      });
    }

    // 3. Get all languages for reference
    const languages = await Language.findAll();
    const languageMap = new Map(languages.map(lang => [lang.language_id, lang.language_name]));

    // 4. Calculate language distribution
    const languageCounts = {};
    let totalTeachers = 0;

    qualifiedTeachers.forEach(teacherRecord => {
      const langId = teacherRecord.teacher?.preferred_language_id; // Access via teacher association
      if (langId) {
        languageCounts[langId] = (languageCounts[langId] || 0) + 1;
        totalTeachers++;
      }
    });

    // 5. Prepare response
    const preferredBreakdown = Object.entries(languageCounts).map(([langId, count]) => ({
      language: languageMap.get(parseInt(langId)) || `Unknown (ID: ${langId})`,
      percent: Math.round((count / totalTeachers) * 100)
    })).sort((a, b) => b.percent - a.percent);

    // 6. Add shortage hint if any language has high demand (>40%)
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
const inMemoryCache = new Map(); // fallback
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

// 🟢 Get all domains
export const getDomains = async (req, res) => {
  const key = 'catalogue:domains:all';
  const cached = await cacheGet(key);
  if (cached) return res.json(cached);

  try {
    const domains = await CatalogueNode.findAll({
      where: { 
        is_domain: true,
        status: 'active' // Optional: only get active domains
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



