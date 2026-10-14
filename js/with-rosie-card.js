(function () {
  var button = document.getElementById('with-rosie-print');
  if (!button) return;
  button.addEventListener('click', function () {
    window.print();
  });
})();
