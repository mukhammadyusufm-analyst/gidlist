import 'server-only';

import { AwsClient } from 'aws4fetch';

/**
 * The off-site backup destination.
 *
 * Cloudflare R2, reached over its S3-compatible API. R2 rather than S3 because
 * egress is free, and a backup you are billed to read is a backup you hesitate
 * to test — which makes it not a backup.
 *
 * `aws4fetch` rather than `@aws-sdk/client-s3`: signing a request is the only
 * thing needed here, and the AWS SDK is megabytes of client for it. This is
 * about five kilobytes and returns a normal `fetch` Response.
 */

export type R2 = {
  put: (key: string, body: ArrayBuffer, contentType: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

/**
 * Null when unconfigured, never a throw.
 *
 * The same shape as `createAdminClient()`, and for the same reason: a
 * deployment that has not been given a bucket should say so plainly, not fail
 * in a way that looks like an outage.
 */
export function createR2(): R2 | null {
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  /*
   * `auto` is R2's region and the only value it accepts. Signing with a real
   * AWS region name produces a signature R2 rejects, with a message about
   * credentials that sends you looking at the wrong thing entirely.
   */
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto',
  });

  const base = `${endpoint.replace(/\/+$/, '')}/${bucket}`;

  /*
   * Each segment is encoded separately so slashes survive as path separators.
   * Storage paths are `<board id>/<submission id>/<file>`, and encoding the
   * whole key would turn those into %2F and flatten the archive into one
   * directory of unreadable names — which still restores, but only by someone
   * who works out what happened.
   */
  const urlFor = (key: string) =>
    `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;

  return {
    async put(key, body, contentType) {
      const response = await client.fetch(urlFor(key), {
        method: 'PUT',
        body,
        headers: { 'content-type': contentType || 'application/octet-stream' },
      });

      if (!response.ok) {
        // The body carries R2's actual complaint; the status alone does not.
        throw new Error(`R2 refused PUT ${key}: ${response.status} ${await safeText(response)}`);
      }
    },

    async remove(key) {
      const response = await client.fetch(urlFor(key), { method: 'DELETE' });

      // S3 returns 204 for a delete, and also for deleting something that was
      // never there. Both are the state we want, so both are success.
      if (!response.ok && response.status !== 404) {
        throw new Error(`R2 refused DELETE ${key}: ${response.status} ${await safeText(response)}`);
      }
    },
  };
}

/** Reading an error body must never be what throws. */
async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return '(no body)';
  }
}
