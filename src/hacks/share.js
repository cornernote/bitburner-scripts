/**
 * Share a computer with your factions.
 * @param {NS} ns
 */
export async function main(ns) {
    //args[0: loop]
    const loop = ns.args[0]
    for (let i = 0; i < loop; i++) {
        await ns.share()
    }
}