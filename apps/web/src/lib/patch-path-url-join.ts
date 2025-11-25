import path from 'path';

let patched = false;

function patchJoinForFileUrls() {
  if (patched) {
    return;
  }

  const originalJoin = path.join;

  const patchedJoin = (...segments: Parameters<typeof path.join>) => {
    if (
      segments.length > 0 &&
      typeof segments[0] === 'string' &&
      segments[0].startsWith('file://')
    ) {
      let url = new URL(segments[0]);
      for (const segment of segments.slice(1)) {
        url = new URL(segment, url);
      }
      return url.href;
    }
    return originalJoin(...segments);
  };

  path.join = patchedJoin as typeof path.join;
  patched = true;
}

function isEdgeRuntime() {
  return (
    typeof process !== 'undefined' &&
    process.env !== undefined &&
    process.env.NEXT_RUNTIME === 'edge'
  );
}

if (typeof window === 'undefined' && !isEdgeRuntime()) {
  patchJoinForFileUrls();
}

export {};
