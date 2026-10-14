import events from '../../../public/events.json';
import { securityHeaders } from '../../../lib/forms-api';
export function GET(){return Response.json({events},{headers:securityHeaders});}
