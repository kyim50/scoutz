import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/api';

const API_URL = API_BASE_URL;

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

if (__DEV__) {
  console.log(`[API] baseURL=${API_URL}`);
}

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with automatic token refresh
let isRefreshing = false;
let failedQueue: { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url || '');
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/signup') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/magic-link') ||
      requestUrl.includes('/auth/verify-magic-link') ||
      requestUrl.includes('/auth/pending-signup');
    const hadAuthHeader =
      Boolean(originalRequest?.headers?.Authorization) || Boolean(api.defaults.headers.common.Authorization);

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint && hadAuthHeader) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) {
          processQueue(error, null);
          return Promise.reject(error);
        }

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });

        if (data.success && data.data?.token) {
          await SecureStore.setItemAsync('authToken', data.data.token);
          if (data.data.refreshToken) {
            await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);
          }
          api.defaults.headers.common.Authorization = `Bearer ${data.data.token}`;
          processQueue(null, data.data.token);
          originalRequest.headers.Authorization = `Bearer ${data.data.token}`;
          return api(originalRequest);
        }
        throw new Error('Refresh failed');
      } catch (refreshError) {
        processQueue(refreshError, null);
        await SecureStore.deleteItemAsync('authToken');
        await SecureStore.deleteItemAsync('refreshToken');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (!error?.response) {
      const baseURL = String(originalRequest?.baseURL || api.defaults.baseURL || API_URL);
      const requestPath = String(originalRequest?.url || '');
      const fullUrl = requestPath.startsWith('http') ? requestPath : `${baseURL}${requestPath}`;
      console.error('[API] Network request failed', {
        message: error?.message,
        code: error?.code,
        method: originalRequest?.method,
        baseURL,
        requestPath,
        fullUrl,
      });
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  signup: async (data: { email: string; password: string; name: string; username?: string }) => {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },

  login: async (data: { identifier: string; password: string }) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  requestMagicLink: async (email: string) => {
    const response = await api.post('/auth/magic-link', { email });
    return response.data;
  },

  requestSignupMagicLink: async (data: { email: string; name: string; username?: string }) => {
    const response = await api.post('/auth/signup-magic-link', data);
    return response.data;
  },

  pendingSignup: async (data: { email: string; name: string; username?: string }) => {
    const response = await api.post('/auth/pending-signup', data);
    return response.data;
  },

  verifyMagicLink: async (token: string) => {
    const response = await api.post('/auth/verify-magic-link', { token });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout: async () => {
    await api.post('/auth/logout');
    await SecureStore.deleteItemAsync('authToken');
    await SecureStore.deleteItemAsync('refreshToken');
  },
};

// Area API (geofencing)
export const areaAPI = {
  getCurrent: async (lat: number, lng: number) => {
    const response = await api.get('/areas/current', { params: { lat, lng } });
    return response.data;
  },
};

// Report API
export const reportAPI = {
  create: async (data: {
    type: string;
    pinId?: string;
    lat: number;
    lng: number;
    content?: string;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
    isAnonymous?: boolean;
  }) => {
    const response = await api.post('/reports', data);
    return response.data;
  },
  getNearby: async (lat: number, lng: number, radius?: number, type?: string) => {
    const params: Record<string, unknown> = { lat, lng };
    if (radius) params.radius = radius;
    if (type) params.type = type;
    const response = await api.get('/reports/nearby', { params });
    return response.data;
  },
  getByPin: async (pinId: string) => {
    const response = await api.get(`/reports/pin/${pinId}`);
    return response.data;
  },
  getNearbyClustered: async (lat: number, lng: number, radius?: number, type?: string) => {
    const params: Record<string, unknown> = { lat, lng };
    if (radius) params.radius = radius;
    if (type) params.type = type;
    const response = await api.get('/reports/nearby/clustered', { params });
    return response.data;
  },
  getById: async (reportId: string) => {
    const response = await api.get(`/reports/${reportId}`);
    return response.data;
  },
  delete: async (reportId: string) => {
    const response = await api.delete(`/reports/${reportId}`);
    return response.data;
  },
};

// Report Chat API
export const reportChatAPI = {
  getUnreadCounts: async (reportIds: string[]): Promise<Record<string, number>> => {
    if (!reportIds.length) return {};
    const response = await api.get('/report-chats/unread', {
      params: { reportIds: reportIds.join(',') },
    });
    return response.data?.data?.counts ?? {};
  },
  markAsRead: async (reportId: string) => {
    const response = await api.post(`/report-chats/${reportId}/read`);
    return response.data;
  },
};

// Event Chat API (unread tracking)
export const eventChatAPI = {
  getUnreadCounts: async (eventIds: string[]): Promise<Record<string, number>> => {
    if (!eventIds.length) return {};
    const response = await api.get('/events/unread', {
      params: { eventIds: eventIds.join(',') },
    });
    return response.data?.data?.counts ?? response.data?.counts ?? {};
  },

  markAsRead: async (eventId: string) => {
    const response = await api.post(`/events/${eventId}/read`);
    return response.data;
  },
};

// Search API
export const searchAPI = {
  search: async (query: string, location: { lat: number; lng: number }, radius?: number) => {
    const response = await api.post('/search', { query, location, radius });
    return response.data;
  },
  
  searchPins: async (params: {
    lat: number;
    lng: number;
    radius?: number;
    type?: string;
    tags?: string[];
  }) => {
    const response = await api.get('/search/pins', { params });
    return response.data;
  },
};

// Recommendations API
export const recommendationAPI = {
  getRecommendations: async (params: {
    query: string;
    location: { lat: number; lng: number };
    radius?: number;
    mode?: 'open_world' | 'campus';
  }) => {
    const response = await api.post('/recommendations', params);
    return response.data;
  },
};

// Pin API
export const pinAPI = {
  create: async (data: any) => {
    const response = await api.post('/pins', data);
    return response.data;
  },
  
  getNearby: async (lat: number, lng: number, radius?: number) => {
    const response = await api.get('/pins/nearby', { params: { lat, lng, radius } });
    return response.data;
  },

  getForYou: async (lat: number, lng: number, radius?: number) => {
    const response = await api.get('/pins/for-you', { params: { lat, lng, radius } });
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/pins/${id}`);
    return response.data;
  },
  
  update: async (id: string, data: any) => {
    const response = await api.put(`/pins/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string) => {
    await api.delete(`/pins/${id}`);
  },
  
  verify: async (id: string, isAccurate: boolean, comment?: string) => {
    const response = await api.post(`/pins/${id}/verify`, { isAccurate, comment });
    return response.data;
  },
};

// Event API
export const eventAPI = {
  create: async (data: any) => {
    const response = await api.post('/events', data);
    return response.data;
  },
  
  getUpcoming: async (lat: number, lng: number, radius?: number, hoursAhead: number = 24 * 30) => {
    const response = await api.get('/events/upcoming', { params: { lat, lng, radius, hoursAhead } });
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },
  
  rsvp: async (id: string, status: 'interested' | 'going') => {
    const response = await api.post(`/events/${id}/rsvp`, { status });
    return response.data;
  },
  
  cancelRsvp: async (id: string) => {
    const response = await api.delete(`/events/${id}/rsvp`);
    return response.data;
  },

  cancelEvent: async (id: string) => {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  },
  
  generateShareToken: async (id: string) => {
    const response = await api.post(`/events/${id}/share`);
    return response.data;
  },
};

// Upload API
export const uploadAPI = {
  uploadImage: async (imageUri: string) => {
    const formData = new FormData();
    
    // Create blob from URI
    const filename = imageUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('image', {
      uri: imageUri,
      name: filename,
      type,
    } as any);

    try {
      const response = await api.post('/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const payload = response.data?.data ?? response.data;

      if (!payload?.mainUrl) {
        throw new Error('Image upload failed');
      }

      return payload as { mainUrl: string; thumbnailUrl: string };
    } catch (error: any) {
      const apiMessage = error?.response?.data?.error?.message;
      throw new Error(apiMessage || error?.message || 'Image upload failed');
    }
  },
};

// User API
export const userAPI = {
  getProfile: async (userId: string) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
  
  updateProfile: async (userId: string, data: any) => {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
  },
  
  getUserPins: async (userId: string) => {
    const response = await api.get(`/users/${userId}/pins`);
    return response.data;
  },
  
  getUserEvents: async (userId: string) => {
    const response = await api.get(`/users/${userId}/events`);
    return response.data;
  },
  
  getUserRSVPs: async (userId: string) => {
    const response = await api.get(`/users/${userId}/rsvps`);
    return response.data;
  },

  getUserReports: async (userId: string) => {
    const response = await api.get(`/users/${userId}/reports`);
    return response.data;
  },

  getUserActivity: async (userId: string, days: number = 91) => {
    const response = await api.get(`/users/${userId}/activity`, { params: { days } });
    return response.data;
  },

  updateLiveLocation: async (lat: number, lng: number) => {
    const response = await api.post('/users/location', { lat, lng });
    return response.data;
  },

  getNearbyLiveUsers: async (lat: number, lng: number, radius?: number, activeWithinMinutes?: number) => {
    const params: Record<string, unknown> = { lat, lng };
    if (radius) params.radius = radius;
    if (activeWithinMinutes) params.activeWithinMinutes = activeWithinMinutes;
    const response = await api.get('/users/nearby-live', { params });
    return response.data;
  },

  savePushToken: async (token: string) => {
    const response = await api.post('/users/push-token', { token });
    return response.data;
  },

  deleteAccount: async () => {
    const response = await api.delete('/users/me');
    return response.data;
  },

  getLeaderboard: async () => {
    const response = await api.get('/users/leaderboard');
    return response.data;
  },
};

// Saved API
export const savedAPI = {
  saveItem: async (itemType: 'pin' | 'event', itemId: string) => {
    const response = await api.post('/saved', { itemType, itemId });
    return response.data;
  },
  
  unsaveItem: async (itemType: 'pin' | 'event', itemId: string) => {
    const response = await api.delete(`/saved/${itemType}/${itemId}`);
    return response.data;
  },
  
  getSavedItems: async (itemType?: 'pin' | 'event') => {
    const params = itemType ? { itemType } : {};
    const response = await api.get('/saved', { params });
    return response.data;
  },
  
  checkSaved: async (itemType: 'pin' | 'event', itemId: string) => {
    const response = await api.get(`/saved/${itemType}/${itemId}/status`);
    return response.data;
  },
};

// Review API
export const reviewAPI = {
  createReview: async (itemType: 'pin' | 'event', itemId: string, data: { rating: number; comment?: string; photos?: string[] }) => {
    const response = await api.post('/reviews', { itemType, itemId, ...data });
    return response.data;
  },
  
  updateReview: async (reviewId: string, data: { rating?: number; comment?: string; photos?: string[] }) => {
    const response = await api.put(`/reviews/${reviewId}`, data);
    return response.data;
  },
  
  deleteReview: async (reviewId: string) => {
    const response = await api.delete(`/reviews/${reviewId}`);
    return response.data;
  },
  
  getReviews: async (itemType: 'pin' | 'event', itemId: string) => {
    const response = await api.get(`/reviews/${itemType}/${itemId}`);
    return response.data;
  },
  
  markHelpful: async (reviewId: string) => {
    const response = await api.post(`/reviews/${reviewId}/helpful`);
    return response.data;
  },
  
  getUserReviews: async (userId: string) => {
    const response = await api.get(`/reviews/user/${userId}`);
    return response.data;
  },
};

// Groups API
export const groupAPI = {
  createGroup: async (name: string) => {
    const response = await api.post('/groups', { name });
    return response.data;
  },

  getUserGroups: async () => {
    const response = await api.get('/groups');
    return response.data;
  },

  getGroup: async (groupId: string) => {
    const response = await api.get(`/groups/${groupId}`);
    return response.data;
  },

  renameGroup: async (groupId: string, name: string) => {
    const response = await api.patch(`/groups/${groupId}`, { name });
    return response.data;
  },

  deleteGroup: async (groupId: string) => {
    const response = await api.delete(`/groups/${groupId}`);
    return response.data;
  },

  addMember: async (groupId: string, username: string) => {
    const response = await api.post(`/groups/${groupId}/members`, { username });
    return response.data;
  },

  removeMember: async (groupId: string, userId: string) => {
    const response = await api.delete(`/groups/${groupId}/members/${userId}`);
    return response.data;
  },

  refreshInviteCode: async (groupId: string) => {
    const response = await api.post(`/groups/${groupId}/invite/refresh`);
    return response.data;
  },

  joinByInviteCode: async (inviteCode: string) => {
    const response = await api.post(`/groups/join/${inviteCode}`);
    return response.data;
  },
};

export default api;
