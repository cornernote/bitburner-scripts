/**
 * Weaken a target
 * Wait for delay and then execute a weaken.
 * @param {NS} ns
 */
export async function main(ns) {
    //args[0: target, 1: delay, 2: uuid, 3: stock (no effect), 4: tprint, 5: toast]
    const target = ns.args[0]
    const delay = ns.args.length > 1 ? ns.args[1] : 0
    const tprint = (ns.args.length > 4 && ns.args[4])
    const toast = (ns.args.length > 5 && ns.args[5])
    if (delay > 0) {
        await ns.sleep(delay)
    }
    // weaken()
    const amount = await ns.weaken(target);
    // write data to a port for stats collection
    await ns.writePort(1, JSON.stringify({target: target, action: 'weaken', amount: amount}))
    // tprint the message
    if (tprint) {
        if (amount) {
            ns.tprint(`WEAKEN ${target} reduced ${ns.nFormat(amount, '0.0a')} security! ${JSON.stringify(ns.args)}`)
        } else {
            ns.tprint(`WEAKEN ${target} reduced 0 security. ${JSON.stringify(ns.args)}`)
        }
    }
    // toast the message
    if (toast) {
        if (amount) {
            ns.toast(`WEAKEN ${target} reduced ${ns.nFormat(amount, '0.0a')} security! ${JSON.stringify(ns.args)}`, 'success')
        } else {
            ns.toast(`WEAKEN ${target} reduced 0 security. ${JSON.stringify(ns.args)}`, 'warning')
        }
    }
}