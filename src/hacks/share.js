/**
 * Hacks: Share
 *
 * Share resources
 * Share a computer with your factions.
 *
 * @param {NS} ns
 */
export async function main(ns) {
    //args[0: finish]
    const finish = new Date(ns.args[0])

    let timer
    do {
        const start = new Date()
        await ns.share()
        timer = new Date().getTime() - start.getTime()
    } while (finish - timer > new Date())
}