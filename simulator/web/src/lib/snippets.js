// Pure functions: a catalog entry + a base URL → a runnable snippet.
// Python uses stdlib urllib (matches pepper/client.py — zero extra deps).

export function toCurl(entry, baseUrl) {
  const url = `${baseUrl}${entry.path}`;
  if (entry.method === 'GET') return `curl ${url}`;
  const body = JSON.stringify(entry.body || {});
  return `curl -X POST ${url} -H 'Content-Type: application/json' -d '${body}'`;
}

export function toPython(entry, baseUrl) {
  const url = `${baseUrl}${entry.path}`;
  if (entry.method === 'GET') {
    return [
      'import json, urllib.request',
      `with urllib.request.urlopen("${url}") as r:`,
      '    print(json.load(r))',
    ].join('\n');
  }
  const body = JSON.stringify(entry.body || {}, null, 4);
  return [
    'import json, urllib.request',
    `req = urllib.request.Request("${url}", method="POST",`,
    `    data=json.dumps(${body}).encode(),`,
    '    headers={"Content-Type": "application/json"})',
    'with urllib.request.urlopen(req) as r:',
    '    print(json.load(r))',
  ].join('\n');
}
