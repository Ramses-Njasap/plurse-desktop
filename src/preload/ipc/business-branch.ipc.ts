// src/main/ipc/business-branch.ts

import { getDB, logEmployeeActivity } from '@db/sqlite3'
import { business, business_branch } from '@schema/sqlite3/accounts'
import { getGeoCoordinates } from '@utils/geolocation'
import { and, eq } from 'drizzle-orm'
import { ipcMain } from 'electron'

const db = () => getDB()

// ========================
// UPSERT BUSINESS BRANCH
// ========================

ipcMain.handle(
  'business-branch:upsert',
  async (
    _event,
    {
      business_name,
      branch_location_name,
      branch_location_coordinate,
      branch_email_address,
      branch_phone_number,
      default_language = 'en',
      default_currency = 'USD',
      verification_code,
      attempt_geolocation = true
    }: {
      business_name: string
      branch_location_name: string
      branch_location_coordinate?: { lat: number; long: number } | null
      branch_email_address?: string
      branch_phone_number?: string
      default_language?: string
      default_currency?: string
      verification_code?: string
      attempt_geolocation?: boolean
    }
  ) => {
    try {
      // Validation
      if (!branch_email_address && !branch_phone_number) {
        return { success: false, message: 'Either email or phone number must be provided.' }
      }
      if (!branch_location_name?.trim()) {
        return { success: false, message: 'Branch location name is required.' }
      }

      const finalVerificationCode =
        verification_code || Math.floor(100000 + Math.random() * 900000).toString()

      // Smart geolocation
      let coordinates = branch_location_coordinate
      if ((!coordinates || coordinates.lat === 0) && attempt_geolocation) {
        const autoCoordinates = await getGeoCoordinates()
        if (autoCoordinates) {
          coordinates = autoCoordinates
        } else {
          console.log('Auto-geolocation failed')
        }
      }

      const coordinatesToStore =
        coordinates && coordinates.lat !== 0 && coordinates.long !== 0
          ? JSON.stringify(coordinates)
          : null

      // Check if records exist
      const [existingBranch, existingBusiness] = await Promise.all([
        db().select().from(business_branch).where(eq(business_branch.id, 1)).get(),
        db().select().from(business).where(eq(business.id, 1)).get()
      ])

      const isUpdate = !!existingBranch && !!existingBusiness
      const activity = isUpdate ? 'updated business branch' : 'created business branch'

      if (isUpdate) {
        // UPDATE MODE
        db()
          .update(business)
          .set({
            business_name: business_name.trim()
          })
          .where(eq(business.id, 1))
          .run()

        db()
          .update(business_branch)
          .set({
            branch_location_name: branch_location_name.trim(),
            branch_location_coordinate: coordinatesToStore,
            branch_email_address: branch_email_address || '',
            branch_phone_number: branch_phone_number || '',
            default_language,
            default_currency,
            verification_code: finalVerificationCode,
            is_sync_required: true
          })
          .where(eq(business_branch.id, 1))
          .run()

        const message = existingBranch.is_verified
          ? 'Business branch updated successfully.'
          : 'Business branch updated. Please verify your contact info.'

        await logEmployeeActivity({
          activity,
          linked_activity_table: 'business_branch',
          linked_activity_id: 1,
          employee_id: 0,
          new_data: JSON.stringify({
            business_name,
            branch_location_name,
            has_coordinates: !!coordinatesToStore
          })
        })

        return { success: true, message, branchId: 1 }
      } else {
        // INSERT MODE
        db()
          .insert(business)
          .values({
            id: 1,
            business_name: business_name.trim()
          })
          .run()

        db()
          .insert(business_branch)
          .values({
            branch_location_name: branch_location_name.trim() || '',
            branch_location_coordinate: coordinatesToStore,
            branch_email_address: branch_email_address || '',
            branch_phone_number: branch_phone_number || '',
            default_language,
            default_currency,
            verification_code: finalVerificationCode,
            is_approved: false,
            is_verified: true, // auto-verified on first creation
            is_active: true,
            is_deleted: false,
            is_sync_required: true
          })
          .run()

        const message = coordinatesToStore
          ? 'Business branch created successfully with location.'
          : 'Business branch created successfully. Location can be added later.'

        await logEmployeeActivity({
          activity,
          linked_activity_table: 'business_branch',
          linked_activity_id: 1,
          employee_id: 0,
          new_data: JSON.stringify({
            business_name,
            branch_location_name,
            has_coordinates: !!coordinatesToStore
          })
        })

        return {
          success: true,
          message: message + ' Please verify your contact info.',
          branchId: 1
        }
      }
    } catch (error: any) {
      console.error(`Error here is: ${error}`)
      // Friendly constraint error handling
      if (error.message?.includes('CHECK constraint failed')) {
        if (error.message.includes('branch_email_address')) {
          return { success: false, message: 'Invalid email address format.' }
        }
        if (error.message.includes('branch_phone_number')) {
          return { success: false, message: 'Invalid phone number format.' }
        }
        if (
          error.message.includes('default_language') ||
          error.message.includes('default_currency')
        ) {
          return { success: false, message: 'Invalid language or currency code.' }
        }
      }

      return { success: false, message: 'Failed to save business branch.' }
    }
  }
)

