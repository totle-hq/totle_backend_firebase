
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_user_topic_status_created
ON user.tests (user_id, topic_uuid, status, created_at DESC);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_topic_status_created
ON user.tests (topic_uuid, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fallback_topic_dimension
ON user.questionsPool (topic_uuid, dimension);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fallback_topic_dimension_usage
ON user.questionsPool (topic_uuid, dimension, usage_count);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fallback_topic_dim_qtext
ON user.questionsPool ( topic_uuid, dimension, (question->>'text')
);


✅ STEP 3: Verify indexes were created

Run:

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'user'
  AND tablename IN ('tests', 'questionsPool');