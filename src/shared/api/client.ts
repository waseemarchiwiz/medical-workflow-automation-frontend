import axios from 'axios'

import { appConfig } from '@/shared/config/app.config'

export const apiClient = axios.create({
  baseURL: appConfig.api.baseUrl,
  withCredentials: false,
})
