(function() {
    var container = document.querySelector('.container');
    if (!container) return;
    var lastAspect = null;
    var scheduled = false;
    var scheduledInstant = false;

    function fitScale(forceInstant) {
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var aspect = vw / vh;
        var isLandscape = vw > vh;
        // Smoothly scale between threshold and very wide screens
        var threshold = 1.64; // start scaling around this aspect
        var endAspect = 2.2;  // at this aspect and wider we reach target scale
        // determine if we should disable transition for this update
        var bigChange = lastAspect === null ? true : Math.abs(aspect - lastAspect) > 0.25;
        var instant = !!forceInstant || bigChange;
        if (instant) {
            document.body.classList.add('no-anim');
        }

        if (isLandscape) {
            // Target area is 70% of viewport in both dimensions, centered
            var targetW = vw * 0.7;
            var targetH = vh * 0.7;
            // Measure natural container size (no scale, keep centered)
            container.style.transform = 'translate(-50%, -50%)';
            var naturalW = container.scrollWidth;
            var naturalH = container.scrollHeight;
            if (!naturalW || !naturalH) {
                var rect = container.getBoundingClientRect();
                naturalW = rect.width;
                naturalH = rect.height;
            }
            var scaleW = naturalW > 0 ? (targetW / naturalW) : 1;
            var scaleH = naturalH > 0 ? (targetH / naturalH) : 1;
            var targetScale = Math.min(scaleW, scaleH, 1); // never upscale above 1
            // Interpolate from 1 → targetScale as aspect goes threshold → endAspect
            var t = Math.min(Math.max((aspect - threshold) / (endAspect - threshold), 0), 1);
            var smoothScale = 1 + (targetScale - 1) * t;
            // Always cap by targetScale to guarantee fit within 70% area
            var finalScale = Math.min(smoothScale, targetScale);
            container.style.transform = 'translate(-50%, -50%) scale(' + finalScale.toFixed(3) + ')';
        } else {
            container.style.transform = 'translate(-50%, -50%)';
        }

        lastAspect = aspect;
        if (instant) {
            requestAnimationFrame(function(){ document.body.classList.remove('no-anim'); });
        }

        updatePreTitleWrap();
    }

    function schedule(instant) {
        scheduledInstant = scheduledInstant || !!instant;
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(function(){
            scheduled = false;
            fitScale(scheduledInstant);
            scheduledInstant = false;
        });
    }

    // Observe container size changes (e.g., fonts/images affecting layout)
    if (window.ResizeObserver) {
        var ro = new ResizeObserver(function(){ schedule(false); });
        ro.observe(container);
    }
    // Also recalc when images in container load
    Array.prototype.forEach.call(container.querySelectorAll('img'), function(img){
        if (!img.complete) {
            img.addEventListener('load', function(){ schedule(false); }, { once: true });
            img.addEventListener('error', function(){ schedule(false); }, { once: true });
        }
    });

    window.addEventListener('resize', function(){ schedule(false); }, { passive: true });
    window.addEventListener('orientationchange', function(){ schedule(true); }, { passive: true });

    // Run asap to position correctly without animation
    schedule(true);
    function revealOnce() {
        if (!document.body.classList.contains('loaded')) {
            document.body.classList.remove('no-anim');
            requestAnimationFrame(function(){ document.body.classList.add('loaded'); });
        }
    }
    // After fonts load or on window load, recalc and then reveal
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function(){ schedule(true); revealOnce(); });
    } else {
        window.addEventListener('load', function(){ schedule(true); revealOnce(); }, { once: true });
    }

    // Handle pre-icons-title wrapping (dash removal on wrap)
    var lastWrapped = null;
    function updatePreTitleWrap() {
        var p = document.querySelector('.pre-icons-title');
        if (!p) return;
        var left = p.querySelector('.pre-title-left');
        var right = p.querySelector('.pre-title-right');
        if (!left || !right) return;
        // Measure in unwrapped state to avoid feedback loops
        var hadWrapped = p.classList.contains('wrapped');
        if (hadWrapped) p.classList.remove('wrapped');
        var leftTop = left.getBoundingClientRect().top;
        var rightTop = right.getBoundingClientRect().top;
        var wrapped = rightTop - leftTop > 1; // tolerance
        // Apply desired state
        p.classList.toggle('wrapped', wrapped);
        lastWrapped = wrapped;
    }
})();


