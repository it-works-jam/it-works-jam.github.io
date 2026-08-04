(function() {
  // Keep a single viewport meta and never lose viewport-fit=cover: without it
  // iOS keeps the layout viewport clear of the notch in landscape, which shows
  // as bars of page background down both sides of the game.
  var viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.name = 'viewport';
    document.getElementsByTagName('head')[0].appendChild(viewport);
  }
  viewport.setAttribute('content',
    'width=device-width, height=device-height, initial-scale=1.0, ' +
    'user-scalable=no, shrink-to-fit=yes, viewport-fit=cover');

  createUnityInstance(document.querySelector('#unity-canvas'), {
    arguments: [],
    dataUrl: 'Build/NeverAlone.data.unityweb',
    frameworkUrl: 'Build/NeverAlone.framework.js.unityweb',
    codeUrl: 'Build/NeverAlone.wasm.unityweb',
    streamingAssetsUrl: 'StreamingAssets',
    companyName: 'BarelyWorks',
    productName: 'NeverAlone',
    productVersion: '0.1'
  }, function(progress) {
    // feeds the thin bar under the Play button
    if (typeof window.webgameSetProgress === 'function') window.webgameSetProgress(progress);
  }).then(function(unityInstance) {
    window.unityInstance = unityInstance;
    if (typeof window.webgameSetProgress === 'function') window.webgameSetProgress(1);
    if (typeof window.webgameOnInstanceReady === 'function') window.webgameOnInstanceReady(unityInstance);
    // this build does not call window.engineLoaded() from inside the game, so
    // the finished instance is the ready signal - a beat later, to let the
    // first frame draw before the loading screen goes away
    setTimeout(function() {
      if (typeof window.webgameMarkEngineReady === 'function') window.webgameMarkEngineReady();
    }, 800);
  }).catch(function(message) {
    alert(message);
  });
})();

