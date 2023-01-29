/**
 * Hacks: Hack
 *
 * Hack a target
 * Wait for delay and then execute a hack command.
 *
 * @param {NS} ns
 */
export async function main(ns) {
    // ns.args = [
    //   0: target,
    //   1: delay,
    //   2: uuid,
    //   3: stock,
    //   4: output,
    //   5: host,
    //   6: threads,
    //   7: start,
    //   8: time,
    // ]
    const startTime = new Date().getTime()
    // const start = performance.now()
    const target = /** @type string */ ns.args[0]
    const estDelay = ns.args.length > 1 ? ns.args[1] : 0
    const stock = (ns.args.length > 3 && ns.args[3])
    const output = (ns.args.length > 4 && ns.args[4])
    const host = ns.args.length > 5 ? ns.args[5] : 'unknown'
    const threads = ns.args.length > 6 ? ns.args[6] : 'unknown'
    const estStart = ns.args.length > 7 ? ns.args[7] : 0
    const estTime = ns.args.length > 8 ? ns.args[8] : 0
    // delay until estStart
    if (estStart - startTime - 1 > 0) {
        await ns.sleep(estStart - startTime - 1)
    }
    // delay
    if (estDelay > 0) {
        await ns.sleep(estDelay)
    }
    // const delay = performance.now() - start
    // hack()
    const data = {
        amount: await ns.hack(target, {stock: stock}),
    }
    // const time = performance.now() - start - delay
    // const finishTime = new Date().getTime()
    // // write data to a port for stats collection
    // await ns.writePort(20, JSON.stringify({
    //     type: 'hack',
    //     data: data,
    //     // info
    //     target: target,
    //     host: host,
    //     threads: threads,
    //     // timer
    //     start: startTime,
    //     delay: delay,
    //     time: time,
    //     finish: finishTime,
    //     estStart: estStart,
    //     estDelay: estDelay,
    //     estTime: estTime,
    //     estFinish: estStart + estDelay + estTime,
    // }))
    // build a message
    if (output) {
        const message = data.amount
            ? `INFO: HACK ${target} stole ${ns.nFormat(data.amount, '$0.0a')} money using ${threads} threads on ${host}!` // + JSON.stringify(ns.args)
            : `WARNING: HACK ${target} stole 0 money using ${threads} threads on ${host}!.` //+ JSON.stringify(ns.args)
        ns.tprint(message)
    }
}