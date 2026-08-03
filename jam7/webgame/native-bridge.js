/* Bridge between the page and the Unity build.
 *
 * Everything the game cannot learn on its own inside a WebGL/Web build
 * lives here: which platform the browser runs on, and vibration (Unity's
 * Handheld.Vibrate is a no-op on the web).
 *
 * Loaded before the Unity loader, so the functions are ready by the time
 * the game starts calling them. See PROMPTS in the repo notes for the
 * matching .jslib and C# side.
 */
(function () {
    var ua = navigator.userAgent || '';

    function isAndroid() {
        return /Android/i.test(ua);
    }

    function isIOS() {
        if (/iPad|iPhone|iPod/i.test(ua)) return true;
        // iPadOS 13+ reports itself as a Mac, but a Mac has no touch points
        return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    }

    function isTouch() {
        return ('ontouchstart' in window) || navigator.maxTouchPoints > 0 ||
            (!!window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    }

    function isMobile() {
        if (isAndroid() || isIOS()) return true;
        if (/Windows Phone|webOS|BlackBerry|Mobile|Silk/i.test(ua)) return true;
        // touch device with a phone/tablet sized screen
        return isTouch() && Math.min(window.innerWidth, window.innerHeight) <= 900;
    }

    function isStandalone() {
        if (window.navigator.standalone === true) return true; // iOS home screen
        if (!window.matchMedia) return false;
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.matchMedia('(display-mode: minimal-ui)').matches;
    }

    function canVibrate() {
        return typeof navigator.vibrate === 'function';
    }

    function snapshot() {
        var android = isAndroid();
        var ios = isIOS();
        return {
            os: android ? 'android' : (ios ? 'ios' : 'desktop'),
            isAndroid: android,
            isIOS: ios,
            isMobile: isMobile(),
            isTouch: isTouch(),
            isStandalone: isStandalone(),
            canVibrate: canVibrate(),
            isPortrait: window.innerHeight > window.innerWidth,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio || 1,
            language: navigator.language || '',
            userAgent: ua
        };
    }

    // kept up to date for debugging from the console
    window.WGPlatform = snapshot();
    window.addEventListener('resize', function () { window.WGPlatform = snapshot(); });

    /* Read by the game: a JSON string is the simplest thing to hand over
     * the jslib boundary and parse with JsonUtility on the C# side. */
    window.wgGetPlatformInfo = function () {
        window.WGPlatform = snapshot();
        return JSON.stringify(window.WGPlatform);
    };

    /* Diagnostics. Open the page with ?wgdebug=1 to see, on screen, whether
     * the game reaches this bridge at all - that tells apart "the browser
     * refuses to vibrate" from "the build never calls us". */
    var debugOn = (location.search || '').indexOf('wgdebug=1') !== -1;
    var debugBox = null;

    window.WGVibrateDebug = { calls: 0, lastArg: null, lastResult: null, lastError: '' };

    function activationState() {
        try {
            if (navigator.userActivation) {
                return (navigator.userActivation.hasBeenActive ? 'hasBeenActive' : 'never-active') +
                    (navigator.userActivation.isActive ? ' +active' : '');
            }
        } catch (e) {}
        return 'unknown';
    }

    function debugReport() {
        if (!debugOn) return;
        var d = window.WGVibrateDebug;
        var text = 'vibrate: supported=' + canVibrate() +
            ' calls=' + d.calls +
            ' last=' + JSON.stringify(d.lastArg) +
            ' ok=' + d.lastResult +
            ' activation=' + activationState() +
            (d.lastError ? ' err=' + d.lastError : '');
        if (console && console.log) console.log('[wg] ' + text);
        if (!debugBox) {
            debugBox = document.createElement('div');
            debugBox.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;' +
                'font:11px/1.4 ui-monospace,monospace;background:rgba(0,0,0,0.72);color:#8f8;' +
                'padding:6px 8px;pointer-events:none;white-space:pre-wrap;';
            (document.body || document.documentElement).appendChild(debugBox);
        }
        debugBox.textContent = text;
    }

    if (debugOn) {
        document.addEventListener('DOMContentLoaded', debugReport);
        setInterval(debugReport, 1000);
    }

    /* Vibration. Chrome on Android only obeys this after the user has
     * interacted with the page - the Play button covers that. Safari on
     * iOS has no Vibration API at all, so this quietly returns false. */
    window.wgVibrate = function (pattern) {
        var dbg = window.WGVibrateDebug;
        dbg.calls++;
        dbg.lastArg = pattern;
        dbg.lastError = '';

        if (!canVibrate()) {
            dbg.lastResult = false;
            dbg.lastError = 'no navigator.vibrate';
            debugReport();
            return false;
        }
        if (document.hidden) {
            dbg.lastResult = false;
            dbg.lastError = 'page hidden';
            debugReport();
            return false;
        }

        var value;
        if (typeof pattern === 'number') {
            value = Math.max(1, Math.min(2000, Math.round(pattern)));
        } else if (typeof pattern === 'string') {
            // "40,60,40" -> [40, 60, 40]
            value = pattern.split(',').map(function (part) {
                return Math.max(0, Math.min(2000, parseInt(part, 10) || 0));
            });
        } else if (Object.prototype.toString.call(pattern) === '[object Array]') {
            value = pattern;
        } else {
            value = 30;
        }

        try {
            var ok = navigator.vibrate(value) !== false;
            dbg.lastResult = ok;
            if (!ok) dbg.lastError = 'browser refused (no user gesture yet, or vibration off)';
            debugReport();
            return ok;
        } catch (e) {
            dbg.lastResult = false;
            dbg.lastError = e && e.message ? e.message : 'threw';
            debugReport();
            return false;
        }
    };

    window.wgVibrateStop = function () {
        if (!canVibrate()) return false;
        try { navigator.vibrate(0); return true; } catch (e) { return false; }
    };
})();
