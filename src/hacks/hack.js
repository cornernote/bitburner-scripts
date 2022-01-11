/**
 * Hack a target
 * Wait for delay and then execute a hack.
 * @param {NS} ns
 */
export async function main(ns) {
    //args[0: target, 1: delay, 2: uuid, 3: stock, 4: toast]
    const target = ns.args[0]
    const delay = ns.args.length > 1 ? ns.args[1] : 0
    const stock = (ns.args.length > 3 && ns.args[3])
    const toast = (ns.args.length > 4 && ns.args[4])
    if (delay > 0) {
        await ns.sleep(delay)
    }
    const amount = await ns.hack(target, {stock: stock});
    if (amount) {
        if (toast) {
            ns.toast(`HACK ${target} stole ${ns.nFormat(amount, '$0.0a')} money! ${JSON.stringify(ns.args)}`, 'success')
        }
    } else {
        ns.toast(`HACK ${target} stole 0 money. Might be a misfire. ${JSON.stringify(ns.args)}`, 'warning')
    }
}