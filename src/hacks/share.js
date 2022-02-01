/**
 * Share a computer with your factions.
 * @param {NS} ns
 */
export async function main(ns) {
    //args[0: loop]
    const start = new Date().getTime()
    const loop = ns.args[0]
    const estDelay = ns.args.length > 1 ? ns.args[1] : 0
    if (estDelay > 0) {
        await ns.sleep(estDelay)
    }
    const delay = new Date().getTime() - start
    for (let i = 0; i < loop; i++) {
        await ns.share()
    }
    const time = new Date().getTime() + delay - start
}