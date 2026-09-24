const { wrapHandler } = require('./_lib/sentry');
module.exports = wrapHandler(require('./_lib/routes/email-review'));
