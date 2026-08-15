import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientSource = fs.readFileSync(path.resolve(testDirectory, '../../analytics.js'), 'utf8');

function loadClient(hostname) {
    const beacons = [];
    const fetches = [];
    const listeners = {};
    const tables = [];
    const location = {
        hostname,
        origin: 'https://' + hostname,
        href: 'https://' + hostname + '/jam8/',
        pathname: '/jam8/'
    };
    const report = {
        range: 'day',
        from: 1000,
        to: 4600,
        resolution: 3600,
        totals: { pageviews: 2, downloads: 1 },
        series: [
            { bucket: 0, event: 'pageview', count: 2 },
            { bucket: 0, event: 'download', count: 1 }
        ],
        pages: [{ path: '/jam8/', count: 2 }],
        downloads: [{ target: '/jam8/Builds/Game.apk', count: 1 }]
    };
    const fetch = async function(url, options) {
        fetches.push({ url, options });
        return { ok: true, status: 200, json: async function() { return report; } };
    };
    const document = {
        addEventListener(type, handler) { listeners[type] = handler; },
        createElement() { throw new Error('Token dialog should not be opened in this test.'); },
        body: { appendChild() {} }
    };
    const window = { location, fetch };
    const context = {
        URL,
        Date,
        Object,
        Promise,
        Math,
        JSON,
        encodeURIComponent,
        window,
        document,
        navigator: {
            sendBeacon(url, body) {
                beacons.push({ url, body });
                return true;
            }
        },
        fetch,
        console: {
            info() {},
            log() {},
            group() {},
            groupEnd() {},
            table(value) { tables.push(value); }
        }
    };
    vm.runInNewContext(clientSource, context, { filename: 'analytics.js' });
    return { window, listeners, beacons, fetches, tables };
}

test('production page view sends only the anonymous metric payload', () => {
    const client = loadClient('it-works-jam.github.io');
    assert.equal(client.beacons.length, 1);
    assert.deepEqual(JSON.parse(client.beacons[0].body), {
        event: 'pageview', path: '/jam8/'
    });
});

test('localhost does not pollute production counters', () => {
    const client = loadClient('127.0.0.1');
    assert.equal(client.beacons.length, 0);
});

test('build and TestFlight clicks become download events', () => {
    const client = loadClient('it-works-jam.github.io');
    const click = client.listeners.click;

    click({ target: { closest: function() { return {
        href: 'https://it-works-jam.github.io/jam8/Builds/Game.apk'
    }; } } });
    click({ target: { closest: function() { return {
        href: 'https://testflight.apple.com/join/example'
    }; } } });

    assert.deepEqual(JSON.parse(client.beacons[1].body), {
        event: 'download', path: '/jam8/', target: '/jam8/Builds/Game.apk'
    });
    assert.deepEqual(JSON.parse(client.beacons[2].body), {
        event: 'download', path: '/jam8/', target: '/jam8/Builds/TestFlight'
    });
});

test('console report uses an in-memory bearer token and prints tables', async () => {
    const client = loadClient('127.0.0.1');
    await client.window.JamStats.login('local-secret');
    const report = await client.window.JamStats.show('day');

    assert.equal(report.totals.pageviews, 2);
    assert.equal(client.fetches.length, 1);
    assert.match(client.fetches[0].url, /\/stats\?range=day$/);
    assert.equal(client.fetches[0].options.headers.Authorization, 'Bearer local-secret');
    assert.equal(client.tables.length, 2);
});
