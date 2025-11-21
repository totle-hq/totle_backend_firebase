// src/migrations/fix-notifications-table.js
import { sequelize1 } from "../config/sequelize.js";
import { QueryTypes } from "sequelize";

const fixNotificationsTable = async () => {
  try {
    console.log('🔄 Fixing notifications table...');
    
    // Drop the table if it exists (with wrong structure)
    await sequelize1.query(`DROP TABLE IF EXISTS "user"."notifications" CASCADE;`);
    
    // Create the table with correct structure
    await sequelize1.query(`
      CREATE TABLE "user"."notifications" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES "user"."users"(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(100) NOT NULL DEFAULT 'session_booking',
        category VARCHAR(50) NOT NULL CHECK (category IN ('all', 'learn', 'teach')) DEFAULT 'all',
        priority VARCHAR(20) CHECK (priority IN ('high', 'medium', 'low')),
        logo TEXT DEFAULT '/lo.jpg',
        read BOOLEAN DEFAULT FALSE,
        data JSONB,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `, { type: QueryTypes.RAW });

    // Create indexes with correct column names
    await sequelize1.query(`
      CREATE INDEX idx_notifications_user_id ON "user"."notifications"(user_id);
      CREATE INDEX idx_notifications_category ON "user"."notifications"(category);
      CREATE INDEX idx_notifications_read ON "user"."notifications"(read);
      CREATE INDEX idx_notifications_created_at ON "user"."notifications"(created_at);
    `, { type: QueryTypes.RAW });

    console.log('✅ Notifications table fixed successfully!');
  } catch (error) {
    console.error('❌ Error fixing notifications table:', error);
  }
};

// Run the fix
fixNotificationsTable()
  .then(() => {
    console.log('🎉 Notifications table fix completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });