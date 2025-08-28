class BackgroundAnimation {
    constructor() {
        this.backgroundContainer = document.querySelector('.background-container');
        this.images = ['background1.png', 'background2.png', 'background3.png'];
        this.imageElements = [];
        this.maxImages = 25;
        this.spawnInterval = null;
        this.spawnRate = { min: 100, max: 4200 };
        this.animationSpeed = 0.4; // pixels per frame
        this.suppressOpacityUpdates = false; // when true, update loop will not override opacity
        
        // Rotation speed parameters
        this.rotationSpeed = { min: 0.1, max: 0.3 }; // degrees per frame
        this.rotationSpeedMultiplier = 0.6; // global multiplier for all images
        
        this.animationId = null;
        
        this.init();
    }

    init() {
        this.startEmitter();
        this.startAnimation();
    }

    startEmitter() {
        this.spawnImage();
        this.scheduleNextSpawn();
    }

    scheduleNextSpawn() {
        if (this.imageElements.length < this.maxImages) {
            const delay = this.getRandomInRange(this.spawnRate.min, this.spawnRate.max);
            this.spawnInterval = setTimeout(() => {
                this.spawnImage();
                this.scheduleNextSpawn();
            }, delay);
        }
    }

    spawnImage() {
        const img = document.createElement('img');
        const randomImage = this.images[Math.floor(Math.random() * this.images.length)];
        
        img.src = `Backgrounds/${randomImage}`;
        img.className = 'background-image';
        img.alt = '';
        
        // Find a valid spawn position that's not too close to other images
        const spawnPosition = this.findValidSpawnPosition();
        if (!spawnPosition) {
            // If no valid position found, skip this spawn
            return;
        }
        
        img.style.top = `${spawnPosition.top}px`;
        img.style.left = `${spawnPosition.left}px`;
        
        // Start with 0 opacity for fade-in effect
        img.style.opacity = '0';
        
        // Random final opacity between 7% and 18%
        const finalOpacity = this.getRandomInRange(0.07, 0.48);
        
        // Add custom properties for movement
        img.dataset.x = spawnPosition.left;
        img.dataset.y = spawnPosition.top;
        img.dataset.rotation = 0;
        img.dataset.opacity = 0;
        img.dataset.finalOpacity = finalOpacity;
        img.dataset.fadeInStartTime = Date.now();
        img.dataset.fadeInDuration = 2000; // 2 seconds in milliseconds
        
        // Apply rotation speed with multiplier
        const baseRotationSpeed = this.getRandomInRange(this.rotationSpeed.min, this.rotationSpeed.max);
        img.dataset.rotationSpeed = baseRotationSpeed * this.rotationSpeedMultiplier;
        
        this.backgroundContainer.appendChild(img);
        this.imageElements.push(img);
    }

    findValidSpawnPosition() {
        const maxAttempts = 50; // Maximum attempts to find a valid position
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            const position = this.getSpawnPosition();
            
            // Check if this position is far enough from all existing images
            if (this.isPositionValid(position)) {
                return position;
            }
            
            attempts++;
        }
        
        // If no valid position found after max attempts, return null
        return null;
    }

    isPositionValid(position) {
        const minDistance = 300; // Minimum distance between images in pixels
        
        for (const img of this.imageElements) {
            const imgX = parseFloat(img.dataset.x);
            const imgY = parseFloat(img.dataset.y);
            
            // Calculate distance between positions
            const distance = Math.sqrt(
                Math.pow(position.left - imgX, 2) + 
                Math.pow(position.top - imgY, 2)
            );
            
            // If distance is less than minimum, position is invalid
            if (distance < minDistance) {
                return false;
            }
        }
        
        // Position is valid if it's far enough from all existing images
        return true;
    }

    getSpawnPosition() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const imageSize = 256;
        
        // Define two spawn zones:
        // Zone 1: Left edge - full height, completely outside screen
        // Zone 2: Bottom edge - full width, completely below screen
        
        const spawnZone = Math.random() < 0.5 ? 'left' : 'bottom';
        
        let left, top;
        
        if (spawnZone === 'left') {
            // Zone 1: Left edge spawn
            // Spawn completely to the left of screen (negative positions)
            left = this.getRandomInRange(-imageSize, -imageSize + 100);
            // Spawn along entire height of screen
            top = this.getRandomInRange(-imageSize/2, screenHeight + imageSize/2);
        } else {
            // Zone 2: Bottom edge spawn
            // Spawn along entire width of screen
            left = this.getRandomInRange(-imageSize/2, screenWidth + imageSize/2);
            // Spawn completely below screen (below screenHeight)
            top = this.getRandomInRange(screenHeight, screenHeight + imageSize);
        }
        
        return { left, top };
    }

    getRandomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    startAnimation() {
        const animate = () => {
            this.updatePositions();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    updatePositions() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const imageSize = 256;
        const currentTime = Date.now();
        
        this.imageElements.forEach((img, index) => {
            // Get current position
            let x = parseFloat(img.dataset.x);
            let y = parseFloat(img.dataset.y);
            let rotation = parseFloat(img.dataset.rotation);
            const rotationSpeed = parseFloat(img.dataset.rotationSpeed);
            
            // Handle fade-in opacity animation (skip when globally fading out)
            if (!this.suppressOpacityUpdates) {
                const fadeInStartTime = parseFloat(img.dataset.fadeInStartTime);
                const fadeInDuration = parseFloat(img.dataset.fadeInDuration);
                const finalOpacity = parseFloat(img.dataset.finalOpacity);
                const elapsedTime = currentTime - fadeInStartTime;
                
                if (elapsedTime < fadeInDuration) {
                    // Still in fade-in phase
                    const opacity = Math.min(finalOpacity, elapsedTime / fadeInDuration * finalOpacity);
                    img.style.opacity = opacity;
                    img.dataset.opacity = opacity;
                } else {
                    // Fade-in complete, set to individual final opacity
                    img.style.opacity = finalOpacity;
                    img.dataset.opacity = finalOpacity;
                }
            }
            
            // Update position - move diagonally up and right
            x += this.animationSpeed;
            y -= this.animationSpeed * 0.8; // Slightly slower upward movement
            
            // Update rotation
            rotation += rotationSpeed;
            
            // Update DOM element
            img.style.left = `${x}px`;
            img.style.top = `${y}px`;
            img.style.transform = `rotate(${rotation}deg)`;
            
            // Update stored values
            img.dataset.x = x;
            img.dataset.y = y;
            img.dataset.rotation = rotation;
            
            // Remove if image is completely off screen
            if (x > screenWidth + imageSize || y < -imageSize) {
                this.removeImage(img);
            }
        });
    }

    // Smoothly fade out all existing images with randomized durations; returns a Promise
    startGlobalFadeOut(minMs = 500, maxMs = 1000) {
        this.pause(); // stop spawning new images
        this.suppressOpacityUpdates = true; // allow CSS transitions to control opacity
        const fades = [];
        this.imageElements.forEach((img) => {
            const dur = Math.max(minMs, Math.min(maxMs, Math.floor(this.getRandomInRange(minMs, maxMs))));
            // set transition only for opacity to avoid affecting transforms from animation
            img.style.transition = 'opacity ' + dur + 'ms ease-out';
            // force reflow to ensure transition applies
            void img.offsetWidth; // reflow
            img.style.opacity = '0';
            fades.push(new Promise((resolve) => {
                let done = false;
                const cleanup = () => { if (done) return; done = true; resolve(); };
                const onEnd = (ev) => { if (ev.propertyName === 'opacity') { img.removeEventListener('transitionend', onEnd); cleanup(); } };
                img.addEventListener('transitionend', onEnd);
                setTimeout(cleanup, dur + 50);
            }));
        });
        return Promise.all(fades);
    }

    removeImage(img) {
        if (img.parentNode) {
            img.parentNode.removeChild(img);
        }
        const index = this.imageElements.indexOf(img);
        if (index > -1) {
            this.imageElements.splice(index, 1);
        }
        
        // If we're below max images, schedule next spawn
        if (this.imageElements.length < this.maxImages) {
            this.scheduleNextSpawn();
        }
    }

    // Method to refresh animation
    refresh() {
        // Clear all existing images
        this.imageElements.forEach(img => {
            if (img.parentNode) {
                img.parentNode.removeChild(img);
            }
        });
        this.imageElements = [];
        
        // Restart emitter
        this.startEmitter();
    }

    // Method to change spawn rate
    setSpawnRate(minMs, maxMs) {
        this.spawnRate = { min: minMs, max: maxMs };
    }

    // Method to change animation speed
    setSpeed(speed) {
        this.animationSpeed = speed;
    }

    // Method to change rotation speed range
    setRotationSpeedRange(min, max) {
        this.rotationSpeed = { min, max };
        // Update existing images with new rotation speeds
        this.imageElements.forEach(img => {
            const baseRotationSpeed = this.getRandomInRange(this.rotationSpeed.min, this.rotationSpeed.max);
            img.dataset.rotationSpeed = baseRotationSpeed * this.rotationSpeedMultiplier;
        });
    }

    // Method to change global rotation speed multiplier
    setRotationSpeedMultiplier(multiplier) {
        this.rotationSpeedMultiplier = multiplier;
        // Update existing images with new multiplier
        this.imageElements.forEach(img => {
            const currentBaseSpeed = parseFloat(img.dataset.rotationSpeed) / (this.rotationSpeedMultiplier / multiplier);
            img.dataset.rotationSpeed = currentBaseSpeed * this.rotationSpeedMultiplier;
        });
    }

    // Method to get current rotation speed settings
    getRotationSpeedSettings() {
        return {
            range: { ...this.rotationSpeed },
            multiplier: this.rotationSpeedMultiplier
        };
    }

    // Method to change number of images
    setImageCount(count) {
        this.maxImages = count;
        if (this.imageElements.length < count) {
            this.scheduleNextSpawn();
        }
    }

    // Method to pause/resume spawning
    pause() {
        if (this.spawnInterval) {
            clearTimeout(this.spawnInterval);
            this.spawnInterval = null;
        }
    }

    resume() {
        if (!this.spawnInterval && this.imageElements.length < this.maxImages) {
            this.scheduleNextSpawn();
        }
    }

    // Method to pause/resume animation
    pauseAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    resumeAnimation() {
        if (!this.animationId) {
            this.startAnimation();
        }
    }

    // Cleanup method
    destroy() {
        this.pause();
        this.pauseAnimation();
        this.imageElements.forEach(img => {
            if (img.parentNode) {
                img.parentNode.removeChild(img);
            }
        });
        this.imageElements = [];
    }
}

// Initialize animation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const backgroundAnimation = new BackgroundAnimation();
    
    // Expose to global scope for debugging/testing
    window.backgroundAnimation = backgroundAnimation;
    
    // Log available methods for easy access
    console.log('Background Animation Controls:');
    console.log('- window.backgroundAnimation.setSpeed(speed) - Change movement speed');
    console.log('- window.backgroundAnimation.setRotationSpeedRange(min, max) - Change rotation speed range');
    console.log('- window.backgroundAnimation.setRotationSpeedMultiplier(multiplier) - Change global rotation speed');
    console.log('- window.backgroundAnimation.getRotationSpeedSettings() - Get current rotation settings');
});
