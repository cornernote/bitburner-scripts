/**
 * Hack a target
 * Wait for delay and then execute a hack.
 * @param {NS} ns
 */
export async function main(ns) {
    //args[0: target, 1: delay, 2: uuid, 3: stock]
    const target = ns.args[0]
    const delay = ns.args.length > 1 ? ns.args[1] : 0
    const stock = (ns.args.length > 3 && ns.args[3])
    if (delay > 0) {
        await ns.sleep(delay)
    }
    if (!await ns.hack(target, {stock: stock})) {
        ns.toast(`Warning, hack stole 0 money. Might be a misfire. ${JSON.stringify(ns.args)}`, 'warning')
    }
}