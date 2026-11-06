import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = 'https://vps.kodub.com/v6/trackOfTheWeek';
const VERSION = '?version=0.6.3';
const MAX_IMAGE = 2 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function getBytes(fetchImpl, url, limit, accepts) {
  const response = await fetchImpl(url, { method: 'GET', redirect: 'error', credentials: 'omit',
    headers: { Accept: accepts, Origin: 'https://app-polytrack.kodub.com', Referer: 'https://app-polytrack.kodub.com/' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok || response.redirected) throw Error('Official weekly download failed');
  if (response.url && response.url !== url) throw Error('Unexpected weekly response URL');
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) throw Error('Weekly asset exceeds size limit');
  const chunks = []; let length = 0;
  if (!response.body) throw Error('Empty weekly response');
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw Error('Weekly asset exceeds size limit'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return { bytes: Buffer.concat(chunks), type: (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() };
}
function assetUrl(value, kind) {
  if (typeof value !== 'string') throw Error('Missing official weekly asset');
  const url = new URL(value);
  if (url.origin !== 'https://vps.kodub.com' || url.username || url.password || url.search || url.hash ||
      !new RegExp('^/v6/trackOfTheWeek/' + kind + '/[a-f0-9]{64}$').test(url.pathname)) throw Error('Invalid official weekly asset URL');
  return url;
}
function currentMetadata(value, now) {
  if (!value || typeof value !== 'object' || !Number.isFinite(Date.parse(value.serverTime))) throw Error('Invalid weekly feed');
  if (value.current === null) return null;
  const item = value.current;
  if (!item || !/^[a-f0-9]{64}$/.test(item.trackId || '') || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 300 ||
      !(item.author === null || typeof item.author === 'string' && item.author.length <= 1000) ||
      !(item.lastModified === null || typeof item.lastModified === 'string' && Number.isFinite(Date.parse(item.lastModified))) ||
      ![0, 1, 2, 3, 32, 33, 34, 35, 36, 37, 38, 39, 40].includes(item.environment) ||
      typeof item.endTime !== 'string' || !Number.isFinite(Date.parse(item.endTime)) || Date.parse(item.endTime) <= now ||
      Date.parse(item.endTime) > now + 14 * 86400000) throw Error('Invalid or expired weekly selection');
  assetUrl(item.trackUrl, 'track'); assetUrl(item.thumbnailUrl, 'image');
  if (item.coverUrl !== null) assetUrl(item.coverUrl, 'image');
  return { trackId: item.trackId, name: item.name, author: item.author, lastModified: item.lastModified,
    environment: item.environment, endTime: item.endTime, trackUrl: item.trackUrl,
    thumbnailUrl: item.thumbnailUrl, coverUrl: item.coverUrl };
}

/** Downloads only public weekly metadata and its assets. No player data or score endpoint is used. */
export async function syncWeekly({ fetchImpl = fetch, root = fileURLToPath(new URL('../', import.meta.url)), now = Date.now() } = {}) {
  const timestamp = typeof now === 'function' ? now() : Number(now);
  if (!Number.isFinite(timestamp)) throw Error('Invalid capture time');
  const feed = await getBytes(fetchImpl, ROOT + VERSION, 16384, 'application/json');
  if (feed.type !== 'application/json') throw Error('Weekly feed is not JSON');
  const current = currentMetadata(JSON.parse(feed.bytes.toString('utf8')), timestamp);
  if (!current) return { updated: false, reason: 'no-current' };
  const assets = [];
  for (const [field, kind, extension] of [['trackUrl', 'track', 'track'], ['thumbnailUrl', 'image', 'webp'], ['coverUrl', 'image', 'webp']]) {
    if (current[field] === null) continue;
    const url = assetUrl(current[field], kind);
    const asset = await getBytes(fetchImpl, url.href + VERSION, kind === 'track' ? 524288 : MAX_IMAGE,
      kind === 'track' ? 'text/plain' : 'image/webp');
    if (kind === 'track') {
      if (!['text/plain', 'application/octet-stream'].includes(asset.type) ||
          !/^PolyTrack[0-9A-Za-z+/_=-]+$/.test(asset.bytes.toString('utf8')) || asset.bytes.length < 32) throw Error('Invalid weekly track code');
    } else if (asset.type !== 'image/webp' || asset.bytes.length < 12 ||
        asset.bytes.toString('ascii', 0, 4) !== 'RIFF' || asset.bytes.toString('ascii', 8, 12) !== 'WEBP') throw Error('Weekly image must be WebP');
    const digest = hash(asset.bytes);
    if (digest !== path.posix.basename(url.pathname)) throw Error('Weekly asset digest does not match its official URL');
    const filename = digest + '.' + extension;
    if (!assets.some(existing => existing.filename === filename)) assets.push({ filename, bytes: asset.bytes });
    current[field] = 'assets/' + filename;
  }
  // All downloads and validation finish before any published capture file changes.
  const weeklyRoot = path.resolve(root, 'weekly');
  const staging = path.join(weeklyRoot, '.capture-' + randomUUID());
  await mkdir(staging, { recursive: true });
  try {
    for (const asset of assets) await writeFile(path.join(staging, asset.filename), asset.bytes);
    await writeFile(path.join(staging, 'current.json'), JSON.stringify({serverTime: new Date(timestamp).toISOString(), current}, null, 2) + '\n');
    await mkdir(path.join(weeklyRoot, 'assets'), { recursive: true });
    for (const asset of assets) await rename(path.join(staging, asset.filename), path.join(weeklyRoot, 'assets', asset.filename));
    // Atomic metadata replacement last keeps a failed refresh from exposing partial downloads.
    await rename(path.join(staging, 'current.json'), path.join(weeklyRoot, 'current.json'));
  } finally { await rm(staging, { recursive: true, force: true }); }
  return { updated: true, trackId: current.trackId, endTime: current.endTime, assets: assets.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  syncWeekly().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error('Weekly refresh failed. The previous capture is preserved: ' + error.message);
    process.exitCode = 1;
  });
}
