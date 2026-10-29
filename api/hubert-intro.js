const { wrapHandler } = require('./_lib/sentry');
module.exports = wrapHandler(require('./_lib/routes/hubert-intro'));
