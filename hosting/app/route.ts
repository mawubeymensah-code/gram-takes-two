import html from '../content/index.html?raw';
import { securityHeaders } from '../lib/forms-api';
export const dynamic = 'force-dynamic';
export function GET() { return new Response(html, { headers: { ...securityHeaders, 'Content-Type':'text/html; charset=utf-8' } }); }
