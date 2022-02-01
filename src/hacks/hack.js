/**
 * Hack a target
 * Wait for delay and then execute a hack.
 * @param {NS} ns
 */
export async function main(ns) {
    //args[0: target, 1: delay, 2: uuid, 3: stock, 4: tprint, 5: host, 6: threads]
    const target = /** @type string */ ns.args[0]
    const delay = ns.args.length > 1 ? ns.args[1] : 0
    const stock = (ns.args.length > 3 && ns.args[3])
    const tprint = (ns.args.length > 4 && ns.args[4])
    const host = ns.args.length > 5 ? ns.args[5] : 'unknown'
    const threads = ns.args.length > 6 ? ns.args[6] : 'unknown'
    if (delay > 0) {
        await ns.sleep(delay)
    }
    // hack()
    const amount = await ns.hack(target, {stock: stock});
    // write data to a port for stats collection
    await ns.writePort(1, JSON.stringify({target: target, action: 'hack', amount: amount}))
    // build a message
    const message = amount
        ? `INFO: HACK ${target} stole ${ns.nFormat(amount, '$0.0a')} money! ${JSON.stringify(ns.args)}`
        : `WARNING: HACK ${target} stole 0 money. ${JSON.stringify(ns.args)}`
    // tprint the message
    if (tprint) {
        ns.tprint(message)
    }
}