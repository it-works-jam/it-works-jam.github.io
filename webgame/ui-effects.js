(function() {
    document.addEventListener('DOMContentLoaded', function(){
        requestAnimationFrame(function(){ document.body.classList.add('loaded'); });
    });
})();

(function() {
    var container = document.getElementById('loading-dots');
    if (!container) return;
    var dots = Array.prototype.slice.call(container.querySelectorAll('.dot'));
    var sequence = [0,1,2,3,0];
    var idx = 0;
    function update() {
        var count = sequence[idx];
        idx = (idx + 1) % sequence.length;
        for (var i = 0; i < dots.length; i++) {
            var target = i < count ? 1 : 0;
            dots[i].style.opacity = target;
        }
    }
    dots.forEach(function(d){ d.style.opacity = 0; });
    setInterval(update, 350);
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

// Function to be called by the Unity build when the engine is ready
window.engineLoaded = function() {
    if (typeof window.webgameOnEngineLoaded === 'function') {
        window.webgameOnEngineLoaded();
    } else {
        if (typeof window.webgameFadeOutOverlay === 'function') window.webgameFadeOutOverlay();
        if (typeof window.webgameRevealCanvas === 'function') window.webgameRevealCanvas();
    }
};


