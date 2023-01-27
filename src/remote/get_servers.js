/**
 * Remote: Get Servers
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog('ALL')

    const args = ns.flags([])
    const port = args['_'][0] || 1
    const homeReservedRam = args['_'][1] || 8
    const hostReservedRam = args['_'][2] || 4

    // scan the entire network
    const scans = []
    const spider = ['home']
    while (spider.length > 0) {
        const hostname = spider.pop()
        for (const scanned of ns.scan(hostname)) {
            if (!scans.includes(scanned)) {
                spider.push(scanned)
            }
        }
        scans.push(hostname)
    }

    // build a list of servers
    const servers = []
    for (const hostname of scans) {
        const server = ns.getServer(hostname)
        if (server.hostname === 'home') {
            server.ramUsed = Math.min(homeReservedRam + server.ramUsed, server.maxRam)
        }
        if (server.hostname === ns.getHostname()) {
            server.ramUsed = Math.min(hostReservedRam + server.ramUsed, server.maxRam)
        }
        servers.push(server)
    }

    ns.writePort(port, JSON.stringify(servers))
}



