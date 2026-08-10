(function() {
    var constraints = {
        channelCount: { ideal: 1 },
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true }
    };

    var state = {
        status: 'idle',
        error: null,
        promise: null,
        revision: 0,
        requestSerial: 0,
        interactiveRequest: false
    };
    window.__wgMicrophonePreflight = state;

    function setStatus(status, error) {
        state.status = status;
        state.error = error || null;
        state.revision++;
    }

    function statusForError(error) {
        var name = error && error.name ? error.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' ||
            name === 'SecurityError') return 'denied';
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError' ||
            name === 'OverconstrainedError') return 'no-device';
        return 'error';
    }

    function stopTracks(stream) {
        if (!stream || !stream.getTracks) return;
        var tracks = stream.getTracks();
        for (var i = 0; i < tracks.length; i++) tracks[i].stop();
    }

    function request(options) {
        options = options || {};

        if (!window.isSecureContext || !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {
            setStatus('unsupported', new Error('Microphone requires HTTPS'));
            return Promise.resolve(state);
        }

        if (state.status === 'granted') return Promise.resolve(state);
        if (state.status === 'requesting' && state.promise) {
            // A page-load request can still be pending when Play is clicked.
            // Start the fallback immediately while the click's user activation is
            // alive; waiting for the old Promise would lose that activation.
            if (!options.retry || state.interactiveRequest) return state.promise;
        }
        if (state.status === 'denied' && !options.retry) return Promise.resolve(state);
        if (state.status === 'deferred' && !options.retry) return Promise.resolve(state);

        var interactiveAttempt = options.retry === true;
        var requestSerial = ++state.requestSerial;
        state.interactiveRequest = interactiveAttempt;
        setStatus('requesting');
        var mediaRequest;
        try {
            mediaRequest = navigator.mediaDevices.getUserMedia({
                audio: constraints,
                video: false
            });
        } catch (error) {
            if (requestSerial === state.requestSerial) {
                setStatus(interactiveAttempt ? statusForError(error) : 'deferred', error);
                state.interactiveRequest = false;
            }
            return Promise.resolve(state);
        }

        var requestPromise = mediaRequest.then(function(stream) {
            // This is only a permission preflight. The Unity bridge opens a fresh
            // stream when gameplay actually needs it, so the privacy indicator is
            // not left on behind the cover screen.
            stopTracks(stream);
            if (requestSerial === state.requestSerial) setStatus('granted');
            return state;
        }, function(error) {
            // Some browsers suppress permission prompts issued during page load.
            // Keep voice enabled and retry from the Play gesture before treating
            // that early rejection as the player's final answer.
            if (requestSerial === state.requestSerial)
                setStatus(interactiveAttempt ? statusForError(error) : 'deferred', error);
            return state;
        });

        state.promise = requestPromise;
        requestPromise.then(function() {
            if (state.promise === requestPromise) {
                state.promise = null;
                state.interactiveRequest = false;
            }
        });
        return requestPromise;
    }

    window.webgameRequestMicrophonePermission = request;

    // Ask as soon as the top-level page opens, before Unity finishes downloading
    // and before the player reaches the Play button.
    request();
})();
