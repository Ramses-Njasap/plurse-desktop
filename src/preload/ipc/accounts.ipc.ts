// src/main/ipc/employees.ts (or wherever this lives)

import { getDB, logEmployeeActivity } from '@db/sqlite3'
import { departments, employee_media, employees } from '@schema/sqlite3/accounts'
import bcrypt from 'bcryptjs'
import { and, desc, eq, like, or, sql } from 'drizzle-orm'
import { app, ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { sessionManager } from '../../main/session-manager'
import type {
  CreateEmployeeByAdminPayload,
  CreateEmployeePayload,
  FileMetadata,
  GetEmployeesPayload,
  UpdateEmployeePayload
} from './type'

import fs from 'fs'
import path from 'path'

const db = () => getDB() // shortcut

// LOGIN
ipcMain.handle(
  'employees:login',
  async (_event, payload: { username: string; password: string; role: string }) => {
    try {
      if (!payload.username?.trim() || !payload.password || !payload.role) {
        return { success: false, message: 'Username, password and role are required.' }
      }

      const employee = db()
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.username, payload.username.trim()),
            eq(employees.role, payload.role),
            eq(employees.is_deleted, false),
            eq(employees.is_active, true)
          )
        )
        .get()

      if (!employee) {
        return { success: false, message: 'Invalid login credentials.' }
      }

      const isPasswordValid = bcrypt.compareSync(payload.password, employee.password_hash)
      if (!isPasswordValid) {
        return { success: false, message: 'Invalid password.' }
      }

      const sessionToken = uuidv4()
      const loginTime = new Date()

      sessionManager.login({
        employeeId: employee.id,
        username: employee.username,
        role: employee.role ?? 'viewer',
        loginTime,
        sessionToken
      })

      logEmployeeActivity({
        activity: 'logged in',
        employee_id: employee.id,
        linked_activity_id: employee.id,
        linked_activity_table: 'employees'
      })

      return {
        success: true,
        message: 'Login successful.',
        data: {
          employee: { id: employee.id, username: employee.username, role: employee.role },
          sessionToken
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, message: 'An unexpected error occurred during login.' }
    }
  }
)

// LOGOUT
ipcMain.handle('employees:logout', async () => {
  try {
    sessionManager.logout()
    return { success: true, message: 'Logout successful.' }
  } catch (error) {
    console.error('Logout error:', error)
    return { success: false, message: 'An unexpected error occurred during logout.' }
  }
})

// GET CURRENT SESSION
ipcMain.handle('employees:get-current-session', async () => {
  try {
    const session = sessionManager.getCurrentSession()
    if (!session) {
      return { success: false, message: 'No active session.' }
    }

    return {
      success: true,
      data: {
        employee: {
          id: session.employeeId,
          username: session.username,
          role: session.role
        },
        loginTime: session.loginTime
      }
    }
  } catch (error) {
    console.error('Get session error:', error)
    return { success: false, message: 'Failed to get session information.' }
  }
})

// CHECK AUTH
ipcMain.handle('employees:check-auth', async () => {
  const isAuthenticated = sessionManager.isLoggedIn()
  return {
    success: true,
    data: { isAuthenticated },
    message: isAuthenticated ? 'User is authenticated' : 'No active session'
  }
})


