import assert from 'node:assert/strict';
import test from 'node:test';

import worker, {
    RANGE_CONFIG,
    normalizeMetricPath,
    validateEventPayload
} from '../src/index.js';

const ALLOWED_ORIGIN = 'https://it-works-jam.github.io';

function fakeDatabase() {
    const calls = [];
    return {
        calls,
        prepare(sql) {
            const statement = {
                sql,
                values: [],
                bind(...values) {
                    this.values = values;
                    return this;
                },
                async run() {
                    calls.push({ sql: this.sql, values: this.values });
                    return { success: true };
                }
            };
            return statement;
        }
    };
}

test('metric paths are canonical and contain no query data', () => {
    assert.equal(normalizeMetricPath('/jam8//webgame/'), '/jam8/webgame/');
    assert.equal(normalizeMetricPath('/jam8/?source=mail'), '');
    assert.equal(normalizeMetricPath('https://example.com/jam8/'), '');
});

test('only supported anonymous events are accepted', () => {
    assert.deepEqual(validateEventPayload({ event: 'pageview', path: '/jam8/' }), {
        eventType: 'pageview', pagePath: '/jam8/', target: ''
    });
    assert.deepEqual(validateEventPayload({
        event: 'download', path: '/jam8/', target: '/jam8/Builds/Game.apk'
    }), {
        eventType: 'download', pagePath: '/jam8/', target: '/jam8/Builds/Game.apk'
    });
    assert.equal(validateEventPayload({ event: 'download', path: '/jam8/', target: '/private.txt' }), null);
    assert.equal(validateEventPayload({ event: 'identify', path: '/jam8/' }), null);
});

test('collector stores only bucket, event type, page path and target', async () => {
    const DB = fakeDatabase();
    const response = await worker.fetch(new Request('https://analytics.example/collect', {
        method: 'POST',
        headers: { Origin: ALLOWED_ORIGIN, 'Content-Type': 'text/plain' },
        body: JSON.stringify({
            event: 'pageview',
            path: '/jam8/',
            ignoredUserAgent: 'must not be stored'
        })
    }), { DB, ALLOWED_ORIGINS: ALLOWED_ORIGIN, STATS_TOKEN: 'secret' });

    assert.equal(response.status, 204);
    assert.equal(DB.calls.length, 1);
    assert.equal(DB.calls[0].values.length, 4);
    assert.deepEqual(DB.calls[0].values.slice(1), ['pageview', '/jam8/', '']);
});

test('collector rejects foreign origins', async () => {
    const DB = fakeDatabase();
    const response = await worker.fetch(new Request('https://analytics.example/collect', {
        method: 'POST',
        headers: { Origin: 'https://attacker.example' },
        body: JSON.stringify({ event: 'pageview', path: '/jam8/' })
    }), { DB, ALLOWED_ORIGINS: ALLOWED_ORIGIN, STATS_TOKEN: 'secret' });

    assert.equal(response.status, 403);
    assert.equal(DB.calls.length, 0);
});

test('statistics require the server-side token', async () => {
    const response = await worker.fetch(new Request('https://analytics.example/stats?range=day', {
        headers: { Origin: ALLOWED_ORIGIN }
    }), { DB: fakeDatabase(), ALLOWED_ORIGINS: ALLOWED_ORIGIN, STATS_TOKEN: 'secret' });

    assert.equal(response.status, 401);
});

test('all requested reporting ranges are configured', () => {
    assert.deepEqual(Object.keys(RANGE_CONFIG), ['hours', 'day', 'week', 'month']);
});
