import bcrypt from 'bcryptjs'
import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import { app } from 'electron'
import fs from 'fs'
import path from 'path'

import { getDbPath } from '@/config/paths'
import { sqlite3Tables } from '@schema/sqlite3'
import { employee_activities, employees } from '@schema/sqlite3/accounts'

let dbInstance: DatabaseType | null = null
let db: BetterSQLite3Database<typeof sqlite3Tables> | null = null

/**
 * Setup database:
 * - Run migrations
 * - Initialize admin user if missing
 */

export const getMigrationsPath = () => {
  if (app.isPackaged) {
    // In production, migrations are in resources/drizzle
    const possiblePaths = [
      path.join(process.resourcesPath, 'drizzle'),
      path.join(process.resourcesPath, 'app.asar', 'drizzle'), // Sometimes asar unpacking
      path.join(__dirname, '../../drizzle'), // Fallback
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log('Found migrations at:', p);
        return p;
      }
    }
    
    console.error('Could not find migrations folder. Tried:', possiblePaths);
    return path.join(process.resourcesPath, 'drizzle'); // Default
  } else {
    // In development
    return path.resolve('drizzle');
  }
};

export const setupDatabase = async (): Promise<void> => {
  if (db) return

  // 1. Open SQLite
  dbInstance = new Database(getDbPath())

  // 2. Enable foreign keys
  dbInstance.exec('PRAGMA foreign_keys = ON;')

  const migrationsFolder = getMigrationsPath();

  if (!fs.existsSync(migrationsFolder)) {
    console.error('Migrations folder does not exist!');
    // List directory contents for debugging
    if (app.isPackaged) {
      console.log('Resources path contents:', fs.readdirSync(process.resourcesPath));
    }
  }

  // 3. Init Drizzle
  db = drizzle(dbInstance, { schema: sqlite3Tables })

  // 4. 🔥 CREATE TABLES (THE RIGHT WAY)
  migrate(db, { migrationsFolder })

  // 5. Bootstrap admin user
  const admin = db
    .select()
    .from(employees)
    .where(eq(employees.role, 'admin'))
    .get()

  if (!admin) {
    const password_hash = await bcrypt.hash('admin', 10)
    db.insert(employees).values({
      username: 'admin',
      password_hash,
      role: 'admin'
    })
  }
}

/**
 * Get Drizzle database instance
 */
export const getDB = (): BetterSQLite3Database<typeof sqlite3Tables> => {
  if (!db) throw new Error('Database not initialized. Call setupDatabase() first.')
  return db
}

/**
 * Close the database connection
 */
export const closeDB = (): void => {
  dbInstance?.close()
  dbInstance = null
  db = null
}

/**
 * Log employee activity
 */
export const logEmployeeActivity = ({
  activity,
  linked_activity_id,
  linked_activity_table,
  old_data,
  new_data,
  employee_id
}: {
  activity: string
  linked_activity_id?: number
  linked_activity_table?: string
  old_data?: string
  new_data?: string
  employee_id: number
}): void => {
  if (!db) throw new Error('Database not initialized')

  db.insert(employee_activities).values({
    activity,
    linked_activity_id: linked_activity_id ?? null,
    linked_activity_table: linked_activity_table ?? null,
    old_data: old_data ?? null,
    new_data: new_data ?? null,
    employee_id
  })
}
