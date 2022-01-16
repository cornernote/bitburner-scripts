/**
 * Grow a target
 * Wait for delay and then execute a grow.
 * @param {NS} ns
 */
export async function main(ns) {
    //args[0: target, 1: delay, 2: uuid, 3: stock, 4: tprint, 5: toast]
    const target = ns.args[0]
    const delay = ns.args.length > 1 ? ns.args[1] : 0
    const stock = (ns.args.length > 3 && ns.args[3])
    const tprint = (ns.args.length > 4 && ns.args[4])
    const toast = (ns.args.length > 5 && ns.args[5])
    if (delay > 0) {
        await ns.sleep(delay)
    }
    const amount = await ns.grow(target, {stock: stock})
    if (tprint) {
        if (amount) {
            ns.tprint(`GROW ${target} increased x${ns.nFormat(amount, '0.00a')} money! ${JSON.stringify(ns.args)}`)
        } else {
            ns.tprint(`GROW ${target} increased x0 money. ${JSON.stringify(ns.args)}`)
        }
    }
    if (toast) {
        if (amount) {
            ns.toast(`GROW ${target} increased x${ns.nFormat(amount, '0.00a')} money! ${JSON.stringify(ns.args)}`, 'success')
        } else {
            ns.toast(`GROW ${target} increased x0 money. ${JSON.stringify(ns.args)}`, 'warning')
        }
    }
}