import { describe, it, expect } from 'vitest';
import { toCurl, toPython } from './snippets';
import catalog from './api_catalog.json';

const GET = { section: 'Robot API', method: 'GET', path: '/health', body: null, desc: 'x' };
const POST = { section: 'Robot API', method: 'POST', path: '/move/velocity', body: { x: 0.5, y: 0, theta: 0 }, desc: 'x' };

describe('snippets', () => {
  it('toCurl GET is a plain curl to the url', () => {
    expect(toCurl(GET, 'http://localhost:5001')).toBe('curl http://localhost:5001/health');
  });

  it('toCurl POST sends JSON body with method and content-type', () => {
    const s = toCurl(POST, 'http://localhost:5001');
    expect(s).toContain('-X POST');
    expect(s).toContain('http://localhost:5001/move/velocity');
    expect(s).toContain("-H 'Content-Type: application/json'");
    expect(s).toContain('{"x":0.5,"y":0,"theta":0}');
  });

  it('toPython GET uses urlopen', () => {
    const s = toPython(GET, 'http://localhost:5001');
    expect(s).toContain('urllib.request');
    expect(s).toContain('http://localhost:5001/health');
    expect(s).not.toContain('method="POST"');
  });

  it('toPython POST builds a Request with the json body', () => {
    const s = toPython(POST, 'http://localhost:5001');
    expect(s).toContain('method="POST"');
    expect(s).toContain('json.dumps');
    expect(s).toContain('"x": 0.5');
  });
});

describe('api_catalog.json', () => {
  it('is a non-empty array with both sections and required keys', () => {
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);
    const sections = new Set(catalog.map((e) => e.section));
    expect(sections.has('Robot API')).toBe(true);
    expect(sections.has('Studio API')).toBe(true);
    for (const e of catalog) {
      expect(['GET', 'POST']).toContain(e.method);
      expect(typeof e.path).toBe('string');
      expect(e.path.startsWith('/')).toBe(true);
      expect(typeof e.desc).toBe('string');
    }
  });
});
