/**
 * Kills all running scripts on the network
 * Leaves runtime host until last (so that script doesn't kill itself)
 *
 * @param {NS} ns
 */
export async function main(ns) {
    let startingNode = ns.getHostname()

    // spider all servers
    const servers = []
    const spider = ['home']
    while (spider.length > 0) {
        const server = spider.pop()
        for (const scannedHostName of ns.scan(server)) {
            if (!servers.includes(scannedHostName)) {
                spider.push(scannedHostName)
            }
        }
        servers.push(server)
    }

    // Send the kill command to all servers
    for (const server of servers) {
        // skip if this host, we save it for last
        if (server === startingNode) {
            continue
        }
        // skip if not running anything
        if (!ns.ps(server).length) {
            continue
        }
        // kill all scripts
        ns.killall(server)
    }

    // idle for things to die
    for (const server of servers) {
        // skip if this host, we save it for last
        if (server === startingNode) {
            continue
        }
        // idle until they're dead, this is to avoid killing the cascade before it's finished.
        while (ns.ps(server).length) {
            await ns.sleep(20)
        }
    }

    // wait to kill these. This kills itself, obviously.
    ns.killall(startingNode)
}

