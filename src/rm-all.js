/**
 * Removes all scripts on the network
 *
 * @param {NS} ns
 */
export async function main(ns) {

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

    // remove all scripts from all servers
    for (const server of servers) {
        for (const file of ns.ls(server)) {
            ns.rm(file, server)
        }
    }

}

