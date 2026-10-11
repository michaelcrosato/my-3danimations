// Placeholder for a script whose WP has not landed yet: says which WP brings it and exits 2.
const [script, wp] = process.argv.slice(2);
process.stdout.write(`${script}: not built yet; it arrives in ${wp} (PLAN.md §10)\nnext: work the ledger up to ${wp}\n`);
process.exit(2);
