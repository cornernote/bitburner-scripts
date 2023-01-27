/**
 * Remote: Purchase Server
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog('ALL')

    const args = ns.flags([])
    const port = args['_'][0] || 1
    const hostname = args['_'][1]
    const ram = args['_'][2]

    const purchaseServer = ns.purchaseServer(hostname, ram)

    ns.writePort(port, JSON.stringify(purchaseServer))
}