ipcMain.handle(
  'employees:create-by-admin',
  async (_event, payload: CreateEmployeeByAdminPayload) => {
    try {
      /* ---------------- BASIC AUTH VALIDATION ---------------- */
      if (!payload.username?.trim() || !payload.password?.trim()) {
        return { success: false, message: 'Username and password are required.' }
      }

      /* ---------------- EMAIL / PHONE RULE ---------------- */
      const hasEmail = !!payload.email?.trim()
      const hasPhone = !!payload.phone?.trim()

      if (!hasEmail && !hasPhone) {
        return {
          success: false,
          message: 'Either email or phone is required.'
        }
      }

      /* ---------------- REQUIRED EMPLOYEE FIELDS ---------------- */
      const requiredFields: Array<keyof CreateEmployeeByAdminPayload> = [
        'role',
        'first_name',
        'last_name',
        'address',
        'date_of_birth',
        'date_of_joining',
        'salary'
      ]

      for (const field of requiredFields) {
        const value = payload[field]
        if (!value || value.toString().trim() === '') {
          return {
            success: false,
            message: `${field.replace('_', ' ')} is required.`
          }
        }
      }

      /* ---------------- PROFILE PICTURE IS COMPULSORY ---------------- */
      if (!payload.with_profile_pic || !payload.profile_pic_data) {
        return {
          success: false,
          message: 'Profile picture is required.'
        }
      }

      /* ---------------- USERNAME UNIQUENESS ---------------- */
      const existingUser = db()
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.username, payload.username.trim()),
            eq(employees.is_deleted, false)
          )
        )
        .get()

      if (existingUser) {
        return { success: false, message: 'Username already exists.' }
      }

      /* ---------------- PASSWORD HASHING ---------------- */
      const password_hash = bcrypt.hashSync(payload.password, 10)

      /* ---------------- INSERT EMPLOYEE ---------------- */
      const result = db()
        .insert(employees)
        .values({
          username: payload.username.trim(),
          password_hash,
          role: payload.role,
          first_name: payload.first_name.trim(),
          last_name: payload.last_name.trim(),
          email: hasEmail ? payload.email!.trim() : null,
          phone: hasPhone ? payload.phone!.trim() : null,
          address: payload.address!.trim(),
          date_of_birth: payload.date_of_birth,
          date_of_joining: payload.date_of_joining,
          emergency_contact: payload.emergency_contact ?? null,
          department_id: payload.department_id ?? null, // OPTIONAL ✔
          salary: payload.salary
        })
        .run()

      const employeeId = Number(result.lastInsertRowid)

      /* ---------------- PROFILE PICTURE HANDLING ---------------- */
      const [meta, base64] = payload.profile_pic_data.split(',')
      const mime = meta.match(/data:(.*);base64/)?.[1]

      if (!mime) {
        throw new Error('Invalid image data')
      }

      const buffer = Buffer.from(base64, 'base64')
      const ext = mime.split('/')[1]

      const avatarsDir = path.join(app.getPath('userData'), 'avatars')
      fs.mkdirSync(avatarsDir, { recursive: true })

      const fileName = `employee_${employeeId}.${ext}`
      const filePath = path.join(avatarsDir, fileName)

      fs.writeFileSync(filePath, buffer)

      db().insert(employee_media).values({
        employee_id: employeeId,
        profile_picture: JSON.stringify({
          path: filePath,
          mime_type: mime
        })
      }).run()

      /* ---------------- SUCCESS RESPONSE ---------------- */
      return {
        success: true,
        message: 'Employee created successfully.',
        data: { id: employeeId }
      }
    } catch (error) {
      console.error(error)
      return {
        success: false,
        message: 'Failed to create employee.'
      }
    }
  }
)


// CREATE EMPLOYEE FROM ONBOARDING PROCESS
ipcMain.handle('employees:create', async (_event, payload: CreateEmployeePayload) => {
  try {
    if (!payload.username?.trim() || !payload.password) {
      return { success: false, message: 'Username and password are required.' }
    }

    const existing = db()
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.username, payload.username.trim()), eq(employees.is_deleted, false)))
      .get()

    if (existing) {
      return { success: false, message: 'Username already exists.' }
    }

    const password_hash = bcrypt.hashSync(payload.password, 10)

    // Insert employee
    const result = db()
      .insert(employees)
      .values({
        username: payload.username.trim(),
        password_hash,
        role: payload.role || 'viewer'
      })
      .run()

    const employeeId = Number(result.lastInsertRowid)

    // Handle profile picture
    if (payload.with_profile_pic) {
      if (
        !payload.profile_pic_data ||
        !payload.profile_pic_filename ||
        !payload.profile_pic_mime_type
      ) {
        return {
          success: false,
          message: 'Profile picture data, filename and MIME type are required.'
        }
      }

      const file_buffer = Buffer.from(payload.profile_pic_data, 'base64')
      const ext = payload.profile_pic_mime_type.split('/')[1]
      const metadata: FileMetadata = {
        path: `/media/employees/${employeeId}/profile-${Date.now()}.${ext}`,
        filename: `profile-${Date.now()}.${ext}`,
        original_filename: payload.profile_pic_filename,
        mime_type: payload.profile_pic_mime_type,
        file_size: file_buffer.length,
        uploaded_at: new Date().toISOString()
      }

      db()
        .insert(employee_media)
        .values({
          employee_id: employeeId,
          profile_picture: JSON.stringify(metadata)
        })
        .run()

      // TODO: Save file to disk
      console.log('File would be saved to:', metadata.path)
    }

    return {
      success: true,
      message: 'Employee created successfully.',
      data: { id: employeeId }
    }
  } catch (error: any) {
    console.error('Error creating employee:', error)
    return { success: false, message: 'Failed to create employee.' }
  }
})

