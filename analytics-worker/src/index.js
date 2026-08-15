const COLLECT_BUCKET_SECONDS = 5 * 60;
const RETENTION_SECONDS = 93 * 24 * 60 * 60;
const MAX_BODY_BYTES = 2048;

export const RANGE_CONFIG = Object.freeze({
    hours: { seconds: 6 * 60 * 60, resolution: 5 * 60 },
    day: { seconds: 24 * 60 * 60, resolution: 60 * 60 },
    week: { seconds: 7 * 24 * 60 * 60, resolution: 6 * 60 * 60 },
    month: { seconds: 30 * 24 * 60 * 60, resolution: 24 * 60 * 60 }
});

function responseHeaders(origin, extra) {
    const headers = new Headers(extra || {});
    if (origin) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Vary', 'Origin');
    }
    headers.set('X-Content-Type-Options', 'nosniff');
    return headers;
}

function jsonResponse(value, status, origin) {
    return new Response(JSON.stringify(value), {
        status: status || 200,
        headers: responseHeaders(origin, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
        })
    });
}

function allowedOrigins(env) {
    return String(env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(function(value) { return value.trim(); })
        .filter(Boolean);
}

function getAllowedOrigin(request, env) {
    const origin = request.headers.get('Origin') || '';
    return allowedOrigins(env).indexOf(origin) !== -1 ? origin : '';
}

export function normalizeMetricPath(value) {
    if (typeof value !== 'string') return '';
    let path = value.trim();
    if (!path || path.length > 300 || path.charAt(0) !== '/') return '';
    if (path.indexOf('?') !== -1 || path.indexOf('#') !== -1 || path.indexOf('\\') !== -1) return '';
    path = path.replace(/\/{2,}/g, '/');
    return path;
}

export function validateEventPayload(payload) {
    if (!payload || (payload.event !== 'pageview' && payload.event !== 'download')) return null;

    const pagePath = normalizeMetricPath(payload.path);
    if (!pagePath) return null;

    if (payload.event === 'pageview') {
        return { eventType: 'pageview', pagePath: pagePath, target: '' };
    }

    const target = normalizeMetricPath(payload.target);
    const isBuild = /\/(?:Builds)\/[^/]+\.(?:apk|zip|dmg|exe)$/i.test(target);
    const isTestFlight = /\/Builds\/TestFlight$/i.test(target);
    if (!target || (!isBuild && !isTestFlight)) return null;
    return { eventType: 'download', pagePath: pagePath, target: target };
}

function tokenMatches(request, env) {
    const expected = String(env.STATS_TOKEN || '');
    const authorization = request.headers.get('Authorization') || '';
    const actual = authorization.indexOf('Bearer ') === 0 ? authorization.slice(7) : '';
    if (!expected || actual.length !== expected.length) return false;

    let mismatch = 0;
    for (let index = 0; index < expected.length; index += 1) {
        mismatch |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
    }
    return mismatch === 0;
}

async function collect(request, env, origin) {
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > MAX_BODY_BYTES) return jsonResponse({ error: 'payload_too_large' }, 413, origin);

    let payload;
    try {
        const body = await request.text();
        if (body.length > MAX_BODY_BYTES) return jsonResponse({ error: 'payload_too_large' }, 413, origin);
        payload = JSON.parse(body);
    } catch (error) {
        return jsonResponse({ error: 'invalid_json' }, 400, origin);
    }

    const event = validateEventPayload(payload);
    if (!event) return jsonResponse({ error: 'invalid_event' }, 400, origin);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(nowSeconds / COLLECT_BUCKET_SECONDS) * COLLECT_BUCKET_SECONDS;

    await env.DB.prepare(
        'INSERT INTO metrics (bucket, event_type, page_path, target, count) VALUES (?, ?, ?, ?, 1) ' +
        'ON CONFLICT (bucket, event_type, page_path, target) DO UPDATE SET count = count + 1'
    ).bind(bucket, event.eventType, event.pagePath, event.target).run();

    return new Response(null, {
        status: 204,
        headers: responseHeaders(origin, { 'Cache-Control': 'no-store' })
    });
}

