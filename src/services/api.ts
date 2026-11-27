/**
 * EventPool API Client
 * Connects the frontend to the Express/Firebase backend API (/api)
 */

const API_BASE = '/api';
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');

function buildApiUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

export async function checkBackendHealth(): Promise<{ ok: boolean; status?: string }> {
  try {
    const res = await fetch(buildApiUrl('/api/health'));
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, status: data?.data?.status || 'healthy' };
  } catch {
    return { ok: false };
  }
}

const AUTH_TOKEN_KEY = 'eventpool_jwt_token';
const FIREBASE_WEB_API_KEY = import.meta.env?.VITE_FIREBASE_WEB_API_KEY || '';

export type UnauthorizedReason = 'expired' | 'disabled';
type UnauthorizedHandler = (reason: UnauthorizedReason) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

interface ApiErrorResponse {
  success?: boolean;
  message?: string;
  error?: { code?: string };
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const rawUrl = endpoint.startsWith('/api/')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const url = buildApiUrl(rawUrl);
  const headers = new Headers(options.headers);

  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the EventPool server.');
  }

  let body: ApiResponse<T> | ApiErrorResponse | null = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || body?.success === false) {
    const errorBody = body as ApiErrorResponse | null;
    const code = errorBody?.error?.code || `HTTP_${response.status}`;
    const message = errorBody?.message || response.statusText || 'API request failed.';

    if (response.status === 401 || code === 'UNAUTHORIZED') {
      clearAuthToken();
      unauthorizedHandler?.('expired');
    } else if (code === 'ACCOUNT_DISABLED') {
      clearAuthToken();
      unauthorizedHandler?.('disabled');
    }

    throw new ApiError(response.status, code, message);
  }

  const successBody = body as ApiResponse<T> | null;
  if (successBody && 'data' in successBody) {
    return successBody.data as T;
  }
  return successBody as unknown as T;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

export type AuthProfile =
  | {
      accountType: 'admin';
      adminId: string;
      adminName: string;
      email: string;
    }
  | {
      accountType: 'club';
      clubId: string;
      clubName: string;
      email: string;
    };

export async function loginWithFirebaseAuth(email: string, password: string): Promise<void> {
  if (!FIREBASE_WEB_API_KEY) {
    throw new ApiError(
      0,
      'FIREBASE_CONFIG_MISSING',
      'Firebase web API key is not configured. Set VITE_FIREBASE_WEB_API_KEY.'
    );
  }

  let response: Response;
  try {
    response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the sign-in service.');
  }

  const body = await response.json().catch(() => null) as
    | { idToken?: string; error?: { message?: string } }
    | null;

  if (!response.ok || !body?.idToken) {
    const code = body?.error?.message || `HTTP_${response.status}`;
    throw new ApiError(response.status, code, 'Firebase authentication failed.');
  }

  setAuthToken(body.idToken);
}

