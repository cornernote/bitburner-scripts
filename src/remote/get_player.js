/**
 * Remote: Get Player
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog('ALL')

    const args = ns.flags([])
    const port = args['_'][0] || 1

    const player = ns.getPlayer()

    ns.writePort(port, JSON.stringify(player))
}