function rows(result) {
    return result && Array.isArray(result.results) ? result.results : [];
}

async function statistics(request, env, origin, url) {
    if (!tokenMatches(request, env)) {
        return jsonResponse({ error: 'unauthorized' }, 401, origin);
    }

    const rangeName = url.searchParams.get('range') || 'day';
    const range = RANGE_CONFIG[rangeName];
    if (!range) return jsonResponse({ error: 'invalid_range' }, 400, origin);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const from = nowSeconds - range.seconds;
    const resolution = range.resolution;

    const seriesStatement = env.DB.prepare(
        'SELECT CAST(bucket / ? AS INTEGER) * ? AS period, event_type, SUM(count) AS count ' +
        'FROM metrics WHERE bucket >= ? GROUP BY period, event_type ORDER BY period ASC'
    ).bind(resolution, resolution, from);

    const pagesStatement = env.DB.prepare(
        "SELECT page_path AS path, SUM(count) AS count FROM metrics " +
        "WHERE bucket >= ? AND event_type = 'pageview' GROUP BY page_path ORDER BY count DESC, page_path ASC"
    ).bind(from);

    const downloadsStatement = env.DB.prepare(
        "SELECT target, SUM(count) AS count FROM metrics " +
        "WHERE bucket >= ? AND event_type = 'download' GROUP BY target ORDER BY count DESC, target ASC"
    ).bind(from);

    const totalStatement = env.DB.prepare(
        'SELECT event_type, SUM(count) AS count FROM metrics WHERE bucket >= ? GROUP BY event_type'
    ).bind(from);

    const results = await env.DB.batch([
        seriesStatement,
        pagesStatement,
        downloadsStatement,
        totalStatement
    ]);

    const totals = { pageviews: 0, downloads: 0 };
    rows(results[3]).forEach(function(row) {
        if (row.event_type === 'pageview') totals.pageviews = Number(row.count) || 0;
        if (row.event_type === 'download') totals.downloads = Number(row.count) || 0;
    });

    return jsonResponse({
        range: rangeName,
        from: from,
        to: nowSeconds,
        resolution: resolution,
        totals: totals,
        series: rows(results[0]).map(function(row) {
            return {
                bucket: Number(row.period),
                event: row.event_type,
                count: Number(row.count) || 0
            };
        }),
        pages: rows(results[1]).map(function(row) {
            return { path: row.path, count: Number(row.count) || 0 };
        }),
        downloads: rows(results[2]).map(function(row) {
            return { target: row.target, count: Number(row.count) || 0 };
        })
    }, 200, origin);
}

function optionsResponse(origin) {
    return new Response(null, {
        status: 204,
        headers: responseHeaders(origin, {
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Max-Age': '86400',
            'Cache-Control': 'no-store'
        })
    });
}

async function handleRequest(request, env) {
    const url = new URL(request.url);
    const origin = getAllowedOrigin(request, env);

    if (url.pathname === '/health' && request.method === 'GET') {
        return jsonResponse({ ok: true }, 200, origin);
    }

    if (!origin) return jsonResponse({ error: 'origin_not_allowed' }, 403, '');
    if (request.method === 'OPTIONS') return optionsResponse(origin);

    if (url.pathname === '/collect' && request.method === 'POST') {
        return collect(request, env, origin);
    }

    if (url.pathname === '/stats' && request.method === 'GET') {
        return statistics(request, env, origin, url);
    }

    return jsonResponse({ error: 'not_found' }, 404, origin);
}

export default {
    fetch: function(request, env) {
        return handleRequest(request, env).catch(function(error) {
            console.error('Analytics request failed:', error && error.message ? error.message : 'unknown error');
            return jsonResponse({ error: 'service_unavailable' }, 503, getAllowedOrigin(request, env));
        });
    },

    scheduled: function(controller, env, context) {
        const cutoff = Math.floor(Date.now() / 1000) - RETENTION_SECONDS;
        context.waitUntil(env.DB.prepare('DELETE FROM metrics WHERE bucket < ?').bind(cutoff).run());
    }
};
