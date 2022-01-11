/**
 * Weaken a target
 * Wait for delay and then execute a weaken.
 * @param {NS} ns
 */
export async function main(ns) {
    //args[0: target, 1: delay, 2: uuid, 3: stock (no effect), 4: toast]
    const target = ns.args[0]
    const delay = ns.args.length > 1 ? ns.args[1] : 0
    const toast = (ns.args.length > 4 && ns.args[4])
    if (delay > 0) {
        await ns.sleep(delay)
    }
    const amount = await ns.weaken(target);
    if (amount) {
        if (toast) {
            ns.toast(`WEAKEN ${target} reduced ${ns.nFormat(amount, '0.0a')} security! ${JSON.stringify(ns.args)}`, 'success')
        }
    } else {
        ns.toast(`WEAKEN ${target} reduced 0 security. Might be a misfire. ${JSON.stringify(ns.args)}`, 'warning')
    }
}