import { NextRequest, NextResponse } from 'next/server';

const TARGET_BACKEND_URL = 'https://edutrack-backend-api.vercel.app';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'POST');
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'PUT');
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'PATCH');
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'DELETE');
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
    },
  });
}

async function proxyRequest(request: NextRequest, pathSegments: string[], method: string) {
  const path = (pathSegments || []).join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const targetUrl = `${TARGET_BACKEND_URL}/${path}${searchParams ? `?${searchParams}` : ''}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authHeader = request.headers.get('Authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  const tenantHeader = request.headers.get('X-Tenant-ID');
  if (tenantHeader) headers['X-Tenant-ID'] = tenantHeader;

  const fetchOptions: RequestInit = {
    method,
    headers,
    cache: 'no-store',
  };

  if (method !== 'GET' && method !== 'DELETE') {
    try {
      const body = await request.text();
      if (body) fetchOptions.body = body;
    } catch {}
  }

  try {
    const backendResponse = await fetch(targetUrl, fetchOptions);
    const responseText = await backendResponse.text();

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    return NextResponse.json(responseData, {
      status: backendResponse.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error(`[API Proxy Error] ${method} /${path}:`, error.message);
    return NextResponse.json(
      { message: 'Backend service temporarily unavailable. Please try again.', error: error.message },
      { status: 503 }
    );
  }
}
