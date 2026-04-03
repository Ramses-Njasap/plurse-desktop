import { app } from 'electron'
import path from 'path'

export const getDbPath = () =>
  path.join(app.getPath('userData'), 'plurse-desktop.db.sqlite-v1')

export const getAuthFilePath = () =>
  path.join(app.getPath('userData'), 'auth.json')
