import { getDB } from '@db/sqlite3'
import { setup } from '@schema/sqlite3/setup'
import { eq } from 'drizzle-orm'
import { ipcMain } from 'electron'

// type SetupData = {
//   id: number
//   progress: number
//   skipped_stages: string | null
//   is_completed: number
// }

type UpdateSetupPayload = {
  action: 'next' | 'previous' | 'skip' | 'complete' | 'unskip'
  stage?: number // Only required for skip/unskip
}

ipcMain.handle('setup:get', async () => {
  try {
    const db = getDB()

    // Use Drizzle to query
    let setupRow = db.select().from(setup).where(eq(setup.id, 1)).get()

    if (!setupRow) {
      // Initialize the setup row
      db.insert(setup)
        .values({
          id: 1,
          progress: 0,
          skipped_stages: '[]',
          is_completed: 0
        })
        .run()

      setupRow = {
        id: 1,
        progress: 0,
        skipped_stages: '[]',
        is_completed: 0
      }
    }

    return {
      success: true,
      data: {
        ...setupRow,
        skipped_stages: setupRow.skipped_stages ? JSON.parse(setupRow.skipped_stages) : []
      }
    }
  } catch (error) {
    console.error('Error fetching setup:', error)
    return { success: false, message: 'Failed to fetch setup data.' }
  }
})

ipcMain.handle('setup:update', async (_event, payload: UpdateSetupPayload) => {
  try {
    const db = getDB()

    // Fetch current setup row
    const current = db.select().from(setup).where(eq(setup.id, 1)).get()

    if (!current) {
      return { success: false, message: 'Setup not found.' }
    }

    let progress = current.progress ?? 0
    let skipped: number[] = current.skipped_stages ? JSON.parse(current.skipped_stages) : []
    let is_completed = current.is_completed ?? 0
    const initialProgress = progress

    switch (payload.action) {
      case 'next':
        if (payload.stage !== undefined && skipped.includes(payload.stage)) {
          skipped = skipped.filter((s) => s !== payload.stage)
        }
        if (progress < 4) progress += 1
        break

      case 'previous':
        if (progress > 0) progress -= 1
        break

      case 'skip':
        if (payload.stage !== undefined && !skipped.includes(payload.stage)) {
          skipped.push(payload.stage)
        }
        if (payload.stage === progress) {
          progress = Math.min(progress + 1, 4)
        }
        break

      case 'unskip':
        if (payload.stage !== undefined) {
          skipped = skipped.filter((s) => s !== payload.stage)
        }
        break

      case 'complete':
        progress = 4
        is_completed = 1
        break
    }

    // Auto-complete if progress reaches 4
    if (progress === 4) {
      is_completed = 1
    } else if (initialProgress !== 4) {
      is_completed = 0
    }

    // Update the row
    db.update(setup)
      .set({
        progress,
        skipped_stages: JSON.stringify(skipped),
        is_completed
      })
      .where(eq(setup.id, 1))
      .run()

    return {
      success: true,
      data: {
        id: 1,
        progress,
        skipped_stages: skipped,
        is_completed
      }
    }
  } catch (error) {
    console.error('Error updating setup:', error)
    return { success: false, message: 'Failed to update setup data.' }
  }
})
