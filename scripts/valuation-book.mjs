import {readFile,stat} from 'node:fs/promises';
import {runValuationBook} from '../src/valuation-book.mjs';
async function read(path) {
  if ((await stat(path)).size > 8*1024*1024) throw new Error('INPUT_SIZE');
  return JSON.parse(await readFile(path,'utf8'));
}
try {
  const args = process.argv.slice(2);
  const html = args.at(-1) === '--html';
  if (html) args.pop();
  if (args.length < 3 || args.length > 4) throw new Error('Expected SCENARIO BINDINGS HISTORIES [AS_OF_UTC] [--html]');
  const [scenario,bindings,history,at] = args;
  if (!history) throw new Error('Usage: node scripts/valuation-book.mjs SCENARIO BINDINGS HISTORIES [AS_OF_UTC]');
  const file = await read(history);
  const chains = !Array.isArray(file) ? [[file]] : Array.isArray(file[0]) ? file : [file];
  const result = runValuationBook(await read(scenario),await read(bindings),chains,at);
  if (html) console.log((await import('../src/valuation-report.mjs')).valuationReport(result));
  else console.log(JSON.stringify(result,null,2));
} catch (e) { console.error(e.message); process.exitCode = 1; }
