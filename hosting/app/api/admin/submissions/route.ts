import { env } from 'cloudflare:workers';
import { exportSubmissions } from '../../../../lib/forms-api';
export const dynamic='force-dynamic';
export function GET(request:Request){
  if(!env.DB)return Response.json({error:'Unavailable.'},{status:503});
  return exportSubmissions(request,env.DB,env.GRAM_ADMIN_TOKEN||'');
}
