// src/utils/fileStorage.ts
import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Types
export interface FileMetadata {
  path: string
  filename: string
  original_filename: string
  mime_type: string
  file_size: number
  uploaded_at: string
  dimensions?: { width: number; height: number }
}

export interface MediaOperationParams {
  table_name: 'employees' | 'business' | 'branches'
  id: number
  table_field: 'profile_picture' | 'id_card' | 'employee_badge' | 'contract' | 'signature'
}

export interface SaveMediaParams extends MediaOperationParams {
  file_buffer: Buffer
  original_filename: string
  mime_type: string
}

// Utility functions
const getMediaBasePath = (): string => {
  return path.join(app.getPath('userData'), 'media')
}

const getEntityMediaPath = (table_name: string, id: number): string => {
  return path.join(getMediaBasePath(), table_name, id.toString())
}

const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  try {
    await fs.access(dirPath)
  } catch {
    await fs.mkdir(dirPath, { recursive: true })
  }
}

const getDefaultExtension = (mime_type: string): string => {
  const extensions: { [key: string]: string } = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
  }
  return extensions[mime_type] || '.bin'
}

// Main media operations
export const saveMedia = async (params: SaveMediaParams): Promise<FileMetadata> => {
  const { table_name, id, table_field, file_buffer, original_filename, mime_type } = params

  const entityMediaPath = getEntityMediaPath(table_name, id)
  await ensureDirectoryExists(entityMediaPath)

  // Generate unique filename
  const fileExtension = path.extname(original_filename) || getDefaultExtension(mime_type)
  const uniqueFilename = `${table_field}-${uuidv4()}${fileExtension}`
  const filePath = path.join(entityMediaPath, uniqueFilename)

  // Save file
  await fs.writeFile(filePath, file_buffer)

  const metadata: FileMetadata = {
    path: filePath,
    filename: uniqueFilename,
    original_filename,
    mime_type,
    file_size: file_buffer.length,
    uploaded_at: new Date().toISOString()
  }

  return metadata
}

export const getMediaFilePath = async (
  table_name: string,
  id: number,
  filename: string
): Promise<string | null> => {
  const filePath = path.join(getEntityMediaPath(table_name, id), filename)
  try {
    await fs.access(filePath)
    return filePath
  } catch {
    return null
  }
}

export const deleteMediaFile = async (
  table_name: string,
  id: number,
  filename: string
): Promise<void> => {
  const filePath = path.join(getEntityMediaPath(table_name, id), filename)
  try {
    await fs.unlink(filePath)
  } catch (error) {
    console.warn('Failed to delete media file:', error)
  }
}

export const readMediaFile = async (
  table_name: string,
  id: number,
  filename: string
): Promise<Buffer | null> => {
  const filePath = await getMediaFilePath(table_name, id, filename)
  if (!filePath) return null

  try {
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}
