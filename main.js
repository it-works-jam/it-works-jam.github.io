(function() {
    // Basic iPhone detection (covers simulators as well)
    var isIPhoneDevice = /iPhone/i.test(navigator.userAgent) ||
        (navigator.platform && /iPhone/.test(navigator.platform));
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
            // In portrait: keep natural size, but on iPhone reduce to 87%
            var portraitScale = isIPhoneDevice ? 0.87 : 1;
            if (portraitScale !== 1) {
                container.style.transform = 'translate(-50%, -50%) scale(' + portraitScale + ')';
            } else {
                container.style.transform = 'translate(-50%, -50%)';
            }
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
            // Ensure we add 'loaded' only after 'no-anim' is fully cleared
            function addLoadedWhenReady() {
                if (document.body.classList.contains('no-anim')) {
                    requestAnimationFrame(addLoadedWhenReady);
                } else {
                    requestAnimationFrame(function(){ document.body.classList.add('loaded'); });
                }
            }
            requestAnimationFrame(addLoadedWhenReady);
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

// Floating button: apply random Google Font across the page on each click
(function() {
    // Respect global toggle. If body has data-float-btn="off", fully disable logic
    var bodyEl = document.body;
    var floatDisabled = bodyEl && bodyEl.getAttribute('data-float-btn') === 'off';
    if (floatDisabled) {
        // Ensure label is cleared if any
        var labelEl = document.querySelector('.float-f-label');
        if (labelEl) { labelEl.textContent = ''; }
    }
    // Optional: if you have a Google Webfonts API key, set it here to fetch live fonts
    // Otherwise, a curated fallback list of Latin-supporting Google Fonts will be used
    var GOOGLE_WEBFONTS_API_KEY = "AIzaSyCtLJ3vKpooEXcLuS05k4H2CnxacIcj9do"; // e.g., "YOUR_API_KEY" or leave null to use fallback list

    var fontsCache = null;

    var fallbackFonts = [
        "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
        "Source Sans 3", "Nunito", "Playfair Display", "Oswald", "Raleway",
        "Merriweather", "Work Sans", "Rubik", "Noto Sans", "Noto Serif",
        "Quicksand", "Fira Sans", "Kanit", "Manrope", "Josefin Sans",
        "Arimo", "Bebas Neue", "Abril Fatface", "Caveat", "DM Sans",
        "DM Serif Display", "Pacifico", "Cinzel", "Titillium Web", "PT Sans",
        "PT Serif", "IBM Plex Sans", "Space Grotesk", "Urbanist", "Mulish",
        "Asap", "Barlow", "Varela Round", "Zilla Slab", "Crimson Text",
        "Sora", "Heebo", "League Spartan", "Anton"
    ];

    function encodeFamily(family) {
        return family.trim().replace(/\s+/g, '+');
    }

    function fetchFontsList() {
        if (fontsCache) return Promise.resolve(fontsCache);
        if (GOOGLE_WEBFONTS_API_KEY) {
            var url = 'https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=' + encodeURIComponent(GOOGLE_WEBFONTS_API_KEY);
            return fetch(url)
                .then(function(r){ return r.json(); })
                .then(function(d){
                    var list = (d.items || [])
                        .filter(function(it){ return (it.subsets || []).indexOf('latin') !== -1; })
                        .map(function(it){ return it.family; });
                    fontsCache = list && list.length ? list : fallbackFonts.slice();
                    return fontsCache;
                })
                .catch(function(){ return fallbackFonts.slice(); });
        }
        return Promise.resolve(fallbackFonts.slice());
    }

    function pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function ensureLinkForFont(family) {
        var id = 'dynamic-google-font';
        var href = 'https://fonts.googleapis.com/css2?family=' + encodeFamily(family) + ':wght@400;600;700&display=swap';
        var existing = document.getElementById(id);
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        var link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);

        return new Promise(function(resolve){
            var done = false;
            function finish(){ if (done) return; done = true; resolve(); }
            if (document.fonts && document.fonts.load) {
                Promise.all([
                    document.fonts.load('400 1rem "' + family + '"'),
                    document.fonts.load('700 1rem "' + family + '"')
                ]).then(function(){ finish(); }).catch(function(){ finish(); });
                setTimeout(finish, 1500);
            } else {
                link.addEventListener('load', function(){ finish(); });
                setTimeout(finish, 1500);
            }
        });
    }

    function applyGlobalFont(family) {
        var id = 'dynamic-font-override';
        var style = document.getElementById(id);
        var css = '* { font-family: "' + family.replace(/\"/g, '\\"') + '", sans-serif !important; }';
        if (!style) {
            style = document.createElement('style');
            style.id = id;
            style.type = 'text/css';
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
        } else {
            style.textContent = css;
        }
        // Update label text if present
        var label = document.querySelector('.float-f-label');
        if (label) {
            label.textContent = family;
        }
    }

    function triggerLayoutRecalc() {
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
        var container = document.querySelector('.container');
        if (container) {
            var prev = container.style.transform;
            container.style.transform = prev ? prev + ' ' : 'translate(-50%, -50%)';
            requestAnimationFrame(function(){ container.style.transform = prev; });
        }
    }

    function loadRandomGoogleFont() {
        return fetchFontsList().then(function(list){
            var family = pickRandom(list);
            console.log('[ƒ] Applying font:', family);
            return ensureLinkForFont(family).then(function(){
                applyGlobalFont(family);
                triggerLayoutRecalc();
            });
        });
    }

    // Delegate click so it works even if the button is added after scripts
    var isNavigating = false;
    document.addEventListener('click', function(e) {
        if (floatDisabled) {
            // Skip float button behavior entirely
        } else {
        var btnTarget = e.target && e.target.closest && e.target.closest('.float-f-btn');
        if (btnTarget) {
            console.log('[ƒ] Floating button clicked');
            loadRandomGoogleFont();
            return;
        }
        }

        var cta = e.target && e.target.closest && e.target.closest('.cta');
        if (!cta) return;
        // Intercept CTA navigation to run background fade sequence
        e.preventDefault();
        if (isNavigating) return;
        isNavigating = true;
        // Animate main container flying down, scaling and fading over 1s ease-in-back
        var containerPromise = (function(){
            try {
                var containerEl = document.querySelector('.container');
                if (!containerEl) return Promise.resolve();
                // Ensure global no-anim flag is cleared so transitions are not disabled by CSS
                document.body.classList.remove('no-anim');
                // Force reflow after class change
                void document.body.offsetWidth;
                
                // Get current transform value
                var currentTransform = window.getComputedStyle(containerEl).transform;
                var baseTransform = 'translate(-50%, -50%)';
                
                // If there's a scale applied, extract it
                if (containerEl.style.transform && containerEl.style.transform.includes('scale')) {
                    var scaleMatch = containerEl.style.transform.match(/scale\(([^)]+)\)/);
                    if (scaleMatch) {
                        baseTransform = 'translate(-50%, -50%) scale(' + scaleMatch[1] + ')';
                    }
                }
                
                var easing = 'cubic-bezier(0.6, -0.28, 0.735, 0.045)';
                var duration = 1000;
                
                // Ensure starting state is committed
                containerEl.style.willChange = 'transform, opacity';
                
                // Get current opacity
                var currentOpacity = window.getComputedStyle(containerEl).opacity;
                
                // Remove any existing transitions
                containerEl.style.transition = 'none';
                containerEl.style.opacity = currentOpacity;
                containerEl.style.transform = baseTransform;
                
                // Force reflow to commit initial state
                void containerEl.offsetWidth;
                
                // Set up the animation
                return new Promise(function(resolve){
                    var done = false;
                    var transitionCount = 0;
                    var expectedTransitions = 2; // opacity and transform
                    
                    var cleanup = function(){ 
                        if (done) return; 
                        done = true; 
                        containerEl.removeEventListener('transitionend', onEnd);
                        resolve(); 
                    };
                    
                    var onEnd = function(ev){
                        if (ev.target !== containerEl) return;
                        if (ev.propertyName === 'transform' || ev.propertyName === 'opacity') {
                            transitionCount++;
                            if (transitionCount >= expectedTransitions) {
                                cleanup();
                            }
                        }
                    };
                    
                    containerEl.addEventListener('transitionend', onEnd);
                    
                    // Apply transition and target values
                    requestAnimationFrame(function(){
                        // Set transition for both properties
                        containerEl.style.transition = 'transform ' + duration + 'ms ' + easing + ', opacity ' + duration + 'ms ' + easing;
                        
                        // Apply final values
                        containerEl.style.opacity = '0';
                        // Combine all transforms: base position + additional animation
                        containerEl.style.transform = 'translate(-50%, calc(-50% + 150vh)) scale(1.1)';
                    });
                    
                    // Fallback timeout
                    setTimeout(cleanup, duration + 100);
                });
            } catch (err) {
                console.error('Container animation error:', err);
                return Promise.resolve();
            }
        })();
        try {
            var bg = window.backgroundAnimation;
            if (bg && typeof bg.startGlobalFadeOut === 'function') {
                var bgPromise = bg.startGlobalFadeOut(500, 1000);
                Promise.all([bgPromise, containerPromise]).then(function(){ window.location.href = cta.href; });
            } else {
                // Fallback: wait for container animation only
                containerPromise.then(function(){ window.location.href = cta.href; });
            }
        } catch (err) {
            window.location.href = cta.href;
        }
    }, { passive: false });

    // Touch-and-hold to reveal label after 2s on mobile
    (function(){
        var wrap = document.querySelector('.float-f-wrap');
        if (!wrap) return;
        if (floatDisabled) return; // do not attach touch handlers when disabled
        var holdTimer = null;
        var start = function() {
            clearTimeout(holdTimer);
            holdTimer = setTimeout(function(){
                wrap.classList.add('show-label');
            }, 2000);
        };
        var end = function() {
            clearTimeout(holdTimer);
            wrap.classList.remove('show-label');
        };
        wrap.addEventListener('touchstart', function(ev){ start(); }, { passive: true });
        wrap.addEventListener('touchend', function(ev){ end(); }, { passive: true });
        wrap.addEventListener('touchcancel', function(ev){ end(); }, { passive: true });
        // If user moves finger significantly, cancel
        wrap.addEventListener('touchmove', function(ev){ if (ev.touches && ev.touches.length) { /* keep */ } }, { passive: true });
    })();
})();
