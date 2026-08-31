import axios from 'axios';

// In production (Vercel): use the Next.js API proxy route /api/* which forwards to the backend.
// In local dev: use NEXT_PUBLIC_API_URL env var, or fall back to localhost:3001 directly.
const envApiUrl = process.env.NEXT_PUBLIC_API_URL;
const BACKEND_URL = (envApiUrl && envApiUrl.startsWith('http') && !envApiUrl.includes('/backend') && !envApiUrl.includes('[SENSITIVE]'))
  ? envApiUrl
  : 'https://edutrack-backend-api.vercel.app';

export function getActiveRole(): 'TEACHER' | 'SCHOOL_ADMIN' | 'PARENT' | 'DRIVER' {
  if (typeof window === 'undefined') return 'SCHOOL_ADMIN';
  
  let role = (sessionStorage.getItem('active_role') || localStorage.getItem('active_role')) as 'TEACHER' | 'SCHOOL_ADMIN' | 'PARENT' | 'DRIVER' | null;
  
  if (typeof window !== 'undefined' && window.location.search) {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('portal');
    if (p === 'teacher') role = 'TEACHER';
    else if (p === 'parent' || p === 'student') role = 'PARENT';
    else if (p === 'admin') role = 'SCHOOL_ADMIN';
  }

  if (!role) {
    if (localStorage.getItem('parent_token')) {
      role = 'PARENT';
    } else if (localStorage.getItem('teacher_token')) {
      role = 'TEACHER';
    } else {
      role = 'SCHOOL_ADMIN';
    }
  }

  localStorage.setItem('active_role', role);
  sessionStorage.setItem('active_role', role);
  return role;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  const role = getActiveRole();
  if (role === 'PARENT') return localStorage.getItem('parent_token');
  if (role === 'TEACHER' || role === 'DRIVER') return localStorage.getItem('teacher_token');
  return localStorage.getItem('admin_token');
}

export function getStoredTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  const role = getActiveRole();
  if (role === 'PARENT') return localStorage.getItem('parent_tenantId');
  if (role === 'TEACHER' || role === 'DRIVER') return localStorage.getItem('teacher_tenantId');
  return localStorage.getItem('admin_tenantId');
}

export function getStoredUserPhone(): string | null {
  if (typeof window === 'undefined') return null;
  const role = getActiveRole();
  if (role === 'PARENT') return localStorage.getItem('parent_userPhone');
  if (role === 'TEACHER' || role === 'DRIVER') return localStorage.getItem('teacher_userPhone');
  return localStorage.getItem('admin_userPhone');
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_tenantId');
  localStorage.removeItem('admin_userPhone');
  localStorage.removeItem('teacher_token');
  localStorage.removeItem('teacher_tenantId');
  localStorage.removeItem('teacher_userPhone');
  localStorage.removeItem('parent_token');
  localStorage.removeItem('parent_tenantId');
  localStorage.removeItem('parent_userPhone');
  localStorage.removeItem('token');
  localStorage.removeItem('tenantId');
  localStorage.removeItem('active_role');
  sessionStorage.removeItem('active_role');
  sessionStorage.removeItem('dismissed_admin_expiry_warning');
}

export function getTenantFromHostname(): string {
  if (typeof window === 'undefined') return '';

  // Prefer stored tenant ID (from successful login) over hostname detection
  const stored = getStoredTenantId();
  if (stored) return stored;

  const hostname = window.location.hostname;
  
  if (hostname === 'edutrack.covenantsynergy.in' || hostname === 'api-edutrack.covenantsynergy.in') {
    return '';
  } else if (hostname.endsWith('.edutrack.covenantsynergy.in')) {
    const parts = hostname.replace('.edutrack.covenantsynergy.in', '').split('.');
    const sub = parts[parts.length - 1];
    if (sub !== 'www' && sub !== 'api') {
      return sub;
    }
  } else if (hostname === 'edutrack.com' || hostname === 'www.edutrack.com' || hostname === 'app.edutrack.com') {
    return '';
  } else if (hostname.endsWith('.edutrack.com')) {
    const parts = hostname.replace('.edutrack.com', '').split('.');
    const sub = parts[parts.length - 1];
    if (sub !== 'www' && sub !== 'api' && sub !== 'app') {
      return sub;
    }
  } else if (hostname.endsWith('.vercel.app')) {
    const prefix = hostname.replace('.vercel.app', '');
    if (prefix !== 'edutrack-saas-frontend' && prefix !== 'edu-track-saa-s' && prefix !== 'www' && prefix !== 'api' && prefix !== 'edutrack-backend-api') {
      return prefix;
    }
    return '';
  } else {
    const parts = hostname.split('.');
    if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== 'www' && isNaN(Number(parts[0]))) {
      return parts[0];
    }
  }

  return '';
}

export const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
    // X‑Tenant‑ID will be injected dynamically by the request interceptor.
  },
});

// In-flight request deduplication cache for GET requests
const inFlightRequests = new Map<string, Promise<any>>();

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const url = (config.url || '').toLowerCase();
      const isPublicRegistration = url.includes('/tenant/register') || url.includes('/tenant/public-branding') || url.includes('/auth/') || url.includes('register');
      
      if (isPublicRegistration) {
        if (config.headers) {
          delete config.headers.Authorization;
          delete config.headers.authorization;
          delete config.headers['Authorization'];
          delete config.headers['X-Tenant-ID'];
          delete config.headers['x-tenant-id'];
        }
      } else {
        const token = getStoredToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        const tenantId = getTenantFromHostname();
        if (tenantId) {
          config.headers['X-Tenant-ID'] = tenantId;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle deduplication & 401 response handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const isPublicPath = path === '/' || path.startsWith('/auth/') || path.startsWith('/register-school');
        if (!isPublicPath) {
          const role = getActiveRole();
          clearStoredAuth();
          const portalParam = role === 'TEACHER' ? 'teacher' : role === 'PARENT' ? 'parent' : 'admin';
          window.location.href = `/auth/login?portal=${portalParam}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

export const updateStudent = (id: string, data: Partial<any>) => api.patch(`/students/${id}`, data);
