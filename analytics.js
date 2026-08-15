(function() {
    'use strict';

    var ENDPOINT = 'https://jamhub-analytics.itworksjam.workers.dev';
    var PRODUCTION_HOST = 'it-works-jam.github.io';
    var statsToken = '';
    var sparkChars = '▁▂▃▄▅▆▇█';

    function pagePath() {
        var path = window.location.pathname || '/';
        return path.replace(/\/{2,}/g, '/');
    }

    function sendEvent(event) {
        if (window.location.hostname !== PRODUCTION_HOST) return;

        var body = JSON.stringify(event);
        if (navigator.sendBeacon) {
            try {
                if (navigator.sendBeacon(ENDPOINT + '/collect', body)) return;
            } catch (error) { /* use fetch fallback */ }
        }

        if (window.fetch) {
            fetch(ENDPOINT + '/collect', {
                method: 'POST',
                mode: 'cors',
                credentials: 'omit',
                keepalive: true,
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                body: body
            }).catch(function() { /* analytics must never affect the page */ });
        }
    }

    function downloadTarget(anchor) {
        var url;
        try { url = new URL(anchor.href, window.location.href); } catch (error) { return ''; }

        if (url.origin === window.location.origin &&
            /\/Builds\/[^/]+\.(?:apk|zip|dmg|exe)$/i.test(url.pathname)) {
            return url.pathname;
        }

        if (url.hostname === 'testflight.apple.com' && /^\/join\//.test(url.pathname)) {
            return pagePath().replace(/\/?$/, '/') + 'Builds/TestFlight';
        }

        return '';
    }

    function onDownloadClick(event) {
        var target = event.target;
        var anchor = target && target.closest ? target.closest('a[href]') : null;
        if (!anchor) return;

        var build = downloadTarget(anchor);
        if (!build) return;
        sendEvent({ event: 'download', path: pagePath(), target: build });
    }

    function tokenDialog() {
        return new Promise(function(resolve) {
            var overlay = document.createElement('div');
            var form = document.createElement('form');
            var title = document.createElement('strong');
            var input = document.createElement('input');
            var submit = document.createElement('button');
            var cancel = document.createElement('button');

            overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;font:14px system-ui,sans-serif;';
            form.style.cssText = 'width:min(360px,calc(100% - 40px));background:#fff;color:#241a1a;border-radius:16px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.4);display:grid;grid-template-columns:1fr auto;gap:12px;';
            title.textContent = 'JamHub statistics token';
            title.style.cssText = 'grid-column:1/-1;font-size:17px;';
            input.type = 'password';
            input.autocomplete = 'off';
            input.placeholder = 'Paste token';
            input.style.cssText = 'grid-column:1/-1;padding:10px 12px;border:1px solid #cdbdb8;border-radius:8px;font:inherit;';
            submit.type = 'submit';
            submit.textContent = 'Open statistics';
            submit.style.cssText = 'padding:9px 12px;border:0;border-radius:8px;background:#ed3341;color:#fff;font:700 13px system-ui;cursor:pointer;';
            cancel.type = 'button';
            cancel.textContent = 'Cancel';
            cancel.style.cssText = 'padding:9px 12px;border:0;border-radius:8px;background:#eee;color:#444;font:700 13px system-ui;cursor:pointer;';

            function finish(value) {
                overlay.remove();
                resolve(value || '');
            }

            form.addEventListener('submit', function(event) {
                event.preventDefault();
                finish(input.value.trim());
            });
            cancel.addEventListener('click', function() { finish(''); });
            overlay.addEventListener('click', function(event) {
                if (event.target === overlay) finish('');
            });

            form.appendChild(title);
            form.appendChild(input);
            form.appendChild(submit);
            form.appendChild(cancel);
            overlay.appendChild(form);
            document.body.appendChild(overlay);
            input.focus();
        });
    }

    async function login(token) {
        var value = typeof token === 'string' ? token.trim() : await tokenDialog();
        if (!value) throw new Error('Statistics token was not provided.');
        statsToken = value;
        console.info('JamStats: token accepted for this page session.');
        return true;
    }

    function pointsFor(report, eventType) {
        var counts = Object.create(null);
        report.series.forEach(function(point) {
            if (point.event === eventType) counts[point.bucket] = point.count;
        });

        var points = [];
        var first = Math.floor(report.from / report.resolution) * report.resolution;
        for (var bucket = first; bucket <= report.to; bucket += report.resolution) {
            points.push(counts[bucket] || 0);
        }
        return points;
    }

    function sparkline(values) {
        if (!values.length) return '';
        var max = Math.max.apply(Math, values);
        if (!max) return values.map(function() { return sparkChars.charAt(0); }).join('');
        return values.map(function(value) {
            var index = Math.round((value / max) * (sparkChars.length - 1));
            return sparkChars.charAt(index);
        }).join('');
    }

    function periodLabel(report) {
        var from = new Date(report.from * 1000).toLocaleString();
        var to = new Date(report.to * 1000).toLocaleString();
        return from + ' — ' + to;
    }

    function renderReport(report, section) {
        var viewPoints = pointsFor(report, 'pageview');
        var downloadPoints = pointsFor(report, 'download');
        var heading = 'JamHub statistics · ' + report.range;

        console.group('%c' + heading, 'font-size:15px;font-weight:bold;color:#ed3341');
        console.log(periodLabel(report));
        console.log('Page views: %c' + report.totals.pageviews, 'font-weight:bold;color:#7a54c4');
        console.log('Downloads:  %c' + report.totals.downloads, 'font-weight:bold;color:#1e8fa6');
        console.log('Views      ' + sparkline(viewPoints));
        console.log('Downloads  ' + sparkline(downloadPoints));

        if (!section || section === 'pages') {
            console.log('%cPages', 'font-weight:bold');
            console.table(report.pages.map(function(item) {
                return { page: item.path, views: item.count };
            }));
        }

        if (!section || section === 'downloads') {
            console.log('%cBuild downloads', 'font-weight:bold');
            console.table(report.downloads.map(function(item) {
                return { build: item.target, downloads: item.count };
            }));
        }
        console.groupEnd();
        return report;
    }

    async function fetchReport(range) {
        var selectedRange = range || 'day';
        if (['hours', 'day', 'week', 'month'].indexOf(selectedRange) === -1) {
            throw new Error('Unknown range. Use hours, day, week or month.');
        }
        if (!statsToken) await login();

        var response = await fetch(ENDPOINT + '/stats?range=' + encodeURIComponent(selectedRange), {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            headers: { Authorization: 'Bearer ' + statsToken }
        });

        if (response.status === 401) {
            statsToken = '';
            throw new Error('JamStats: invalid token. Run await JamStats.login() and try again.');
        }
        if (!response.ok) throw new Error('JamStats service returned HTTP ' + response.status + '.');
        return response.json();
    }

    async function show(range) {
        return renderReport(await fetchReport(range), '');
    }

    async function pages(range) {
        return renderReport(await fetchReport(range), 'pages');
    }

    async function downloads(range) {
        return renderReport(await fetchReport(range), 'downloads');
    }

    function help() {
        console.log([
            'JamHub anonymous statistics',
            'await JamStats.login()        enter the stats token',
            "await JamStats.show('day')    full report: hours | day | week | month",
            "await JamStats.pages('week') page views only",
            "await JamStats.downloads('month') build downloads only",
            'JamStats.logout()             forget the token on this page'
        ].join('\n'));
    }

    window.JamStats = Object.freeze({
        login: login,
        logout: function() { statsToken = ''; },
        show: show,
        pages: pages,
        downloads: downloads,
        help: help
    });

    document.addEventListener('click', onDownloadClick, true);
    sendEvent({ event: 'pageview', path: pagePath() });
})();
