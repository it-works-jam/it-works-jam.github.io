(function() {
  // Ensure viewport meta is present for mobile scaling
  if (!document.querySelector('meta[name="viewport"][content*="height=device-height"]')) {
    var meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, shrink-to-fit=yes';
    document.getElementsByTagName('head')[0].appendChild(meta);
  }

  createUnityInstance(document.querySelector('#unity-canvas'), {
    arguments: [],
    dataUrl: 'Build/Web.data.unityweb',
    frameworkUrl: 'Build/Web.framework.js.unityweb',
    codeUrl: 'Build/Web.wasm.unityweb',
    streamingAssetsUrl: 'StreamingAssets',
    companyName: 'ItWorks!',
    productName: 'Devil’s in Detail',
    productVersion: '0.1.0'
  }).then(function(unityInstance) {
  }).catch(function(message) {
    alert(message);
  });
})();


