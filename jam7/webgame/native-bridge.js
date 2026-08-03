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

    /* Vibration. Chrome on Android only obeys this after the user has
     * interacted with the page - the Play button covers that. Safari on
     * iOS has no Vibration API at all, so this quietly returns false. */
    window.wgVibrate = function (pattern) {
        if (!canVibrate()) return false;
        if (document.hidden) return false; // ignored by the browser anyway

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
            return navigator.vibrate(value) !== false;
        } catch (e) {
            return false;
        }
    };

    window.wgVibrateStop = function () {
        if (!canVibrate()) return false;
        try { navigator.vibrate(0); return true; } catch (e) { return false; }
    };
})();
