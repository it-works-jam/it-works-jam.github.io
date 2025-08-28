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

// Fade out the overlay container after 3s over a duration of 2s
(function() {
    var wrapper = document.querySelector('.wg-container');
    if (!wrapper) return;
    window.setTimeout(function() {
        wrapper.classList.add('fade-out');
    }, 3000);
})();

// Reveal the canvas after 3s with a 1s fade-in
(function() {
    var canvas = document.getElementById('unity-canvas');
    if (!canvas) return;
    window.setTimeout(function() {
        canvas.classList.add('visible');
    }, 3000);
})();


