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
    var progress = 0;
    var revealed = false;

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

    function reveal() {
        if (revealed) return;
        revealed = true;
        if (typeof window.webgameFadeOutOverlay === 'function') window.webgameFadeOutOverlay();
        if (typeof window.webgameRevealCanvas === 'function') window.webgameRevealCanvas();
    }

    function maybeReveal() {
        if (userStarted && engineReady) reveal();
    }

    function onPlay() {
        if (userStarted) return;
        userStarted = true;
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
        if (barFill) barFill.style.width = Math.round(progress * 100) + '%';
        if (label) label.textContent = engineReady ? 'ready' : 'loading';
    }

    // called from unity-init.js while the build downloads
    window.webgameSetProgress = function(value) {
        if (typeof value !== 'number' || isNaN(value)) return;
        progress = Math.max(progress, Math.min(1, value));
        render();
    };

    window.webgameMarkEngineReady = function() {
        engineReady = true;
        progress = 1;
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
