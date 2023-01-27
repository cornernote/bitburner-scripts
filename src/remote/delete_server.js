/**
 * Remote: Delete Server
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog('ALL')

    const args = ns.flags([])
    const port = args['_'][0] || 1
    const hostname = args['_'][1]

    const deleteServer = ns.deleteServer(hostname)

    ns.writePort(port, JSON.stringify(deleteServer))
}