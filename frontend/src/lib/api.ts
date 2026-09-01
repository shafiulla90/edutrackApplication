import axios from 'axios';

// In production (Vercel): use the Next.js API proxy route /api/* which forwards to the backend.
// In local dev: use NEXT_PUBLIC_API_URL env var, or fall back to localhost:3001 directly.
const envApiUrl = process.env.NEXT_PUBLIC_API_URL;
const BACKEND_URL = (envApiUrl && envApiUrl.startsWith('http') && !envApiUrl.includes('/backend') && !envApiUrl.includes('[SENSITIVE]'))
  ? envApiUrl
  : 'https://edutrack-backend-api-silk.vercel.app';



export function getActiveRole(): 'TEACHER' | 'SCHOOL_ADMIN' | 'PARENT' | 'DRIVER' {
  if (typeof window === 'undefined') return 'SCHOOL_ADMIN';
  
  let role = sessionStorage.getItem('active_role') as 'TEACHER' | 'SCHOOL_ADMIN' | 'PARENT' | 'DRIVER' | null;
  if (!role) {
    if (localStorage.getItem('parent_token')) {
      role = 'PARENT';
    } else if (localStorage.getItem('teacher_token')) {
      role = 'TEACHER';
    } else if (localStorage.getItem('admin_token')) {
      role = 'SCHOOL_ADMIN';
    } else {
      role = 'SCHOOL_ADMIN';
    }
    sessionStorage.setItem('active_role', role);
  }
  return role;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  const role = getActiveRole();
  if (role === 'PARENT' && localStorage.getItem('parent_token')) return localStorage.getItem('parent_token');
  if ((role === 'TEACHER' || role === 'DRIVER') && localStorage.getItem('teacher_token')) return localStorage.getItem('teacher_token');
  if (role === 'SCHOOL_ADMIN' && localStorage.getItem('admin_token')) return localStorage.getItem('admin_token');
  return localStorage.getItem('admin_token') || localStorage.getItem('teacher_token') || localStorage.getItem('parent_token') || null;
}

export function getStoredTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  const role = getActiveRole();
  if (role === 'PARENT' && localStorage.getItem('parent_tenantId')) return localStorage.getItem('parent_tenantId');
  if ((role === 'TEACHER' || role === 'DRIVER') && localStorage.getItem('teacher_tenantId')) return localStorage.getItem('teacher_tenantId');
  if (role === 'SCHOOL_ADMIN' && localStorage.getItem('admin_tenantId')) return localStorage.getItem('admin_tenantId');
  return localStorage.getItem('admin_tenantId') || localStorage.getItem('teacher_tenantId') || localStorage.getItem('parent_tenantId') || null;
}

export function getStoredUserPhone(): string | null {
  if (typeof window === 'undefined') return null;
  const role = getActiveRole();
  if (role === 'PARENT' && localStorage.getItem('parent_userPhone')) return localStorage.getItem('parent_userPhone');
  if ((role === 'TEACHER' || role === 'DRIVER') && localStorage.getItem('teacher_userPhone')) return localStorage.getItem('teacher_userPhone');
  if (role === 'SCHOOL_ADMIN' && localStorage.getItem('admin_userPhone')) return localStorage.getItem('admin_userPhone');
  return localStorage.getItem('admin_userPhone') || localStorage.getItem('teacher_userPhone') || localStorage.getItem('parent_userPhone') || null;
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  const role = getActiveRole();
  if (role === 'PARENT') {
    localStorage.removeItem('parent_token');
    localStorage.removeItem('parent_tenantId');
    localStorage.removeItem('parent_userPhone');
  } else if (role === 'TEACHER' || role === 'DRIVER') {
    localStorage.removeItem('teacher_token');
    localStorage.removeItem('teacher_tenantId');
    localStorage.removeItem('teacher_userPhone');
  } else {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_tenantId');
    localStorage.removeItem('admin_userPhone');
  }
  sessionStorage.removeItem('active_role');
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

// Interceptor to inject JWT Token and correct Tenant ID
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Inject resolved tenant ID if present
      const tenantId = getTenantFromHostname();
      if (tenantId) {
        config.headers['X-Tenant-ID'] = tenantId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle 401 and redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        // Prevent redirect loop if already on root page, auth pages, or public registration
        const path = window.location.pathname;
        const isPublicPath = path === '/' || path.startsWith('/auth/') || path.startsWith('/register-school');
        // Do NOT redirect for background tenant polling calls - TenantContext handles those
        const url = error.config?.url || '';
        const isTenantPolling = url.includes('/tenant/setup-status') || url.includes('/tenant/public-branding');
        if (!isPublicPath && !isTenantPolling) {
          clearStoredAuth();
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const updateStudent = (id: string, data: Partial<any>) => api.patch(`/students/${id}`, data);