ipcMain.handle('departments:get', async (
  _event,
  payload: { include_deleted?: boolean } = { include_deleted: false }
) => {
  try {
    const whereClause = payload.include_deleted
      ? sql`1` // no filter
      : eq(departments.is_deleted, false)

    const list = db()
      .select()
      .from(departments)
      .where(whereClause)
      .orderBy(desc(departments.created_on))
      .all()

    return {
      success: true,
      data: { departments: list }
    }
  } catch (error) {
    console.error('Error fetching departments:', error)
    return { success: false, message: 'Failed to fetch departments.' }
  }
})

// GET EMPLOYEES (paginated)
ipcMain.handle(
  'employees:get',
  async (
    _event,
    payload: GetEmployeesPayload = {}
  ) => {
    try {
      /* ============================
         PAGINATION CONFIG
      ============================ */
      const limit = payload.limit ?? 50
      const page = payload.page ?? 1

      // overlap logic:
      // page 1 → offset 0
      // page 2 → offset 49
      // page 3 → offset 99
      const offset = page === 1 ? 0 : (page - 1) * (limit - 1)

      /* ============================
         SEARCH CONDITION
      ============================ */
      const searchCondition = payload.search
        ? or(
            like(employees.username, `%${payload.search}%`),
            like(employees.first_name, `%${payload.search}%`),
            like(employees.last_name, `%${payload.search}%`),
            like(employees.email, `%${payload.search}%`),
            like(employees.phone, `%${payload.search}%`)
          )
        : undefined

      /* ============================
         WHERE CLAUSE
      ============================ */
      const whereClause = and(
        //eq(employees.is_deleted, false),
        searchCondition ?? sql`1`
      )

      /* ============================
         TOTAL COUNT (FOR PAGINATION)
      ============================ */
      const totalResult = db()
        .select({ total: sql<number>`count(*)` })
        .from(employees)
        .where(whereClause)
        .get()

      const total = totalResult?.total ?? 0
      const totalPages = Math.ceil(total / (limit - 1))

      /* ============================
         FETCH EMPLOYEES
      ============================ */
      const list = db()
        .select({
          id: employees.id,
          username: employees.username,
          role: employees.role,
          first_name: employees.first_name,
          last_name: employees.last_name,
          email: employees.email,
          phone: employees.phone,
          created_on: employees.created_on,
          updated_on: employees.updated_on,
          is_deleted: employees.is_deleted,
          last_sync: employees.last_sync,
          is_sync_required: employees.is_sync_required
        })
        .from(employees)
        .where(whereClause)
        .orderBy(desc(employees.created_on))
        .limit(limit)
        .offset(offset)
        .all()

      /* ============================
         ATTACH MEDIA
      ============================ */
      const employeesWithMedia = list.map((emp) => {
        const media = db()
          .select({
            profile_picture: employee_media.profile_picture,
            id_card: employee_media.id_card,
            employee_badge: employee_media.employee_badge
          })
          .from(employee_media)
          .where(
            and(
              eq(employee_media.employee_id, emp.id),
              eq(employee_media.is_deleted, false)
            )
          )
          .get()

        return {
          ...emp,
          profile_picture: media?.profile_picture
            ? JSON.parse(media.profile_picture)
            : null,
          id_card: media?.id_card ? JSON.parse(media.id_card) : null,
          employee_badge: media?.employee_badge
            ? JSON.parse(media.employee_badge)
            : null
        }
      })

      /* ============================
         RESPONSE
      ============================ */
      return {
        success: true,
        data: {
          employees: employeesWithMedia,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
            isSearch: Boolean(payload.search)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
      return { success: false, message: 'Failed to fetch employees.' }
    }
  }
)


// GET BY ID
ipcMain.handle(
  'employees:get-by-id',
  async (_event, payload: { id: number; with_profile_pic?: boolean }) => {
    try {
      // 1️⃣ Get current session
      const session = sessionManager.getCurrentSession()

      if (!session) {
        return { success: false, message: 'Not authenticated.' }
      }

      const isSelf = session.employeeId === payload.id
      const isAdmin = session.role === 'admin' || session.role === 'super_admin'

      // 2️⃣ Authorization check
      if (!isSelf && !isAdmin) {
        return { success: false, message: 'Unauthorized access.' }
      }

      // 3️⃣ Fetch employee
      const employee = db()
        .select({
          id: employees.id,
          first_name: employees.first_name,
          last_name: employees.last_name,
          email: employees.email,
          phone: employees.phone,
          role: employees.role,
          created_at: employees.created_on
          // intentionally exclude password, tokens, etc.
        })
        .from(employees)
        .where(and(eq(employees.id, payload.id), eq(employees.is_deleted, false)))
        .get()

      if (!employee) {
        return { success: false, message: 'Employee not found.' }
      }

      // 4️⃣ Optional profile picture
      if (payload.with_profile_pic) {
        const media = db()
          .select({
            profile_picture: employee_media.profile_picture
          })
          .from(employee_media)
          .where(
            and(
              eq(employee_media.employee_id, payload.id),
              eq(employee_media.is_deleted, false)
            )
          )
          .get()

        return {
          success: true,
          data: {
            ...employee,
            profile_picture: media?.profile_picture
              ? JSON.parse(media.profile_picture)
              : null
          }
        }
      }

      return { success: true, data: employee }
    } catch (error) {
      console.error('Error fetching employee:', error)
      return { success: false, message: 'Failed to fetch employee.' }
    }
  }
)

ipcMain.handle(
  'employees:get-profile',
  async (_event, payload?: { with_profile_pic?: boolean }) => {
    try {
      // 1️⃣ Get active session
      const session = sessionManager.getCurrentSession()

      if (!session) {
        return { success: false, message: 'Not authenticated.' }
      }

      // 2️⃣ Fetch employee using session ID
      const employee = db()
        .select({
          id: employees.id,
          first_name: employees.first_name,
          last_name: employees.last_name,
          email: employees.email,
          phone: employees.phone,
          role: employees.role,
          created_at: employees.created_on
        })
        .from(employees)
        .where(
          and(
            eq(employees.id, session.employeeId),
            eq(employees.is_deleted, false)
          )
        )
        .get()

      if (!employee) {
        return { success: false, message: 'Employee not found.' }
      }

      // 3️⃣ Optional profile picture
      if (payload?.with_profile_pic) {
        const media = db()
          .select({
            profile_picture: employee_media.profile_picture
          })
          .from(employee_media)
          .where(
            and(
              eq(employee_media.employee_id, session.employeeId),
              eq(employee_media.is_deleted, false)
            )
          )
          .get()

        return {
          success: true,
          data: {
            ...employee,
            profile_picture: media?.profile_picture
              ? JSON.parse(media.profile_picture)
              : null
          }
        }
      }

      return { success: true, data: employee }
    } catch (error) {
      console.error('Error fetching profile:', error)
      return { success: false, message: 'Failed to fetch profile.' }
    }
  }
)


// UPDATE EMPLOYEE (simplified — you can expand as needed)
ipcMain.handle('employees:update', async (_event, payload: UpdateEmployeePayload) => {
  try {
    // 1. Fetch existing employee
    const existing = db()
      .select()
      .from(employees)
      .where(and(eq(employees.id, payload.id), eq(employees.is_deleted, false)))
      .get()

    if (!existing) {
      return { success: false, message: 'Employee not found.' }
    }

    // 2. Prepare updates
    const updates: Partial<typeof employees.$inferInsert> = {}

    /* ============================
       USERNAME (unique)
    ============================ */
    if (payload.username !== undefined && payload.username !== existing.username) {
      const dup = db()
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.username, payload.username), eq(employees.is_deleted, false)))
        .get()

      if (dup && dup.id !== payload.id) {
        return { success: false, message: 'Username already exists.' }
      }

      updates.username = payload.username?.trim()
    }

    /* ============================
       PROFILE FIELDS
    ============================ */
    if (payload.first_name !== undefined) {
      updates.first_name = payload.first_name
    }

    if (payload.last_name !== undefined) {
      updates.last_name = payload.last_name
    }

    if (payload.email !== undefined) {
      updates.email = payload.email
    }

    if (payload.phone !== undefined) {
      updates.phone = payload.phone
    }

    /* ============================
       PASSWORD
    ============================ */
    if (payload.password) {
      updates.password_hash = bcrypt.hashSync(payload.password, 10)
    }

    /* ============================
       META
    ============================ */
    if (payload.role !== undefined) {
      updates.role = payload.role
    }

    if (payload.is_active !== undefined) {
      updates.is_active = Boolean(payload.is_active)
    }

    /* ============================
       APPLY UPDATE
    ============================ */
    if (Object.keys(updates).length === 0) {
      return { success: true, message: 'Nothing to update.' }
    }

    db()
      .update(employees)
      .set({
        ...updates,
        updated_on: sql`(strftime('%s', 'now'))`
      })
      .where(eq(employees.id, payload.id))
      .run()

    /* ============================
       PROFILE PICTURE
    ============================ */

    if (payload.with_profile_pic && payload.profile_pic_data) {
      const [meta, base64] = payload.profile_pic_data.split(',')

      const mime = meta.match(/data:(.*);base64/)?.[1]
      if (!mime) {
        throw new Error('Invalid image data')
      }

      const buffer = Buffer.from(base64, 'base64')
      const ext = mime.split('/')[1]

      const avatarsDir = path.join(app.getPath('userData'), 'avatars')
      fs.mkdirSync(avatarsDir, { recursive: true })

      const fileName = `employee_${payload.id}.${ext}`
      const filePath = path.join(avatarsDir, fileName)

      fs.writeFileSync(filePath, buffer)

      const picturePayload = {
        employee_id: payload.id,
        profile_picture: JSON.stringify({
          path: filePath,
          mime_type: mime
        }),
        updated_on: new Date().toISOString()
      }

      const existingMedia = db()
        .select()
        .from(employee_media)
        .where(
          and(
            eq(employee_media.employee_id, payload.id),
            eq(employee_media.is_deleted, false)
          )
        )
        .get()

      if (existingMedia) {
        db()
          .update(employee_media)
          .set(picturePayload as any)
          .where(eq(employee_media.id, existingMedia.id))
          .run()
      } else {
        db().insert(employee_media).values(picturePayload as any).run()
      }
    }

    return { success: true, message: 'Employee updated successfully.' }
  } catch (error) {
    console.error('Error updating employee:', error)
    return { success: false, message: 'Failed to update employee.' }
  }
})

// DELETE (soft)
ipcMain.handle(
  'employees:delete',
  async (_event, payload: { id: number; restore?: boolean }) => {
    const restore = payload.restore ?? false

    try {
      return db().transaction((tx) => {
        const employee = tx
          .select()
          .from(employees)
          .where(
            and(
              eq(employees.id, payload.id),
              eq(employees.is_deleted, restore)
            )
          )
          .get()

        if (!employee) {
          return {
            success: false,
            message: restore
              ? 'Employee not found or not deleted.'
              : 'Employee not found.',
          }
        }

        tx.update(employees)
          .set({ is_deleted: !restore })
          .where(eq(employees.id, payload.id))
          .run()

        tx.update(employee_media)
          .set({ is_deleted: !restore })
          .where(eq(employee_media.employee_id, payload.id))
          .run()

        return {
          success: true,
          message: restore
            ? 'Employee restored successfully.'
            : 'Employee deleted successfully.',
        }
      })
    } catch (error) {
      console.error('Error updating employee deletion state:', error)
      return {
        success: false,
        message: restore
          ? 'Failed to restore employee.'
          : 'Failed to delete employee.',
      }
    }
  }
)

