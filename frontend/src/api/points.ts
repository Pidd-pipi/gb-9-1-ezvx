import api from './axios'

export const pointsApi = {
  getBalance: () => api.get('/points/balance'),

  getRecords: () => api.get('/points/records'),

  checkin: () => api.post('/points/checkin'),

  getCheckinStatus: () => api.get('/points/checkin/status'),

  getMallItems: () => api.get('/points/mall'),

  redeem: (itemId: string) => api.post(`/points/mall/${itemId}/redeem`),

  getCoupons: () => api.get('/coupons'),
}
