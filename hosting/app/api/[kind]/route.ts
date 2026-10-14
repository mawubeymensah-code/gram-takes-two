import { env } from 'cloudflare:workers';
import { submitForm } from '../../../lib/forms-api';
export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{kind:string}>}){
  if(!env.DB)return Response.json({error:'The form service is unavailable.'},{status:503});
  return submitForm(request,env.DB,(await context.params).kind);
}
