/* ------------------------------------------------------------------
 * Audio gate. This file runs before the Unity loader, so every
 * AudioContext the engine creates goes through here: on a warm cache the
 * build boots before anyone pressed Play, and it would start its music
 * right away. Contexts stay suspended - and refuse to resume - until the
 * player presses the button.
 * ---------------------------------------------------------------- */
(function() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    var contexts = [];
    window.__wgAudioAllowed = false;

    function Gated(options) {
        var ctx = new Ctx(options);
        contexts.push(ctx);
        var resume = ctx.resume.bind(ctx);
        ctx.__wgResume = resume;
        ctx.resume = function() {
            if (window.__wgAudioAllowed) return resume();
            return Promise.resolve();
        };
        if (!window.__wgAudioAllowed) {
            try { ctx.suspend(); } catch (e) { /* nothing to suspend yet */ }
        }
        return ctx;
    }
    Gated.prototype = Ctx.prototype;

    window.AudioContext = Gated;
    window.webkitAudioContext = Gated;

    window.__wgAllowAudio = function() {
        window.__wgAudioAllowed = true;
        for (var i = 0; i < contexts.length; i++) {
            try { contexts[i].__wgResume(); } catch (e) { /* already gone */ }
        }
    };
})();

(function() {
    document.addEventListener('DOMContentLoaded', function(){
        requestAnimationFrame(function(){ document.body.classList.add('loaded'); });
    });
})();

/* ------------------------------------------------------------------
 * Portrait guard: on phones the game only makes sense in landscape,
 * so ask for a rotation every time the screen turns portrait.
 * ---------------------------------------------------------------- */
(function() {
    function isHandheld() {
        var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        var smallSide = Math.min(window.innerWidth, window.innerHeight);
        var uaMobile = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS
        return (coarse || uaMobile) && smallSide <= 900;
    }

    function isPortrait() {
        if (window.matchMedia && window.matchMedia('(orientation: portrait)').matches) return true;
        return window.innerHeight > window.innerWidth;
    }

    function update() {
        document.body.classList.toggle('needs-rotate', isHandheld() && isPortrait());
    }

    document.addEventListener('DOMContentLoaded', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', function(){
        // iOS reports stale dimensions right after the event
        update();
        setTimeout(update, 250);
    });
    if (window.matchMedia) {
        var mq = window.matchMedia('(orientation: portrait)');
        if (mq.addEventListener) mq.addEventListener('change', update);
        else if (mq.addListener) mq.addListener(update);
    }
    update();
})();

/* ------------------------------------------------------------------
 * Launch button + loading progress.
 * The game downloads in the background straight away; the button is
 * there so the player makes a gesture on the page, which is what lets
 * the browser play sound.
 * ---------------------------------------------------------------- */
(function() {
    var playBtn = null;
    var loading = null;
    var barFill = null;
    var label = null;

    var userStarted = false;
    var engineReady = false;
    var revealed = false;

    // the bar chases the reported progress instead of snapping to it
    var target = 0;
    var shown = 0;
    var rafId = null;

    function unlockAudio() {
        try {
            var Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            var ctx = window.__wgAudioCtx || (window.__wgAudioCtx = new Ctx());
            if (ctx.state === 'suspended') ctx.resume();
            // a zero-length blip is enough to mark the context as user-activated
            var source = ctx.createBufferSource();
            source.buffer = ctx.createBuffer(1, 1, 22050);
            source.connect(ctx.destination);
            source.start(0);
        } catch (e) { /* audio stays muted until the engine asks for it */ }
    }

    // the audio gate at the top of this file keeps the engine quiet; this
    // opens it once the player has pressed the button
    function releaseEngineAudio() {
        if (typeof window.__wgAllowAudio === 'function') window.__wgAllowAudio();
    }

    // called from unity-init.js once the instance exists
    window.webgameOnInstanceReady = function() {
        if (userStarted) releaseEngineAudio();
    };

    function reveal() {
        if (revealed) return;
        revealed = true;
        if (typeof window.webgameFadeOutOverlay === 'function') window.webgameFadeOutOverlay();
        if (typeof window.webgameRevealCanvas === 'function') window.webgameRevealCanvas();
    }

    // let the bar finish its run before the overlay goes away, and always give
    // the button-to-progress swap time to play out even on an instant load
    var startedAt = 0;
    var pending = null;
    var MIN_DWELL = 620;

    function maybeReveal() {
        if (!(userStarted && engineReady && shown > 0.995)) return;
        var left = MIN_DWELL - (new Date().getTime() - startedAt);
        if (left <= 0) { reveal(); return; }
        if (pending === null) pending = setTimeout(function(){ pending = null; reveal(); }, left);
    }

    function onPlay() {
        if (userStarted) return;
        userStarted = true;
        startedAt = new Date().getTime();
        releaseEngineAudio();
        unlockAudio();
        if (playBtn) playBtn.classList.add('is-gone');
        if (loading) loading.classList.add('is-on');
        maybeReveal();
    }

    document.addEventListener('DOMContentLoaded', function() {
        playBtn = document.getElementById('wg-play');
        loading = document.getElementById('wg-loading');
        barFill = document.getElementById('wg-bar-fill');
        label = document.getElementById('wg-loading-label');
        if (playBtn) playBtn.addEventListener('click', onPlay);
        render();
    });

    function render() {
        if (barFill) barFill.style.width = (shown * 100).toFixed(2) + '%';
        if (label) label.textContent = engineReady ? 'READY' : 'LOADING';
    }

    function tick() {
        rafId = null;
        var diff = target - shown;
        if (diff <= 0.0008) {
            shown = target;
            render();
            maybeReveal();
            return;
        }
        // exponential chase with a floor, so even a jump from 0 to 1 reads as motion
        shown = Math.min(target, shown + Math.max(diff * 0.075, 0.0022));
        render();
        rafId = requestAnimationFrame(tick);
    }

    function animateTo(value) {
        target = Math.max(target, Math.min(1, value));
        if (rafId === null) rafId = requestAnimationFrame(tick);
    }

    // called from unity-init.js while the build downloads
    window.webgameSetProgress = function(value) {
        if (typeof value !== 'number' || isNaN(value)) return;
        animateTo(value);
    };

    window.webgameMarkEngineReady = function() {
        engineReady = true;
        animateTo(1);
        render();
        maybeReveal();
    };
})();

// Expose UI effect functions to be triggered when the engine is loaded
window.webgameFadeOutOverlay = function() {
    var wrapper = document.querySelector('.wg-container');
    if (!wrapper) return;
    wrapper.classList.add('fade-out');
};

window.webgameRevealCanvas = function() {
    var canvas = document.getElementById('unity-canvas');
    if (!canvas) return;
    canvas.classList.add('visible');
};

// Convenience method to trigger both effects together
window.webgameOnEngineLoaded = function() {
    if (typeof window.webgameFadeOutOverlay === 'function') window.webgameFadeOutOverlay();
    if (typeof window.webgameRevealCanvas === 'function') window.webgameRevealCanvas();
};

// Function to be called by the Unity build when the engine is ready.
// The overlay now waits for the player to press Play as well, so the
// reveal itself is handled by webgameMarkEngineReady().
window.engineLoaded = function() {
    if (typeof window.webgameMarkEngineReady === 'function') {
        window.webgameMarkEngineReady();
    } else {
        window.webgameOnEngineLoaded();
    }
};
