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
    dataUrl: 'Build/e71a79b8cf395587d56fd3b671453b9d.data.unityweb',
    frameworkUrl: 'Build/b29ce343cdade66af5e28ecff76d5bf8.framework.js.unityweb',
    codeUrl: 'Build/c0d44600385cf4661dd4a973b82cf2b1.wasm.unityweb',
    streamingAssetsUrl: 'StreamingAssets',
    companyName: 'Mostly Works',
    productName: 'Eeh! Aah, Ooh!',
    productVersion: '1.0.0'
  }, function(progress) {
    // feeds the thin bar under the Play button
    if (typeof window.webgameSetProgress === 'function') window.webgameSetProgress(progress);
  }).then(function(unityInstance) {
    window.unityInstance = unityInstance;
    if (typeof window.webgameSetProgress === 'function') window.webgameSetProgress(1);
    if (typeof window.webgameOnInstanceReady === 'function') window.webgameOnInstanceReady(unityInstance);
  }).catch(function(message) {
    alert(message);
  });
})();
