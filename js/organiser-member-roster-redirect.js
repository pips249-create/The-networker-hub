(function () {
  var params = new URLSearchParams(location.search);
  var id = params.get('id') || params.get('organiserId') || '';
  var target = '/organiser/#memberships';
  if (id) target += '?membershipGroup=' + encodeURIComponent(id);
  location.replace(target);
})();
