/**
 * Check a target
 * Wait for delay and then check the target.
 * @param {NS} ns
 */
export async function main(ns) {
    // ns.args = [
    //   0: target,
    //   1: delay,
    //   2: uuid,
    //   3: stock, (not used)
    //   4: tprint,
    //   5: host,
    //   6: threads,
    //   7: start,
    //   8: time,
    // ]
    const startTime = new Date().getTime()
    const start = performance.now()
    const target = /** @type string */ ns.args[0]
    const estDelay = ns.args.length > 1 ? ns.args[1] : 0
    const tprint = (ns.args.length > 4 && ns.args[4])
    const host = ns.args.length > 5 ? ns.args[5] : 'unknown'
    const threads = ns.args.length > 6 ? ns.args[6] : 'unknown'
    const estStart = ns.args.length > 7 ? ns.args[7] : 0
    const estTime = ns.args.length > 8 ? ns.args[8] : 0
    if (estDelay > 0) {
        await ns.sleep(estDelay)
    }
    const delay = performance.now() - start
    // get server info, cheaper than getServer
    const data = {
        moneyAvailable: ns.getServerMoneyAvailable(target),
        moneyMax: ns.getServerMaxMoney(target),
        hackDifficulty: ns.getServerSecurityLevel(target),
        minDifficulty: ns.getServerMinSecurityLevel(target),
    }
    const time = performance.now() - start - delay
    // write data to a port for stats collection
    await ns.writePort(1, JSON.stringify({
        type: 'check',
        data: data,
        // info
        target: target,
        host: host,
        threads: threads,
        // timer
        start: startTime,
        delay: delay,
        time: time,
        estStart: estStart,
        estDelay: estDelay,
        estTime: estTime,
    }))
    // build a message
    const status = data.hackDifficulty > data.minDifficulty + 1 || data.moneyAvailable < data.moneyMax * 0.9
        ? 'WARNING:'
        : 'INFO:'
    const message = [
        `${status} CHECK ${target}`,
        `money=${ns.nFormat(data.moneyAvailable, '$0.000a')}/${ns.nFormat(data.moneyMax, '$0.000a')}`,
        `security=${data.hackDifficulty}/${data.minDifficulty}`,
    ].join(' | ')
    // tprint the message
    if (tprint) {
        ns.tprint(message)
    }
}