import { getDB, logEmployeeActivity } from '@db/sqlite3'
import { employees } from '@schema/sqlite3/accounts'
import { AUTH_FILE } from '@utils/config'
import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { ipcMain } from 'electron'
import fs from 'fs/promises'
import path from 'path'

ipcMain.handle(
  'login',
  async (
    _event,
    { username, password, role }: { username: string; password: string; role: string }
  ) => {
    try {
      const db = getDB()

      // Use Drizzle to find the employee
      const employee = db
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.username, username),
            eq(employees.role, role),
            eq(employees.is_active, true),
            eq(employees.is_deleted, false)
          )
        )
        .get() // ← synchronous, returns row or undefined

      if (!employee) {
        return {
          success: false,
          message: 'Invalid username or role, or employee is inactive/deleted.'
        }
      }

      // Compare password
      const match = await bcrypt.compare(password, employee.password_hash)

      if (!match) {
        return { success: false, message: 'Invalid password.' }
      }

      const userData = {
        id: employee.id,
        username: employee.username,
        role: employee.role
      }

      // Write session file
      const userDataDir = path.dirname(AUTH_FILE)
      await fs.mkdir(userDataDir, { recursive: true })
      await fs.writeFile(AUTH_FILE, JSON.stringify(userData, null, 2))

      // Log activity
      logEmployeeActivity({
        activity: 'logged in',
        employee_id: employee.id,
        linked_activity_id: employee.id,
        linked_activity_table: 'employees'
      })

      return { success: true, data: userData }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, message: 'An unexpected error occurred.' }
    }
  }
)
