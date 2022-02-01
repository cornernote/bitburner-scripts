/**
 * Share a computer with your factions.
 * @param {NS} ns
 */
export async function main(ns) {
    //args[0: loop]
    const startTime = new Date().getTime()
    const start = performance.now()
    const loop = ns.args[0]
    const estDelay = ns.args.length > 1 ? ns.args[1] : 0
    if (estDelay > 0) {
        await ns.sleep(estDelay)
    }
    const delay = performance.now() - start
    for (let i = 0; i < loop; i++) {
        await ns.share()
    }
    const time = performance.now() - start - delay
}