/**
 * Weaken a target
 * Wait for delay and then execute a weaken.
 * @param {NS} ns
 */
export async function main(ns) {
    //args[0: target, 1: delay, 2: uuid]
    const target = ns.args[0];
    const delay = ns.args.length > 1 ? ns.args[1] : 0;
    if (delay > 0) {
        await ns.sleep(delay);
    }
    if (!await ns.weaken(target)) {
        ns.toast(`Warning, weaken reduced 0 security. Might be a misfire. ${JSON.stringify(ns.args)}`, 'warning');
    }
}