export async function fetchAuthProfileApi(): Promise<AuthProfile> {
  return apiRequest<AuthProfile>('/api/auth/profile');
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
  };
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('eventpool_jwt_token') || null;
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('eventpool_jwt_token', token);
    } else {
      localStorage.removeItem('eventpool_jwt_token');
    }
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('eventpool_jwt_token');
  }

  private async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = buildApiUrl(`${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`);
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const json = await response.json().catch(() => ({
        success: false,
        message: response.statusText,
        error: { code: 'HTTP_' + response.status },
      }));

      return json;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network request failed',
        error: { code: 'NETWORK_ERROR' },
      };
    }
  }

  // Health check
  async health() {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  // Auth Endpoints (BE-01)
  auth = {
    getProfile: () => this.request<any>('/auth/profile'),
  };

  // Admin Endpoints (BE-05)
  admin = {
    getProfile: () => this.request<any>('/admin/profile'),
    createClub: (data: {
      clubName: string;
      description?: string;
      contactEmail: string;
      picContactNum: string;
      password: string;
    }) =>
      this.request<{
        clubId: string;
        clubName: string;
        contactEmail: string;
        isActive: boolean;
      }>('/admin/clubs', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deactivateClub: (clubId: string) =>
      this.request<{ clubId: string; isActive: boolean }>(
        `/admin/clubs/${clubId}/deactivate`,
        { method: 'PATCH' }
      ),
    getDashboard: () =>
      this.request<{
        totalClubs: number;
        activeClubs: number;
        totalResources: number;
        totalBorrowingRequests: number;
        pendingRequests: number;
        completedRequests: number;
      }>('/admin/dashboard'),
  };

  // Club Endpoints (BE-04)
  clubs = {
    getAll: () =>
      this.request<
        Array<{
          clubId: string;
          clubName: string;
          description: string;
          contactEmail: string;
          picContactNum: string;
          isActive: boolean;
        }>
      >('/clubs'),
    getById: (clubId: string) =>
      this.request<{
        clubId: string;
        clubName: string;
        description: string;
        contactEmail: string;
        picContactNum: string;
        createdAt: string;
        isActive: boolean;
      }>(`/clubs/${clubId}`),
    update: (
      clubId: string,
      data: {
        clubName?: string;
        description?: string;
        contactEmail?: string;
        picContactNum?: string;
      }
    ) =>
      this.request<{
        clubId: string;
        clubName: string;
        contactEmail: string;
      }>(`/clubs/${clubId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  };

  // Event Endpoints (BE-04)
  events = {
    getAll: (params?: { clubId?: string; eventDate?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return this.request<
        Array<{
          eventId: string;
          clubId: string;
          eventName: string;
          eventDate: string;
          purpose: string;
          description: string;
          createdAt: string;
        }>
      >(`/events${q ? `?${q}` : ''}`);
    },
    create: (data: {
      eventName: string;
      eventDate: string;
      purpose: string;
      description?: string;
    }) =>
      this.request<{
        eventId: string;
        clubId: string;
        eventName: string;
        eventDate: string;
        purpose: string;
      }>('/events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Resource Endpoints (BE-02 & BE-03)
  resources = {
    getAll: (params?: {
      category?: string;
      status?: string;
      clubId?: string;
      location?: string;
      page?: number;
      limit?: number;
    }) => {
      const q = new URLSearchParams(params as any).toString();
      return this.request<{
        items: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/resources${q ? `?${q}` : ''}`);
    },
    search: (params?: {
      q?: string;
      category?: string;
      status?: string;
      clubId?: string;
      location?: string;
      page?: number;
      limit?: number;
    }) => {
      const qs = new URLSearchParams(params as any).toString();
      return this.request<{
        items: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/resources/search${qs ? `?${qs}` : ''}`);
    },
    getById: (resourceId: string) => this.request<any>(`/resources/${resourceId}`),
    create: (data: {
      itemName: string;
      category: string;
      description?: string;
      totalQuantity: number;
      condition?: string;
      location?: string;
      remarks?: string;
      estimatedUnitCost?: number;
      estimatedUnitWeight?: number;
    }) =>
      this.request<any>('/resources', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      resourceId: string,
      data: {
        itemName?: string;
        category?: string;
        description?: string;
        totalQuantity?: number;
        condition?: string;
        location?: string;
        remarks?: string;
        estimatedUnitCost?: number;
        estimatedUnitWeight?: number;
      }
    ) =>
      this.request<any>(`/resources/${resourceId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    archive: (resourceId: string) =>
      this.request<{ resourceId: string; isArchived: boolean }>(
        `/resources/${resourceId}/archive`,
        { method: 'PATCH' }
      ),
    updateAvailability: (
      resourceId: string,
      data: { isTemporarilyUnavailable: boolean; remarks?: string }
    ) =>
      this.request<any>(`/resources/${resourceId}/availability`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    uploadImage: (resourceId: string, file: File | Blob) => {
      const formData = new FormData();
      formData.append('image', file);
      return this.request<{ resourceId: string; imageURL: string }>(
        `/resources/${resourceId}/image`,
        {
          method: 'POST',
          body: formData,
        }
      );
    },
    getImage: (resourceId: string) =>
      this.request<{ resourceId: string; imageURL: string }>(
        `/resources/${resourceId}/image`
      ),
    deleteImage: (resourceId: string) =>
      this.request<{ resourceId: string; imageURL: null }>(
        `/resources/${resourceId}/image`,
        { method: 'DELETE' }
      ),
  };

  // Borrowing Request Endpoints (BE-06 to BE-10)
  borrowing = {
    getAll: (params?: {
      status?: string;
      resourceId?: string;
      page?: number;
      limit?: number;
    }) => {
      const q = new URLSearchParams(params as any).toString();
      return this.request<{
        requests?: any[];
        items?: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/borrowing-requests${q ? `?${q}` : ''}`);
    },
    getById: (requestId: string) =>
      this.request<any>(`/borrowing-requests/${requestId}`),
    submit: (data: {
      resourceId: string;
      eventId: string;
      quantity: number;
      purpose: string;
      pickupDate: string;
      expectedReturnDate: string;
      wouldHavePurchased: boolean;
      remarks?: string;
    }) =>
      this.request<any>('/borrowing-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    approve: (requestId: string) =>
      this.request<any>(`/borrowing-requests/${requestId}/approve`, {
        method: 'PATCH',
      }),
    reject: (requestId: string, remarks?: string) =>
      this.request<any>(`/borrowing-requests/${requestId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ remarks: remarks || '' }),
      }),
    cancel: (requestId: string, reason?: string) =>
      this.request<any>(`/borrowing-requests/${requestId}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reason || 'Cancelled by club' }),
      }),
    markBorrowed: (requestId: string) =>
      this.request<any>(`/borrowing-requests/${requestId}/borrow`, {
        method: 'PATCH',
      }),
    submitReturn: (
      requestId: string,
      data: { actualReturnDate: string; remarks?: string }
    ) =>
      this.request<any>(`/borrowing-requests/${requestId}/return`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    complete: (
      requestId: string,
      data: {
        returnedQuantity: number;
        usableQuantity: number;
        damagedQuantity: number;
        missingQuantity: number;
        returnCondition?: string;
        remarks?: string;
      }
    ) =>
      this.request<any>(`/borrowing-requests/${requestId}/complete`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  };
}

export const api = new ApiService();
export default api;
