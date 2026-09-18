import { getRedisConnection } from "./queue";

/**
 * Simple fixed-window rate limiter built on the same Redis instance the job queues
 * already require — no new infrastructure. Fixed-window (not sliding/token-bucket)
 * is a deliberate simplicity trade-off: it allows a burst right at a window boundary,
 * which is an acceptable cost for the endpoints this guards (signup, login, public
 * analytics ingestion) versus the complexity of a sliding-window implementation.
 *
 * Fails open: if Redis is unreachable, requests are allowed through rather than
 * locking everyone out of signup/login because of an infra blip elsewhere.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const redis = getRedisConnection();
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch (err) {
    console.error("Rate limiter unavailable, failing open:", err);
    return { allowed: true, remaining: limit };
  }
}

/** Best-effort client IP extraction behind a proxy/load balancer. Falls back to a shared bucket if no proxy header is present (e.g. plain `docker run` with no reverse proxy) — document that your production deploy should sit behind something that sets this. */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
