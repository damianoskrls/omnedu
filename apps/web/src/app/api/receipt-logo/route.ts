import { NextRequest, NextResponse } from 'next/server';

function blockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host === 'metadata.google.internal') return true;
  if (host === '0.0.0.0' || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('169.254.')) return true;
  const match = /^172\.(\d+)\./.exec(host);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  return false;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url') ?? '';
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'bad url' }, { status: 400 });
  }
  if (target.protocol !== 'https:' || blockedHost(target.hostname)) {
    return NextResponse.json({ error: 'blocked' }, { status: 400 });
  }
  const upstream = await fetch(target.toString());
  if (!upstream.ok) return NextResponse.json({ error: 'fetch failed' }, { status: 502 });
  const type = upstream.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) return NextResponse.json({ error: 'not an image' }, { status: 400 });
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
