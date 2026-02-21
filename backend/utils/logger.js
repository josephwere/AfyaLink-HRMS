// Simple centralized logger - can be replaced by Winston/Sentry in production
import util from 'util';
function timestamp(){ return new Date().toISOString(); }
function formatArgs(args){ return args.map(a => (typeof a === 'string' ? a : util.inspect(a, {depth:2}))).join(' '); }
export default {
  log: (...args) => console.log(`[INFO] ${timestamp()} -`, formatArgs(args)),
  info: (...args) => console.log(`[INFO] ${timestamp()} -`, formatArgs(args)),
  warn: (...args) => console.warn(`[WARN] ${timestamp()} -`, formatArgs(args)),
  error: (...args) => console.error(`[ERROR] ${timestamp()} -`, formatArgs(args)),
};
// Monkey patch console to use standardized prefixes (safe approach)
const origLog = console.log;
console.log = (...args) => { origLog(`[LOG ${new Date().toISOString()}]`, ...args); };
const origErr = console.error;
console.error = (...args) => { origErr(`[ERR ${new Date().toISOString()}]`, ...args); };
