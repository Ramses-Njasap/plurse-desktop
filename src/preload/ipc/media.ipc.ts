// import { getDB } from '@db/sqlite3'
// import { deleteMediaFile, FileMetadata, readMediaFile, saveMedia } from '@utils/file-storage'
// import { ipcMain } from 'electron'

// // Upload media
// ipcMain.handle(
//   'media:upload',
//   async (
//     _event,
//     {
//       table_name,
//       id,
//       table_field,
//       file_data,
//       original_filename,
//       mime_type
//     }: {
//       table_name: 'employees' | 'business' | 'branches'
//       id: number
//       table_field: 'profile_picture' | 'id_card' | 'employee_badge' | 'contract' | 'signature'
//       file_data: string // Base64 encoded
//       original_filename: string
//       mime_type: string
//     }
//   ) => {
//     try {
//       const db = getDB()

//       // Convert base64 to buffer
//       const file_buffer = Buffer.from(file_data, 'base64')

//       // Save file to disk and get metadata
//       const metadata = await saveMedia({
//         table_name,
//         id,
//         table_field,
//         file_buffer,
//         original_filename,
//         mime_type
//       })

//       // Check if employee media record exists
//       const existingMedia = await new Promise<any | undefined>((resolve, reject) => {
//         db.get('SELECT * FROM employee_media WHERE employee_id = ?', [id], (err, row) =>
//           err ? reject(err) : resolve(row)
//         )
//       })

//       if (existingMedia) {
//         // Delete old file if exists
//         const oldMetadataJson = existingMedia[table_field]
//         if (oldMetadataJson) {
//           const oldMetadata: FileMetadata = JSON.parse(oldMetadataJson)
//           await deleteMediaFile(table_name, id, oldMetadata.filename)
//         }

//         // Update existing record
//         await new Promise<void>((resolve, reject) => {
//           db.run(
//             `UPDATE employee_media SET 
//             ${table_field} = ?,
//             updated_at = CURRENT_TIMESTAMP,
//             is_sync_required = 1
//            WHERE employee_id = ?`,
//             [JSON.stringify(metadata), id],
//             function (err) {
//               if (err) reject(err)
//               else resolve()
//             }
//           )
//         })
//       } else {
//         // Insert new record
//         const mediaData: any = { employee_id: id }
//         mediaData[table_field] = JSON.stringify(metadata)

//         const columns = Object.keys(mediaData).join(', ')
//         const placeholders = Object.keys(mediaData)
//           .map(() => '?')
//           .join(', ')

//         await new Promise<void>((resolve, reject) => {
//           db.run(
//             `INSERT INTO employee_media (${columns}) VALUES (${placeholders})`,
//             Object.values(mediaData),
//             function (err) {
//               if (err) reject(err)
//               else resolve()
//             }
//           )
//         })
//       }

//       return {
//         success: true,
//         message: 'Media uploaded successfully',
//         metadata
//       }
//     } catch (error) {
//       console.error('Upload media error:', error)
//       return { success: false, message: 'Failed to upload media' }
//     }
//   }
// )

// // Get media
// ipcMain.handle(
//   'media:get',
//   async (
//     _event,
//     {
//       table_name,
//       id,
//       table_field
//     }: {
//       table_name: 'employees' | 'business' | 'branches'
//       id: number
//       table_field: 'profile_picture' | 'id_card' | 'employee_badge' | 'contract' | 'signature'
//     }
//   ) => {
//     try {
//       const db = getDB()

//       const media = await new Promise<any | undefined>((resolve, reject) => {
//         db.get('SELECT * FROM employee_media WHERE employee_id = ?', [id], (err, row) =>
//           err ? reject(err) : resolve(row)
//         )
//       })

//       if (!media || !media[table_field]) {
//         return { success: false, message: 'No media found' }
//       }

//       const metadata: FileMetadata = JSON.parse(media[table_field])
//       const fileBuffer = await readMediaFile(table_name, id, metadata.filename)

//       if (!fileBuffer) {
//         return { success: false, message: 'Media file not found' }
//       }

//       const base64Data = fileBuffer.toString('base64')

//       return {
//         success: true,
//         data: {
//           file_data: `data:${metadata.mime_type};base64,${base64Data}`,
//           metadata
//         }
//       }
//     } catch (error) {
//       console.error('Get media error:', error)
//       return { success: false, message: 'Failed to load media' }
//     }
//   }
// )

// // Delete media
// ipcMain.handle(
//   'media:delete',
//   async (
//     _event,
//     {
//       table_name,
//       id,
//       table_field
//     }: {
//       table_name: 'employees' | 'business' | 'branches'
//       id: number
//       table_field: 'profile_picture' | 'id_card' | 'employee_badge' | 'contract' | 'signature'
//     }
//   ) => {
//     try {
//       const db = getDB()

//       const media = await new Promise<any | undefined>((resolve, reject) => {
//         db.get('SELECT * FROM employee_media WHERE employee_id = ?', [id], (err, row) =>
//           err ? reject(err) : resolve(row)
//         )
//       })

//       if (!media || !media[table_field]) {
//         return { success: false, message: 'No media found to delete' }
//       }

//       // Delete file from disk
//       const metadata: FileMetadata = JSON.parse(media[table_field])
//       await deleteMediaFile(table_name, id, metadata.filename)

//       // Clear field in database
//       await new Promise<void>((resolve, reject) => {
//         db.run(
//           `UPDATE employee_media SET 
//           ${table_field} = NULL,
//           updated_at = CURRENT_TIMESTAMP,
//           is_sync_required = 1
//          WHERE employee_id = ?`,
//           [id],
//           function (err) {
//             if (err) reject(err)
//             else resolve()
//           }
//         )
//       })

//       return {
//         success: true,
//         message: 'Media deleted successfully'
//       }
//     } catch (error) {
//       console.error('Delete media error:', error)
//       return { success: false, message: 'Failed to delete media' }
//     }
//   }
// )
