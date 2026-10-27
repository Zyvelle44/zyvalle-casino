(function () {
  var ua = navigator.userAgent || '';
  var mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  window.WURFL = {
    complete_device_name: ua,
    is_mobile: mobile,
    form_factor: mobile ? 'Smartphone' : 'Desktop'
  };
})();
