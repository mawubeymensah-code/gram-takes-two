declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    GRAM_ADMIN_TOKEN?: string;
    BUCKET?: R2Bucket;
  }
}
