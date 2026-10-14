import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const submissions = sqliteTable('submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind').notNull(), name: text('name').notNull(), email: text('email').notNull(),
  category: text('category').notNull(), message: text('message').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const limits = sqliteTable('submission_limits', {
  key: text('key').primaryKey(), window: integer('window').notNull(), count: integer('count').notNull(),
});
