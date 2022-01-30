import {getServers, SERVER} from "./lib/Server";

/**
 * Copies hacking scripts to all hacking servers
 *
 * @param {NS} ns
 */
export async function main(ns) {
    const servers = getServers(ns).filter(s => s.hasAdminRights)
    for (const server of servers) {
        await ns.scp(SERVER.hackScripts, server.hostname)
    }
}