// ========================
// VERIFY CONTACT
// ========================

ipcMain.handle(
  'business-branch:verify',
  async (_event, { verification_code }: { verification_code: string }) => {
    try {
      if (!/^\d{6}$/.test(verification_code)) {
        return { success: false, message: 'Verification code must be 6 digits.' }
      }

      const result = db()
        .update(business_branch)
        .set({
          is_verified: true,
          is_active: true,
          is_sync_required: true
        })
        .where(
          and(
            eq(business_branch.id, 1),
            eq(business_branch.verification_code, verification_code),
            eq(business_branch.is_deleted, false)
          )
        )
        .run()

      if (result.changes === 0) {
        return { success: false, message: 'Invalid or expired verification code.' }
      }

      await logEmployeeActivity({
        activity: 'verified business branch contact',
        linked_activity_table: 'business_branch',
        linked_activity_id: 1,
        employee_id: 0,
        old_data: JSON.stringify({ is_verified: false }),
        new_data: JSON.stringify({ is_verified: true })
      })

      return { success: true, message: 'Contact verified successfully!' }
    } catch (error) {
      console.error('Verify error:', error)
      return { success: false, message: 'Verification failed.' }
    }
  }
)

// ========================
// GET BUSINESS BRANCH
// ========================

ipcMain.handle('business-branch:get', async () => {
  try {
    const [biz, branch] = await Promise.all([
      db().select().from(business).where(eq(business.id, 1)).get(),
      db().select().from(business_branch).where(eq(business_branch.id, 1)).get()
    ])

    if (!biz || !branch) {
      return { success: false, message: 'Business or branch not found.' }
    }

    return {
      success: true,
      data: {
        ...branch,
        business_name: biz.business_name
      }
    }
  } catch (error) {
    console.error('Get business branch error:', error)
    return { success: false, message: 'Failed to fetch business branch.' }
  }
})

// ========================
// UPDATE LOCATION ONLY
// ========================

ipcMain.handle('business-branch:update-location', async () => {
  try {
    const coordinates = await getGeoCoordinates()
    if (!coordinates) {
      return { success: false, message: 'Could not detect location.' }
    }

    db()
      .update(business_branch)
      .set({
        branch_location_coordinate: JSON.stringify(coordinates),
        is_sync_required: true
      })
      .where(eq(business_branch.id, 1))
      .run()

    return {
      success: true,
      message: 'Location updated successfully.',
      coordinates
    }
  } catch (error) {
    console.error('Update location error:', error)
    return { success: false, message: 'Failed to update location.' }
  }
})
