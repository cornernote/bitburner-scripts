import {getServers} from "./lib/Server";
import {detailView, listView} from "./lib/Helpers";

/**
 * @param {NS} ns
 */
export async function main(ns) {
    const servers = getServers(ns)
    ns.tprint(listView(servers.map(s => {
        return {
            hostname: `<a href="foo.js">${s.hostname}</a>`,
            serverGrowth: s.serverGrowth,
        }
    })))
    // ns.tprint(detailView(servers[0]))
}
