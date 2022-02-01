/**
 * Check a target
 * Wait for delay and then check the target.
 * @param {NS} ns
 */
export async function main(ns) {
    //args[0: target, 1: delay, 2: uuid, 3: stock (no effect), 4: tprint, 5: host, 6: threads]
    const target = /** @type string */ ns.args[0]
    const delay = ns.args.length > 1 ? ns.args[1] : 0
    const tprint = (ns.args.length > 4 && ns.args[4])
    const host = ns.args.length > 5 ? ns.args[5] : 'unknown'
    const threads = ns.args.length > 6 ? ns.args[6] : 'unknown'
    if (delay > 0) {
        await ns.sleep(delay)
    }
    // get server info, cheaper than getServer
    const check = {
        moneyAvailable: ns.getServerMoneyAvailable(target),
        moneyMax: ns.getServerMaxMoney(target),
        hackDifficulty: ns.getServerSecurityLevel(target),
        minDifficulty: ns.getServerMinSecurityLevel(target),
    }
    // write data to a port for stats collection
    await ns.writePort(1, JSON.stringify({target: target, action: 'info', check: check}))
    // build a message
    const status = check.hackDifficulty > check.minDifficulty + 1 || check.moneyAvailable < check.moneyMax * 0.9
        ? 'WARNING:'
        : 'INFO:'
    const message = [
        `${status} CHECK ${target}`,
        `money=${ns.nFormat(check.moneyAvailable, '$0.000a')}/${ns.nFormat(check.moneyMax, '$0.000a')}`,
        `security=${check.hackDifficulty}/${check.minDifficulty}`,
    ].join(' | ')
    // tprint the message
    if (tprint) {
        ns.tprint(message)
    }

}