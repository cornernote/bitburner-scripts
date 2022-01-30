import {scanAll} from "./lib/Server";

/**
 * Kills all running scripts on the network
 * Leaves runtime host until last (so that script doesn't kill itself)
 *
 * @param {NS} ns
 */
export async function main(ns) {
    const host = ns.getHostname()
    const servers = scanAll(ns)

    // Send the kill command to all servers
    for (const server of servers) {
        // skip if this host, we save it for last
        if (server === host) {
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
        if (server === host) {
            continue
        }
        // idle until they're dead, this is to avoid killing the cascade before it's finished.
        while (ns.ps(server).length) {
            await ns.sleep(20)
        }
    }

    // wait to kill these. This kills itself, obviously.
    ns.killall(host)
}
