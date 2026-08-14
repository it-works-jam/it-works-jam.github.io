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
    dataUrl: 'Build/Web.data.unityweb',
    frameworkUrl: 'Build/Web.framework.js.unityweb',
    codeUrl: 'Build/Web.wasm.unityweb',
    streamingAssetsUrl: 'StreamingAssets',
    companyName: 'ItWorks!',
    productName: 'Devil’s in Detail',
    productVersion: '0.1.1'
  }, function(progress) {
    // feeds the thin bar under the Play button
    if (typeof window.webgameSetProgress === 'function') window.webgameSetProgress(progress);
  }).then(function(unityInstance) {
    window.unityInstance = unityInstance;
    if (typeof window.webgameSetProgress === 'function') window.webgameSetProgress(1);
    if (typeof window.webgameOnInstanceReady === 'function') window.webgameOnInstanceReady(unityInstance);
    // This build does not call the optional engineLoaded() bridge used by Jam 7.
    // A resolved Unity instance is ready to be revealed after the user presses Play.
    if (typeof window.webgameMarkEngineReady === 'function') window.webgameMarkEngineReady();
  }).catch(function(message) {
    alert(message);
  });
})();
