import { readFileSync } from 'node:fs';

/**
 * Reads the Redis image of `compose.dev.yaml`, so the tests run the image the workstation runs and
 * the pin Renovate updates lives in one file.
 *
 * @returns The image reference, tag and digest.
 * @throws {Error} When `compose.dev.yaml` names no Redis image.
 */
export function redisImage(): string {
  const compose: string = readFileSync(new URL('../../compose.dev.yaml', import.meta.url), 'utf8');
  const image: string | undefined = /^\s*image:\s*(redis:\S+)\s*$/mu.exec(compose)?.[1];
  if (image === undefined) {
    throw new Error('compose.dev.yaml names no Redis image.');
  }
  return image;
}
