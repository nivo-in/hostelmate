const fs = require('fs');
function replaceInFile(file, search, replace) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(search, replace);
  fs.writeFileSync(file, content);
}
replaceInFile(
  'src/config/curfewJob.js',
  'catch (error) {\n    \n  }',
  'catch (error) {\n    // ignore\n  }'
);
replaceInFile(
  'src/middleware/errorHandler.js',
  'function errorHandler(err, req, res, next)',
  'function errorHandler(err, req, res, _next)'
);
replaceInFile('src/routes/curfew.js', "const logger = require('../config/logger')\n", '');
replaceInFile(
  'src/routes/notifications.js',
  'async (req, res, next) => {',
  'async (req, res, _next) => {'
);
replaceInFile(
  'src/routes/notifications.js',
  'async (req, res, next) => {',
  'async (req, res, _next) => {'
); // 2nd
replaceInFile(
  'src/routes/notifications.js',
  'async (req, res, next) => {',
  'async (req, res, _next) => {'
); // 3rd
replaceInFile('src/routes/payments.js', ', requireStudent', '');
replaceInFile('src/routes/payments.js', 'const today = new Date()', '');
replaceInFile('src/routes/rooms.js', "const logger = require('../config/logger')\n", '');
replaceInFile(
  'src/routes/staff-feedback.js',
  'const { requireAuth, requireWarden }',
  'const { requireAuth }'
);
