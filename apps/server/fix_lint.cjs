const fs = require('fs');

function replaceInFileRegex(file, search, replace) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(search, replace);
  fs.writeFileSync(file, content);
}

replaceInFileRegex('src/config/curfewJob.js', /catch \(error\) \{\s*\}/g, 'catch (error) { /* ignore */ }');
replaceInFileRegex('src/middleware/errorHandler.js', 'function errorHandler(err, req, res, next)', 'function errorHandler(err, req, res, _next)');
replaceInFileRegex('src/routes/curfew.js', /import logger from '\.\.\/config\/logger\.js'\n/g, '');
replaceInFileRegex('src/routes/notifications.js', /async \(req, res, next\)/g, 'async (req, res)');
replaceInFileRegex('src/routes/payments.js', /, requireStudent/g, '');
replaceInFileRegex('src/routes/payments.js', /let query = supabaseAdmin/g, 'const query = supabaseAdmin');
replaceInFileRegex('src/routes/payments.js', /const today = new Date\(\)/g, '');
replaceInFileRegex('src/routes/rooms.js', /import logger from '\.\.\/config\/logger\.js'\n/g, '');
replaceInFileRegex('src/routes/staff-feedback.js', /const \{ requireAuth, requireWarden \}/g, 'const { requireAuth }');
